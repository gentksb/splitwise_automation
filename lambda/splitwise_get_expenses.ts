import {
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent,
  Handler,
} from "aws-lambda";
import axios from "axios";

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { SPLITWISE_API_KEY_PARAMETER_NAME } = process.env;

  const getApiResponse = await axios.get(
    "https://secure.splitwise.com/api/v3.0/get_expenses",
    {
      headers: { Authorization: `Bearer ${SPLITWISE_API_KEY_PARAMETER_NAME}` },
    }
  );

  const isSharedCost = (expense: any) => {
    const { cost, users } = expense;
    const splitRate = parseInt(users[0].owed_share) / parseInt(cost);

    return splitRate !== 0 && splitRate !== 1;
  };

  const expensesList: Array<any> = getApiResponse.data.expenses;

  const noPaymentExpenses = await expensesList.filter(
    (expense) => expense.payment === false
  );

  const willSplitExpenses = await noPaymentExpenses.filter((expense) =>
    isSharedCost(expense)
  );

  const logMessage =
    expensesList.length === 0
      ? "取得対象の精算経費がありません"
      : `直近${expensesList.length}の経費のうち、${noPaymentExpenses.length}件が未清算、${willSplitExpenses.length}件を割り勘処理します`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: logMessage,
    }),
  };
};
