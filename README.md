# Splitwise 割り勘自動化

## やること

- 特定のSplitwiseグループで50:50になっている割り勘を指定の傾斜配分に指定しなおす
- Slack通知

### コーナーケース仕様

1. 端数
   - 割り切れない場合、Payerに1円を追加する
2. 立て替え処理
   - 既定の負担割合が100:0の場合、傾斜配分の対象としない 

### 制限・既知の問題

- 2人用
  - 環境変数 `USER1_RATE`, `USER2_RATE`の合計を1にする必要がある
- 環境変数名 `SPLITWISE_API_KEY_PARAMETER_NAME` が名称と一致していない
  - パラメータストア使おうとしてやめた開発上の歴史的経緯
- 金銭計算用ライブラリを使っていないので、浮動小数点誤差が発生する 
 
## Environment variables

```
SPLITWISE_API_KEY_PARAMETER_NAME= //splitwise api key(not a parameterstore name!)
SLACK_WEBHOOK_URL= // your slack channel webhook url
SPLITWISE_GROUP_ID= // Splitwise group ID
USER1_ID= // user1 splitwise userid"
USER2_ID= // user2 splitwise userid"
USER1_RATE= // split rate for user1. Must be 1 to sum of USER1_RATE and USER2_RATE. e.g.)0.6
USER2_RATE= // split rate for user2. Must be 1 to sum of USER1_RATE and USER2_RATE. e.g.)0.4
```

フォーマットは[Splitwise API](https://dev.splitwise.com/)を参照

## commands

- `npm run test` perform the jest unit tests
- `npm run e2e` **CAUTION** End-to-End Test. This script has side effects to splitwise data.
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
