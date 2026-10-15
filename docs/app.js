// HTK v1.2 web GUI: sliders -> the model (core.js) -> the SubD surface, all in the browser.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Model, Operator, parseOperator, surfaceOBJ } from './core.js';

const $ = (id) => document.getElementById(id);
const state = { t: 0, tAuto: true, z: new Array(20).fill(0), words: {}, mice: [] };

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

let model, op, mesh, geometry, level = 4, current, imported = null;   // imported: CVs of a loaded file, shown until a control moves

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

let showT = () => {};

function update(l = 4) {
  if (l !== level) { level = l; geometry.dispose(); geometry = makeGeometry(l); mesh.geometry = geometry; }
  const auto = state.tAuto ? model.autoT(state.mice) : null;
  if (auto !== null) showT(auto);                           // the slider follows the mice
  current = imported || model.stackCvs({ t: state.t, z: state.z, words: state.words, mice: state.mice, tAuto: state.tAuto });
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
  imported = null;
  update(3);                                                 // fast while dragging
  clearTimeout(settle);
  settle = setTimeout(() => update(4), 150);
}

// ---- controls
// a range input and a number input kept in step. The number can be typed beyond the slider's range (to `wide`).
// onValue(v) sets the state; the shape is redrawn after it. Returns show(v), which only moves the two inputs.
function bind(range, num, wide, decimals, onValue) {
  const clamp = (v) => Math.min(wide[1], Math.max(wide[0], v));
  const show = (v) => { range.value = v; num.value = (+v).toFixed(decimals); };
  range.addEventListener('input', () => { num.value = (+range.value).toFixed(decimals); onValue(+range.value); change(); });
  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (Number.isFinite(v)) { range.value = clamp(v); onValue(clamp(v)); change(); }
  });
  num.addEventListener('change', () => { const v = parseFloat(num.value); show(Number.isFinite(v) ? clamp(v) : +range.value); });
  return show;
}

function slider(parent, label, min, max, step, value, onInput, wide = [min, max]) {
  const l = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value });
  const num = Object.assign(document.createElement('input'), { type: 'number', className: 'num', step, min: wide[0], max: wide[1] });
  l.append(label, input, num);
  parent.append(l);
  const set = bind(input, num, wide, step < 1 ? 2 : 0, onInput);
  set(value);
  return set;
}

const KIND = { symm: '対称', half: 'ハーフエルゴ', ergo: 'エルゴ' };

// a slider -limit .. +limit (double click: 0)
function weightSlider(parent, label, value, onInput, limit = 100) {
  const set = slider(parent, label, -limit, limit, 1, value, onInput, [-limit, limit]);
  const input = parent.lastElementChild.querySelector('input');
  input.addEventListener('dblclick', () => { set(0); onInput(0); change(); });
  return set;
}

function init() {
  showT = bind($('t'), $('t-o'), [-2, 3], 2, (v) => { state.t = v; state.tAuto = false; $('t-auto').checked = false; });
  const sT = showT;
  $('t-auto').addEventListener('change', () => { state.tAuto = $('t-auto').checked; change(); });
  const wordSetters = {};
  for (const [group, keys] of model.wordGroups) {
    const det = Object.assign(document.createElement('details'), { open: true });
    det.append(Object.assign(document.createElement('summary'), { textContent: group }));
    $('words').append(det);
    for (const k of keys) wordSetters[k] = weightSlider(det, model.words[k].label, 0, (v) => { state.words[k] = v; }, 50);
  }
  const add = $('mouse-add');
  const renderMice = () => {
    const box = $('mice');
    box.replaceChildren();
    for (const m of state.mice) {
      const info = model.mice[m.name], div = document.createElement('div'), head = document.createElement('div');
      div.className = 'mouse'; head.className = 'head';
      const name = Object.assign(document.createElement('span'), { textContent: info.label });
      name.append(Object.assign(document.createElement('small'), { textContent: KIND[info.kind] }));
      const rm = Object.assign(document.createElement('button'), { textContent: '外す', type: 'button' });
      rm.onclick = () => { state.mice = state.mice.filter((x) => x !== m); renderMice(); change(); };
      head.append(name, rm);
      div.append(head);
      box.append(div);
      weightSlider(div, '対称遺伝子', m.sym, (v) => { m.sym = v; });
      if (info.gene) weightSlider(div, '非対称遺伝子', m.asym, (v) => { m.asym = v; });
    }
    add.replaceChildren(new Option('遺伝子を追加…', ''));
    for (const kind of ['symm', 'half', 'ergo']) {
      const og = Object.assign(document.createElement('optgroup'), { label: KIND[kind] });
      for (const info of Object.values(model.mice)) {
        if (info.kind === kind && !state.mice.some((m) => m.name === info.name)) og.append(new Option(info.label, info.name));
      }
      if (og.children.length) add.append(og);
    }
  };
  add.addEventListener('change', () => {
    const info = model.mice[add.value];
    if (info) state.mice.push({ name: info.name, sym: 0, asym: 0 });
    renderMice(); change();
  });
  const pcSetters = state.z.map((_, i) => slider($('pcs'), `PC${i + 1}`, -3, 3, 0.05, 0, (v) => { state.z[i] = v; }, [-6, 6]));
  const sync = () => {
    sT(state.t); $('t-auto').checked = state.tAuto; renderMice();
    Object.entries(wordSetters).forEach(([k, set]) => set(state.words[k] || 0));
    pcSetters.forEach((s, i) => s(state.z[i]));
    update(4);
  };
  $('reset').onclick = () => { Object.assign(state, { t: 0, tAuto: true, words: {}, mice: [], z: state.z.map(() => 0) }); sync(); };
  $('random').onclick = () => {
    const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += Math.random(); return (s - 3) * Math.SQRT2; };   // ~N(0, 1)
    state.z = state.z.map(() => Math.max(-3, Math.min(3, g())));
    state.t = Math.random(); sync();
  };
  const save = (name, text, type) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    a.click(); URL.revokeObjectURL(a.href);
  };
  // the saved file is the CV document plus the stack that made it, so loading it brings the sliders back
  $('save-json').onclick = () => {
    const doc = model.document(current);
    if (!imported) doc.htk = { t: state.t, tAuto: state.tAuto, z: state.z, words: state.words, mice: state.mice };
    save('htk.json', JSON.stringify(doc) + '\n', 'application/json');
  };
  $('load-json').onclick = () => $('file-json').click();
  $('file-json').addEventListener('change', async () => {
    const file = $('file-json').files[0];
    $('file-json').value = '';
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (d.htk) {                                           // a file saved here: the stack comes back
        const h = d.htk;
        if (h.mice.some((m) => !model.mice[m.name]) || Object.keys(h.words).some((k) => !model.words[k])) throw new Error('知らない軸かマウスが入っています');
        Object.assign(state, { t: h.t, tAuto: h.tAuto, z: model.sigma.map((_, i) => h.z[i] || 0), words: h.words, mice: h.mice });
        imported = null;
        sync();
      } else {                                               // any CV document: shown as it is
        imported = model.fromDocument(d);
        update(4);
      }
    } catch (e) {
      $('info').textContent = `読み込めませんでした：${e.message}`;
    }
  });
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
  init();
  resize();
  frame('iso');
  $('loading').remove();
  (function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
})().catch((e) => { $('loading').textContent = `読み込めませんでした：${e.message}`; });
