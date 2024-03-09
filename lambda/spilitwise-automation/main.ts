import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { splitExpense } from "./src/logic/splitExpense";
import { isExpenseEligibleForSplitting } from "./src/validator/isExpenseEligibleForSplitting";
import { components, paths } from "../../@types/splitwise";
import { IncomingWebhook } from "@slack/webhook";

interface Props {
  SPLITWISE_API_KEY_PARAMETER_NAME: string;
  SLACK_WEBHOOK_URL: string;
  USER1_ID: string;
  USER1_RATE: string;
  USER2_ID: string;
  USER2_RATE: string;
  SPLITWISE_GROUP_ID: string;
}

type Expense = components["schemas"]["expense"];

export const splitRecent20Expenses = async (props: Props) => {
  const {
    SPLITWISE_API_KEY_PARAMETER_NAME,
    SLACK_WEBHOOK_URL,
    USER1_ID,
    USER1_RATE,
    USER2_ID,
    USER2_RATE,
    SPLITWISE_GROUP_ID,
  } = props;
  const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

  const axios_option: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${SPLITWISE_API_KEY_PARAMETER_NAME}` },
  };

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      console.error(error);
      return;
    }
  );

  // 本処理
  const getExpenses: AxiosResponse<
    paths["/get_expenses"]["get"]["responses"]["200"]["content"]["application/json"]
  > = await axios.get(
    "https://secure.splitwise.com/api/v3.0/get_expenses",
    axios_option
  );

  const expensesList: Expense[] = getExpenses.data.expenses || [];

  // リストが空か0の場合は処理を終了
  if (expensesList.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "取得対象の精算経費がありません",
      }),
    };
  }

  const willSplitExpenses = expensesList.filter((expense) =>
    isExpenseEligibleForSplitting({
      expense,
      USER1_RATE,
      USER2_RATE,
      SPLITWISE_GROUP_ID,
    })
  );

  const makeNewSplitData = (expense: Expense) => {
    const payerId = expense.repayments?.[0]?.to?.toString();
    const { payerOwedShare, nonPayerOwedShare } = splitExpense({
      expense,
      USER1_RATE,
      USER1_ID,
      USER2_RATE,
    });

    return {
      group_id: SPLITWISE_GROUP_ID,
      users__0__user_id: payerId,
      users__0__paid_share: expense.cost,
      users__0__owed_share: payerOwedShare,
      users__1__user_id: payerId === USER1_ID ? USER2_ID : USER1_ID,
      users__1__paid_share: "0",
      users__1__owed_share: nonPayerOwedShare.toString(),
    };
  };

  // 更新処理
  await Promise.all(
    willSplitExpenses.map(async (expense) => {
      console.log("更新処理開始 ExpenseID: ", expense.id);
      const newSplitData = makeNewSplitData(expense);

      await axios
        .post(
          `https://secure.splitwise.com/api/v3.0/update_expense/${expense.id}`,
          newSplitData,
          {
            headers: {
              "Content-Type": "application/json",
              ...axios_option.headers,
            },
          }
        )
        .then(
          async (
            response: AxiosResponse<
              paths["/update_expense/{id}"]["post"]["responses"]["200"]["content"]["application/json"]
            >
          ) => {
            if (response.data.errors?.length !== 0) {
              console.error(response.data.errors);
              await webhook.send({
                text: `割り勘処理でエラー発生\n ID:${response.data.expenses?.[0].id}\n${response.data.errors?.toString()}`,
              });
              return;
              // 失敗したものはエラーを出力して終了
            } else {
              console.log("update_expense成功", response.data);

              const slackMessage = [
                `ID:${response.data.expenses?.[0].id} を下記の通り分割しました`,
                `\`\`\`●内容: ${response.data.expenses?.[0].description}`,
                `●金額: ${response.data.expenses?.[0].cost}円`,
                `●${response.data.expenses?.[0].users?.[0].user?.first_name}の負担: ${response.data.expenses?.[0].users?.[0].owed_share}円`,
                `●${response.data.expenses?.[0].users?.[1].user?.first_name}の負担: ${response.data.expenses?.[0].users?.[1].owed_share}円\`\`\``,
              ].join("\n");

              await webhook
                .send({
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
                })
                .then((result) => {
                  console.log("Slackへの通知に成功しました", result.text);
                });
            }
          }
        );
      return;
    })
  );

  const logMessage =
    expensesList.length === 0
      ? "取得対象の精算経費がありません"
      : `直近${expensesList.length}の経費のうち、${willSplitExpenses.length}件を割り勘処理しました`;
  console.log(logMessage);

  return { result: logMessage };
};
