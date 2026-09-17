# PocketLedger

**Your money, your device.** A free, MIT-licensed expense tracker with no accounts, subscriptions, bank credentials, analytics, or required backend.

> **Verification pending:** App code and unit tests are committed, but the connector could not create `.github/workflows/ci.yml`. No CI runs were found. Lint, type-checking, tests, production build, and browser behavior have not been executed in this implementation session. Run the checks below before merging or deploying. A workflow template is included below for manual setup.

## Features

| Feature | Details |
| --- | --- |
| Transactions | Add, edit, delete, search, and filter income and expenses by month |
| Overview | Monthly income, expenses, net amount, category totals, and recent entries |
| Budgets | Per-category monthly limits with remaining and overspent amounts |
| Bills | Due dates, overdue status, and manual paid/unpaid tracking |
| CSV | Validated append-only import and spreadsheet-safe export of all transactions |
| Backups | Versioned JSON export and confirmed full restore |
| Offline | Service-worker cached application shell after the first successful production load |
| Privacy | Local browser storage; no financial-data uploads or third-party fonts |
| Accessibility | Labeled forms, keyboard focus, skip link, live status messages, and reduced-motion support |
| Currency | INR, USD, EUR, GBP, AUD, or CAD; one currency per ledger, no conversion |

## Run locally

Use Node.js **22.12 or newer**, npm, and a modern browser supporting local storage, Web Crypto, and service workers. Serve over localhost or HTTPS.

```bash
git clone https://github.com/daksh043/pocketledger.git
cd pocketledger
git checkout feature/pocketledger
npm install
npm run check
npm run dev
```

Open the local address printed by Vite. The branch checkout is only needed before this work is merged into `main`.

```bash
npm run build
npm run preview
```

`npm run check` runs ESLint, strict TypeScript checking, unit tests, and a production build. Tests cover integer-money calculations, date validation, malformed and duplicate records, storage failures, backup restoration, CSV quoting, and spreadsheet-formula escaping. Browser end-to-end tests are not yet included.

A lockfile is not included in this initial implementation. `npm install` generates one locally; retain and review it for reproducible installs, then prefer `npm ci`. Review dependency audit results before production deployment.

## First use

Choose a currency in **Data & privacy** before entering records. Add income and expenses under **Transactions**. The selected month controls the overview, transaction history, and budgets. Bills show all dates. Marking a bill paid does **not** create an expense; record its payment separately.

Monthly net means recorded income minus recorded expenses in the selected month. It is not a bank balance and does not carry over earlier months.

## Offline use and hosting

Run a production build, open it online once, and wait for **Offline ready**. The cached app shell can then load without a connection. Service workers are disabled in development. Installation options vary by browser; the app supplies an SVG icon, and some platforms need additional PNG icons for installation UI.

Deploy `dist/` to a static host over HTTPS. The relative base path supports repository subdirectories; keep the trailing slash on subdirectory URLs. Use build command `npm install && npm run build`, output directory `dist`, and Node 22.12+. No server, database, or API key is required. **No deployment or GitHub Pages settings have been configured.**

## CSV format

```csv
date,type,category,amount,note
2026-01-01,income,Salary,2500.00,Monthly pay
2026-01-02,expense,Food,12.50,Lunch
```

The header must be exactly `date,type,category,amount,note`. Dates use YYYY-MM-DD. Amounts are positive decimal units with at most two decimal places. CSV contains no currency: confirm the destination currency before importing. Use exact category names from the app.

| Type | Category |
| --- | --- |
| Expense | Food |
| Expense | Housing |
| Expense | Transport |
| Expense | Utilities |
| Expense | Health |
| Expense | Education |
| Expense | Shopping |
| Expense | Entertainment |
| Expense | Other expense |
| Income | Salary |
| Income | Freelance |
| Income | Gift |
| Income | Other income |

Quoted commas, escaped double quotes, multiline notes, CRLF, and a UTF-8 BOM are supported. One invalid record rejects the whole import. Reimporting a file appends duplicates; use JSON restore to replace a ledger. CSV exports prefix formula-like or apostrophe-prefixed notes with an apostrophe; PocketLedger reverses that escape on import. External CSV notes beginning with the same sequence are interpreted accordingly.

## Data safety and limits

Money uses integer minor units (cents/paise). Records are stored under `pocketledger:v1` in local storage. Each collection supports at most 5,000 records; each amount is capped at 1,000,000,000.00, notes at 500 characters, and imported files at 2 MB. Browser storage quotas may impose lower limits. A backup larger than 2 MB cannot be restored using this version's import control; keep ledgers below that size. Failed saves are reported without updating the in-memory ledger.

**Local storage and downloaded files are not encrypted.** Anyone with access to your browser profile or files may read them. Clearing site data, private-browsing cleanup, changing origin, or switching devices can make records unavailable. Hosts may log ordinary page requests. Keep backups outside the browser before upgrading, restoring, resetting, or changing hosts.

Malformed saved data pauses editing instead of being silently overwritten. Use **Download raw saved data** before recovery. Restore accepts schema version 1 only; future schema changes must introduce explicit migrations and tests. Unknown extra fields are discarded during validation.

Use one editing tab. Storage events and a pre-save comparison detect most cross-tab changes, but local storage has no transactional compare-and-swap: simultaneous writes are not guaranteed safe. There is no cross-device sync, multi-user support, recurring bill generation, bank integration, background notification delivery, or accounting/tax advice.

## Add automated checks

The connector failed to create the workflow file; the exact cause was not returned. A maintainer can add this as `.github/workflows/ci.yml` on the feature branch. This builds and checks code only; it does not deploy or write repository contents.

```yaml
name: PocketLedger checks
on:
  push:
    branches: [main, feature/pocketledger]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm install --no-fund --no-audit
      - name: Lint, type-check, test, and build
        run: npm run check
      - name: Upload build and resolved lockfile
        uses: actions/upload-artifact@v4
        with:
          name: pocketledger-build
          path: |
            dist/
            package-lock.json
```

## Verify before release

| Check | How to verify |
| --- | --- |
| Automated checks | Run `npm run check`; do not merge until it passes |
| Transactions | Add income and expense, edit and delete, then verify month totals |
| Budgets | Set and exceed a limit, then switch months |
| Bills | Add overdue and future dates; toggle paid without creating an expense |
| CSV | Export and reimport into an empty ledger; verify quoted and formula-like notes |
| Recovery | Back up and restore; test storage denial; preserve raw data before reset |
| Offline | Run production preview, wait for Offline ready, disconnect and reload |
| Accessibility | Test keyboard navigation, screen reader labels, and narrow screens |
| Multi-tab | Change records in another tab and confirm editing pauses |

## Contributing and license

Keep changes focused, add behavior tests, and run `npm run check`. Use synthetic financial data in public issues, never real records. No production secrets are required.

Released under the [MIT License](LICENSE): free to use, modify, distribute, and self-host. Provided without warranty.
