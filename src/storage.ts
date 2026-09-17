import { emptyLedger, validateLedger, type Ledger } from './ledger';
export const STORAGE_KEY = 'pocketledger:v1';
export const MAX_FILE_BYTES = 2_000_000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export function loadLedger(store?: StoragePort): { data: Ledger; error: string | null } {
  try {
    const raw = (store ?? window.localStorage).getItem(STORAGE_KEY);
    return { data: raw === null ? emptyLedger() : validateLedger(JSON.parse(raw)), error: null };
  } catch {
    return { data: emptyLedger(), error: 'Saved data could not be read. Editing is paused to protect it. Download the raw data or restore a valid backup. If browser storage is blocked, enable it and reload.' };
  }
}
export function saveLedger(data: Ledger, store?: StoragePort) {
  const valid = validateLedger(data);
  (store ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(valid));
}
export function backupText(data: Ledger) { return JSON.stringify(validateLedger(data)); }
export function restoreBackup(text: string) {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error('Backup exceeds the 2 MB limit.');
  return validateLedger(JSON.parse(text));
}
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
