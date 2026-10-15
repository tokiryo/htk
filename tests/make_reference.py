"""Reference shapes for tests/test_core.mjs: python3 tests/make_reference.py <out.json>  (needs numpy)"""
import json
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from htk import HTK  # noqa: E402

m = HTK()
rng = np.random.default_rng(1)
cases = [(0.0, [], None), (1.0, [], 'model'), (0.4, list(rng.normal(size=20)), 'np01'), (-0.3, list(rng.normal(size=20) * 2), 'u2'),
         (1.2, [1.5, -2.0], 'np01s'), (0.5, [0.5] * 20, [1.0, -0.5, 0.25])]
out = [dict(t=t, z=[float(x) for x in z], gene=g, cvs=m.cvs(t, z, g).tolist()) for t, z, g in cases]
Path(sys.argv[1]).write_text(json.dumps(out))
