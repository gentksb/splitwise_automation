import { components } from "../../../../@types/splitwise";

type Expense = components["schemas"]["expense"];

interface Props {
  expense: Expense;
  lastPaymentDate: string;
  USER1_RATE: string;
  USER2_RATE: string;
  SPLITWISE_GROUP_ID: string;
}

export const isNeededReSplit = ({
  expense,
  lastPaymentDate,
  USER1_RATE,
  USER2_RATE,
  SPLITWISE_GROUP_ID,
}: Props) => {
  // validation of props
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
    expense.cost === undefined ||
    expense.created_at === undefined
  ) {
    console.error("割り勘費用の情報に不備があります", expense);
    return false;
  }

  const { cost, users, created_at } = expense;
  const splitRate = parseFloat(
    (parseInt(users?.[0]?.owed_share ?? "0") / parseInt(cost)).toPrecision(2)
  );

  const isPayment = expense.payment === true;
  const isTargetGroup = expense.group_id?.toString() === SPLITWISE_GROUP_ID;
  const isAfterPayment = new Date(created_at) >= new Date(lastPaymentDate);
  const isTargetSplitRate =
    splitRate !== 0 &&
    splitRate !== 1 &&
    splitRate !== parseFloat(USER1_RATE) &&
    splitRate !== parseFloat(USER2_RATE);

  // グループIDが一致し、割り勘でない、かつ、割り勘率が0,1,USER1_RATE,USER2_RATE以外の場合は処理対象とする
  // payment:true -> 精算レコード（個々の支払い終了ではない）
  // 一度いじったものを再度いじらないようにするため、payment以前の対象は除外したいが判定が難しいので今月内のものだけを対象とする
  return !isPayment && isTargetGroup && isTargetSplitRate && isAfterPayment;
};
