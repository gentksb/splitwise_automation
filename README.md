# Splitwise 割り勘自動化

Cloudflare Workersで動作する、Splitwiseグループの割り勘補正自動化ツール。

## 概要

特定のSplitwiseグループで50:50になっている経費を指定の傾斜配分に修正し、Slackへ通知する。Cron Triggerにより4時間ごとに自動実行。

## 技術スタック

- **Cloudflare Workers** + TypeScript
- **Wrangler CLI** - デプロイ・ローカル開発
- **Cron Triggers** - 4時間ごと自動実行（`0 */4 * * *`）
- 外部依存ゼロ（開発依存のみ）

## ワークフロー

```bash
pnpm install       # 依存関係インストール
pnpm dev           # ローカル開発サーバー起動
pnpm test          # ユニットテスト実行
pnpm deploy        # Cloudflare Workersへデプロイ
pnpm typegen       # Splitwise API型定義を生成
```

### ローカル開発

`.env` ファイルを作成して環境変数を設定する（`.gitignore` 対象）：

```
SPLITWISE_API_KEY=your_api_key
SLACK_WEBHOOK_URL=your_webhook_url
SPLITWISE_GROUP_ID=your_group_id
USER1_ID=user1_id
USER2_ID=user2_id
USER1_RATE=0.6
USER2_RATE=0.4
```

> **Note**: Wrangler 4.x は `.dev.vars` が存在しない場合、`.env` を自動的に読み込む（`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV` デフォルト有効）。

### デプロイ前の準備

Cloudflare Workers Secretsとして以下を設定：

```bash
wrangler secret put SPLITWISE_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put SPLITWISE_GROUP_ID
wrangler secret put USER1_ID
wrangler secret put USER2_ID
wrangler secret put USER1_RATE
wrangler secret put USER2_RATE
```

**注意**: `USER1_RATE` + `USER2_RATE` = 1 であること

## ライセンス

MIT
