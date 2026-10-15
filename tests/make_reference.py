"""Reference shapes for tests/test_core.mjs: python3 tests/make_reference.py <out.json>  (needs numpy)"""
import json
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from htk import HTK  # noqa: E402

m = HTK()
rng = np.random.default_rng(1)
cases = [dict(t=0.0), dict(t=1.0, gene='model'), dict(t=0.4, z=list(rng.normal(size=20)), gene='np01'),
         dict(t=-0.3, z=list(rng.normal(size=20) * 2), gene='u2'), dict(t=1.2, z=[1.5, -2.0], gene='np01s'),
         dict(t=0.5, z=[0.5] * 20, gene=[1.0, -0.5, 0.25]),
         # the stack: word axes, mouse scores (sym) and genes (asym)
         dict(words={'height': 40, 'waist': -25, 'length': 10}),
         dict(t=0.2, words={'flare': 60}, mice=[dict(name='sora', sym=100), dict(name='zowie_ec2', sym=50, asym=100)]),
         dict(mice=[dict(name='zowie_ec2', sym=100, asym=100), dict(name='model_d', sym=-40, asym=30), dict(name='np01', sym=100, asym=100)],
              tAuto=True),
         dict(t=0.7, z=[1.0, -1.0], words={'wall_angle_m': -80}, mice=[dict(name='u2', sym=60, asym=-50)], tAuto=True, gene='np01', strength=0.5)]
out = []
for c in cases:
    cvs = m.stack_cvs(c.get('t', 0.0), c.get('z', []), c.get('words'), c.get('mice', []), c.get('tAuto', False),
                      c.get('gene'), c.get('strength', 1.0))
    out.append(dict(c, cvs=cvs.tolist()))
Path(sys.argv[1]).write_text(json.dumps(out))
