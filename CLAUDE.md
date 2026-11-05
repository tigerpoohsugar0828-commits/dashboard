# プロジェクト文脈（Claude Code 用）

## これは何か
Googleスプレッドシートを読み込む**単一HTMLのKPIダッシュボード**。`index.html` にHTML/CSS/JSをすべて内包している。ビルド工程・依存パッケージ・バックエンドは無い。

## 構造
- すべてのコードは `index.html` の1ファイル。
  - `<style>` … デザイン（CSSトークンは `:root` に定義。Noto Sans JP、ミュートしたフラットな配色）。
  - `<body>` … 画面マークアップ。
  - 末尾の `<script>` … データ取得（PapaParse + Google Sheets API）・集計・Chart.js描画・画面制御。
- 外部ライブラリはCDN読み込み（npm依存なし）。

## 重要な実装ポイント
- **APIキーはコードに埋め込まない。** `EMBEDDED_API_KEY` は空文字。利用者が初回に入力し、`localStorage`（キー `starter_dash_apikey_v1`）に保存。
- 接続先シートは `DEFAULT_CATS` 定数で定義。利用者の保存設定（localStorage `starter_dash_cats_v1`）があればそちらを優先。
- フェーズ定義は `KGI_KPI_PHASES`（準備期間 / フェーズ1〜4 / 卒業）。各フェーズで表示するKPIが異なる。
- フェーズバナーの描画は `_renderKPIPhaseBanner(gradYM)`。全フェーズ共通の白基調デザイン（濃紺ヒーローカード＋白サブカード＋ステータス凡例＋進捗バー）。

## 作業時の注意
- `localStorage` の値（特に `starter_dash_*`）を勝手に消さない。利用者の設定が入っている。
- 大きな1ファイルなので、編集は該当箇所をピンポイントで。
- 動作確認は `index.html` をブラウザで開き、初回にAPIキーを入力する（または `EMBEDDED_API_KEY` に一時的にキーを入れる）。

## デプロイ
静的ホスティング（Netlify等）に `index.html` を置くだけ。ビルド不要。
