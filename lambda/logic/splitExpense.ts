export const splitExpense = (expense: any) => {
  const { USER1_RATE, USER2_RATE, USER1_ID } = process.env;
  const numCost = parseInt(expense.cost);
  const payerId = expense.repayments[0].to.toString();

  if (USER1_RATE != null && USER2_RATE != null && USER1_ID !== null) {
    const payerOwedShare =
      payerId === USER1_ID
        ? parseInt(Math.round(numCost * parseFloat(USER1_RATE)).toPrecision())
        : parseInt(Math.round(numCost * parseFloat(USER2_RATE)).toPrecision());
    const nonPayerOwedShare = numCost - payerOwedShare;
    return {
      payerOwedShare: payerOwedShare,
      nonPayerOwedShare: nonPayerOwedShare,
    };
  } else {
    throw new Error("ユーザー情報が環境変数に入力されていません");
  }
};
