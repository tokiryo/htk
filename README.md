# HTK v1.1

ゲーミングマウスの形の小さな統計モデルです。マウスの SubD ケージ（SP パッチの制御頂点、CV）を、数個のつまみ（軸）で作れます。numpy だけで動きます。（English: a small statistical shape model of gaming mice, as SubD-cage control vertices; numpy only.）

- 左右対称のマウスから、左右非対称（エルゴ）のマウスまでを、1本の軸 `t` でつなぎます。
- そのほかの形の違いを、20個の主成分 `z` で表します。
- 左右非対称なマウスの「ずれ」を、遺伝子（gene）として足せます。NP-01、NP-01S、Zowie U2 の3つは、そのまま足せます。

## 使い方

```bash
python3 -m pip install numpy
python3 htk.py --t 0.5 --pc 1:+2 --pc 3:-1 --out mouse.json --obj mouse.obj
python3 htk.py --t 0 --gene np01 --out np01like.json
python3 htk.py --t 1 --gene-pc 1:+1 --out ergo.json
```

```python
from htk import HTK
m = HTK()
cvs = m.cvs(t=0.5, z=[2, 0, -1])        # (386, 3) 全体（右半分 + 鏡像）、mm
cvs = m.cvs(t=0.0, gene='np01')         # 遺伝子を足す
m.write_obj(cvs, 'mouse.obj')           # 制御網（CV をつないだ四角形）
doc = m.document(cvs)                   # パッチごとの CV（JSON にできる）
```

## 形の式

右半分の 193 個の CV について、

```
shape(t, z) = mean_symm + t * axis + Σ z_i * σ_i * component_i
```

- `t = 0`：対称マウスの平均。`t = 1`：非対称（エルゴ）マウスの平均。範囲の外は外挿になります。
- `z_i`：標準偏差（σ）の倍数。20個あります。
- `axis = mean_asym - mean_symm`。`component` は、この軸の成分を除いたうえでの主成分です。
- 左半分は、右半分の X を反転して作ります（`HTK.mirrored`）。中心線上の CV は X = 0 に固定されます。
- 遺伝子：左右に 386 点ぶんのずれを足します。`genes/` の3つは1体分そのもの、遺伝子モデル（`--gene-pc`）はエルゴ11体の遺伝子の主成分（7個）です。

## 座標・並び

- 単位は mm。前が +Y。
- 8パッチ。CV の並びは U が速い順で、`(grid[0]+1) × (grid[1]+1)` 個です。パッチ名と `grid` は `model/layout.json` にあります。
- パッチ 8〜15 は、パッチ 0〜7 の鏡像です。読む順番は `layout.json` の `mirror_flips` に書いてあります。

## 精度

作ったマウス1体を抜いて、そのマウスを再現したときの CV 誤差（RMS）です。

| グループ | 体数 | 中央値 | 最大 |
|---|---|---|---|
| 対称 | 24 | 0.98 mm | 1.99 mm |
| 非対称（エルゴ） | 11 | 0.89 mm | 1.29 mm |

体数が少ないので、モデルの範囲外の形はうまく出ません。主成分を増やしても1体抜きの精度はほとんど良くならないため、20個にしています。

## 出典とライセンス

元になったマウスは、Printables の Mouse Shape Tester Megapack（Scout339、CC BY-SA）のものだけです。個人・非商用に限られるデータは使っていません。

> TODO：個々のマウスの出典、モデルデータのライセンス（CC BY-SA 4.0 の予定）、コードのライセンスは、`ATTRIBUTION.md` と `LICENSE` に書きます。（公開前に確定する）

## 再現

このリポジトリの `model/` は、非公開の研究リポジトリ（moushroom）の `registry/hiratake/lite-v1.1` と `registry/naratake/asym-gene-lite-v1` から、`tools/export_htk.py` で書き出したものです。マウスごとのスコア・誤差・元の形は含まれていません。
