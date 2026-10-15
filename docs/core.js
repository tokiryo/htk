// HTK v1.1 core (no DOM, no three.js): the shape model and the CV -> SubD surface operator. Same maths as htk.py.
//   half(t, z)  = mean_symm + t axis + sum z_i sigma_i component_i      right half, 193 CVs
//   cvs(...)    = the 386 CVs of the whole cage (+ a gene)
//   surface     = S (Mx cv_x, Myz cv_y, Myz cv_z)                       SubD level 3 or 4 (Bezier patches, welded)

export function parseOperator(buffer) {
  const n = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, n)));
  const arrays = {};
  for (const [key, h] of Object.entries(header)) {
    if (!h || h.offset === undefined) continue;
    const Type = h.dtype === 'f32' ? Float32Array : Int32Array;
    arrays[key] = new Type(buffer, 4 + n + h.offset, h.length);
  }
  return { header, arrays };
}

function csrMul(indptr, indices, data, x, out) {
  for (let r = 0; r < indptr.length - 1; r++) {
    let s = 0;
    for (let k = indptr[r]; k < indptr[r + 1]; k++) s += data[k] * x[indices[k]];
    out[r] = s;
  }
  return out;
}

export class Operator {
  constructor({ header, arrays }) {
    this.a = arrays;
    this.nCv = header.grids.reduce((s, [u, v]) => s + (u + 1) * (v + 1), 0);
    this.cage = [0, 1, 2].map(() => new Float64Array(arrays.mx_indptr.length - 1));
  }

  level(l) {
    const a = this.a;
    return { indptr: a[`s${l}_indptr`], indices: a[`s${l}_indices`], data: a[`s${l}_data`], faces: a[`faces${l}`],
             nVerts: a[`s${l}_indptr`].length - 1 };
  }

  // cvs: flat [x0, y0, z0, x1, ...] of the 386 CVs -> surface positions (Float32Array, written into `out` if given)
  surface(cvs, l = 4, out = null) {
    const L = this.level(l), a = this.a, n = this.nCv;
    const c = [0, 1, 2].map((k) => { const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = cvs[3 * i + k]; return v; });
    csrMul(a.mx_indptr, a.mx_indices, a.mx_data, c[0], this.cage[0]);
    csrMul(a.myz_indptr, a.myz_indices, a.myz_data, c[1], this.cage[1]);
    csrMul(a.myz_indptr, a.myz_indices, a.myz_data, c[2], this.cage[2]);
    const pos = out || new Float32Array(3 * L.nVerts), tmp = new Float64Array(L.nVerts);
    for (let k = 0; k < 3; k++) {
      csrMul(L.indptr, L.indices, L.data, this.cage[k], tmp);
      for (let v = 0; v < L.nVerts; v++) pos[3 * v + k] = tmp[v];
    }
    return pos;
  }
}

// CV index order of a patch (U fastest) read with U and/or V reversed
function order(grid, flip) {
  const nu = grid[0] + 1, nv = grid[1] + 1, out = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const jj = flip === 'flipV' || flip === 'flipUV' ? nv - 1 - j : j;
    const ii = flip === 'flipU' || flip === 'flipUV' ? nu - 1 - i : i;
    out.push(jj * nu + ii);
  }
  return out;
}

export class Model {
  constructor(d) {
    this.d = d;
    this.sigma = d.sigma;
    this.geneSigma = d.gene_sigma;
    this.patches = d.layout.patches;
    this.flat = (a) => Float64Array.from(a.flat());
    this.mean = this.flat(d.mean_symm); this.axis = this.flat(d.axis);
    this.comps = d.components.map(this.flat); this.geneMean = this.flat(d.gene_mean);
    this.geneComps = d.gene_components.map(this.flat);
    this.genes = Object.fromEntries(Object.entries(d.genes).map(([k, v]) => [k, this.flat(v)]));
    this.starts = [];
    let o = 0;
    for (const p of this.patches) { this.starts.push(o); o += (p.grid[0] + 1) * (p.grid[1] + 1); }
    this.orders = this.patches.map((p, k) => order(p.grid, d.layout.mirror_flips[String(k + 8)]));
  }

  // right half (193 x 3, flat). z: sigma units, any length up to the component count
  half(t, z = []) {
    const out = new Float64Array(this.mean.length);
    for (let i = 0; i < out.length; i++) out[i] = this.mean[i] + t * this.axis[i];
    z.forEach((w, k) => { if (w) { const s = w * this.sigma[k], c = this.comps[k]; for (let i = 0; i < out.length; i++) out[i] += s * c[i]; } });
    this.d.centerline.forEach((on, k) => { if (on) out[3 * k] = 0; });
    return out;
  }

  // sign: [-1, 1, 1] mirrors the shape, [1, -1, -1] makes the antisymmetric gene
  mirrored(half, sign) {
    const out = new Float64Array(2 * half.length);
    out.set(half);
    this.patches.forEach((p, k) => {
      const n = (p.grid[0] + 1) * (p.grid[1] + 1), src = this.starts[k], dst = half.length + 3 * src, ord = this.orders[k];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[dst + 3 * i + c] = half[3 * (src + ord[i]) + c] * sign[c];
    });
    return out;
  }

  gene(w = []) {
    const g = Float64Array.from(this.geneMean);
    w.forEach((x, k) => { if (x) { const s = x * this.geneSigma[k], c = this.geneComps[k]; for (let i = 0; i < g.length; i++) g[i] += s * c[i]; } });
    return this.mirrored(g, [1, -1, -1]);
  }

  // gene: null | a name in this.genes | 'model' (the gene model mean) | an array of gene-model weights
  cvs(t, z, gene = null, strength = 1) {
    const full = this.mirrored(this.half(t, z), [-1, 1, 1]);
    if (gene === null || strength === 0) return full;
    const g = typeof gene === 'string' ? (gene === 'model' ? this.gene() : this.genes[gene]) : this.gene(gene);
    for (let i = 0; i < full.length; i++) full[i] += strength * g[i];
    return full;
  }

  document(cvs, name = 'htk') {
    const patches = [];
    for (let k = 0; k < 16; k++) {
      const p = this.patches[k % 8], n = (p.grid[0] + 1) * (p.grid[1] + 1), off = 3 * this.starts[k % 8] + (k < 8 ? 0 : cvs.length / 2);
      const rows = [];
      for (let i = 0; i < n; i++) rows.push([cvs[off + 3 * i], cvs[off + 3 * i + 1], cvs[off + 3 * i + 2]]);
      patches.push({ name: p.name + (k < 8 ? '' : `.m${k - 7}`), grid: p.grid, cvs: rows });
    }
    return { schema: 'moushroom-cvs-v1', name, symmetry: 'free', weld_distance: this.d.layout.weld_distance,
             cv_count: cvs.length / 3, patches };
  }
}

export function surfaceOBJ(positions, faces) {
  const lines = ['o htk'];
  for (let i = 0; i < positions.length; i += 3) lines.push(`v ${positions[i].toFixed(4)} ${positions[i + 1].toFixed(4)} ${positions[i + 2].toFixed(4)}`);
  for (let i = 0; i < faces.length; i += 4) lines.push(`f ${faces[i] + 1} ${faces[i + 1] + 1} ${faces[i + 2] + 1} ${faces[i + 3] + 1}`);
  return lines.join('\n') + '\n';
}
