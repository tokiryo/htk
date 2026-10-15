"""HTK v1.1 — a small statistical shape model of gaming mice, as SubD-cage control vertices (CVs).

numpy only. Shape (right half, 193 CVs, mm, +Y is the front):

    shape(t, z) = mean_symm + t * axis + sum_i z_i * sigma_i * component_i

t = 0 is the symmetric mean, t = 1 the asymmetric (ergo) mean. z is in standard deviations (sigma units).
The mirrored left half and an optional half-ergo "gene" are added by `cvs`.

    python htk.py --t 0.5 --pc 1:+2 --pc 3:-1 --out mouse.json --obj mouse.obj
    python htk.py --t 0 --gene np01 --out np01like.json          # a named half-ergo gene (np01, np01s, u2)
    python htk.py --t 1 --gene-pc 1:+1 --out ergo.json           # the ergo gene model's own axes
"""
import argparse
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FLIP_ORDER = ('flipU', 'flipV', 'flipUV')


def _order(grid, flip):
    """CV index order of a patch (U fastest) read with U and/or V reversed."""
    nu, nv = grid[0] + 1, grid[1] + 1
    idx = np.arange(nu * nv).reshape(nv, nu)
    return {'flipU': idx[:, ::-1], 'flipV': idx[::-1, :], 'flipUV': idx[::-1, ::-1]}[flip].ravel()


class HTK:
    def __init__(self, model_dir=HERE / 'model'):
        d = Path(model_dir)
        self.info = json.loads((d / 'model.json').read_text())
        self.layout = json.loads((d / 'layout.json').read_text())
        self.mean_symm, self.axis = np.load(d / 'mean_symm.npy'), np.load(d / 'axis.npy')
        self.components, self.sigma = np.load(d / 'components.npy'), np.load(d / 'sigma.npy')
        self.centerline = np.load(d / 'centerline.npy')
        self.gene_mean, self.gene_components = np.load(d / 'gene_mean.npy'), np.load(d / 'gene_components.npy')
        self.gene_sigma = np.load(d / 'gene_sigma.npy')
        self.genes = {p.stem: np.load(p) for p in sorted((d / 'genes').glob('*.npy'))}
        self.patches = self.layout['patches']
        self.flips = {int(k): v for k, v in self.layout['mirror_flips'].items()}

    def half(self, t=0.0, z=()):
        """The right half, (193, 3). z: up to len(sigma) values in sigma units."""
        z = np.zeros(len(self.sigma)) if len(z) == 0 else np.pad(np.asarray(z, float), (0, len(self.sigma) - len(z)))
        cvs = self.mean_symm + t * self.axis + np.einsum('i,ijk->jk', z * self.sigma, self.components)
        cvs[self.centerline, 0] = 0.0
        return cvs

    def _split(self, half):
        o, out = 0, []
        for p in self.patches:
            n = (p['grid'][0] + 1) * (p['grid'][1] + 1)
            out.append(half[o:o + n])
            o += n
        return out

    def mirrored(self, half):
        """Sixteen patches: the eight of the right half and their mirror images, (386, 3)."""
        right = self._split(half)
        left = [(right[j - 8] * [-1, 1, 1])[_order(self.patches[j - 8]['grid'], self.flips[j])] for j in range(8, 16)]
        return np.concatenate(right + left)

    def gene(self, pcs=()):
        """The ergo gene model's shape (386, 3): mean + sum w_i sigma_i c_i on the first eight patches, mirror-antisymmetric
        on the other eight. pcs: up to len(gene_sigma) weights in sigma units."""
        w = np.zeros(len(self.gene_sigma)) if len(pcs) == 0 else np.pad(np.asarray(pcs, float), (0, len(self.gene_sigma) - len(pcs)))
        right = self._split(self.gene_mean + np.einsum('i,ijk->jk', w * self.gene_sigma, self.gene_components))
        left = [(right[j - 8] * [1, -1, -1])[_order(self.patches[j - 8]['grid'], self.flips[j])] for j in range(8, 16)]
        return np.concatenate(right + left)

    def cvs(self, t=0.0, z=(), gene=None, strength=1.0):
        """(386, 3) CVs of the whole cage. gene: None, a name of genes/*.npy, 'model' (the gene model's mean),
        a list of gene-model weights, or a (386, 3) array."""
        full = self.mirrored(self.half(t, z))
        if gene is None:
            return full
        if isinstance(gene, str):
            gene = self.gene() if gene == 'model' else self.genes[gene]
        elif not isinstance(gene, np.ndarray) or gene.ndim != 2:
            gene = self.gene(gene)
        return full + strength * np.asarray(gene)

    def document(self, cvs, name='htk'):
        """A moushroom-cvs-v1 style document: patches of {name, grid, cvs}, U fastest, mm."""
        patches, o = [], 0
        for k in range(16):
            p = self.patches[k % 8]
            n = (p['grid'][0] + 1) * (p['grid'][1] + 1)
            patches.append(dict(name=p['name'] + ('' if k < 8 else f'.m{k - 7}'), grid=p['grid'], cvs=cvs[o:o + n].tolist()))
            o += n
        return dict(schema='moushroom-cvs-v1', name=name, symmetry='free', weld_distance=self.layout['weld_distance'],
                    cv_count=len(cvs), patches=patches)

    def write_obj(self, cvs, path):
        """The control net as an OBJ (a quad per CV cell of each patch, U fastest). Face winding is not normalised."""
        lines, o = [], 0
        for k in range(16):
            g = self.patches[k % 8]['grid']
            nu, nv = g[0] + 1, g[1] + 1
            lines += [f'o patch{k}'] + [f'v {x:.5f} {y:.5f} {z:.5f}' for x, y, z in cvs[o:o + nu * nv]]
            lines += [f'f {o + j * nu + i + 1} {o + j * nu + i + 2} {o + (j + 1) * nu + i + 2} {o + (j + 1) * nu + i + 1}'
                      for j in range(nv - 1) for i in range(nu - 1)]
            o += nu * nv
        Path(path).write_text('\n'.join(lines) + '\n')


