"""Words, mice and genes for HTK, from the research repository (read only).

    python3 tools/export_gui_data.py <moushroom root> [--env lite-e2]

Reads <root>/registry/env/<env>.json and the files it names (Hiratake scores, word axes, genes), checks that the
model in this repository is the same Hiratake, and writes
    model/words.json        14 word axes: label, group, sd, direction (t and 20 z, in sigma units)
    model/mice.json         35 mice: label, kind, t (as a deviation from its group's mean), z (sigma units), gene
    model/genes/<name>.npy  the half-ergo gene (386, 3) of every ergo and half-ergo mouse (14)
    docs/model.json         everything the browser needs (rebuilt from model/, rounded to 1e-6)
Nothing is written under <moushroom root>.
"""
import argparse
import ast
import csv
import json
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parents[1]
MODEL = HERE / 'model'

LABELS = {   # not in the scanned list: ergo and half-ergo mice (gui/adjust.py LABELS)
    'zowie_ec1': 'Zowie EC1', 'zowie_ec2': 'Zowie EC2', 'zowie_ec3c': 'Zowie EC3-C',
    'deathadder_v3_pro': 'Razer DeathAdder V3 Pro', 'lamzu_thorn': 'Lamzu Thorn', 'model_d': 'Glorious Model D',
    'origin_one_x': 'Ninjutso Origin One X', 'outset_ax': 'Vaxee Outset AX', 'xlite_v3': 'Pulsar Xlite V3',
    'prime_wireless': 'SteelSeries Prime Wireless', 'prime_mini_wireless': 'SteelSeries Prime Mini Wireless',
    'np01': 'Vaxee NP-01', 'np01s': 'Vaxee NP-01S', 'u2': 'Zowie U2',
}


def product_labels(root):
    """PRODUCT_LABELS of gui/server.py: read as text, the module is not imported."""
    text = (root / 'gui/server.py').read_text()
    block = text[text.index('PRODUCT_LABELS = {'):]
    block = block[:block.index('\n}')]
    return dict(re.findall(r"'([a-z0-9_]+)':\s*'([^']+)'", block))


def measure_labels(root):
    """MEASURES of common/shape_words.py: key -> the Japanese label that is read (parsed, not imported)."""
    tree = ast.parse((root / 'common/shape_words.py').read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], 'id', '') == 'MEASURES':
            return {e.elts[0].value: e.elts[1].value for e in node.value.elts}
    raise SystemExit('MEASURES not found')


def gene_array(path):
    g = json.loads(path.read_text())
    return np.array([c for p in g['patches'] for c in np.ravel(p['gene']).tolist()], float).reshape(-1, 3), g['flips']


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('root', type=Path)
    ap.add_argument('--env', default='lite-e2')
    a = ap.parse_args()
    root = a.root
    env = json.loads((root / 'registry/env' / f'{a.env}.json').read_text())
    hdir = root / env['hiratake']
    layout = json.loads((MODEL / 'layout.json').read_text())
    for name in ('mean_symm', 'axis', 'components', 'sigma'):
        mine, theirs = np.load(MODEL / f'{name}.npy'), np.load(hdir / f'{name}.npy')
        if mine.shape != theirs.shape or np.abs(mine - theirs).max() > 1e-9:
            raise SystemExit(f'model/{name}.npy is not {hdir.name}/{name}.npy')
    sigma = np.load(MODEL / 'sigma.npy')

    # word axes
    axes = json.loads((root / env['word_axes']).read_text())
    names = measure_labels(root)
    group_of = {k: g['label'] if isinstance(g, dict) else g[0] for g in axes['groups'] for k in
                (g['keys'] if isinstance(g, dict) else g[1])}
    words = dict(source=Path(env['word_axes']).stem, hold_t=axes['hold_t'],
                 note='a slider value v (-100..100) adds v / 25 * sd * direction to (t, z1..z20); +-50 is +-2 SD of the real mice',
                 groups=axes['groups'],
                 axes=[dict(key=k, label=names.get(k, v['label']), sd=v['sd'], direction=v['direction'],
                            loo_r2=round(v['loo_r2'], 3)) for k, v in axes['axes'].items()])
    assert all(len(w['direction']) == len(sigma) + 1 for w in words['axes'])

    # mice: score (t, z) as a deviation from the group's mean, and the gene of the ergo and half-ergo mice
    genes = {}
    for g in env['genes']:
        stem = Path(g).stem
        name = re.sub(r'@r\d+$', '', stem)
        genes[name] = root / g
    labels = {**product_labels(root), **LABELS}
    mice, flips = [], set()
    for row in csv.DictReader(open(hdir / 'scores.csv')):
        ergo = row['group'].startswith('asym')
        name = row['name'].removesuffix('_sym')
        has_gene = name in genes and (ergo or name != row['name'])
        z = np.array([float(row[f'pc{i + 1}']) for i in range(len(sigma))]) / sigma
        mice.append(dict(name=name, label=labels.get(name, name), kind='ergo' if ergo else 'half' if has_gene else 'symm',
                         t=round(float(row['t']) - ergo, 6), z=[round(float(v), 6) for v in z], gene=has_gene))
        if has_gene:
            arr, f = gene_array(genes.pop(name))
            flips.add(json.dumps(f, sort_keys=True))
            np.save(MODEL / 'genes' / f'{name}.npy', arr)
    assert not genes, f'genes without a score row: {sorted(genes)}'
    assert flips == {json.dumps(layout['mirror_flips'], sort_keys=True)}, 'a gene mirrors differently from the model'
    (MODEL / 'words.json').write_text(json.dumps(words, ensure_ascii=False, indent=1) + '\n')
    (MODEL / 'mice.json').write_text(json.dumps(mice, ensure_ascii=False, indent=1) + '\n')

    # the browser's single file
    r = lambda x: np.round(np.asarray(x, float), 6).tolist()  # noqa: E731
    doc = dict(info=json.loads((MODEL / 'model.json').read_text()), layout=layout,
               **{k: r(np.load(MODEL / f'{k}.npy')) for k in ('mean_symm', 'axis', 'components', 'sigma')},
               centerline=np.load(MODEL / 'centerline.npy').astype(bool).tolist(),
               **{k: r(np.load(MODEL / f'{k}.npy')) for k in ('gene_mean', 'gene_components', 'gene_sigma')},
               genes={p.stem: r(np.load(p)) for p in sorted((MODEL / 'genes').glob('*.npy'))},
               words=words, mice=mice)
    (HERE / 'docs/model.json').write_text(json.dumps(doc, separators=(',', ':')) + '\n')
    print(f"{len(words['axes'])} word axes, {len(mice)} mice ({sum(m['gene'] for m in mice)} with a gene)")


if __name__ == '__main__':
    main()
