# PocketLedger

**Your money, your device.** A free, open-source expense tracker with no accounts, subscriptions, bank credentials, analytics, or required backend.

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

Use Node.js **22.12 or newer** and npm. A modern browser with local storage, Web Crypto, and service-worker support is recommended. Use localhost or HTTPS.

```bash
git clone https://github.com/daksh043/pocketledger.git
cd pocketledger
git checkout feature/pocketledger
npm install
npm run dev
```

Open the local address printed by Vite. The feature branch command is only needed before this work is merged into `main`.

```bash
npm run check
npm run build
npm run preview
```

`check` runs ESLint, strict TypeScript checking, unit tests, and a production build. The tests cover integer-money calculations, date validation, malformed and duplicate records, storage failures, backup restoration, CSV quoting, and spreadsheet-formula escaping.

A lockfile is not included in this initial implementation. `npm install` generates one locally; retain and review it for reproducible dependency installs. The CI workflow uploads its generated lockfile with the build artifacts, but does not write back to the repository. Review dependency audit results before production deployment.

## First use

Choose a currency in **Data & privacy** before entering records. Add income and expenses under **Transactions**. The selected month controls the overview, transaction history, and budgets. Bills show all dates. A bill marked paid does **not** create an expense; record its payment separately.

Monthly net means recorded income minus recorded expenses in the selected month. It is not a bank balance and does not carry over earlier months.

## Offline use and hosting

Run a production build, open it online once, and wait for **Offline ready**. Thereafter the cached app shell can load without a connection. Service workers are disabled in development. Browser installation options vary; an SVG app icon is provided, and some platforms may require additional PNG icons for their installation UI.

Deploy the contents of `dist/` to a static host over HTTPS. The relative base path supports a repository subdirectory. Keep the trailing slash on subdirectory URLs. There is no server, API key, or database to configure. This repository's CI builds artifacts only: **it does not publish a site or change GitHub Pages settings**.

For a host with build settings, use `npm install && npm run build`, output directory `dist`, and Node 22.12+. If you have added a lockfile, prefer `npm ci`.

## CSV format

```csv
date,type,category,amount,note
2026-01-01,income,Salary,2500.00,Monthly pay
2026-01-02,expense,Food,12.50,Lunch
```

The header must be exactly `date,type,category,amount,note`. Dates use YYYY-MM-DD. Amounts are positive decimal currency units with at most two decimal places. Currency is not embedded in CSV; confirm the destination currency before importing. Use exact category names from the app.

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

Quoted commas, escaped double quotes, multiline notes, CRLF, and a UTF-8 BOM are supported. CSV validation is atomic: one invalid record rejects the import. Reimporting a file appends duplicates by design; use JSON backup restoration to replace a ledger. CSV exports prefix formula-like or apostrophe-prefixed notes with an apostrophe; PocketLedger reverses that escape on import. External CSV notes beginning with the same escape sequence are interpreted accordingly.

## Data safety and limits

Financial records use integer minor units (cents/paise), stored under `pocketledger:v1` in local storage. Each collection is limited to 5,000 records, amounts to 1,000,000,000.00, notes to 500 characters, and imported files to 2 MB. Browser storage quotas may impose lower limits. A backup larger than 2 MB cannot be restored through this version's import control; split or reduce large ledgers before reaching that limit. A failed save is reported and does not update the in-memory ledger.

**Local storage and downloads are not encrypted.** Anyone with access to your browser profile or backup files can read them. Clearing site data, private-browsing cleanup, changing origin, or switching devices can make your records unavailable. Hosting providers may log normal page and asset requests. Keep backups outside the browser, particularly before upgrading, restoring, resetting, or changing hosts.

If saved data is malformed, editing pauses instead of overwriting it. Use **Download raw saved data** before attempting recovery. Restore accepts schema version 1 only; future schema changes must add an explicit migration and tests before changing the version. Unknown extra fields are discarded during validation.

Use one editing tab. Storage events and a pre-save comparison detect most cross-tab changes and pause editing, but local storage has no transactional compare-and-swap: simultaneous writes are not guaranteed safe. There is no cross-device sync, multi-user support, recurring bill generation, bank import integration, background notification delivery, or accounting/tax advice.

## Verification before release

| Check | How to verify |
| --- | --- |
| Automated checks | Run `npm run check` or inspect the pull request's CI result |
| Transaction flows | Add income and expense, edit and delete; check monthly totals |
| Budgets | Create a limit, exceed it, and switch months |
| Bills | Add overdue and future dates; toggle paid; verify no expense is auto-created |
| CSV | Export, import into an empty ledger, and check multiline notes and formula-like values |
| Recovery | Back up, restore, test storage denial, and preserve raw data before reset |
| Offline | Use production preview; wait for Offline ready, disconnect, and reload |
| Accessibility | Navigate by keyboard; test screen reader labels and a narrow viewport |
| Multi-tab | Change records in another tab and verify editing pauses |

The initial implementation includes unit tests, not browser end-to-end tests. A passing build is not a substitute for the manual browser checks above.

## Contributing and license

Keep changes focused, add tests for behavior changes, and run `npm run check` before opening a pull request. Do not attach real financial records to public issues. Use synthetic examples for bug reports. No production secrets are required.

Released under the [MIT License](LICENSE): free to use, modify, distribute, and self-host. Provided without warranty.
