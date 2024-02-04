import {
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent,
  Handler,
} from "aws-lambda";
import axios, { AxiosRequestConfig } from "axios";
import { splitExpense } from "./src/logic/splitExpense";
import { isExpenseEligibleForSplitting } from "./src/validator/isExpenseEligibleForSplitting";
import { paths } from "../../@types/splitwise";

// I tried to generate d.type.ts, w/ official API repo and openapi-typescript, but it didn't work.
// https://github.com/drwpow/openapi-typescript
// https://github.com/splitwise/api-docs

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { SPLITWISE_API_KEY_PARAMETER_NAME, SLACK_WEBHOOK_URL } = process.env;
  const axios_option: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${SPLITWISE_API_KEY_PARAMETER_NAME}` },
  };
  const { USER1_ID, USER2_ID, SPLITWISE_GROUP_ID } = process.env;

  if (SLACK_WEBHOOK_URL === undefined) {
    throw new Error("slack url is not set");
  }

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      console.error(error);
      return;
    }
  );

  // 本処理
  const getExpenses = await axios.get(
    "https://secure.splitwise.com/api/v3.0/get_expenses",
    axios_option
  );

  const expensesList: paths["/get_expenses"]["get"]["responses"]["200"]["content"]["application/json"]["expenses"] = getExpenses.data.expenses;

  // リストが空か0の場合は処理を終了
  if (expensesList === undefined || expensesList.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "取得対象の精算経費がありません",
      }),
    };
  }

  const noPaymentExpenses = expensesList.filter(
    (expense) => expense.payment === false
  );

  const willSplitExpenses = noPaymentExpenses.filter((expense) =>
    isExpenseEligibleForSplitting(expense)
  );

  // 更新処理
  await Promise.all(
    willSplitExpenses.map(async (expense) => {
      console.log("更新処理開始 ExpenseID: ", expense.id);
      const payerId = expense.repayments?.[0]?.to?.toString();
      const { payerOwedShare, nonPayerOwedShare } = splitExpense(expense);

      const newSplitData = {
        users__0__user_id: payerId,
        users__0__paid_share: expense.cost,
        users__0__owed_share: payerOwedShare,
        users__1__user_id: payerId === USER1_ID ? USER2_ID : USER1_ID,
        users__1__paid_share: "0",
        users__1__owed_share: nonPayerOwedShare.toString(),
      };

      await axios
        .post(
          `https://secure.splitwise.com/api/v3.0/update_expense/${expense.id}`,
          {
            group_id: SPLITWISE_GROUP_ID,
            ...newSplitData,
          },
          {
            headers: {
              "Content-Type": "application/json",
              ...axios_option.headers,
            },
          }
        )
        .then(async (response) => {
          if (Object.keys(response.data.errors).length !== 0) {
            console.error(response.data.errors);
            await axios.post(SLACK_WEBHOOK_URL, {
              text: `割り勘処理でエラー発生\n ID:${response.data.expenses[0].id}\n${response.data.errors.shares}\n${response.data.errors.base}`,
            });
            throw new Error("Splitwise APIへのPOST内容に問題があります");
          } else {
            console.log(response.data);

            const slackMessage = [
              `ID:${response.data.expenses[0].id} を下記の通り分割しました`,
              `\`\`\`●内容: ${response.data.expenses[0].description}`,
              `●金額: ${response.data.expenses[0].cost}円`,
              `●${response.data.expenses[0].users[0].user.first_name}の負担: ${response.data.expenses[0].users[0].owed_share}円`,
              `●${response.data.expenses[0].users[1].user.first_name}の負担: ${response.data.expenses[0].users[1].owed_share}円\`\`\``,
            ].join("\n");

            await axios.post(SLACK_WEBHOOK_URL, {
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "割り勘補正を実行しました:ballot_box_with_check:",
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: slackMessage,
                  },
                },
              ],
            });
          }
        });
      return;
    })
  );

  const logMessage =
    expensesList.length === 0
      ? "取得対象の精算経費がありません"
      : `直近${expensesList.length}の経費のうち、${noPaymentExpenses.length}件が未清算、${willSplitExpenses.length}件を割り勘処理しました`;
  console.log(logMessage);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: logMessage,
    }),
  };
};
