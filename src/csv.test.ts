import { describe, expect, it } from 'vitest';
import { exportCsv, importCsv } from './csv';
import type { Transaction } from './ledger';
const header = 'date,type,category,amount,note';
describe('CSV', () => {
  it('round trips commas, quotes, Unicode and multiline notes', () => {
    const rows: Transaction[] = [{ id: 'a', date: '2026-09-01', type: 'expense', category: 'Food', amount: 299, note: 'Tea, "coffee"\n₹' }];
    expect(importCsv(exportCsv(rows), () => 'a')).toEqual(rows);
  });
  it('neutralizes spreadsheet formulas and preserves notes on reimport', () => {
    const rows: Transaction[] = [{ id: 'a', date: '2026-09-01', type: 'income', category: 'Other income', amount: 100, note: '=1+1' }];
    expect(exportCsv(rows)).toContain("'=1+1");
    expect(importCsv(exportCsv(rows), () => 'a')).toEqual(rows);
    rows[0].note = "'quoted";
    expect(importCsv(exportCsv(rows), () => 'a')).toEqual(rows);
  });
  it('accepts BOM and CRLF', () => {
    expect(importCsv('\uFEFF' + header + '\r\n2026-09-01,expense,Food,12.30,lunch\r\n')).toHaveLength(1);
  });
  it('rejects invalid headers, amounts, dates and broken quoting atomically', () => {
    for (const text of ['wrong\n1', header + '\n2026-02-30,expense,Food,2,x', header + '\n2026-09-01,expense,Food,-1,x', header + '\n2026-09-01,expense,Food,1,"broken', header + '\n2026-09-01,expense,Food,1,"x"oops']) expect(() => importCsv(text)).toThrow();
  });
});
