# Finance Imports, Receipts and Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add only the missing finance capabilities: CSV/PDF-text/manual statement input, settlement receipts, and CSV/XLSX/PDF/print output.

**Architecture:** Preserve the existing finance/conciliação engine. Add input adapters around `statement-import`, a focused finance-document service around existing entries/settlements, HTTP endpoints for report/receipt payloads, and Electron IPC for local file selection/PDF/printing. No paid service or cloud dependency is introduced.

**Tech Stack:** Node.js 22, Electron, SQLite, built-in Node APIs, `pdfjs-dist` (OSS) only for extracting text from user-selected PDFs.

**Spec:** User requested items 1–3 identified in the ERP-vs-finance comparison.

## Global Constraints

- Core must remain R$ 0, local/self-hosted and not depend on a paid service.
- Do not duplicate existing OFX, reconciliation, DRE, cashflow or finance ledger logic.
- Statement preview must remain read-only and commit must remain idempotent.
- Reversed settlements must not produce valid receipts.
- XLSX must be a real OpenXML workbook and must not require Microsoft Office.

## Review Focus

- CSV decimal comma, quoted delimiters and renamed duplicate files.
- PDF-text lines that do not match the supported transaction pattern must be ignored, not invented.
- Manual rows require an ISO date, direction and positive integer cents.
- Receipt generation must reject reversed settlements.
- Export strings must escape spreadsheet/HTML content and preserve amounts in cents internally.

---

### Task 1: Statement input adapters

**Files:**
- Create: `js/domains/finance/csv-statement-parser.js`
- Create: `js/domains/finance/pdf-text-statement-parser.js`
- Modify: `js/domains/finance/statement-import.js`
- Modify: `desktop/import-bridge.cjs`
- Modify: `desktop/renderer/app.js`
- Test: `test/finance-io.test.js`

**Interfaces:**
- Consumes existing `bankStatements.preview/commit`.
- Produces normalized transaction rows `{date,direction,amountCents,description,externalId?,rowIndex}`.

- [ ] Write failing tests for CSV, PDF-text and MANUAL preview/commit.
- [ ] Verify the tests fail because the new source types are unsupported.
- [ ] Implement parsers and source-type dispatch without changing reconciliation semantics.
- [ ] Extend the Electron file picker to OFX/CSV/PDF, extracting text from PDF locally.
- [ ] Add the finance-screen import controls and manual-row entry.
- [ ] Run the finance I/O test and full suite.

### Task 2: Settlement receipts

**Files:**
- Create: `js/domains/reports/finance-document-service.js`
- Modify: `js/core/erp-runtime.js`
- Modify: `server/routers/reporting-router.js`
- Modify: `desktop/renderer/app.js`
- Test: `test/finance-io.test.js`

**Interfaces:**
- `settlementReceipt(settlementId)` returns a structured receipt.
- `toPrintableHtml(document)` returns escaped printable HTML.

- [ ] Write failing tests for receipt content and reversed-settlement rejection.
- [ ] Implement receipt lookup from existing finance tables.
- [ ] Expose receipt JSON/print endpoints.
- [ ] Add receipt actions in the finance screen.
- [ ] Run targeted and full tests.

### Task 3: CSV/XLSX/PDF/print exports

**Files:**
- Modify: `js/domains/reports/finance-document-service.js`
- Modify: `server/routers/reporting-router.js`
- Modify: `desktop/main.cjs`
- Modify: `desktop/preload.cjs`
- Modify: `desktop/renderer/app.js`
- Modify: `package.json`
- Test: `test/finance-io.test.js`

**Interfaces:**
- `financialReport(filters)`, `toCsv(report)`, `toXlsxBuffer(report)`, `toPrintableHtml(report)`.
- Electron bridge: `saveExportFile`, `savePdf`, `printHtml`.

- [ ] Write failing tests for CSV escaping, XLSX ZIP signature and printable HTML.
- [ ] Implement report/export serialization using built-in APIs.
- [ ] Add reporting endpoints and Electron save/print bridge.
- [ ] Wire export buttons into the reports screen.
- [ ] Run `npm run verify` and inspect the final branch diff.
