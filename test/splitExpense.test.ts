import { isExpenseEligibleForSplitting } from "../lambda/spilitwise-automation/src/validator/isExpenseEligibleForSplitting";
import { splitExpense } from "../lambda/spilitwise-automation/src/logic/splitExpense";
import { components } from "../@types/splitwise";

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
    const oddData = {
      ...willBeSplittedData,
      cost: "999",
      repayments: [{ amount: "499" }],
      users: [
        {
          owed_share: "499",
          net_balance: "-499",
        },
        {
          paid_share: "999",
          owed_share: "500",
          net_balance: "499",
        },
      ],
    };
    const oddDataSplitResult = {
      payerOwedShare: 400,
      nonPayerOwedShare: 599,
    };

    expect(splitExpense(oddData)).toEqual(oddDataSplitResult);
  });
});

const willBeSplittedData: components["schemas"]["expense"] = {
  id: 1111111111,
  group_id: Number(SPLITWISE_GROUP_ID),
  cost: "1000.0",
  repayments: [
    {
      from: Number(USER1_ID),
      to: Number(USER2_ID),
      amount: "500.0",
    },
  ],
  users: [
    {
      user: {
        id: Number(USER1_ID),
      },
      user_id: Number(USER1_ID),
      paid_share: "0.0",
      owed_share: "500.0",
      net_balance: "-500.0",
    },
    {
      user: {
        id: Number(USER2_ID),
      },
      user_id: Number(USER2_ID),
      paid_share: "1000.0",
      owed_share: "500.0",
      net_balance: "500.0",
    },
  ],
};

const willBeSplittedDataResult = {
  payerOwedShare:
    parseFloat(willBeSplittedData.cost ?? "0") * parseFloat(USER2_RATE ?? "0"),
  nonPayerOwedShare:
    parseFloat(willBeSplittedData.cost ?? "0") * parseFloat(USER1_RATE),
};

const simpleDebtData: components["schemas"]["expense"] = {
  id: 1111111111,
  group_id: Number(SPLITWISE_GROUP_ID),
  cost: "1000.0",
  repayments: [
    {
      from: Number(USER1_ID),
      to: Number(USER2_ID),
      amount: "1000.0",
    },
  ],
  users: [
    {
      user: {
        id: Number(USER1_ID),
      },
      user_id: Number(USER1_ID),
      paid_share: "0.0",
      owed_share: "0.0",
      net_balance: "-1000.0",
    },
    {
      user: {
        id: Number(USER2_ID),
      },
      user_id: Number(USER2_ID),
      paid_share: "1000.0",
      owed_share: "0.0",
      net_balance: "0.0",
    },
  ],
};

const splittedData: components["schemas"]["expense"] = {
  id: 1111111111,
  group_id: Number(SPLITWISE_GROUP_ID),
  cost: "1000.0",
  repayments: [
    {
      from: Number(USER1_ID),
      to: Number(USER2_ID),
      amount: "600.0",
    },
  ],
  users: [
    {
      user: {
        id: Number(USER1_ID),
      },
      user_id: Number(USER1_ID),
      paid_share: "0.0",
      owed_share: "6000.0",
      net_balance: "-600.0",
    },
    {
      user: {
        id: Number(USER2_ID),
      },
      user_id: Number(USER2_ID),
      paid_share: "1000.0",
      owed_share: "400.0",
      net_balance: "600.0",
    },
  ],
};

const wrongGroupData: components["schemas"]["expense"] = {
  id: 1111111111,
  group_id: 88888888,
  cost: "1000.0",
  repayments: [
    {
      from: Number(USER1_ID),
      to: Number(USER2_ID),
      amount: "600.0",
    },
  ],
  users: [
    {
      user: {
        id: Number(USER1_ID),
      },
      user_id: Number(USER2_ID),
      paid_share: "0.0",
      owed_share: "6000.0",
      net_balance: "-600.0",
    },
    {
      user: {
        id: Number(USER2_ID),
      },
      user_id: Number(USER1_ID),
      paid_share: "1000.0",
      owed_share: "400.0",
      net_balance: "600.0",
    },
  ],
};
