# AWS デプロイ手順

このダッシュボードは **単一の静的HTML（`index.html`）** です。ビルド工程・サーバー・データベースは不要で、AWSの静的ホスティングにそのまま載せられます。データの取得・集計・描画はすべて閲覧者のブラウザ内で完結します（バックエンド不要）。

AWSでの代表的な方法は3つ。**おすすめは A（Amplify）** です。

---

## A. AWS Amplify Hosting（おすすめ・GitHub連携）

GitHubリポジトリと連携し、push するだけで自動デプロイ。HTTPS込み・ビルド不要。

1. AWSコンソール → **Amplify** → 「Host web app」。
2. GitHub を選び、このリポジトリ（`tigerpoohsugar0828-commits/dashboard`）と `main` ブランチを接続。
3. ビルド設定は **「No build」相当**でOK（成果物がリポジトリ直下の `index.html` なので、ビルドコマンド空・公開ディレクトリ `/`）。必要なら下記 `amplify.yml` を使用。
4. デプロイ完了 → `https://main.xxxx.amplifyapp.com` のHTTPS URLが発行される。以後 `main` への push で自動更新。

`amplify.yml`（ビルドなしの最小例）:

```yaml
version: 1
frontend:
  phases:
    build:
      commands: []
  artifacts:
    baseDirectory: /
    files:
      - 'index.html'
  cache:
    paths: []
```

---

## B. S3 + CloudFront（HTTPS・CDN／本番向け）

1. **S3バケット**を作成（パブリックアクセスはブロックのままでOK）。`index.html` をアップロード。
2. **CloudFront**ディストリビューションを作成。オリジン＝このS3バケット。**OAC（Origin Access Control）** を有効化し、生成されるバケットポリシーを適用。
3. 「デフォルトルートオブジェクト」に `index.html` を設定。
4. 発行された `https://xxxx.cloudfront.net` でアクセス。独自ドメインは Route 53 + ACM証明書で設定可能。
5. 更新時は S3 に `index.html` を再アップロード → CloudFront を **無効化（Invalidation: `/index.html` または `/*`）** してキャッシュを更新。

> 補足: CLI なら `aws s3 cp index.html s3://<バケット名>/` でアップロード、`aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` で反映。

---

## C. S3 静的ウェブサイトホスティング（最小構成・HTTPなし）

1. S3バケットを作成し、**静的ウェブサイトホスティング**を有効化（インデックスドキュメント＝`index.html`）。
2. バケットを公開（パブリック読み取りのバケットポリシー）。
3. `http://<バケット名>.s3-website-<region>.amazonaws.com` でアクセス（**HTTPは付くがHTTPSは無し**）。社内検証向け。本番は A か B を推奨。

---

## デプロイ前に必ず確認（重要）

- **Google Sheets API キーの制限**: 公開URLになるため、Google Cloud Console でこのAPIキーに
  - 「アプリケーションの制限 → HTTPリファラー」で **公開ドメイン（Amplify/CloudFrontのURL）のみ許可**
  - 「APIの制限 → Google Sheets API のみ」
  を設定してください。キーはHTMLには埋め込んでおらず、各閲覧者がブラウザで入力します（端末の localStorage に保存）。
- **アクセス制限**: 受講生の個人情報を含むため、一般公開ではなく関係者限定を推奨。
  - Amplify: 「Access control」で**ベーシック認証（パスワード）**を設定可能。
  - CloudFront: **CloudFront Functions / Lambda@Edge でベーシック認証**、または署名付きURL/Cookie。
- データは**読み取り専用**で、スプレッドシート自体は書き換えられません。

---

## まとめ

| 方法 | HTTPS | 自動デプロイ | 手間 | 用途 |
|------|:----:|:----:|:----:|------|
| **A. Amplify** | ✓ | ✓（push連携） | 小 | おすすめ・継続運用 |
| **B. S3+CloudFront** | ✓ | △（手動 or CI） | 中 | 本番・独自ドメイン |
| **C. S3 静的ホスティング** | ✗ | ✗ | 小 | 社内検証のみ |
