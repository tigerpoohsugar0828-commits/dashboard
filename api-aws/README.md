# KPIダッシュボード API（AWS版）

ダッシュボードで計算した数字を、URLひとつでJSONとして取り出せるようにする仕組みです。

## 構成
- **Lambda（Node.js 20）**：データの受け取りと返却。関数URLで公開（API Gatewayは不要）
- **S3**：最新データ（`latest.json`）と日付ごとの履歴（`history/2026-10-16.json`）を保存。外部からは直接見られない設定
- 費用の目安：月数十円〜数百円程度（アクセス数が少ないため、ほぼ無料枠内）

```
ダッシュボード（管理者が開く）── POST ──▶ Lambda ──▶ S3
Claude / Notion / 同僚     ── GET  ──▶ Lambda ◀── S3
```

## デプロイ（AWS SAM CLI を使う場合）
```bash
cd api-aws
npm init -y && npm install @aws-sdk/client-s3   # Lambdaの実行環境にも入っているが念のため
sam build
sam deploy --guided
#   Stack Name     : kpi-dashboard-api
#   AWS Region     : ap-northeast-1（東京）
#   ReadToken      : 読み取り用の合言葉（ランダムな英数字20文字以上）
#   WriteToken     : 書き込み用の合言葉（同上・ReadTokenとは別のもの）
#   AllowedOrigin  : ダッシュボードの公開URL（例 https://xxxx.netlify.app）
```
完了すると `ApiUrl` が表示されます。

### コンソールで手作業でやる場合
1. S3でバケットを作成（パブリックアクセスはすべてブロック）
2. Lambdaで関数を作成（Node.js 20）→ `index.mjs` を貼り付け
3. 環境変数に `BUCKET` `READ_TOKEN` `WRITE_TOKEN` を設定
4. 実行ロールに、そのバケットへの `s3:GetObject` `s3:PutObject` `s3:ListBucket` を許可
5. 「関数URL」を作成：認証タイプ NONE、CORS 有効（許可オリジン＝ダッシュボードのURL、メソッド GET/POST）

## ダッシュボードとつなぐ
管理者パスワードでダッシュボードを開き、ヘッダーの「API連携」→ `ApiUrl` と WriteToken を入力。
以降、管理者がダッシュボードを開くたびに最新データが送られます。

## 読み取り
`{ApiUrl}?token={ReadToken}&type=...`

| type | 中身 |
|---|---|
| （なし） | 一覧：どの卒業月があるか・更新日時・履歴 |
| `summary` | 全卒業月のKGI・KPIの要約（万垢率・5000/3000/1000/100人以上率・初投稿完了率・10/30/50投稿達成率）。卒業済みは卒業日まで、在籍中は今日までの数字 |
| `cohort&ym=2026/10` | 1つの卒業月の詳細（ファネル・属性・クロス分析・生徒分類）。過去の月は要約と生徒一覧 |
| `students&ym=2026/10` | その卒業月の生徒全員の一覧（クラス・コース・ジャンル・MG・年代・職業・フォロワー・卒業日までの投稿数・到達段階・各到達日） |
| `coaching` | コーチングKPI（開始月ごと） |
| `program` | プログラム完了率（60日以内など） |
| `programs` | プログラムの生徒ごとの進み具合（開始日・完了日・完了までの日数・止まっているSTEP） |
| `monthly` | 月次レポートのデータ |
| `all` | 全部 |

過去の日：`&date=2026-10-16`

## 使い方の例
- **Claude**：URLを渡して「10月卒業の状況をまとめて」
- **Notion**：Make／Zapier などで「毎週金曜にURLを読む → Notionに書き込む」
- **同僚**：`summary` のURLをブラウザで開くだけ

## 注意
- `students` には生徒の名前・フォロワー数などの個人情報が入る。ReadToken は社内の必要な人にだけ渡す
- 合言葉を変えるときは Lambda の環境変数を書き換える（古い合言葉は即無効）
- より厳しくしたい場合は、関数URLの前に API Gateway＋WAF（IP制限）を置くか、社内SSOの裏に置く
