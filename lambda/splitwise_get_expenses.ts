import {
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent,
  Handler,
} from "aws-lambda";
import axios, { AxiosRequestConfig } from "axios";

const splitData = {
  gen: {
    userId: 33439788,
    rate: 0.6,
  },
  yu: {
    userId: 49299667,
    rate: 0.4,
  },
};

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { SPLITWISE_API_KEY_PARAMETER_NAME } = process.env;
  const axios_option: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${SPLITWISE_API_KEY_PARAMETER_NAME}` },
  };

  // レスポンスエラーハンドリング
  const axiosErrorResponse = {
    statusCode: 500,
    body: JSON.stringify({
      message: "Axios Error",
    }),
  };
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      console.error(error);
      return axiosErrorResponse;
    }
  );

  // 本処理
  const getExpenses = await axios.get(
    "https://secure.splitwise.com/api/v3.0/get_expenses",
    axios_option
  );

  const isSharedCost = (expense: any) => {
    const { cost, users } = expense;
    const splitRate = parseFloat(
      (parseInt(users[0].owed_share) / parseInt(cost)).toPrecision(2)
    );

    return (
      splitRate !== 0 &&
      splitRate !== 1 &&
      splitRate !== splitData.gen.rate &&
      splitRate !== splitData.yu.rate
    );
  };

  const expensesList: Array<any> = getExpenses.data.expenses;

  const noPaymentExpenses = expensesList.filter(
    (expense) => expense.payment === false
  );

  const willSplitExpenses = noPaymentExpenses.filter((expense) =>
    isSharedCost(expense)
  );

  // 更新処理
  willSplitExpenses.forEach(async (expense) => {
    console.log("更新処理開始 ExpenseID: ", expense.id);
    const numCost = parseInt(expense.cost);
    const payerId = expense.repayments[0].to;
    const payerOwedShare =
      payerId === splitData.gen.userId
        ? (numCost * splitData.gen.rate).toPrecision()
        : (numCost * splitData.yu.rate).toPrecision();
    const nonPayerOwedShare = numCost - parseInt(payerOwedShare);

    const newSplitData = {
      users__0__user_id: payerId,
      users__0__paid_share: expense.cost,
      users__0__owed_share: payerOwedShare,
      users__1__user_id:
        payerId === splitData.gen.userId
          ? splitData.yu.userId
          : splitData.gen.userId,
      users__1__paid_share: "0",
      users__1__owed_share: nonPayerOwedShare.toString(),
    };

    const updateResponse = await axios.post(
      `https://secure.splitwise.com/api/v3.0/update_expense/${expense.id}`,
      {
        group_id: 31566863,
        ...newSplitData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...axios_option.headers,
        },
      }
    );

    console.log(JSON.stringify(updateResponse));
  });

  const logMessage =
    expensesList.length === 0
      ? "取得対象の精算経費がありません"
      : `直近${expensesList.length}の経費のうち、${noPaymentExpenses.length}件が未清算、${willSplitExpenses.length}件を割り勘処理しました`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: logMessage,
    }),
  };
};