def _pairs(specs, limit, what):
    out = np.zeros(limit)
    for s in specs:
        i, v = s.split(':')
        if not 1 <= int(i) <= limit:
            raise SystemExit(f'{what} number must be 1..{limit}')
        out[int(i) - 1] = float(v)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--t', type=float, default=0.0, help='symmetric (0) to asymmetric (1) axis; outside 0..1 extrapolates')
    ap.add_argument('--pc', action='append', default=[], help='<number>:<sigma>, e.g. 1:+2 (repeatable)')
    ap.add_argument('--gene', help='np01, np01s, u2, or model (the ergo gene model mean)')
    ap.add_argument('--gene-pc', action='append', default=[], help='<number>:<sigma> on the ergo gene model')
    ap.add_argument('--strength', type=float, default=1.0, help='gene multiplier')
    ap.add_argument('--out', type=Path, help='CV JSON')
    ap.add_argument('--obj', type=Path, help='control net OBJ')
    a = ap.parse_args()
    m = HTK()
    z = _pairs(a.pc, len(m.sigma), 'pc')
    gene = a.gene
    if a.gene_pc:
        gene = _pairs(a.gene_pc, len(m.gene_sigma), 'gene-pc')
    cvs = m.cvs(a.t, z, gene, a.strength)
    if a.out:
        a.out.write_text(json.dumps(m.document(cvs, a.out.stem)) + '\n')
    if a.obj:
        m.write_obj(cvs, a.obj)
    print(f'{len(cvs)} CVs, x {cvs[:, 0].min():.1f}..{cvs[:, 0].max():.1f}, y {cvs[:, 1].min():.1f}..{cvs[:, 1].max():.1f}, '
          f'z {cvs[:, 2].min():.1f}..{cvs[:, 2].max():.1f} mm')


if __name__ == '__main__':
    main()
