import { isNeededReSplit } from "../src/validator/isNeededResplit";
import { splitExpense } from "../src/logic/splitExpense";
import { findLastPaymentDate } from "../src/logic/findLastPaymentDate";
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

const firstDayOfCurrenMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
).toISOString();

// 環境変数を設定済みの関数
const isNeededReSplitWrapper = (expense: components["schemas"]["expense"]) =>
  isNeededReSplit({
    expense,
    lastPaymentDate: firstDayOfCurrenMonth,
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
    expect(isNeededReSplitWrapper(missingGroupIdData)).toBe(false);
  });
});

describe("補正対象判定処理テスト", () => {
  test("典型例: 支払い前でデフォルト負担率（50:50）のデータを処理する", () => {
    expect(isNeededReSplitWrapper(basicExpense)).toBeTruthy();
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
    expect(isNeededReSplitWrapper(simpleDebtExpense)).toBeFalsy();
  });

  test("補正済みデータは処理対象としない", () => {
    const cost = 1000;
    const nonPayerOwed = cost * parseFloat(USER1_RATE);
    const payerOwed = cost * parseFloat(USER2_RATE);
    const reSplittedExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      repayments: [
        {
          amount: nonPayerOwed.toFixed(1),
        },
      ],
      users: [
        {
          owed_share: nonPayerOwed.toFixed(1),
          net_balance: (-nonPayerOwed).toFixed(1),
        },
        {
          owed_share: payerOwed.toFixed(1),
          net_balance: nonPayerOwed.toFixed(1),
        },
      ],
    };
    expect(isNeededReSplitWrapper(reSplittedExpense)).toBeFalsy();
  });

  test("指定したグループID以外は処理対象としない", () => {
    const nonTargetGroupExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      group_id: 88888888,
    };
    expect(isNeededReSplitWrapper(nonTargetGroupExpense)).toBeFalsy();
  });

  test("Payment Date以前のデータは対象としない", () => {
    const nonTargetGroupExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      created_at: "2021-08-31T00:00:00Z",
    };
    expect(isNeededReSplitWrapper(nonTargetGroupExpense)).toBeFalsy();
  });

  test("削除済みのデータは処理対象としない", () => {
    const deletedExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      deleted_at: new Date().toISOString(),
    };
    expect(isNeededReSplitWrapper(deletedExpense)).toBeFalsy();
  });
});

describe("最新精算日の取得テスト", () => {
  // basicExpenseはファイル末尾で定義されているため、テスト実行時に参照する
  const makePaymentExpense = (): components["schemas"]["expense"] => ({
    ...basicExpense,
    payment: true,
    created_at: "2026-08-31T00:00:00Z",
  });

  test("対象グループの最新の精算レコードの日時を返す", () => {
    const paymentExpense = makePaymentExpense();
    const olderPayment = {
      ...paymentExpense,
      created_at: "2026-07-31T00:00:00Z",
    };
    expect(
      findLastPaymentDate(
        [basicExpense, paymentExpense, olderPayment],
        SPLITWISE_GROUP_ID,
      ),
    ).toBe("2026-08-31T00:00:00Z");
  });

  test("他グループの精算レコードは無視する", () => {
    const paymentExpense = makePaymentExpense();
    const otherGroupPayment = {
      ...paymentExpense,
      group_id: 88888888,
      created_at: "2026-09-30T00:00:00Z",
    };
    expect(
      findLastPaymentDate(
        [otherGroupPayment, basicExpense, paymentExpense],
        SPLITWISE_GROUP_ID,
      ),
    ).toBe("2026-08-31T00:00:00Z");
  });

  test("削除済みの精算レコードは無視する", () => {
    const paymentExpense = makePaymentExpense();
    const deletedPayment = {
      ...paymentExpense,
      created_at: "2026-09-30T00:00:00Z",
      deleted_at: "2026-09-30T01:00:00Z",
    };
    expect(
      findLastPaymentDate(
        [deletedPayment, basicExpense, paymentExpense],
        SPLITWISE_GROUP_ID,
      ),
    ).toBe("2026-08-31T00:00:00Z");
  });

  test("精算レコードが無い場合はundefinedを返す（当月1日に丸めない）", () => {
    expect(
      findLastPaymentDate([basicExpense], SPLITWISE_GROUP_ID),
    ).toBeUndefined();
  });

  test("精算レコードが無い場合、前月の経費も処理対象になる", () => {
    const lastMonthExpense: components["schemas"]["expense"] = {
      ...basicExpense,
      created_at: new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        15,
      ).toISOString(),
    };
    const lastPaymentDate =
      findLastPaymentDate([lastMonthExpense], SPLITWISE_GROUP_ID) ??
      new Date(0).toISOString();
    expect(
      isNeededReSplit({
        expense: lastMonthExpense,
        lastPaymentDate,
        USER1_RATE,
        USER2_RATE,
        SPLITWISE_GROUP_ID,
      }),
    ).toBeTruthy();
  });
});

describe("割り勘補正処理テスト", () => {
  test("割り切ることのできる金額を処理できる", () => {
    expect(splitExpenseWrapper(basicExpense)).toEqual(reSplittedExpenseBalance);
  });
  test("割り切れない場合の端数を処理できる", () => {
    const oddCost = 999;
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
    const payerOwedShare = Math.round(oddCost * parseFloat(USER2_RATE));
    const oddExpenseReSplittedBalance = {
      payerOwedShare,
      nonPayerOwedShare: oddCost - payerOwedShare,
    };

    expect(splitExpenseWrapper(oddBlanceExpense)).toEqual(
      oddExpenseReSplittedBalance,
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
