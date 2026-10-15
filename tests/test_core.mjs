// docs/core.js against htk.py: node tests/test_core.mjs <reference.json>
// reference.json: [{t, z, gene, cvs: [[x,y,z]...386]}] written by tests/make_reference.py
import fs from 'node:fs';
import { Model, Operator, parseOperator } from '../docs/core.js';

const model = new Model(JSON.parse(fs.readFileSync(new URL('../docs/model.json', import.meta.url))));
const ref = JSON.parse(fs.readFileSync(process.argv[2]));
let worst = 0;
for (const r of ref) {
  const got = model.cvs(r.t, r.z, r.gene);
  r.cvs.flat().forEach((v, i) => { worst = Math.max(worst, Math.abs(v - got[i])); });
}
if (worst > 1e-4) throw new Error(`core.js differs from htk.py by ${worst} mm`);   // model.json is rounded to 1e-6
const buf = fs.readFileSync(new URL('../docs/operator.bin', import.meta.url));
const op = new Operator(parseOperator(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)));
const s = op.surface(model.cvs(0.3, [1, -1], 'np01'), 4);
const xs = []; for (let i = 0; i < s.length; i += 3) xs.push(s[i]);
console.log(`ok: ${ref.length} shapes, max |diff| ${worst.toExponential(2)} mm; surface ${s.length / 3} vertices, x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)}`);
