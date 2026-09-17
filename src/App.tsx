import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { amountToCents, CURRENCIES, emptyLedger, EXPENSE_CATEGORIES, INCOME_CATEGORIES, localDate, money, monthlySummary, validMonth, validateLedger, type Ledger, type Transaction, type Currency } from './ledger';
import { backupText, download, loadLedger, MAX_FILE_BYTES, restoreBackup, saveLedger, STORAGE_KEY } from './storage';
import { exportCsv, importCsv } from './csv';

type Page = 'Overview' | 'Transactions' | 'Budgets' | 'Bills' | 'Data & privacy';
const pages: Page[] = ['Overview', 'Transactions', 'Budgets', 'Bills', 'Data & privacy'];
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. No changes were saved.';
const get = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
function boot() {
  const loaded = loadLedger();
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* loadLedger supplies the recovery message. */ }
  return { ...loaded, raw };
}

function TransactionForm({ existing, disabled, onSave, onCancel }: { existing: Transaction | null; disabled: boolean; onSave: (row: Transaction) => boolean; onCancel: () => void }) {
  const [type, setType] = useState<'income' | 'expense'>(existing?.type ?? 'expense');
  const [error, setError] = useState('');
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget, values = new FormData(element);
    try {
      const row: Transaction = { id: existing?.id ?? crypto.randomUUID(), type, date: get(values, 'date'), category: get(values, 'category'), amount: amountToCents(get(values, 'amount')), note: get(values, 'note') };
      if (onSave(row)) { element.reset(); setError(''); }
    } catch (err) { setError(errorText(err)); }
  }
  return <form className="panel transaction-form" onSubmit={submit}>
    <div className="section-heading"><h2>{existing ? 'Edit transaction' : 'Add a transaction'}</h2><span className="eyebrow">MANUAL ENTRY</span></div>
    <fieldset disabled={disabled}>
      <div className="form-grid">
        <label>Type<select name="type" value={type} onChange={e => setType(e.target.value as 'income' | 'expense')}><option value="expense">Expense</option><option value="income">Income</option></select></label>
        <label>Amount<input name="amount" type="text" inputMode="decimal" placeholder="0.00" required maxLength={14} defaultValue={existing ? (existing.amount / 100).toFixed(2) : ''} /></label>
        <label>Date<input name="date" type="date" required min="1900-01-01" max="9999-12-31" defaultValue={existing?.date ?? localDate()} /></label>
        <label>Category<select key={type} name="category" defaultValue={existing?.type === type ? existing.category : categories[0]}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="wide">Note <span className="muted">(optional)</span><input name="note" maxLength={500} placeholder="What was this for?" defaultValue={existing?.note ?? ''} /></label>
      </div>
      <div className="actions"><button type="submit">{existing ? 'Save changes' : 'Add transaction'}</button>{existing && <button type="button" className="secondary" onClick={onCancel}>Cancel edit</button>}</div>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
  </form>;
}

