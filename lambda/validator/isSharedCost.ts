export const isSharedCost = (expense: any) => {
  const { USER1_RATE, USER2_RATE } = process.env;
  // env check
  if (
    USER1_RATE != null &&
    USER2_RATE != null &&
    parseFloat(USER1_RATE) + parseFloat(USER2_RATE) === 1
  ) {
    const { cost, users } = expense;
    const splitRate = parseFloat(
      (parseInt(users[0].owed_share) / parseInt(cost)).toPrecision(2)
    );

    return (
      expense.group_id.toString() === process.env.SPLITWISE_GROUP_ID &&
      splitRate !== 0 &&
      splitRate !== 1 &&
      splitRate !== parseFloat(USER1_RATE) &&
      splitRate !== parseFloat(USER2_RATE)
    );
  } else {
    console.error(
      "Split Rateが不正です（値が設定されていないか、合計が1ではありません）",
      USER1_RATE,
      USER2_RATE
    );
    throw new Error("split rate error");
  }
};
