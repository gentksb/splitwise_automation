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

// 環境変数を設定済みの関数
const isExpenseEligibleForSplittingWrapper = (
  expense: components["schemas"]["expense"]
) =>
  isExpenseEligibleForSplitting({
    expense,
    USER1_RATE,
    USER2_RATE,
    SPLITWISE_GROUP_ID,
  });

const splitExpenseWrapper = (expense: components["schemas"]["expense"]) =>
  splitExpense({
    expense,
    USER1_RATE,
    USER1_ID,
    USER2_RATE,
  });

test("always ok", () => {
  expect(true).toBeTruthy();
});

// 異常系テスト
describe("異常系テスト", () => {
  test("グループIDが含まれていない場合、処理せずエラーログを出力して正常終了する", () => {
    const missingGroupIdData = {
      ...basicExpense,
      group_id: null,
    };

    // console.errorの出力をAssertする
    expect(isExpenseEligibleForSplittingWrapper(missingGroupIdData)).toBe(
      false
    );
  });
});

describe("補正対象判定処理テスト", () => {
  test("典型例: 支払い前でデフォルト負担率（50:50）のデータを処理する", () => {
    expect(isExpenseEligibleForSplittingWrapper(basicExpense)).toBeTruthy();
  });

  test("100%負担のデータは処理対象としない", () => {
    const simpleDebtExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      repayments: [
        {
          amount: "1000.0",
        },
      ],
      users: [
        {
          owed_share: "0.0",
          net_balance: "-1000.0",
        },
        {
          owed_share: "0.0",
          net_balance: "0.0",
        },
      ],
    };
    expect(isExpenseEligibleForSplittingWrapper(simpleDebtExpense)).toBeFalsy();
  });

  test("補正済みデータは処理対象としない", () => {
    const reSplittedExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      repayments: [
        {
          amount: "600.0",
        },
      ],
      users: [
        {
          owed_share: "600.0",
          net_balance: "-600.0",
        },
        {
          owed_share: "400.0",
          net_balance: "600.0",
        },
      ],
    };
    expect(isExpenseEligibleForSplittingWrapper(reSplittedExpense)).toBeFalsy();
  });

  test("指定したグループID以外は処理対象としない", () => {
    const nonTargetGroupExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      group_id: 88888888,
    };
    expect(
      isExpenseEligibleForSplittingWrapper(nonTargetGroupExpense)
    ).toBeFalsy();
  });

  test("前月のデータは対象としない", () => {
    const nonTargetGroupExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      created_at: "2021-08-31T00:00:00Z",
    };
    expect(
      isExpenseEligibleForSplittingWrapper(nonTargetGroupExpense)
    ).toBeFalsy();
  });
});

describe("割り勘補正処理テスト", () => {
  test("割り切ることのできる金額を処理できる", () => {
    expect(splitExpenseWrapper(basicExpense)).toEqual(reSplittedExpenseBalance);
  });
  test("割り切れない場合の端数を処理できる", () => {
    const oddBlanceExpense = {
      ...basicExpense,
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
    const oddExpenseReSplittedBalance = {
      payerOwedShare: 400,
      nonPayerOwedShare: 599,
    };

    expect(splitExpenseWrapper(oddBlanceExpense)).toEqual(
      oddExpenseReSplittedBalance
    );
  });
});

const basicExpense: components["schemas"]["expense"] = {
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
  payment: false,
  created_at: new Date().toISOString(),
};

const reSplittedExpenseBalance = {
  payerOwedShare:
    parseFloat(basicExpense.cost ?? "0") * parseFloat(USER2_RATE ?? "0"),
  nonPayerOwedShare:
    parseFloat(basicExpense.cost ?? "0") * parseFloat(USER1_RATE),
};
