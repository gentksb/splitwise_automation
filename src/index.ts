import { splitExpense } from "./logic/splitExpense";
import { isNeededReSplit } from "./validator/isNeededResplit";
import { components, paths } from "../@types/splitwise";

type Expense = components["schemas"]["expense"];

interface Env {
  SPLITWISE_API_KEY: string;
  SLACK_WEBHOOK_URL: string;
  USER1_ID: string;
  USER1_RATE: string;
  USER2_ID: string;
  USER2_RATE: string;
  SPLITWISE_GROUP_ID: string;
}

const sendSlackMessage = async (webhookUrl: string, message: any) => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack通知に失敗しました: ${response.statusText}`);
  }

  return response;
};

const splitRecentExpenses = async (env: Env) => {
  const {
    SPLITWISE_API_KEY,
    SLACK_WEBHOOK_URL,
    USER1_ID,
    USER1_RATE,
    USER2_ID,
    USER2_RATE,
    SPLITWISE_GROUP_ID,
  } = env;

  // Splitwise API呼び出し用のfetch関数
  const splitwiseRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(
      `https://secure.splitwise.com/api/v3.0${endpoint}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${SPLITWISE_API_KEY}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      console.error(`Splitwise API error: ${response.statusText}`);
      throw new Error(`Splitwise API error: ${response.statusText}`);
    }

    return response.json();
  };

  // 本処理
  const getExpensesData: paths["/get_expenses"]["get"]["responses"]["200"]["content"]["application/json"] =
    await splitwiseRequest("/get_expenses?limit=100");

  const expenses: Expense[] = getExpensesData.expenses || [];

  // リストが空か0の場合は処理を終了
  if (expenses.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "取得対象の精算経費がありません",
      }),
    };
  }

  const firstDayOfCurrentMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  // 最新の精算日を取得. expensesは支払い日の降順で取得されることが保証済み
  // 精算日を取得できない場合は当月1日とする
  // created_atが見つからない場合に最初の日時を取得するためにfind()を利用
  const lastPaymentDate =
    expenses.find((expense) => expense.payment === true)?.created_at ||
    firstDayOfCurrentMonth;

  // Todo: 判定ルールを個別に定義する
  // isPayment => 精算レコード（個々の経費ではないレコード）判定
  // isTargetGroup => 対象のグループIDかどうか
  // isTargetSplitRate => 環境変数の割り勘率が設定されているか
  // isAfterPayment => 最新の精算レコード以降のレコードかどうか
  const willSplitExpenses = expenses.filter((expense) =>
    isNeededReSplit({
      expense,
      lastPaymentDate,
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

      try {
        const response: paths["/update_expense/{id}"]["post"]["responses"]["200"]["content"]["application/json"] =
          await splitwiseRequest(`/update_expense/${expense.id}`, {
            method: "POST",
            body: JSON.stringify(newSplitData),
          });

        // errorが無い場合は空オブジェクトが返ってくるので、判定条件に含めておく
        if (
          response.errors === undefined ||
          (response.errors !== undefined &&
            Object.keys(response.errors).length > 0)
        ) {
          console.error(response.errors?.toString());
          await sendSlackMessage(SLACK_WEBHOOK_URL, {
            text: `割り勘処理でエラー発生\n ID:${response.expenses?.[0].id}\n${response.errors?.toString()}`,
          });
          return;
          // 失敗したものはエラーを出力して終了
        } else {
          console.log("update_expense成功", response);

          const slackMessage = [
            `ID:${response.expenses?.[0].id} を下記の通り分割しました`,
            `\`\`\`●内容: ${response.expenses?.[0].description}`,
            `●金額: ${response.expenses?.[0].cost}円`,
            `●${response.expenses?.[0].users?.[0].user?.first_name}の負担: ${response.expenses?.[0].users?.[0].owed_share}円`,
            `●${response.expenses?.[0].users?.[1].user?.first_name}の負担: ${response.expenses?.[0].users?.[1].owed_share}円\`\`\``,
          ].join("\n");

          await sendSlackMessage(SLACK_WEBHOOK_URL, {
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

          console.log("Slackへの通知に成功しました");
        }
      } catch (error) {
        console.error("処理エラー:", error);
      }
    })
  );

  const logMessage =
    expenses.length === 0
      ? "取得対象の精算経費がありません"
      : `直近${expenses.length}の経費のうち、${willSplitExpenses.length}件を割り勘処理しました`;
  console.log(logMessage);

  return { result: logMessage };
};

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Cron Triggerから実行される
    ctx.waitUntil(splitRecentExpenses(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // 手動テスト用のHTTPエンドポイント
    try {
      // 環境変数のバリデーション
      if (
        !env.SPLITWISE_API_KEY ||
        !env.USER1_ID ||
        !env.USER1_RATE ||
        !env.USER2_ID ||
        !env.USER2_RATE ||
        !env.SPLITWISE_GROUP_ID ||
        !env.SLACK_WEBHOOK_URL
      ) {
        throw new Error("環境変数が設定されていません");
      }

      const result = await splitRecentExpenses(env);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  },
};
