import { components } from "../../@types/splitwise";

type Expense = components["schemas"]["expense"];

/**
 * 対象グループの最新の精算日を返す
 * expensesは支払い日の降順で並んでいる前提
 * 削除済みの精算レコードは対象外
 * 精算レコードが見つからない場合はundefinedを返す
 */
export const findLastPaymentDate = (
  expenses: Expense[],
  SPLITWISE_GROUP_ID: string,
): string | undefined =>
  expenses.find(
    (expense) =>
      expense.payment === true &&
      expense.deleted_at == null &&
      expense.group_id?.toString() === SPLITWISE_GROUP_ID &&
      expense.created_at !== undefined,
  )?.created_at;
