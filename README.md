# ここで一句

写真や動画に一句を添えて、渋い作品に仕上げるスマホ向けウェブアプリ。ハッカソン（テーマ「渋い」）で作った。

句は AI（Claude）に詠ませることも、自分で詠むこともできる。仕上げでは、筆で1文字ずつ縦書きし、最後に落款を押す。

## できること

| 機能 | 内容 |
| --- | --- |
| 撮る・選ぶ | その場で写真や動画を撮るか、アルバムから選ぶ |
| AI が詠む | 喜怒哀楽と句の調子（渋い、侘び寂び、若者ことば、はしゃぎ口語）を選ぶと、写真を読み取って一句詠む。五七五はコードで数えて保証し、言葉を途中で切った句は AI の判定ではじく |
| 自分で詠む | 音を数える目盛り、季語の候補、写真から拾った言葉のヒントを見ながら詠む。仕上げた後に、AI の選者が渋さの点数、良いところ、直しどころ、添削案を返す |
| 仕上げ | 筆で書く演出、落款を押す瞬間の派手な演出と音、季節の演出（桜、花火、紅葉、雪、金箔）、筆の書体、画風、色紙の枠 |
| 保存 | 元の写真と同じ大きさの画像と、筆で書いていく動画。端末内のギャラリーにも残る |
| その他 | 俳句図鑑（季語と古典の名句）、世界の俳句（見本の投稿のみ） |

句は主役に重ならない場所へ自動で置き、ドラッグで動かせる。出力は元の画像と同じ大きさと縦横比のまま。

## 動かし方

Node.js 22 以上が必要。

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY を書く。空のままだと見本の句を返すモードで動く
npm run build
npm start              # http://localhost:8787
```

開発中は `npm run dev` で、画面（Vite、5173番）とサーバー（8787番）が同時に起動し、保存すると自動で反映される。

API キーは [Claude Console](https://console.anthropic.com/) で発行する。キーは `.env` にだけ書き、Git には載せない（`.gitignore` で除外済み）。

## スマホや他の PC から開く

サーバーを起動したまま、別のターミナルで次を実行する。

```bash
npm run tunnel
```

`https://〜.trycloudflare.com` という URL が表示されるので、それを開く。cloudflared が必要（Mac なら `brew install cloudflared`）。

この URL は一時的なもので、起動するたびに変わる。Mac のスリープや Wi-Fi の切り替えで切れたら、もう一度実行する。

`.env` の `APP_PASSCODE` に合言葉を書くと、最初に開いたときに合言葉を聞く。空なら誰でも使える。どちらの場合も、AI の呼び出しは接続元ごとに10分で20回までに制限している。

## 主な設定

`.env` で変えられる。

- `HAIKU_MODEL`: 既定は `claude-sonnet-5-5`。句の質を上げたいときは `claude-opus-5-5`
- `HAIKU_EFFORT`: 思考の深さ。既定は `low`。`medium` にすると質は上がるが遅くなる
- `MOCK=1`: API キーがあっても、見本の句を返すモードで動かす

## 構成

| 場所 | 役割 |
| --- | --- |
| `server/analyze.ts` | 句を詠む前の画像分析。主役、要素、場の空気、文体、演出、文字をかぶせてはいけない範囲 |
| `server/haiku.ts` | 候補を4つ詠ませ、音数と句の切れ目をコードで確かめ、自然さを AI に判定させて1句を選ぶ |
| `server/critique.ts` | 自分で詠んだ句の講評と添削案 |
| `server/mora.ts` | 読みから音数を数える。形態素解析は kuromoji |
| `server/guard.ts` | 合言葉と回数制限 |
| `src/lib/render.ts` | Canvas での作品描画。句の置き場所、色調、筆の動き、落款、画像と動画の書き出し |
| `src/lib/stamp.ts` | 落款を押す瞬間の演出 |
| `src/lib/effects.ts` | 季節の演出 |
| `src/lib/finish.ts` | 画風と質感の加工 |
| `src/lib/frame.ts` | 色紙の枠 |
| `src/lib/sound.ts` | 筆と落款の効果音（Web Audio で合成） |
| `src/components/SelfComposer.tsx` | 自分で詠む編集欄 |
| `src/screens/` | 各画面 |
| `scripts/` | 手元の Chrome で操作を流してスクリーンショットを撮る確認用スクリプトなど |

## 使っているもの

- 画面: React、Vite、TypeScript
- サーバー: Node.js、Express、Anthropic SDK
- 書体: Yuji Syuku、Yuji Boku、Yuji Mai、Potta One、Dela Gothic One、Kaisei Tokumin、Shippori Mincho（いずれも SIL Open Font License。npm の fontsource 経由）
- 図鑑の例句は、著作権の切れた古典から選んでいる。世界の俳句の投稿と俳号は架空のもの
