# HTK v1.1

ゲーミングマウスのシェイプの小さな統計モデルです。マウスの SubD ケージ（SP パッチの制御頂点、CV）を、数個のつまみ（軸）で作れます。numpy だけで動きます。（English: a small statistical shape model of gaming mice, as SubD-cage control vertices; numpy only.）

- 左右対称のマウスから、左右非対称（エルゴ）のマウスまでを、1本の軸 `t` でつなぎます。
- そのほかの形の違いを、20個の主成分 `z` で表します。
- 色々なマウスの左右対称成分や非対称成分を遺伝子として足せます。ハーフエルゴのNP-01,NP-01S,U2は特殊な遺伝子として扱っています。

## 使い方

```bash
python3 -m pip install numpy
python3 htk.py --t 0.5 --pc 1:+2 --pc 3:-1 --out mouse.json --obj mouse.obj
python3 htk.py --t 0 --gene np01 --out np01like.json
python3 htk.py --t 1 --gene-pc 1:+1 --out ergo.json
python3 htk.py --word height:+25 --word waist:-10 --out words.json      # 言葉の軸（-100〜+100、±50 が ±2 SD）
python3 htk.py --mouse sora:100 --mouse zowie_ec2:50:100 --auto-t --out mix.json   # マウスを重ねる（名前:形:左右）
```

```python
from htk import HTK
m = HTK()
cvs = m.cvs(t=0.5, z=[2, 0, -1])        # (386, 3) 全体（右半分 + 鏡像）、mm
cvs = m.cvs(t=0.0, gene='np01')         # 遺伝子を足す
m.write_obj(cvs, 'mouse.obj')           # 制御網（CV をつないだ四角形）
doc = m.document(cvs)                   # パッチごとの CV（JSON にできる）
cvs = m.stack_cvs(words={'height': 25}, mice=[dict(name='zowie_ec2', sym=100, asym=100)], t_auto=True)   # 言葉の軸とマウスの重ね
```

## Web GUI

`docs/` が静的なページです。つまみ（`t`・遺伝子・主成分20個）を動かすと、SubD の曲面がその場で変わります。CV の JSON と、曲面の OBJ を保存できます。

```bash
cd docs && python3 -m http.server 8000     # http://localhost:8000/
```

## 精度

作ったマウス1体を抜いて、そのマウスを再現したときの CV 誤差（RMS）です。

| グループ | 体数 | 中央値 | 最大 |
|---|---|---|---|
| 対称（ハーフエルゴの3体を含む） | 24 | 0.98 mm | 1.99 mm |
| 非対称（エルゴ） | 11 | 0.89 mm | 1.29 mm |

体数が少ないので、モデルの範囲外の形はうまく出ません。

## 出典とライセンス

元になったマウスは、Printables の Mouse Shape Tester Megapack（Scout339、CC BY-SA）のものだけです。個人・非商用に限られるデータは使っていません。

モデルデータは CC BY-SA 4.0（`LICENSE-DATA`）、コードは MIT（`LICENSE`）です。入力したマウスの一覧と出典は `ATTRIBUTION.md` に書いています。