export default function App() {
  const [initial] = useState(boot);
  const [data, setData] = useState<Ledger>(initial.data);
  const lastSaved = useRef(initial.raw);
  const [locked, setLocked] = useState(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error ?? '');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState<Page>('Overview');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [today, setToday] = useState(localDate());
  const [limit, setLimit] = useState(50);
  const [importing, setImporting] = useState(false);
  const { offlineReady: [offlineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError(error) { setNotice(`Offline cache unavailable: ${errorText(error)}. Your saved ledger is unaffected.`); } });
  useEffect(() => {
    const connected = () => setOnline(navigator.onLine);
    const changed = (event: StorageEvent) => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === localStorage) {
        setLocked(true); setNotice('Ledger changed in another tab. Reload before editing to avoid overwriting those changes.');
      }
    };
    window.addEventListener('online', connected); window.addEventListener('offline', connected); window.addEventListener('storage', changed);
    const timer = window.setInterval(() => setToday(localDate()), 60_000);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', connected); window.removeEventListener('storage', changed); window.clearInterval(timer); };
  }, []);
  const busy = locked || importing;
  const summary = monthlySummary(data, month);
  const fmt = (amount: number) => money(amount, data.currency);
  const monthlyRows = data.transactions.filter(t => t.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = monthlyRows.filter(t => (filter === 'all' || filter === t.type) && `${t.note} ${t.category} ${t.date}`.toLowerCase().includes(query.toLowerCase()));
  const budgets = data.budgets.filter(b => b.month === month);
  const unpaid = data.bills.filter(b => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = unpaid.filter(b => b.dueDate < today);
  const hasRecords = data.transactions.length + data.budgets.length + data.bills.length > 0;

  function commit(next: Ledger, message: string, recovery = false) {
    if (locked && !recovery) { setNotice('Editing is paused. Resolve the storage warning first.'); return false; }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== lastSaved.current) {
        setLocked(true); throw new Error('Saved data changed in another tab. Reload before continuing.');
      }
      const validated = validateLedger(next);
      saveLedger(validated);
      lastSaved.current = JSON.stringify(validated);
      setData(validated); setLocked(false); setNotice(''); setStatus(message);
      return true;
    } catch (error) { setNotice(`Not saved: ${errorText(error)} Check browser storage permissions or available space.`); return false; }
  }
  function removeTransaction(row: Transaction) {
    if (window.confirm(`Delete this ${fmt(row.amount)} ${row.category} transaction?`)) commit({ ...data, transactions: data.transactions.filter(t => t.id !== row.id) }, 'Transaction deleted.');
  }
  function saveTransaction(row: Transaction) {
    const next = editing ? data.transactions.map(t => t.id === editing.id ? row : t) : [...data.transactions, row];
    const ok = commit({ ...data, transactions: next }, editing ? 'Transaction updated.' : 'Transaction added.');
    if (ok) setEditing(null);
    return ok;
  }
  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    try {
      const category = get(values, 'category'), amount = amountToCents(get(values, 'amount'));
      if (commit({ ...data, budgets: [...data.budgets.filter(b => !(b.month === month && b.category === category)), { month, category, amount }] }, 'Monthly budget saved.')) form.reset();
    } catch (err) { setNotice(errorText(err)); }
  }
  function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    try {
      const bill = { id: crypto.randomUUID(), name: get(values, 'name'), dueDate: get(values, 'dueDate'), amount: amountToCents(get(values, 'amount')), paid: false };
      if (commit({ ...data, bills: [...data.bills, bill] }, 'Bill reminder added.')) form.reset();
    } catch (err) { setNotice(errorText(err)); }
  }
  function downloadBackup() {
    try { download(`pocketledger-${today}.json`, backupText(data), 'application/json'); setStatus('Backup download started. Keep it somewhere safe.'); }
    catch (err) { setNotice(errorText(err)); }
  }
  async function importFile(file: File | undefined, kind: 'csv' | 'backup') {
    if (!file || importing) return;
    setImporting(true);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 2 MB.');
      const text = await file.text();
      if (kind === 'backup') {
        const next = restoreBackup(text);
        if (window.confirm(`Replace this device's ledger with ${next.transactions.length} transactions, ${next.budgets.length} budgets and ${next.bills.length} bills in ${next.currency}? Download your current backup first if needed.`)) {
          if (commit(next, 'Backup restored.', true)) setEditing(null);
        }
      } else {
        const rows = importCsv(text);
        if (!rows.length) throw new Error('No transactions found in the CSV.');
        if (window.confirm(`Import ${rows.length} transactions as ${data.currency}? CSV contains no currency. Reimporting a file creates duplicates.`)) commit({ ...data, transactions: [...data.transactions, ...rows] }, `Imported ${rows.length} transactions.`);
      }
    } catch (err) { setNotice(errorText(err)); }
    finally { setImporting(false); }
  }
  function transactionTable(rows: Transaction[]) {
    if (!rows.length) return <div className="empty"><strong>No transactions here yet</strong><p>Add your first entry, or choose another month or filter.</p></div>;
    return <div className="table-scroll"><table><caption className="sr-only">Transactions for {month}</caption><thead><tr><th>Date</th><th>Details</th><th>Type</th><th className="number">Amount</th><th>Actions</th></tr></thead><tbody>{rows.map(t => <tr key={t.id}>
      <td className="nowrap">{t.date}</td><td><strong>{t.category}</strong><span className="table-note">{t.note || 'No note'}</span></td><td><span className={`badge ${t.type}`}>{t.type}</span></td><td className={`number ${t.type === 'income' ? 'positive' : ''}`}>{t.type === 'income' ? '+' : '−'}{fmt(t.amount)}</td>
      <td><div className="row-actions"><button disabled={busy} className="text-button" aria-label={`Edit ${t.category} transaction on ${t.date}`} onClick={() => { setEditing(t); setPage('Transactions'); window.scrollTo({ top: 0 }); }}>Edit</button><button disabled={busy} className="text-button danger" aria-label={`Delete ${t.category} transaction on ${t.date}`} onClick={() => removeTransaction(t)}>Delete</button></div></td>
    </tr>)}</tbody></table></div>;
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#main"><span className="brand-icon" aria-hidden="true">P</span><span>PocketLedger<small>Less worry. More clarity.</small></span></a>
      <nav aria-label="Main navigation">{pages.map((name, i) => <button key={name} className={page === name ? 'nav-item active' : 'nav-item'} aria-current={page === name ? 'page' : undefined} onClick={() => { setPage(name); setStatus(''); }}><span className="nav-number" aria-hidden="true">0{i + 1}</span>{name}</button>)}</nav>
      <div className="sidebar-bottom"><span className="privacy-dot" /> Your device. Your data.<p>No account, tracking, or subscriptions.</p><span className="version">OPEN SOURCE · MIT LICENSE</span></div>
    </aside>
    <main id="main" tabIndex={-1}>
      <header className="topbar"><span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span><span className="connection"><span className={online ? 'online-dot' : 'offline-dot'} />{online ? 'Device online' : 'Device offline'}{offlineReady ? ' · Offline ready' : ''}</span></header>
      <div className="page-heading"><div><h1>{page === 'Overview' ? 'Your money, at a glance.' : page}</h1><p>{page === 'Overview' ? 'Make room for what matters. Start with knowing where you stand.' : 'Simple tools. Thoughtful decisions. All on your device.'}</p></div>{['Overview', 'Transactions', 'Budgets'].includes(page) && <label className="month-picker">Selected month<input type="month" value={month} min="1900-01" max="9999-12" onChange={e => { if (validMonth(e.target.value)) { setMonth(e.target.value); setLimit(50); } }} /></label>}</div>
      {notice && <div className="notice" role="alert"><p>{notice}</p>{locked && <div className="actions"><button className="secondary" onClick={() => window.location.reload()}>Reload</button><button className="secondary" onClick={() => setPage('Data & privacy')}>Recovery options</button></div>}<button className="text-button" onClick={() => setNotice('')}>Dismiss message</button></div>}
      {locked && !notice && <p className="notice">Editing remains paused. Open Data &amp; privacy for recovery, or reload.</p>}
      <div role="status" aria-live="polite" className={status ? 'success-message' : 'sr-only'}>{status}</div>
      {needRefresh && <div className="notice"><p>A new app version is ready. Save any unfinished form before reloading.</p><button onClick={() => { if (window.confirm('Reload to update? Unsaved form text will be lost.')) void updateServiceWorker(true).catch(err => setNotice(errorText(err))); }}>Update and reload</button></div>}

      {page === 'Overview' && <>
        <section className="stats" aria-label="Monthly summary">
          <article className="stat balance"><span>Monthly net</span><strong>{fmt(summary.balance)}</strong><small>Income minus expenses · not a bank balance</small></article>
          <article className="stat"><span>Money in</span><strong className="positive">{fmt(summary.income)}</strong><small>Income recorded this month</small></article>
          <article className="stat"><span>Money out</span><strong>{fmt(summary.expenses)}</strong><small>{monthlyRows.filter(t => t.type === 'expense').length} expenses recorded this month</small></article>
        </section>
        {!hasRecords && <section className="welcome panel"><div><span className="eyebrow">A FRESH START</span><h2>Small entries. A clearer picture.</h2><p>Add an income or expense to begin. Nothing leaves this browser, and there is no account to create.</p></div><button disabled={busy} onClick={() => setPage('Transactions')}>Add your first transaction</button></section>}
        <div className="two-column"><section className="panel"><div className="section-heading"><h2>Spending breakdown</h2><span className="muted">{month}</span></div>
          {summary.expenses === 0 ? <div className="empty"><strong>Space for your spending story</strong><p>Category totals will appear after you record expenses.</p></div> : <ul className="category-list">{Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([category, total]) => <li key={category}><div className="spread"><strong>{category}</strong><span>{fmt(total)} <small className="muted">· {Math.round(total / summary.expenses * 100)}%</small></span></div><progress aria-label={`${category} share of spending`} value={total} max={summary.expenses} /></li>)}</ul>}
        </section><section className="panel"><div className="section-heading"><h2>On the horizon</h2><span className="badge">{unpaid.length} unpaid</span></div><p className="muted">All dates · reminders only, not automatic payments</p>
          {unpaid.length === 0 ? <div className="empty"><strong>Nothing waiting on you</strong><p>Add upcoming bills to keep due dates in sight.</p></div> : <ul className="bill-preview">{unpaid.slice(0, 4).map(b => <li key={b.id}><div><strong>{b.name}</strong><small className={b.dueDate < today ? 'danger' : 'muted'}>{b.dueDate < today ? 'Overdue' : b.dueDate === today ? 'Due today' : 'Due'} · {b.dueDate}</small></div><strong>{fmt(b.amount)}</strong></li>)}</ul>}
          <button className="secondary" onClick={() => setPage('Bills')}>Manage bills{overdue.length ? ` · ${overdue.length} overdue` : ''}</button>
        </section></div>
        <section className="panel"><div className="section-heading"><h2>Recent transactions</h2><button className="text-button" onClick={() => setPage('Transactions')}>View all →</button></div>{transactionTable(monthlyRows.slice(0, 5))}</section>
      </>}

      {page === 'Transactions' && <>
        <TransactionForm key={editing?.id ?? 'new'} existing={editing} disabled={busy} onSave={saveTransaction} onCancel={() => setEditing(null)} />
        <section className="panel"><div className="section-heading"><h2>Transaction history</h2><span className="muted">{filtered.length} matching entries</span></div><div className="filters"><label>Search<input type="search" value={query} placeholder="Note, category or date" onChange={e => { setQuery(e.target.value); setLimit(50); }} /></label><label>Type<select value={filter} onChange={e => { setFilter(e.target.value); setLimit(50); }}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></label></div>
          {transactionTable(filtered.slice(0, limit))}{filtered.length > limit && <button className="secondary" onClick={() => setLimit(n => n + 50)}>Show 50 more</button>}
        </section>
      </>}

      {page === 'Budgets' && <>
        <form className="panel" onSubmit={saveBudget}><h2>Give your spending a plan</h2><p className="muted">Budgets apply to {month} only. Saving an existing category replaces its limit.</p><fieldset disabled={busy}><div className="form-grid"><label>Category<select name="category">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Monthly limit ({data.currency})<input name="amount" required inputMode="decimal" placeholder="0.00" maxLength={14} /></label></div><button type="submit">Save budget</button></fieldset></form>
        <section className="panel"><div className="section-heading"><h2>Your category budgets</h2><span className="muted">{budgets.length} planned categories</span></div>{!budgets.length ? <div className="empty"><strong>A plan, not a restriction.</strong><p>Set a limit for a category to see spending against your plan.</p></div> : <ul className="budget-list">{budgets.map(b => { const spent = summary.byCategory[b.category] ?? 0; return <li key={b.category}><div className="spread"><strong>{b.category}</strong><span className={spent > b.amount ? 'danger' : ''}>{fmt(spent)} / {fmt(b.amount)}</span></div><progress className={spent > b.amount ? 'over' : ''} aria-label={`${b.category} budget used`} value={Math.min(spent, b.amount)} max={b.amount} /><div className="spread"><small className={spent > b.amount ? 'danger' : 'muted'}>{fmt(Math.abs(b.amount - spent))} {spent > b.amount ? 'over budget' : 'remaining'} · {Math.round(spent / b.amount * 100)}% used</small><button disabled={busy} className="text-button danger" onClick={() => { if (window.confirm(`Remove the ${b.category} budget for ${month}?`)) commit({ ...data, budgets: data.budgets.filter(x => x !== b) }, 'Budget removed.'); }}>Remove</button></div></li>; })}</ul>}</section>
      </>}

      {page === 'Bills' && <>
        <form className="panel" onSubmit={saveBill}><h2>Keep a due date in sight</h2><p className="muted">Reminders appear here when the app is open. Marking a bill paid does not create an expense; record the payment separately.</p><fieldset disabled={busy}><div className="form-grid"><label>Bill name<input name="name" required maxLength={100} placeholder="Internet, rent, electricity…" /></label><label>Amount ({data.currency})<input name="amount" required inputMode="decimal" placeholder="0.00" maxLength={14} /></label><label>Due date<input name="dueDate" type="date" required min="1900-01-01" max="9999-12-31" defaultValue={today} /></label></div><button type="submit">Add bill reminder</button></fieldset></form>
        <section className="panel"><div className="section-heading"><h2>All bills</h2><span className="badge">{overdue.length} overdue</span></div>{!data.bills.length ? <div className="empty"><strong>No bills added</strong><p>Track upcoming payments without connecting a bank account.</p></div> : <ul className="bill-list">{[...data.bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDate.localeCompare(b.dueDate)).map(b => <li key={b.id}><div><strong>{b.name}</strong><small>Due {b.dueDate}</small></div><strong>{fmt(b.amount)}</strong><span className={`badge ${b.paid ? 'income' : b.dueDate < today ? 'expense' : ''}`}>{b.paid ? 'Paid' : b.dueDate < today ? 'Overdue' : b.dueDate === today ? 'Due today' : 'Upcoming'}</span><div className="row-actions"><button disabled={busy} className="secondary" onClick={() => commit({ ...data, bills: data.bills.map(x => x.id === b.id ? { ...x, paid: !x.paid } : x) }, b.paid ? 'Bill marked unpaid.' : 'Bill marked paid. Add its expense separately if needed.')}>{b.paid ? 'Mark unpaid' : 'Mark paid'}</button><button disabled={busy} className="text-button danger" onClick={() => { if (window.confirm(`Delete the ${b.name} reminder?`)) commit({ ...data, bills: data.bills.filter(x => x.id !== b.id) }, 'Bill deleted.'); }}>Delete</button></div></li>)}</ul>}</section>
      </>}

      {page === 'Data & privacy' && <>
        <section className="panel"><h2>Your data belongs to you</h2><p>PocketLedger stores financial records in this browser's local storage. There are no accounts, analytics, bank connections or financial-data uploads. Your host may log ordinary page requests.</p><p><strong>Local storage is not encrypted.</strong> Anyone with access to your browser profile may see your records. Private browsing, clearing site data, or changing devices can remove access to your ledger. Keep regular backups; downloaded files contain sensitive information.</p><label className="currency-field">Ledger currency<select value={data.currency} disabled={busy || hasRecords} onChange={e => commit({ ...data, currency: e.target.value as Currency }, 'Currency changed.')} >{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label><p className="muted">Choose currency before adding records. Currency changes are blocked once records exist; amounts are never converted. One currency per ledger.</p></section>
        <div className="two-column"><section className="panel"><h2>Back up &amp; restore</h2><p>JSON backups include every transaction, budget, bill, and your currency. Restore replaces the entire ledger after confirmation.</p><div className="actions"><button disabled={locked || importing} onClick={downloadBackup}>Download JSON backup</button><label className={`file-button secondary ${importing ? 'disabled' : ''}`}>Restore JSON backup<input type="file" accept=".json,application/json" disabled={importing} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importFile(file, 'backup'); }} /></label></div><p className="muted">Maximum import size: 2 MB. Keep your backup outside this browser.</p></section>
        <section className="panel"><h2>Move your transactions</h2><p>Export all dates as CSV for spreadsheets. Import appends transactions in {data.currency}; importing the same file again creates duplicates.</p><div className="actions"><button className="secondary" disabled={locked || importing} onClick={() => download(`pocketledger-transactions-${today}.csv`, exportCsv(data.transactions), 'text/csv;charset=utf-8')}>Export all CSV</button><label className={`file-button secondary ${busy ? 'disabled' : ''}`}>Import CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importFile(file, 'csv'); }} /></label></div><p className="muted">CSV header: <code>date,type,category,amount,note</code>. Dates use YYYY-MM-DD; amounts use decimal units, not cents. Use the exact categories shown in the entry form. Exported formula-like notes are prefixed with an apostrophe.</p><button className="text-button" onClick={() => download('pocketledger-template.csv', 'date,type,category,amount,note\r\n2026-01-01,expense,Food,12.50,Example lunch\r\n', 'text/csv')}>Download example CSV</button></section></div>
        <section className="panel"><h2>Offline &amp; recovery</h2><p>Open the production app online once and wait for “Offline ready”. Its cached app shell can then load without a connection. Install availability depends on your browser. Development mode does not cache the app.</p><p>Use one editing tab at a time. Changes detected in another tab pause editing until reload. Local storage is not a multi-user database.</p><button className="secondary" onClick={() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) throw new Error('No stored data found.'); download(`pocketledger-raw-${today}.txt`, raw, 'text/plain'); } catch (err) { setNotice(errorText(err)); } }}>Download raw saved data</button></section>
        <section className="panel danger-panel"><h2>Start over on this device</h2><p>This replaces all locally stored records with an empty ledger. It does not delete downloaded backups. Back up first.</p><button className="danger-button" disabled={importing} onClick={() => { if (window.confirm('Delete ALL transactions, budgets and bills in this browser? This cannot be undone without a backup.') && window.prompt('Type DELETE to confirm:') === 'DELETE') { if (commit({ ...emptyLedger(), currency: data.currency }, 'Local ledger reset.', true)) setEditing(null); } }}>Reset local ledger</button></section>
      </>}
      <footer>PocketLedger · Free to use. Yours to keep.<span>Saved only in this browser · Back up regularly.</span></footer>
    </main>
  </div>;
}
