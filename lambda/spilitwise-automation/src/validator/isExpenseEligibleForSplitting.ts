import { components } from "../../../../@types/splitwise";

export const isExpenseEligibleForSplitting = (
  expense: components["schemas"]["expense"]
) => {
  const { USER1_RATE, USER2_RATE } = process.env;

  // env check
  if (
    USER1_RATE == null ||
    USER2_RATE == null ||
    parseFloat(USER1_RATE) + parseFloat(USER2_RATE) !== 1
  ) {
    console.error(
      "Split Rateが不正です（値が設定されていないか、合計が1ではありません）",
      USER1_RATE,
      USER2_RATE
    );
    throw new Error("split rate error");
  }

  // 必要な情報が含まれていない場合、エラーをスローせずに処理を終了する
  if (
    expense.group_id === undefined ||
    expense.users === undefined ||
    expense.users.length < 2 ||
    expense.cost === undefined
  ) {
    console.error("割り勘費用の情報に不備があります", expense);
    return false;
  }

  const { cost, users } = expense;
  const splitRate = parseFloat(
    (parseInt(users?.[0]?.owed_share ?? "0") / parseInt(cost)).toPrecision(2)
  );

  // グループIDが一致し、割り勘でない、かつ、割り勘率が0,1,USER1_RATE,USER2_RATE以外の場合は処理対象とする
  return (
    expense.payment === false &&
    expense.group_id?.toString() === process.env.SPLITWISE_GROUP_ID &&
    splitRate !== 0 &&
    splitRate !== 1 &&
    splitRate !== parseFloat(USER1_RATE) &&
    splitRate !== parseFloat(USER2_RATE)
  );
};
