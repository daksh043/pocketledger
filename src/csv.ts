import { amountToCents, MAX_ROWS, validateTransaction, type Transaction } from './ledger';
import { MAX_FILE_BYTES } from './storage';
const HEADER = ['date', 'type', 'category', 'amount', 'note'];
const risky = /^[\s]*[=+@-]|^[\t\r\n'] /;
// Apostrophe escaping is reversible for files exported by PocketLedger.
function safeCell(value: string) {
  const protect = risky.test(value) || /^[\t\r\n']/.test(value);
  return '"' + (protect ? "'" + value : value).replace(/"/g, '""') + '"';
}
function unescapeNote(value: string) {
  if (value.startsWith("'") && (risky.test(value.slice(1)) || /^[\t\r\n']/.test(value.slice(1)))) return value.slice(1);
  return value;
}
export function exportCsv(rows: Transaction[]): string {
  return HEADER.join(',') + '\r\n' + rows.map(t => [t.date, t.type, t.category, (t.amount / 100).toFixed(2), t.note].map(safeCell).join(',')).join('\r\n');
}
function parse(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); result.push(row); row = []; if (result.length > MAX_ROWS + 1) throw new Error('Too many CSV rows.'); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += ch;
    } else if (ch === ',') endCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else if (closed) throw new Error('Unexpected text after a quoted CSV field.');
    else if (ch === '"') { if (cell) throw new Error('Quotes must enclose an entire CSV field.'); quoted = true; }
    else cell += ch;
  }
  if (quoted) throw new Error('Unclosed quote in CSV.');
  if (cell || row.length || closed) endRow();
  return result;
}
export function importCsv(text: string, id: () => string = () => crypto.randomUUID()): Transaction[] {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error('CSV exceeds the 2 MB limit.');
  const rows = parse(text.replace(/^\uFEFF/, ''));
  if (rows.shift()?.join(',') !== HEADER.join(',')) throw new Error('CSV header must be date,type,category,amount,note.');
  return rows.map((cells, index) => {
    try {
      if (cells.length !== 5) throw new Error('Expected exactly five columns.');
      return validateTransaction({ id: id(), date: cells[0], type: cells[1], category: cells[2], amount: amountToCents(cells[3]), note: unescapeNote(cells[4]) });
    } catch (error) { throw new Error(`CSV record ${index + 2}: ${error instanceof Error ? error.message : 'Invalid record.'}`); }
  });
}
