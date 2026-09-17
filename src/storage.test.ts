import { describe, expect, it } from 'vitest';
import { emptyLedger } from './ledger';
import { backupText, loadLedger, restoreBackup, saveLedger, STORAGE_KEY } from './storage';

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('storage', () => {
  it('starts empty, saves and reloads a validated ledger', () => {
    const store = memory();
    expect(loadLedger(store).data).toEqual(emptyLedger());
    const data = { ...emptyLedger(), currency: 'USD' as const };
    saveLedger(data, store);
    expect(loadLedger(store).data).toEqual(data);
  });
  it('preserves corrupt stored data instead of silently overwriting it', () => {
    const store = memory();
    store.setItem(STORAGE_KEY, '{broken');
    expect(loadLedger(store).error).toBeTruthy();
    expect(store.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('reports unavailable storage and write failures', () => {
    const store = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadLedger(store).error).toBeTruthy();
    expect(() => saveLedger(emptyLedger(), store)).toThrow();
  });
  it('round trips backups and rejects unsupported data', () => {
    expect(restoreBackup(backupText(emptyLedger()))).toEqual(emptyLedger());
    expect(() => restoreBackup('{"version":99}')).toThrow();
    expect(() => restoreBackup('x'.repeat(2_000_001))).toThrow();
  });
});
