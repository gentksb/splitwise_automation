# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスです。

## プロジェクト概要

Cloudflare Workersで動作するSplitwise割り勘自動化ツール。
特定のSplitwiseグループで50:50になっている経費を、指定の傾斜配分に修正し、Slackへ通知する。Cron Triggerにより4時間ごとに自動実行。

## コマンド

```bash
npm test          # ユニットテスト実行
npm run dev       # ローカル開発サーバー起動（wrangler dev）
npm run deploy    # Cloudflare Workersへデプロイ
npm run typegen   # Splitwise Swagger定義から型定義を生成
```

## アーキテクチャ

- **ランタイム**: Cloudflare Workers (TypeScript)
- **スケジューラ**: Cron Triggers（4時間ごと: `0 */4 * * *`）
- **外部依存**: ゼロ（開発依存のみ）

### ファイル構成

```
src/
  index.ts                    # Workersエントリーポイント。fetch/scheduledハンドラ、Splitwise API呼び出し、Slack通知
  logic/splitExpense.ts       # 割り勘計算ロジック（傾斜配分の金額算出）
  validator/isNeededResplit.ts # 処理対象の経費かどうかを判定
@types/splitwise.d.ts         # Splitwise APIの型定義（openapi-typescriptで生成）
test/splitExpense.test.ts     # ユニットテスト（Jest + ts-jest）
```

### 環境変数（Cloudflare Workers Secrets）

| 変数名 | 説明 |
|--------|------|
| `SPLITWISE_API_KEY` | Splitwise API Key |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |
| `SPLITWISE_GROUP_ID` | 対象のSplitwiseグループID |
| `USER1_ID` | ユーザー1のSplitwise ID |
| `USER2_ID` | ユーザー2のSplitwise ID |
| `USER1_RATE` | ユーザー1の負担率（例: `0.6`） |
| `USER2_RATE` | ユーザー2の負担率（例: `0.4`） |

**制約**: `USER1_RATE + USER2_RATE = 1` であること

## 重要な仕様・コーナーケース

- **端数処理**: 割り切れない場合はPayerに1円を追加（`Math.round`で支払者側を丸め、非支払者側は差分）
- **精算レコード除外**: `payment: true` の経費は処理しない
- **100:0の経費は除外**: `splitRate` が `0` または `1` の経費はスキップ
- **対象経費の条件**: 対象グループ、最新精算日以降、かつ割合がUSER1_RATE/USER2_RATEでない経費のみ更新
- **2人専用**: 現状3人以上のグループには非対応

## 開発時の注意

- `@types/splitwise.d.ts` は `npm run typegen` で生成されるため、手動編集しない
- ローカルテスト時は `.dev.vars` ファイルで環境変数を設定する（`.gitignore` 対象）
- テストは環境変数なしで実行できる（ロジック層のみテスト）
