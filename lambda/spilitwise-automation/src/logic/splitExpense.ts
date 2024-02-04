import { components } from "../../../../@types/splitwise";

export const splitExpense = (expense: components["schemas"]['expense']) => {
  const { USER1_RATE, USER2_RATE, USER1_ID } = process.env;

  // ユーザー情報が環境変数に入力されているかどうかのチェック
  if (USER1_RATE != null && USER2_RATE != null && USER1_ID !== null) {
    const numCost = parseInt(expense.cost ?? "0");
    const payerId = expense.repayments?.[0]?.to?.toString();
    // ユーザー情報から支払ったユーザーの割合を取得
    const payerOwedShare =
      payerId === USER1_ID
        ? Math.round(numCost * parseFloat(USER1_RATE))
        : Math.round(numCost * parseFloat(USER2_RATE));
    // 支払われたユーザーの割合を取得
    const nonPayerOwedShare = numCost - payerOwedShare;
    return {
      payerOwedShare: payerOwedShare,
      nonPayerOwedShare: nonPayerOwedShare,
    };
  } else {
    throw new Error("ユーザー情報が環境変数に入力されていません");
  }
};
