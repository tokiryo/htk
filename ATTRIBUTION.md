# 出典とライセンス

## ライセンスの区分

| 対象 | ライセンス |
|---|---|
| コード：`htk.py`、`docs/index.html`、`docs/app.js`、`docs/core.js`、`tests/` | MIT（`LICENSE`） |
| モデルデータ：`model/`、`docs/model.json`、`docs/operator.bin` | CC BY-SA 4.0（`LICENSE-DATA`） |
| 加工済みの四角形メッシュ：`meshes/*.obj` | CC BY-SA 4.0（`LICENSE-DATA`） |
| `docs/vendor/` の three.js 関連 | MIT（Copyright 2010-2024 Three.js Authors）。詳細は `docs/vendor/README.md` |

## 元データ

モデルは、Printables の **Mouse Shape Tester Megapack**（作者：Scout339、CC BY-SA）に含まれるマウスの形から作った数値です。
モデルデータは、その派生物として CC BY-SA 4.0 で配布します。利用するときは、この出典を示し、改変した場合は同じライセンスで公開してください。
個人・非商用に限られるデータは使っていません。マウスごとのスコア・誤差・元の形（元のメッシュ）は含みません。

`meshes/` の OBJ は、このモデルで各マウスを再現し、SubD の曲面から作った四角形メッシュです（Web GUI で保存できるものと同じ種類です）。元のメッシュそのものではありませんが、元のマウスの形から作ったものなので、モデルデータと同じく CC BY-SA 4.0 で配布します。

## 入力したマウス（内部名）

### 対称（21 体）

- 通常（12）：atlantis, atlantis_mini, bolt, model_o_pro, one_pro, op1we, sora, superlight, x2, xe, xm1r, zowie_s2
- 肉抜き（9）：aerox3, haste, hati_s, m42, mz1, pwnage_symm, pwnage_symm2, starlight_m, starlight_s

### エルゴ（11 体）

モデルに入っているのは左右対称な部分です（内部名は末尾に `_sym` がつきます）。

zowie_ec2, origin_one_x, deathadder_v3_pro, outset_ax, lamzu_thorn, xlite_v3, prime_wireless, prime_mini_wireless, zowie_ec3c, zowie_ec1, model_d

### 特殊な遺伝子（半エルゴ、3 体）

対称部分もモデルに入っていて、遺伝子としても使っています。

np01, np01s, u2

対称の 21 体と特殊な 3 体で、対称グループは 24 体です。

## 商標

上のマウス名は、各社の製品名・商標です。各社とは関係がありません。
