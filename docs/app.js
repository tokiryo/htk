// HTK v1.1 web GUI: sliders -> the model (core.js) -> the SubD surface, all in the browser.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Model, Operator, parseOperator, surfaceOBJ } from './core.js';

const $ = (id) => document.getElementById(id);
const state = { t: 0, z: new Array(20).fill(0), gene: '', strength: 1, geneZ: new Array(7).fill(0) };

// ---- scene (Z up, the front of the mouse is +Y, the floor is z = 0)
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2c31);
const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x555560, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-120, -160, 260);
scene.add(key);
const grid = new THREE.GridHelper(300, 30, 0x55575e, 0x3a3b40);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const shaded = new THREE.MeshStandardMaterial({ color: 0xc9ccd6, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
const zebra = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying vec3 vP;
    void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vP = p.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * p; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vP;
    void main() { vec3 r = reflect(normalize(vP), normalize(vN)); float s = step(0.5, fract(r.y * 7.0 + 0.5));
      gl_FragColor = vec4(mix(vec3(0.05), vec3(0.42, 0.45, 0.70), s), 1.0); }`,
  side: THREE.DoubleSide,
});

let model, op, mesh, geometry, level = 4, current;

function resize() {
  renderer.setSize(view.clientWidth, view.clientHeight);
  camera.aspect = view.clientWidth / view.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function frame(dir) {
  const target = new THREE.Vector3(0, 0, 14), d = { iso: [-1, -1.4, 0.9], left: [-1, 0, 0.05], top: [0, -0.001, 1], front: [0, 1, 0.05], rear: [0, -1, 0.05] }[dir];
  camera.position.copy(target).addScaledVector(new THREE.Vector3(...d).normalize(), 320);
  controls.target.copy(target);
  controls.update();
}

function makeGeometry(l) {
  const L = op.level(l), f = L.faces, tri = new Uint32Array((f.length / 4) * 6);
  for (let q = 0, t = 0; q < f.length; q += 4) {
    tri.set([f[q], f[q + 1], f[q + 2], f[q], f[q + 2], f[q + 3]], t);
    t += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(tri, 1));
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * L.nVerts), 3));
  return g;
}

function geneArgument() {
  if (!state.gene) return null;
  return state.gene === 'pcs' ? state.geneZ : state.gene;
}

function update(l = 4) {
  if (l !== level) { level = l; geometry.dispose(); geometry = makeGeometry(l); mesh.geometry = geometry; }
  current = model.cvs(state.t, state.z, geneArgument(), state.strength);
  const attr = geometry.getAttribute('position');
  op.surface(current, level, attr.array);
  attr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const s = geometry.boundingBox.getSize(new THREE.Vector3());
  $('info').textContent = `長さ ${s.y.toFixed(1)} × 幅 ${s.x.toFixed(1)} × 高さ ${s.z.toFixed(1)} mm`;
}

let settle = 0;
function change() {
  update(3);                                                 // fast while dragging
  clearTimeout(settle);
  settle = setTimeout(() => update(4), 150);
}

// ---- controls
function slider(parent, label, min, max, step, value, onInput, fmt = (v) => v.toFixed(2)) {
  const l = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value });
  const out = document.createElement('output');
  l.append(label, input, out);
  parent.append(l);
  const set = (v) => { input.value = v; out.textContent = fmt(+v); };
  input.addEventListener('input', () => { set(input.value); onInput(+input.value); change(); });
  set(value);
  return set;
}

function init() {
  const sT = (v) => { $('t').value = v; $('t-o').textContent = (+v).toFixed(2); };
  $('t').addEventListener('input', () => { state.t = +$('t').value; sT(state.t); change(); });
  $('strength').addEventListener('input', () => { state.strength = +$('strength').value; $('strength-o').textContent = state.strength.toFixed(2); change(); });
  $('gene').addEventListener('change', () => { state.gene = $('gene').value; $('gene-pcs').hidden = state.gene !== 'pcs'; change(); });
  const pcSetters = state.z.map((_, i) => slider($('pcs'), `PC${i + 1}`, -3, 3, 0.05, 0, (v) => { state.z[i] = v; }));
  const geneSetters = state.geneZ.map((_, i) => slider($('gene-pcs'), `G${i + 1}`, -3, 3, 0.05, 0, (v) => { state.geneZ[i] = v; }));
  $('gene-pcs').hidden = true;
  const sync = () => {
    sT(state.t); $('strength').value = state.strength; $('strength-o').textContent = state.strength.toFixed(2);
    $('gene').value = state.gene; $('gene-pcs').hidden = state.gene !== 'pcs';
    pcSetters.forEach((s, i) => s(state.z[i])); geneSetters.forEach((s, i) => s(state.geneZ[i]));
    update(4);
  };
  $('reset').onclick = () => { Object.assign(state, { t: 0, z: state.z.map(() => 0), gene: '', strength: 1, geneZ: state.geneZ.map(() => 0) }); sync(); };
  $('random').onclick = () => {
    const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += Math.random(); return (s - 3) * Math.SQRT2; };   // ~N(0, 1)
    state.z = state.z.map(() => Math.max(-3, Math.min(3, g())));
    state.t = Math.random(); sync();
  };
  const save = (name, text, type) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('save-json').onclick = () => save('htk.json', JSON.stringify(model.document(current)) + '\n', 'application/json');
  $('save-obj').onclick = () => {
    const l = op.level(4);
    save('htk_surface.obj', surfaceOBJ(op.surface(current, 4), l.faces), 'text/plain');
  };
  document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-cam]').forEach((x) => x.classList.toggle('on', x === b));
    frame(b.dataset.cam);
  }));
  $('wire').onclick = () => { shaded.wireframe = !shaded.wireframe; $('wire').classList.toggle('on', shaded.wireframe); };
  $('zebra').onclick = () => { const on = mesh.material === shaded; mesh.material = on ? zebra : shaded; $('zebra').classList.toggle('on', on); };
  sync();
}

(async () => {
  const [d, buf] = await Promise.all([fetch('model.json').then((r) => r.json()), fetch('operator.bin').then((r) => r.arrayBuffer())]);
  model = new Model(d);
  op = new Operator(parseOperator(buf));
  geometry = makeGeometry(4);
  mesh = new THREE.Mesh(geometry, shaded);
  scene.add(mesh);
  const i = d.info, e = i.leave_one_out_cv_rms;
  $('about').textContent = `${i.sample_count.symmetric} 体（対称）と ${i.sample_count.asymmetric} 体（エルゴ）から作ったモデル。主成分 ${i.component_count} 個で分散の ${(i.cumulative_variance * 100).toFixed(0)}%。` +
    ` 1体抜きの再現誤差（CV の RMS、中央値）：対称 ${e.symmetric.median_mm} mm、エルゴ ${e.asymmetric.median_mm} mm。`;
  init();
  resize();
  frame('iso');
  $('loading').remove();
  (function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
})().catch((e) => { $('loading').textContent = `読み込めませんでした：${e.message}`; });
