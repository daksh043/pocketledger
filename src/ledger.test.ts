import { describe, expect, it } from 'vitest';
import { amountToCents, emptyLedger, monthlySummary, validateLedger, validDate } from './ledger';

describe('money and dates', () => {
  it('uses integer minor units without floating point rounding', () => {
    expect(amountToCents('0.29')).toBe(29);
    expect(amountToCents('125.5')).toBe(12550);
    for (const value of ['-1', '0', '1.001', '1e3', 'NaN', '', '1000000001']) {
      expect(() => amountToCents(value)).toThrow();
    }
  });
  it('rejects impossible dates', () => {
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2025-02-29')).toBe(false);
    expect(validDate('2026-13-01')).toBe(false);
    expect(validDate('2026-04-31')).toBe(false);
  });
});

describe('ledger validation and summaries', () => {
  it('accepts an empty ledger and rejects malformed backups', () => {
    expect(validateLedger(emptyLedger())).toEqual(emptyLedger());
    for (const input of [null, {}, { ...emptyLedger(), version: 2 }, { ...emptyLedger(), currency: 'XXX' }]) {
      expect(() => validateLedger(input)).toThrow();
    }
  });
  it('calculates only the selected month using integer amounts', () => {
    const data = emptyLedger();
    data.transactions = [
      { id: 'income', date: '2026-09-01', type: 'income', category: 'Salary', amount: 100000, note: '' },
      { id: 'food', date: '2026-09-02', type: 'expense', category: 'Food', amount: 12345, note: '' },
      { id: 'old', date: '2026-08-02', type: 'expense', category: 'Food', amount: 500, note: '' },
    ];
    expect(monthlySummary(data, '2026-09')).toEqual({ income: 100000, expenses: 12345, balance: 87655, byCategory: { Food: 12345 } });
  });
  it('rejects duplicate IDs, invalid categories, and fractional stored amounts', () => {
    const row = { id: 'one', date: '2026-09-01', type: 'expense' as const, category: 'Food', amount: 100, note: '' };
    expect(() => validateLedger({ ...emptyLedger(), transactions: [row, row] })).toThrow();
    expect(() => validateLedger({ ...emptyLedger(), transactions: [{ ...row, category: 'Salary' }] })).toThrow();
    expect(() => validateLedger({ ...emptyLedger(), transactions: [{ ...row, amount: 1.5 }] })).toThrow();
  });
  it('validates budget uniqueness and bill status', () => {
    const budget = { month: '2026-09', category: 'Food', amount: 20000 };
    expect(() => validateLedger({ ...emptyLedger(), budgets: [budget, budget] })).toThrow();
    expect(() => validateLedger({ ...emptyLedger(), budgets: [{ ...budget, month: '2026-99' }] })).toThrow();
    expect(() => validateLedger({ ...emptyLedger(), bills: [{ id: 'b', name: 'Rent', dueDate: '2026-09-10', amount: 100, paid: 'yes' }] })).toThrow();
  });
});
