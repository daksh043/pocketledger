export const EXPENSE_CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Health', 'Education', 'Shopping', 'Entertainment', 'Other expense'] as const;
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Other income'] as const;
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'] as const;
export type Currency = typeof CURRENCIES[number];
export type Transaction = { id: string; date: string; type: 'income' | 'expense'; category: string; amount: number; note: string };
export type Budget = { month: string; category: string; amount: number };
export type Bill = { id: string; name: string; dueDate: string; amount: number; paid: boolean };
export type Ledger = { version: 1; currency: Currency; transactions: Transaction[]; budgets: Budget[]; bills: Bill[] };
export const MAX_ROWS = 5000;
export const MAX_AMOUNT = 100_000_000_000;
export const emptyLedger = (): Ledger => ({ version: 1, currency: 'INR', transactions: [], budgets: [], bills: [] });
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function validMonth(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 9999; }
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0, 7))) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function amountToCents(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new Error('Amount must be above zero and at most 1,000,000,000.00.');
  return amount;
}
export const money = (cents: number, currency: Currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('Invalid or excessively long text.');
  return value;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT) throw new Error('Invalid stored amount.');
  return value;
}
function date(value: unknown): string {
  const result = text(value, 10);
  if (!validDate(result)) throw new Error('Use a real date between years 1900 and 9999.');
  return result;
}
export function validateTransaction(value: unknown): Transaction {
  const row = record(value);
  if (row.type !== 'income' && row.type !== 'expense') throw new Error('Invalid transaction type.');
  const category = text(row.category, 40);
  const choices: readonly string[] = row.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (!choices.includes(category)) throw new Error('Category does not match the transaction type.');
  return { id: text(row.id, 100), date: date(row.date), type: row.type, category, amount: amount(row.amount), note: text(row.note, 500, true) };
}
function rows<T>(value: unknown, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw new Error(`A collection can contain at most ${MAX_ROWS} records.`);
  return value.map(parse);
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error('Duplicate records are not allowed.');
}
export function validateLedger(value: unknown): Ledger {
  const data = record(value);
  if (data.version !== 1) throw new Error('Unsupported backup version. Expected version 1.');
  if (!(CURRENCIES as readonly unknown[]).includes(data.currency)) throw new Error('Unsupported currency.');
  const transactions = rows(data.transactions, validateTransaction);
  const budgets = rows<Budget>(data.budgets, value => {
    const row = record(value), month = text(row.month, 7), category = text(row.category, 40);
    if (!validMonth(month) || !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) throw new Error('Invalid budget month or category.');
    return { month, category, amount: amount(row.amount) };
  });
  const bills = rows<Bill>(data.bills, value => {
    const row = record(value);
    if (typeof row.paid !== 'boolean') throw new Error('Invalid bill status.');
    return { id: text(row.id, 100), name: text(row.name, 100), dueDate: date(row.dueDate), amount: amount(row.amount), paid: row.paid };
  });
  unique(transactions.map(t => t.id)); unique(bills.map(b => b.id)); unique(budgets.map(b => `${b.month}:${b.category}`));
  return { version: 1, currency: data.currency as Currency, transactions, budgets, bills };
}
export function monthlySummary(data: Ledger, month: string) {
  let income = 0, expenses = 0;
  const byCategory: Record<string, number> = {};
  for (const row of data.transactions.filter(t => t.date.startsWith(month))) {
    if (row.type === 'income') income += row.amount;
    else { expenses += row.amount; byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount; }
  }
  return { income, expenses, balance: income - expenses, byCategory };
}
