# Splitwise 割り勘自動化

Cloudflare Workersで動作する、Splitwiseグループの割り勘補正自動化ツールです。

## やること

- 特定のSplitwiseグループで50:50になっている割り勘を指定の傾斜配分に修正する
- Slack通知
- 4時間ごとに自動実行（Cron Triggers）

### コーナーケース仕様

1. 端数
   - 割り切れない場合、Payerに1円を追加する
2. 立て替え処理
   - 既定の負担割合が100:0の場合、傾斜配分の対象としない

### 制限・既知の問題

- 2人用
  - 環境変数 `USER1_RATE`, `USER2_RATE`の合計を1にする必要がある
- 金銭計算用ライブラリを使っていないので、浮動小数点誤差が発生する

## セットアップ

### 前提条件

- Node.js 20以上
- Cloudflareアカウント
- Wrangler CLI

### インストール

```bash
npm install
```

### 環境変数の設定

Cloudflare Workers Secretsとして以下の環境変数を設定します：

```bash
wrangler secret put SPLITWISE_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put SPLITWISE_GROUP_ID
wrangler secret put USER1_ID
wrangler secret put USER2_ID
wrangler secret put USER1_RATE
wrangler secret put USER2_RATE
```

#### 環境変数の説明

- `SPLITWISE_API_KEY`: Splitwise API Key ([Splitwise API](https://dev.splitwise.com/)で取得)
- `SLACK_WEBHOOK_URL`: Slack Webhook URL
- `SPLITWISE_GROUP_ID`: 対象のSplitwiseグループID
- `USER1_ID`: ユーザー1のSplitwise ID
- `USER2_ID`: ユーザー2のSplitwise ID
- `USER1_RATE`: ユーザー1の負担率（例: 0.6）
- `USER2_RATE`: ユーザー2の負担率（例: 0.4）

**注意**: `USER1_RATE` + `USER2_RATE` = 1 である必要があります

## コマンド

### 開発

```bash
npm run dev
```

ローカル環境でWorkersを起動します。環境変数は`.dev.vars`ファイルで設定できます：

```
SPLITWISE_API_KEY=your_api_key
SLACK_WEBHOOK_URL=your_webhook_url
SPLITWISE_GROUP_ID=your_group_id
USER1_ID=user1_id
USER2_ID=user2_id
USER1_RATE=0.6
USER2_RATE=0.4
```

### テスト

```bash
npm test
```

ユニットテストを実行します。テスト実行には環境変数の設定が必要です。

### デプロイ

```bash
npm run deploy
```

Cloudflare Workersにデプロイします。デプロイ前に必ずSecretsを設定してください。

### 型定義の生成

```bash
npm run typegen
```

Splitwise APIのSwagger定義から型定義を生成します。

## アーキテクチャ

### 以前の構成（v0.1.x）

- AWS Lambda (Node.js 20)
- AWS CDK
- EventBridge Rules
- 依存関係: axios, @slack/webhook, aws-cdk-lib, constructs など

### 現在の構成（v0.2.x）

- **Cloudflare Workers**
- **Wrangler CLI**
- **Cron Triggers**
- **依存関係: ゼロ（開発依存のみ）**

### 移行の目的

- 依存関係の大幅削減によるセキュリティ対応の負担軽減
- インフラコストの削減（Cloudflare Workers無料枠）
- メンテナンス負担の削減
- Node.js 24対応（Workers runtime）

## プロジェクト構造

```
.
├── src/
│   ├── index.ts              # Workers エントリーポイント
│   ├── logic/
│   │   └── splitExpense.ts   # 割り勘計算ロジック
│   └── validator/
│       └── isNeededResplit.ts # 処理対象判定
├── @types/
│   └── splitwise.d.ts        # Splitwise API型定義
├── test/
│   └── splitExpense.test.ts  # ユニットテスト
├── wrangler.toml             # Cloudflare Workers設定
├── package.json
└── tsconfig.json
```

## ライセンス

MIT
