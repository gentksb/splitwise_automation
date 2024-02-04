import { isExpenseEligibleForSplitting } from "../lambda/spilitwise-automation/src/validator/isExpenseEligibleForSplitting";
import { splitExpense } from "../lambda/spilitwise-automation/src/logic/splitExpense";

const { USER1_RATE, USER2_RATE, USER1_ID, USER2_ID, SPLITWISE_GROUP_ID } =
  process.env;

if (
  !USER1_ID ||
  !USER2_ID ||
  !USER1_RATE ||
  !USER2_RATE ||
  !SPLITWISE_GROUP_ID
) {
  throw new Error("環境変数が不足しています");
}
test("always ok", () => {
  expect(true).toBeTruthy();
});

describe("補正対象判定処理テスト", () => {
  test("割り勘補正前のデータは処理対象とする", () => {
    expect(isExpenseEligibleForSplitting(willBeSplittedData)).toBeTruthy;
  });

  test("100%負担のデータは処理対象としない", () => {
    expect(isExpenseEligibleForSplitting(simpleDebtData)).toBeFalsy;
  });

  test("補正済みデータは処理対象としない", () => {
    expect(isExpenseEligibleForSplitting(splittedData)).toBeFalsy;
  });

  test("指定したグループID以外は処理対象としない", () => {
    expect(isExpenseEligibleForSplitting(wrongGroupData)).toBeFalsy;
  });
});

describe("割り勘補正処理テスト", () => {
  test("割り切ることのできる金額を処理できる", () => {
    expect(splitExpense(willBeSplittedData)).toEqual(willBeSplittedDataResult);
  });
  test("割り切れない場合の端数を処理できる", () => {
    const oddData = { ...willBeSplittedData };
    oddData.cost = "999";
    oddData.repayments[0].amount = "499";
    oddData.users[0].owed_share = "499";
    oddData.users[0].net_balance = "-499";
    oddData.users[1].paid_share = "999";
    oddData.users[1].owed_share = "500";
    oddData.users[1].net_balance = "499";
    const oddDataSplitResult = {
      payerOwedShare: 400,
      nonPayerOwedShare: 599,
    };

    expect(splitExpense(oddData)).toEqual(oddDataSplitResult);
  });
});

const willBeSplittedData = {
  id: 1111111111,
  group_id: SPLITWISE_GROUP_ID,
  cost: "1000.0",
  repayments: [
    {
      from: USER1_ID,
      to: USER2_ID,
      amount: "500.0",
    },
  ],
  users: [
    {
      user: {
        id: USER1_ID,
      },
      user_id: USER1_ID,
      paid_share: "0.0",
      owed_share: "500.0",
      net_balance: "-500.0",
    },
    {
      user: {
        id: USER2_ID,
      },
      user_id: USER2_ID,
      paid_share: "1000.0",
      owed_share: "500.0",
      net_balance: "500.0",
    },
  ],
};

const willBeSplittedDataResult = {
  payerOwedShare: parseFloat(willBeSplittedData.cost) * parseFloat(USER2_RATE),
  nonPayerOwedShare:
    parseFloat(willBeSplittedData.cost) * parseFloat(USER1_RATE),
};

const simpleDebtData = {
  id: 1111111111,
  group_id: SPLITWISE_GROUP_ID,
  cost: "1000.0",
  repayments: [
    {
      from: USER1_ID,
      to: USER2_ID,
      amount: "1000.0",
    },
  ],
  users: [
    {
      user: {
        id: USER1_ID,
      },
      user_id: USER1_ID,
      paid_share: "0.0",
      owed_share: "0.0",
      net_balance: "-1000.0",
    },
    {
      user: {
        id: USER2_ID,
      },
      user_id: USER2_ID,
      paid_share: "1000.0",
      owed_share: "0.0",
      net_balance: "0.0",
    },
  ],
};

const splittedData = {
  id: 1111111111,
  group_id: SPLITWISE_GROUP_ID,
  cost: "1000.0",
  repayments: [
    {
      from: USER1_ID,
      to: USER2_ID,
      amount: "600.0",
    },
  ],
  users: [
    {
      user: {
        id: USER1_ID,
      },
      user_id: USER1_ID,
      paid_share: "0.0",
      owed_share: "6000.0",
      net_balance: "-600.0",
    },
    {
      user: {
        id: USER2_ID,
      },
      user_id: USER2_ID,
      paid_share: "1000.0",
      owed_share: "400.0",
      net_balance: "600.0",
    },
  ],
};

const wrongGroupData = {
  id: 1111111111,
  group_id: "88888888",
  cost: "1000.0",
  repayments: [
    {
      from: USER1_ID,
      to: USER2_ID,
      amount: "600.0",
    },
  ],
  users: [
    {
      user: {
        id: USER1_ID,
      },
      user_id: USER1_ID,
      paid_share: "0.0",
      owed_share: "6000.0",
      net_balance: "-600.0",
    },
    {
      user: {
        id: USER2_ID,
      },
      user_id: USER2_ID,
      paid_share: "1000.0",
      owed_share: "400.0",
      net_balance: "600.0",
    },
  ],
};
