/**
 * Canonical rule catalogue — Bangladesh Regulatory Mapping v2
 * (source-reviewed 2026-11-15).
 *
 * Single source of truth for the statutory rule IDs and their definitions.
 * Three layers MUST reconcile against this manifest by rule ID (refCode)
 * and definition:
 *   1. seed      — prisma/seed.ts writes these rows verbatim
 *   2. database  — Regulator / ObligationTemplate tables (live rows)
 *   3. engine    — /api/regulators + /api/calendar joins by refCode/templateId
 *
 * Any drift is reported by GET /api/reconciliation (src/lib/reconciliation.ts).
 */

export interface CatalogueRegulator {
  code: string
  name: string
  fullName: string
  description: string
  scopeNote: string | null
  sortOrder: number
}

export interface CatalogueTemplate {
  refCode: string
  regulatorCode: string
  module: string
  title: string
  description: string | null
  legalBasis: string
  legalBasisNote: string | null
  sourceTier: string
  lawStatus: string
  verification: string
  /** JSON-encoded string array of statutory form names */
  forms: string
  cadence: string
  deadlineRule: string
  deadlineNote: string | null
  applicableTo: string
}

export interface CatalogueSectionItem {
  title: string
  body: string
}

export const CATALOGUE_VERSION = 'Regulatory Mapping v2 · source-reviewed 2026-11-15'

// ── verbatim catalogue data (extracted from prisma/seed.ts) ──

const regulators = [
  {
    code: 'RJSC',
    name: 'RJSC',
    fullName: 'Registrar of Joint Stock Companies & Firms',
    description: 'Company incorporation, director registry, statutory registers, annual returns and share allotments under the Companies Act 1994.',
    scopeNote: null,
    sortOrder: 1,
  },
  {
    code: 'BSEC',
    name: 'BSEC',
    fullName: 'Bangladesh Securities & Exchange Commission',
    description: 'Listing-rule compliance, price-sensitive disclosures, related-party transactions, insider declarations and Corporate Governance Code 2018 compliance.',
    scopeNote: 'Corporate Governance Code 2018 issued under s. 2CC of the Securities and Exchange Ordinance 1969; compliance certificate from a practising professional accountant/secretary is mandatory.',
    sortOrder: 2,
  },
  {
    code: 'DSECSE',
    name: 'DSE & CSE',
    fullName: 'Dhaka & Chittagong Stock Exchanges',
    description: 'Exchange-push obligations: material event disclosure to both exchanges, quarterly financial statements, shareholding pattern and investor complaint resolution.',
    scopeNote: 'Consolidated text — verify chapter/section references against the current exchange-published rulebook.',
    sortOrder: 3,
  },
  {
    code: 'NBR',
    name: 'NBR',
    fullName: 'National Board of Revenue',
    description: 'Corporate income-tax returns, VAT returns (Mushak), TDS / withholding deposits and statements, and audit reconciliation.',
    scopeNote: null,
    sortOrder: 4,
  },
  {
    code: 'DOL',
    name: 'Department of Labour',
    fullName: 'Department of Labour — Ministry of Labour & Employment',
    description: 'Labour law filings, WPPF contribution (5% of profit), Provident Fund / Welfare Foundation and workplace safety registers.',
    scopeNote: 'Labour (Amendment) Ordinance 2025 + Labour (Amendment) Act 2026 together carry ~90 changes — re-verify every citation against the current text.',
    sortOrder: 5,
  },
  {
    code: 'BB',
    name: 'Bangladesh Bank',
    fullName: 'Bangladesh Bank — Central Bank of Bangladesh',
    description: 'Banking-company statutory returns, foreign-exchange (FE) returns and export / import documentation.',
    scopeNote: 'Banking-company returns apply ONLY to banks — not to ordinary listed PLCs. Do not file these for non-bank companies.',
    sortOrder: 6,
  },
  {
    code: 'NDGA',
    name: 'NDGA',
    fullName: 'National Data Governance Authority',
    description: 'Personal data inventory & consent registry, data-subject access requests, breach notification and Data Protection Officer duties.',
    scopeNote: 'PDPA 2026 in force 6 Nov 2025 except s.23 and ss.31–35 (18-month delay). Enforcement rules still being phased in.',
    sortOrder: 7,
  },
]

const templates = [
  // ── RJSC — Companies Act Service ──────────────────────────
  {
    refCode: 'RJSC-AR',
    regulatorCode: 'RJSC',
    module: 'Companies Act Service',
    title: 'Annual Return (RJSC)',
    description: 'Statutory annual return of the company filed with the Registrar after the AGM.',
    legalBasis: 'Companies Act 1994 (Act No. XVIII of 1994) — ss. 88, 110, 113, 152',
    legalBasisNote: 'Specific section numbers need confirmation against bdlaws.',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Annual Return']),
    cadence: 'ANNUAL',
    deadlineRule: '?? days from AGM',
    deadlineNote: 'UNVERIFIED — sources conflict: 30, 21, or 42 days. Pull from Companies Act 1994 on bdlaws before relying on it.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'RJSC-DC',
    regulatorCode: 'RJSC',
    module: 'Companies Act Service',
    title: 'Director Change Form',
    description: 'Notification of appointment, cessation or change of directors.',
    legalBasis: 'Companies Act 1994 (Act No. XVIII of 1994)',
    legalBasisNote: 'Form labels (X/XII/VI) are unverified — do not rely on Indian form numbers.',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Director change form']),
    cadence: 'ON_CHANGE',
    deadlineRule: '?? days',
    deadlineNote: 'UNVERIFIED — the 14-day claim was not BD-sourced.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'RJSC-ALLOT',
    regulatorCode: 'RJSC',
    module: 'Companies Act Service',
    title: 'Allotment Return',
    description: 'Return of allotment for any new share issue or private placement.',
    legalBasis: 'Companies Act 1994 (Act No. XVIII of 1994)',
    legalBasisNote: 'Form labels (X/XII/VI) are unverified — do not rely on Indian form numbers.',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Allotment return']),
    cadence: 'ON_CHANGE',
    deadlineRule: 'Within statutory period of allotment',
    deadlineNote: 'Confirm the exact period against Companies Act 1994 text.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'RJSC-SR',
    regulatorCode: 'RJSC',
    module: 'Companies Act Service',
    title: 'Special Resolution Filing',
    description: 'Filing of special resolutions passed in general meeting with the Registrar.',
    legalBasis: 'Companies Act 1994 (Act No. XVIII of 1994)',
    legalBasisNote: 'Confirm filing window against current Act text.',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Special Resolution']),
    cadence: 'ON_CHANGE',
    deadlineRule: 'Within statutory period of passing',
    deadlineNote: 'Confirm against Companies Act 1994 text on bdlaws.',
    applicableTo: 'ALL',
  },

  // ── BSEC — BSEC Listing Service ───────────────────────────
  {
    refCode: 'BSEC-PSD',
    regulatorCode: 'BSEC',
    module: 'BSEC Listing Service',
    title: 'Price-Sensitive Disclosure (PSD)',
    description: 'Public disclosure of any price-sensitive information affecting the listed company.',
    legalBasis: 'Corporate Governance Code 2018 (gazetted 8 Aug 2018); s. 2CC, Securities & Exchange Ordinance 1969 (XVII of 1969)',
    legalBasisNote: null,
    sourceTier: 'CIRCULAR', lawStatus: 'IN_FORCE', verification: 'VERIFIED',
    forms: JSON.stringify(['PSD filing']),
    cadence: 'EVENT',
    deadlineRule: 'Immediately — max 24 hours',
    deadlineNote: 'Per Listing Regs — verify against current text.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'BSEC-CGCC',
    regulatorCode: 'BSEC',
    module: 'BSEC Listing Service',
    title: 'CGC Compliance Certificate',
    description: 'Annual compliance certificate on Corporate Governance Code 2018, signed by a practising professional accountant / secretary.',
    legalBasis: 'Corporate Governance Code 2018; s. 2CC, Securities & Exchange Ordinance 1969',
    legalBasisNote: 'Compliance certificate from practising professional accountant/secretary mandatory.',
    sourceTier: 'CIRCULAR', lawStatus: 'IN_FORCE', verification: 'VERIFIED',
    forms: JSON.stringify(['Compliance Certificate', 'CGC Compliance Checklist']),
    cadence: 'ANNUAL',
    deadlineRule: 'With annual report',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
  {
    refCode: 'BSEC-RPT',
    regulatorCode: 'BSEC',
    module: 'BSEC Listing Service',
    title: 'Related-Party Transaction (RPT) Disclosure',
    description: 'Disclosure of related-party transactions under listing conditions.',
    legalBasis: 'BSEC listing conditions; Corporate Governance Code 2018',
    legalBasisNote: null,
    sourceTier: 'CIRCULAR', lawStatus: 'IN_FORCE', verification: 'VERIFIED',
    forms: JSON.stringify(['RPT disclosure']),
    cadence: 'EVENT',
    deadlineRule: 'On occurrence — per listing conditions',
    deadlineNote: 'Verify mode/timeline against current BSEC directives.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'BSEC-INSIDER',
    regulatorCode: 'BSEC',
    module: 'BSEC Listing Service',
    title: 'Insider Trading Declaration',
    description: 'Declaration by insiders of dealings in company securities.',
    legalBasis: 'BSEC insider trading rules — specific rule numbers unverified',
    legalBasisNote: 'Citation confirmed but specific rule numbers (e.g. "BSEC/SRMC/1995-Insider") unverified.',
    sourceTier: 'CIRCULAR', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Insider declaration']),
    cadence: 'EVENT',
    deadlineRule: '7 days post-trade',
    deadlineNote: 'Verify against current BSEC rules.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'BSEC-CGCR',
    regulatorCode: 'BSEC',
    module: 'BSEC Listing Service',
    title: 'Annual CGC Report',
    description: 'Annual Corporate Governance Code status report covering board composition, committees and appointments.',
    legalBasis: 'Corporate Governance Code 2018',
    legalBasisNote: 'Code requires appointment of Company Secretary, CFO, Head of Internal Audit & Compliance.',
    sourceTier: 'CIRCULAR', lawStatus: 'IN_FORCE', verification: 'VERIFIED',
    forms: JSON.stringify(['Annual CGC report']),
    cadence: 'ANNUAL',
    deadlineRule: 'With annual report cycle',
    deadlineNote: null,
    applicableTo: 'ALL',
  },

  // ── DSE & CSE — Listing Service (exchange push) ───────────
  {
    refCode: 'DSECSE-QFS',
    regulatorCode: 'DSECSE',
    module: 'BSEC Listing Service (exchange push)',
    title: 'Quarterly Financial Statements',
    description: 'Quarterly un-audited financial statements published and pushed to both exchanges.',
    legalBasis: 'DSE Listing Regulations; CSE Listing Regulations',
    legalBasisNote: 'Consolidated text — verify chapter/section refs against current exchange-published rulebook.',
    sourceTier: 'RULES', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Quarterly FS']),
    cadence: 'QUARTERLY',
    deadlineRule: 'Within 1 month of quarter-end',
    deadlineNote: 'Confirm against current Listing Regs.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DSECSE-SHP',
    regulatorCode: 'DSECSE',
    module: 'BSEC Listing Service (exchange push)',
    title: 'Shareholding Pattern Disclosure',
    description: 'Quarterly disclosure of shareholding positions of sponsors/directors, institutions and the public.',
    legalBasis: 'DSE Listing Regulations; CSE Listing Regulations',
    legalBasisNote: 'Consolidated text — verify against current exchange-published rulebook.',
    sourceTier: 'RULES', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Shareholding Pattern']),
    cadence: 'QUARTERLY',
    deadlineRule: 'Within 30 days of quarter',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
  {
    refCode: 'DSECSE-MEN',
    regulatorCode: 'DSECSE',
    module: 'BSEC Listing Service (exchange push)',
    title: 'Material Event Notice',
    description: 'Notice of any material event affecting the company to both exchanges.',
    legalBasis: 'DSE Listing Regulations; CSE Listing Regulations',
    legalBasisNote: null,
    sourceTier: 'RULES', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Material Event Notice']),
    cadence: 'EVENT',
    deadlineRule: 'Immediately upon occurrence',
    deadlineNote: 'Confirm notice mode and hours against current rulebook.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DSECSE-ICR',
    regulatorCode: 'DSECSE',
    module: 'BSEC Listing Service (exchange push)',
    title: 'Investor Complaint Return',
    description: 'Periodic return on investor complaints received and resolved.',
    legalBasis: 'DSE Listing Regulations; CSE Listing Regulations',
    legalBasisNote: null,
    sourceTier: 'RULES', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Investor Complaint Return']),
    cadence: 'QUARTERLY',
    deadlineRule: 'Quarterly — within prescribed window',
    deadlineNote: 'Confirm window against current exchange circulars.',
    applicableTo: 'ALL',
  },

  // ── NBR — Tax & VAT Service ───────────────────────────────
  {
    refCode: 'NBR-ITR',
    regulatorCode: 'NBR',
    module: 'Tax & VAT Service',
    title: 'Corporate Income-Tax Return',
    description: 'Annual corporate income-tax return for the fiscal year (July–June).',
    legalBasis: 'Income Tax Act 2023 (Act No. XX of 2023) — return-filing provisions',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'PARTIAL',
    forms: JSON.stringify(['IT Return (company)']),
    cadence: 'ANNUAL',
    deadlineRule: '15th day of 7th month after year-end = 15 January for 30 June YE',
    deadlineNote: 'Per Income Tax Act 2023. Secondary sources conflict (PwC says 9th month = 15 March). Verify against Act text.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'NBR-M91',
    regulatorCode: 'NBR',
    module: 'Tax & VAT Service',
    title: 'VAT Return (Mushak 9.1)',
    description: 'Monthly VAT return filed under the VAT & Supplementary Duty Act 2012.',
    legalBasis: 'VAT & Supplementary Duty Act 2012 (Act No. 47 of 2012)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'VERIFIED',
    forms: JSON.stringify(['Mushak 9.1']),
    cadence: 'MONTHLY',
    deadlineRule: 'Within 15 days of month-end',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
  {
    refCode: 'NBR-TDS',
    regulatorCode: 'NBR',
    module: 'Tax & VAT Service',
    title: 'TDS Deposit & Challan',
    description: 'Monthly deposit of tax deducted at source with challan.',
    legalBasis: 'Income Tax Act 2023 — s. 142 (TDS)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['TDS Challan']),
    cadence: 'MONTHLY',
    deadlineRule: 'Within ?? days of deduction',
    deadlineNote: 'UNVERIFIED — sources conflict (7 days vs 2 weeks per s.142). Verify against Act text.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'NBR-WHR',
    regulatorCode: 'NBR',
    module: 'Tax & VAT Service',
    title: 'Withholding Return',
    description: 'Monthly/periodic statement of tax withheld on payments.',
    legalBasis: 'Income Tax Act 2023 (Act No. XX of 2023)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Withholding return']),
    cadence: 'MONTHLY',
    deadlineRule: '15th or 25th of following month',
    deadlineNote: 'UNVERIFIED — sources conflict. Verify against NBR rule.',
    applicableTo: 'ALL',
  },

  // ── Department of Labour — Labour & WPPF Service ──────────
  {
    refCode: 'DOL-FORMA',
    regulatorCode: 'DOL',
    module: 'Labour & WPPF Service',
    title: 'Form-A (Establishment Registration)',
    description: 'Registration / update of establishment particulars with the Department of Labour.',
    legalBasis: 'Bangladesh Labour Act 2006 (Act No. XLII of 2006) as amended 2025/2026',
    legalBasisNote: 'Form labels UNVERIFIED after 2025/2026 amendments — re-check.',
    sourceTier: 'STATUTE', lawStatus: 'AMENDED_2026', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Form-A (Establishment)']),
    cadence: 'ON_CHANGE',
    deadlineRule: 'On change of particulars',
    deadlineNote: 'Verify against amended Labour Act.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DOL-FORM3',
    regulatorCode: 'DOL',
    module: 'Labour & WPPF Service',
    title: 'Form-III (Worker Register)',
    description: 'Maintenance / submission of the worker register under the Labour Act.',
    legalBasis: 'Bangladesh Labour Act 2006 as amended 2025/2026',
    legalBasisNote: 'Form labels UNVERIFIED after 2025/2026 amendments — re-check.',
    sourceTier: 'STATUTE', lawStatus: 'AMENDED_2026', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Form-III (Worker register)']),
    cadence: 'ON_CHANGE',
    deadlineRule: 'On change / as maintained',
    deadlineNote: 'Verify against amended Labour Act.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DOL-PF',
    regulatorCode: 'DOL',
    module: 'Labour & WPPF Service',
    title: 'PF Annual Return',
    description: 'Annual return of the company provident fund to the labour authorities.',
    legalBasis: 'Bangladesh Labour Act 2006 — Provident Fund chapter, as amended',
    legalBasisNote: '"30 Sept PF return" label UNVERIFIED after amendments — re-check.',
    sourceTier: 'STATUTE', lawStatus: 'AMENDED_2026', verification: 'UNVERIFIED',
    forms: JSON.stringify(['PF Annual Return']),
    cadence: 'ANNUAL',
    deadlineRule: '30 September (reference)',
    deadlineNote: 'UNVERIFIED after 2025/2026 amendments. Re-check.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DOL-WPPF',
    regulatorCode: 'DOL',
    module: 'Labour & WPPF Service',
    title: 'WPPF Statement (5% of Profit)',
    description: 'Workers\u2019 Profit Participation Fund statement — 5% of previous year\u2019s net profit, split 80:10:10 (80% WPPF, 10% Workers\u2019 Welfare Foundation, 10% Bangladesh Workers\u2019 Welfare Foundation).',
    legalBasis: 'Bangladesh Labour Act 2006 — Chapter on Workers\u2019 Profit Participation Fund',
    legalBasisNote: 'Split and deadline re-verify against 2025/2026 amendments.',
    sourceTier: 'STATUTE', lawStatus: 'AMENDED_2026', verification: 'UNVERIFIED',
    forms: JSON.stringify(['WPPF statement']),
    cadence: 'ANNUAL',
    deadlineRule: 'Within 9 months of year-end',
    deadlineNote: '5% of previous year\u2019s net profit. Split 80:10:10.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'DOL-SAFETY',
    regulatorCode: 'DOL',
    module: 'Labour & WPPF Service',
    title: 'Safety Audit Report',
    description: 'Workplace safety audit report submission for the establishment.',
    legalBasis: 'Bangladesh Labour Act 2006 — workplace safety provisions, as amended',
    legalBasisNote: 'Re-verify citation against amended Labour Act.',
    sourceTier: 'STATUTE', lawStatus: 'AMENDED_2026', verification: 'UNVERIFIED',
    forms: JSON.stringify(['Safety Audit Report']),
    cadence: 'ANNUAL',
    deadlineRule: 'Annual — per prescribed cycle',
    deadlineNote: 'Confirm cycle against amended Labour Act / factory rules.',
    applicableTo: 'ALL',
  },

  // ── Bangladesh Bank — Banking & Forex Service ─────────────
  {
    refCode: 'BB-FE2',
    regulatorCode: 'BB',
    module: 'Banking & Forex Service',
    title: 'FE-2 (Export Receipt)',
    description: 'Foreign-exchange return on export receipts. Banking-company returns apply ONLY to banks.',
    legalBasis: 'Foreign Exchange Regulation Act 1947; Bangladesh Bank Act 2017 (Act No. XXIII of 2017); Bank Company Act 1991 (Act No. 14 of 1991)',
    legalBasisNote: 'FE-2/FE-4 form numbers — verify against current BB master circular. Removed LFR-1 (only applies to banks) and "IMF-Balance" (could not match to any known filing).',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['FE-2 (Export receipt)']),
    cadence: 'MONTHLY',
    deadlineRule: 'Per BB FE Manual schedule',
    deadlineNote: '"Weekly/monthly as scheduled" is not a deadline — confirm exact dates against current circular.',
    applicableTo: 'BANKS',
  },
  {
    refCode: 'BB-FE4',
    regulatorCode: 'BB',
    module: 'Banking & Forex Service',
    title: 'FE-4 (Import Payment)',
    description: 'Foreign-exchange return on import payments. Banking-company returns apply ONLY to banks.',
    legalBasis: 'Foreign Exchange Regulation Act 1947; Bangladesh Bank Act 2017; Bank Company Act 1991',
    legalBasisNote: 'FE-2/FE-4 form numbers — verify against current BB master circular.',
    sourceTier: 'STATUTE', lawStatus: 'IN_FORCE', verification: 'UNVERIFIED',
    forms: JSON.stringify(['FE-4 (Import payment)']),
    cadence: 'MONTHLY',
    deadlineRule: 'Per BB FE Manual schedule',
    deadlineNote: 'Confirm exact dates against current BB circular.',
    applicableTo: 'BANKS',
  },

  // ── NDGA — Data Privacy Service ───────────────────────────
  {
    refCode: 'NDGA-INV',
    regulatorCode: 'NDGA',
    module: 'Data Privacy Service',
    title: 'Data Inventory Register',
    description: 'Personal data inventory & consent registry maintained under PDPA 2026.',
    legalBasis: 'Personal Data Protection Act 2026 (Act No. 63 of 2026). Originally PDPO issued 6 Nov 2025; amended Feb 2026; enacted by Parliament April 2026.',
    legalBasisNote: 'In force 6 Nov 2025 except s.23 and ss.31–35 (18-month delay).',
    sourceTier: 'STATUTE', lawStatus: 'PHASED_IN', verification: 'VERIFIED',
    forms: JSON.stringify(['Data inventory register']),
    cadence: 'EVENT',
    deadlineRule: 'Maintained continuously; review on processing change',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
  {
    refCode: 'NDGA-DSAR',
    regulatorCode: 'NDGA',
    module: 'Data Privacy Service',
    title: 'DSAR Response',
    description: 'Response to data-subject access requests under PDPA 2026.',
    legalBasis: 'Personal Data Protection Act 2026 (Act No. 63 of 2026)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'PHASED_IN', verification: 'PENDING',
    forms: JSON.stringify(['DSAR response']),
    cadence: 'EVENT',
    deadlineRule: 'Timeframe "as prescribed"',
    deadlineNote: 'UNVERIFIED — subordinate rules not yet issued. Treat as PENDING.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'NDGA-BREACH',
    regulatorCode: 'NDGA',
    module: 'Data Privacy Service',
    title: 'Breach Notification (s. 20)',
    description: 'Notification of personal-data breaches to NDGA under section 20 of PDPA 2026.',
    legalBasis: 'Personal Data Protection Act 2026 — s. 20 (breach notification)',
    legalBasisNote: 's.20 makes it mandatory, but the time limit is "as prescribed" — subordinate rules not yet issued. The "72-hour" figure was a GDPR default — NOT statutory in BD.',
    sourceTier: 'STATUTE', lawStatus: 'PHASED_IN', verification: 'PENDING',
    forms: JSON.stringify(['Breach notification']),
    cadence: 'EVENT',
    deadlineRule: 'Mandatory — time limit pending ("as prescribed")',
    deadlineNote: 'Treat as PENDING until subordinate rules are issued.',
    applicableTo: 'ALL',
  },
  {
    refCode: 'NDGA-DPIA',
    regulatorCode: 'NDGA',
    module: 'Data Privacy Service',
    title: 'DPIA Report (High-Risk Processing)',
    description: 'Data Protection Impact Assessment report for high-risk processing activities.',
    legalBasis: 'Personal Data Protection Act 2026 (Act No. 63 of 2026)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'PHASED_IN', verification: 'VERIFIED',
    forms: JSON.stringify(['DPIA report (high-risk processing)']),
    cadence: 'EVENT',
    deadlineRule: 'Before commencement of high-risk processing',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
  {
    refCode: 'NDGA-DPO',
    regulatorCode: 'NDGA',
    module: 'Data Privacy Service',
    title: 'DPO Appointment',
    description: 'Appointment / change notification of the Data Protection Officer.',
    legalBasis: 'Personal Data Protection Act 2026 (Act No. 63 of 2026)',
    legalBasisNote: null,
    sourceTier: 'STATUTE', lawStatus: 'PHASED_IN', verification: 'VERIFIED',
    forms: JSON.stringify(['DPO appointment']),
    cadence: 'ON_CHANGE',
    deadlineRule: 'On appointment / change',
    deadlineNote: null,
    applicableTo: 'ALL',
  },
]

const voluntary = [
  {
    title: 'ISO 27001 (Information Security)',
    body: 'Voluntary international standard. No Bangladesh statute mandates it for listed PLCs. Audit-and-evidence workflow can reuse the audit-chain module, but deadlines are contractual, not statutory.',
  },
  {
    title: 'SOC 2 (Service Organisation Controls)',
    body: 'AICPA framework. Voluntary. Used for vendor assurance. No BD statutory basis — do not file as a regulatory return.',
  },
]

const pendingItems = [
  { title: 'Financial Reporting Council (FRC)', body: 'Audit-oversight body. Excluded from the regulator register because its statutory scope over listed PLCs in Bangladesh could not be confirmed.' },
  { title: 'CDBL (Central Depository Bangladesh Ltd.)', body: 'Operates the CDS. Listed PLCs interact with it for share movement, but whether CDBL imposes compliance filings distinct from DSE/CSE listing regs is unconfirmed.' },
  { title: 'BSEC Insider Trading Rules', body: 'Citation confirmed but specific rule numbers (e.g. "BSEC/SRMC/1995-Insider") unverified.' },
  { title: 'BSEC Takeover Rules', body: 'Same as above; circular reference unverified.' },
  { title: 'RJSC Form-X / XII / VI labels', body: 'These look like Indian form numbers — do not rely on them.' },
]

// ── exports ──────────────────────────────────────────────────

export const CATALOGUE_REGULATORS: CatalogueRegulator[] = regulators
export const CATALOGUE_TEMPLATES: CatalogueTemplate[] = templates
export const CATALOGUE_VOLUNTARY: CatalogueSectionItem[] = voluntary
export const CATALOGUE_PENDING_ITEMS: CatalogueSectionItem[] = pendingItems

export const CATALOGUE_RULE_IDS: string[] = CATALOGUE_TEMPLATES.map((t) => t.refCode)

/** Definition fields that MUST reconcile per rule (everything except the rule ID itself). */
export const TEMPLATE_DEFINITION_FIELDS = [
  'module',
  'title',
  'description',
  'legalBasis',
  'legalBasisNote',
  'sourceTier',
  'lawStatus',
  'verification',
  'forms',
  'cadence',
  'deadlineRule',
  'deadlineNote',
  'applicableTo',
] as const

export const REGULATOR_DEFINITION_FIELDS = [
  'name',
  'fullName',
  'description',
  'scopeNote',
  'sortOrder',
] as const

function jsonStable(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') {
    try {
      return jsonStable(JSON.parse(value))
    } catch {
      return JSON.stringify(value)
    }
  }
  return JSON.stringify(value)
}

/** JSON-aware equality: compares object values against JSON-encoded strings stably. */
export function jsonEquals(a: unknown, b: unknown): boolean {
  return jsonStable(a) === jsonStable(b)
}

/**
 * Compare a catalogue row against a live row field-by-field.
 * Returns the list of drifted definition fields (empty = identical definition).
 * JSON-encoded fields (forms, applicability, requiredEvidence, deadlineFormula)
 * are compared structurally so formatting never causes false drift.
 */
export function definitionDrift(
  seedRow: object,
  dbRow: object,
  fields: readonly string[],
): string[] {
  const s = seedRow as Record<string, unknown>
  const d = dbRow as Record<string, unknown>
  const drifted: string[] = []
  const jsonFields = new Set<string>(RULE_JSON_FIELDS)
  for (const f of fields) {
    const a = s[f] ?? null
    const b = d[f] ?? null
    if (jsonFields.has(f)) {
      if (!jsonEquals(a, b)) drifted.push(f)
    } else if (a !== b) {
      drifted.push(f)
    }
  }
  return drifted
}

// ══════════════════════════════════════════════════════════════
// LEGAL INSTRUMENT REGISTRY — the table that fixes the LegalRule
// disconnect. Every rule cites an instrument here by code; the
// engine reads citations from this registry and nowhere else.
// Versions are immutable: an amendment APPENDS a version row and
// never edits an old one. Dates carry honest precision (year or
// month where the day was not confirmed) — never fake precision.
// ══════════════════════════════════════════════════════════════

export interface InstrumentVersionSeed {
  versionNo: number
  label: string
  effectiveFrom: string
  effectiveTo?: string | null
  changeNote?: string | null
  sourceTier: string
  status: string
  verification: string
}

export interface InstrumentSeed {
  code: string
  title: string
  issuingBody: string
  referenceType: string
  reference: string
  sourceUrl?: string | null
  verification: string
  verifiedBy?: string | null
  verifiedAt?: string | null
  note?: string | null
  versions: InstrumentVersionSeed[]
}

export const CATALOGUE_INSTRUMENTS: InstrumentSeed[] = [
  {
    code: 'CA-1994',
    title: 'Companies Act 1994',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. XVIII of 1994',
    sourceUrl: 'http://bdlaws.minlaw.gov.bd',
    verification: 'PARTIAL',
    verifiedBy: 'Tanvir Ahmed — Company Secretary',
    verifiedAt: '2026-11-10',
    note: 'Instrument confirmed; specific section numbers (ss. 88, 110, 113, 152) need confirmation against bdlaws.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '1994', effectiveTo: null, changeNote: 'Act No. XVIII of 1994 — governing statute for company filings.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'PARTIAL' },
    ],
  },
  {
    code: 'SEO-1969',
    title: 'Securities and Exchange Ordinance 1969',
    issuingBody: 'Parliament of Bangladesh (ordinance-making authority, 1969)',
    referenceType: 'ORDINANCE',
    reference: 'Ordinance No. XVII of 1969 — s. 2CC empowers the Corporate Governance Code 2018',
    sourceUrl: 'http://bdlaws.minlaw.gov.bd',
    verification: 'VERIFIED',
    verifiedBy: 'Tanvir Ahmed — Company Secretary',
    verifiedAt: '2026-11-10',
    note: 's. 2CC confirmed as the legal basis for CGC 2018.',
    versions: [
      { versionNo: 1, label: 'Original ordinance', effectiveFrom: '1969', effectiveTo: null, changeNote: 'Base securities statute; s. 2CC added later — cite via CGC-2018 notification.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'VERIFIED' },
    ],
  },
  {
    code: 'CGC-2018',
    title: 'Corporate Governance Code 2018',
    issuingBody: 'Bangladesh Securities & Exchange Commission (BSEC)',
    referenceType: 'NOTIFICATION',
    reference: 'BSEC notification gazetted 08 Aug 2018, issued under s. 2CC of the Securities and Exchange Ordinance 1969',
    sourceUrl: 'https://www.bsec.gov.bd',
    verification: 'VERIFIED',
    verifiedBy: 'Tanvir Ahmed — Company Secretary',
    verifiedAt: '2026-11-10',
    note: 'Compliance certificate from a practising professional accountant/secretary is mandatory.',
    versions: [
      { versionNo: 1, label: 'Notification as gazetted', effectiveFrom: '2018-08-08', effectiveTo: null, changeNote: 'Gazette notification of 08 Aug 2018.', sourceTier: 'CIRCULAR', status: 'IN_FORCE', verification: 'VERIFIED' },
    ],
  },
  {
    code: 'BSEC-LC',
    title: 'BSEC Listing Conditions (consolidated)',
    issuingBody: 'Bangladesh Securities & Exchange Commission (BSEC)',
    referenceType: 'RULES',
    reference: 'Listing conditions — consolidated text; chapter/section references unconfirmed',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'RPT disclosure obligations cite listing conditions. Consolidated text not yet verified against current BSEC directives.',
    versions: [
      { versionNo: 1, label: 'Consolidated text (working copy)', effectiveFrom: 'current consolidation', effectiveTo: null, changeNote: 'Working consolidation — do not rely until verified.', sourceTier: 'RULES', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'BSEC-INSIDER-RULES',
    title: 'BSEC Insider Trading Rules',
    issuingBody: 'Bangladesh Securities & Exchange Commission (BSEC)',
    referenceType: 'CIRCULAR',
    reference: 'Circular reference UNVERIFIED — the label "BSEC/SRMC/1995-Insider" looks plausible but was NOT verified; do not rely on it',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Citation confirmed to exist; specific rule numbers unverified.',
    versions: [
      { versionNo: 1, label: 'Rules (reference pending confirmation)', effectiveFrom: 'unconfirmed', effectiveTo: null, changeNote: 'Specific circular number must be confirmed against BSEC records before reliance.', sourceTier: 'CIRCULAR', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'BSEC-TAKEOVER-RULES',
    title: 'BSEC Takeover Rules',
    issuingBody: 'Bangladesh Securities & Exchange Commission (BSEC)',
    referenceType: 'CIRCULAR',
    reference: 'Circular reference UNVERIFIED',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'No platform rule cites this instrument yet — kept in the registry so takeover exposure is visible.',
    versions: [
      { versionNo: 1, label: 'Rules (reference pending confirmation)', effectiveFrom: 'unconfirmed', effectiveTo: null, changeNote: 'Same status as insider trading rules; circular reference unverified.', sourceTier: 'CIRCULAR', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'DSE-LR',
    title: 'DSE Listing Regulations',
    issuingBody: 'Dhaka Stock Exchange',
    referenceType: 'RULEBOOK',
    reference: 'Consolidated listing regulations — verify chapter/section refs against the current exchange-published rulebook',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Exchange-push obligations (quarterly FS, shareholding pattern, MEN, investor complaints).',
    versions: [
      { versionNo: 1, label: 'Consolidated rulebook (working copy)', effectiveFrom: 'current consolidation', effectiveTo: null, changeNote: 'Working consolidation — verify before reliance.', sourceTier: 'RULES', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'CSE-LR',
    title: 'CSE Listing Regulations',
    issuingBody: 'Chittagong Stock Exchange',
    referenceType: 'RULEBOOK',
    reference: 'Consolidated listing regulations — verify against the current exchange-published rulebook',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Applies alongside DSE-LR; the company is listed on both exchanges.',
    versions: [
      { versionNo: 1, label: 'Consolidated rulebook (working copy)', effectiveFrom: 'current consolidation', effectiveTo: null, changeNote: 'Working consolidation — verify before reliance.', sourceTier: 'RULES', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'ITA-2023',
    title: 'Income Tax Act 2023',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. XX of 2023',
    sourceUrl: 'https://nbr.gov.bd',
    verification: 'PARTIAL',
    verifiedBy: 'Rahim Uddin — CFO',
    verifiedAt: '2026-11-11',
    note: 'Corporate return deadline corrected to the 15th day of the 7th month after year-end per the Act; secondary sources still conflict (PwC says 9th month) — verify against Act text.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '2023', effectiveTo: null, changeNote: 'Replaced the Income Tax Ordinance 1984 regime for assessment years from FY2023-24.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'PARTIAL' },
    ],
  },
  {
    code: 'VATSD-2012',
    title: 'VAT & Supplementary Duty Act 2012',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. 47 of 2012',
    sourceUrl: 'https://nbr.gov.bd',
    verification: 'VERIFIED',
    verifiedBy: 'Rahim Uddin — CFO',
    verifiedAt: '2026-11-11',
    note: 'Mushak 9.1 monthly return within 15 days of month-end confirmed against the Act.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '2012', effectiveTo: null, changeNote: 'Governs monthly VAT return (Mushak 9.1).', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'VERIFIED' },
    ],
  },
  {
    code: 'BLA-2006',
    title: 'Bangladesh Labour Act 2006 (as amended 2025/2026)',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. XLII of 2006 — Labour (Amendment) Ordinance 2025 + Labour (Amendment) Act 2026 together carry ~90 changes',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Re-verify every citation against the current consolidated text after the 2025/2026 amendments.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '2006', effectiveTo: null, changeNote: 'Base labour statute (Act No. XLII of 2006).', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
      { versionNo: 2, label: 'Labour (Amendment) Ordinance 2025', effectiveFrom: '2025', effectiveTo: null, changeNote: 'First amendment wave — citations re-verify in progress.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
      { versionNo: 3, label: 'Labour (Amendment) Act 2026', effectiveFrom: '2026', effectiveTo: null, changeNote: 'Second amendment wave; together with the 2025 Ordinance carries ~90 changes — form labels and deadlines must be re-confirmed.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'BB-FE-MANUAL',
    title: 'Bangladesh Bank FE Manual & master circulars',
    issuingBody: 'Bangladesh Bank',
    referenceType: 'CIRCULAR',
    reference: 'Foreign Exchange (FE) Manual schedule — exact return dates must be confirmed against the current BB master circular',
    sourceUrl: 'https://www.bb.org.bd',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: '"Weekly/monthly as scheduled" is not a deadline — confirm exact dates. Applies ONLY to banks.',
    versions: [
      { versionNo: 1, label: 'FE Manual + master circular (working copy)', effectiveFrom: 'current circular', effectiveTo: null, changeNote: 'Working copy — verify schedule against current circular.', sourceTier: 'CIRCULAR', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'FERA-1947',
    title: 'Foreign Exchange Regulation Act 1947',
    issuingBody: 'Parliament of Bangladesh (pre-independence enactment, continued in force)',
    referenceType: 'ACT',
    reference: 'Act No. VII of 1947 (as amended)',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Registry entry only — no platform rule cites it directly; FE returns cite the BB FE Manual.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '1947', effectiveTo: null, changeNote: 'Base forex statute.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'BB-2017',
    title: 'Bangladesh Bank Act 2017',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. XXIII of 2017',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Registry entry only — cited by BB rules as background statute.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '2017', effectiveTo: null, changeNote: 'Central-bank statute.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'BCA-1991',
    title: 'Bank Company Act 1991',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. 14 of 1991',
    verification: 'UNVERIFIED',
    verifiedBy: null,
    note: 'Registry entry only — banking-company returns apply ONLY to banks.',
    versions: [
      { versionNo: 1, label: 'Original enactment', effectiveFrom: '1991', effectiveTo: null, changeNote: 'Banking-company statute.', sourceTier: 'STATUTE', status: 'IN_FORCE', verification: 'UNVERIFIED' },
    ],
  },
  {
    code: 'PDPA-2026',
    title: 'Personal Data Protection Act 2026',
    issuingBody: 'Parliament of Bangladesh',
    referenceType: 'ACT',
    reference: 'Act No. 63 of 2026',
    verification: 'VERIFIED',
    verifiedBy: 'Mahmud Hasan — DPO / Legal Counsel',
    verifiedAt: '2026-11-12',
    note: 'In force 6 Nov 2025 except s. 23 and ss. 31–35 (18-month delay). Originally PDPO issued 6 Nov 2025; amended Feb 2026; enacted by Parliament April 2026.',
    versions: [
      { versionNo: 1, label: 'PDPO issued', effectiveFrom: '2025-11-06', effectiveTo: '2026-02', changeNote: 'Personal Data Protection Ordinance issued 6 Nov 2025.', sourceTier: 'STATUTE', status: 'SUPERSEDED', verification: 'VERIFIED' },
      { versionNo: 2, label: 'Amendment (Feb 2026)', effectiveFrom: '2026-02', effectiveTo: '2026-04', changeNote: 'Ordinance amended February 2026.', sourceTier: 'STATUTE', status: 'SUPERSEDED', verification: 'VERIFIED' },
      { versionNo: 3, label: 'Enacted by Parliament — Act No. 63 of 2026', effectiveFrom: '2026-04', effectiveTo: null, changeNote: 'In force 6 Nov 2025 except s. 23 and ss. 31–35 (18-month delay). Regulator: National Data Governance Authority (NDGA).', sourceTier: 'STATUTE', status: 'PHASED_IN', verification: 'VERIFIED' },
    ],
  },
]

// ══════════════════════════════════════════════════════════════
// RULE LAYER — applicability predicate, trigger, obligation,
// required evidence, deadline formula, penalty reference and
// evaluation type for every rule, keyed by rule ID.
//
// DEADLINE DISCIPLINE: no deadline is asserted from memory. A formula
// is `unverified: true` unless the rule row itself is VERIFIED and its
// deadlineNote carries no "confirm/verify" caveat. Unverified formulas
// never produce a hard due date — the evaluator reports them as
// UNVERIFIED_DEADLINE instead.
// ══════════════════════════════════════════════════════════════

export interface ApplicabilityPredicate {
  companyTypes?: string[] // PLC | BANK | INSURER | NBFI
  listingStatus?: string[] // LISTED | UNLISTED
  exchanges?: string[] // DSE | CSE | BOTH
  categories?: string[] // A | B | N | Z
  sectors?: string[]
  requireFacts?: { key: string; truthy?: boolean; equals?: string }[]
}

export interface RuleExtension {
  instrumentCode: string
  trigger: 'CALENDAR' | 'EVENT' | 'STATE'
  evaluationType: 'DETERMINISTIC' | 'DOCUMENTARY' | 'JUDGMENT'
  applicability: ApplicabilityPredicate
  requiredEvidence: string[]
  deadlineFormula: { kind: string; unverified: boolean; note?: string } & Record<string, unknown>
  penaltyRef: string
  judgmentGuidance?: string
}

const DEFAULT_APPLICABILITY: ApplicabilityPredicate = {
  companyTypes: ['PLC'],
  listingStatus: ['LISTED'],
  exchanges: ['DSE', 'CSE', 'BOTH'],
  categories: ['A', 'B', 'N', 'Z'],
}

function unverifiedPenalty(instrument: string, reference: string): string {
  return `UNVERIFIED — confirm the penalty provision in ${instrument} (${reference}) against the primary source before reliance.`
}

export const RULE_EXTENSIONS: Record<string, RuleExtension> = {
  // ── RJSC — Companies Act Service ──────────────────────────
  'RJSC-AR': {
    instrumentCode: 'CA-1994', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Board resolution approving the annual report', 'RJSC filing receipt'],
    deadlineFormula: { kind: 'DAYS_FROM_FACT', factKey: 'last_agm_date', days: null, unverified: true, note: 'Sources conflict: 30, 21 or 42 days from AGM — pull from Companies Act 1994 on bdlaws before relying.' },
    penaltyRef: unverifiedPenalty('Companies Act 1994', 'Act No. XVIII of 1994'),
  },
  'RJSC-DC': {
    instrumentCode: 'CA-1994', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Signed resignation letter', 'Board acceptance minute'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: null, unverified: true, note: 'The 14-day claim was not BD-sourced — verify against the Act text.' },
    penaltyRef: unverifiedPenalty('Companies Act 1994', 'Act No. XVIII of 1994'),
  },
  'RJSC-ALLOT': {
    instrumentCode: 'CA-1994', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Board allotment resolution', 'Allotment return copy'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: null, unverified: true, note: 'Confirm the exact statutory period of allotment against the Act text.' },
    penaltyRef: unverifiedPenalty('Companies Act 1994', 'Act No. XVIII of 1994'),
  },
  'RJSC-SR': {
    instrumentCode: 'CA-1994', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Certified copy of the special resolution', 'EGM notice'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: null, unverified: true, note: 'Confirm filing window against the current Act text.' },
    penaltyRef: unverifiedPenalty('Companies Act 1994', 'Act No. XVIII of 1994'),
  },

  // ── BSEC — BSEC Listing Service ───────────────────────────
  'BSEC-PSD': {
    instrumentCode: 'CGC-2018', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Board approval of disclosure text', 'PSD filing acknowledgment'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: 1, unverified: false, note: 'Immediately — max 24 hours (per Listing Regs; verify against current text).' },
    penaltyRef: unverifiedPenalty('Corporate Governance Code 2018 / SEO 1969', 'gazetted 08 Aug 2018; Ordinance XVII of 1969'),
  },
  'BSEC-CGCC': {
    instrumentCode: 'CGC-2018', trigger: 'CALENDAR', evaluationType: 'DOCUMENTARY',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Compliance Certificate signed by a practising professional accountant/secretary', 'CGC Compliance Checklist'],
    deadlineFormula: { kind: 'WITH_ANNUAL_REPORT', unverified: false, note: 'Filed with the annual report cycle.' },
    penaltyRef: unverifiedPenalty('Corporate Governance Code 2018', 'gazetted 08 Aug 2018'),
  },
  'BSEC-RPT': {
    instrumentCode: 'BSEC-LC', trigger: 'EVENT', evaluationType: 'JUDGMENT',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['RPT disclosure', 'Supporting valuation / arm\u2019s-length papers'],
    deadlineFormula: { kind: 'ON_EVENT', unverified: true, note: 'On occurrence — verify mode/timeline against current BSEC directives.' },
    penaltyRef: unverifiedPenalty('BSEC Listing Conditions', 'consolidated text'),
    judgmentGuidance: 'Adequacy of related-party transaction disclosure cannot be self-certified. Assess the substance of the transaction against the listing conditions and confirm the disclosure content requirements against the current text before filing.',
  },
  'BSEC-INSIDER': {
    instrumentCode: 'BSEC-INSIDER-RULES', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Insider declaration register entry'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: 7, unverified: true, note: '7 days post-trade — verify against current BSEC rules; rule numbers unverified.' },
    penaltyRef: unverifiedPenalty('BSEC Insider Trading Rules', 'circular reference unverified'),
  },
  'BSEC-CGCR': {
    instrumentCode: 'CGC-2018', trigger: 'CALENDAR', evaluationType: 'DOCUMENTARY',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Annual CGC status report'],
    deadlineFormula: { kind: 'WITH_ANNUAL_REPORT', unverified: false, note: 'With the annual report cycle.' },
    penaltyRef: unverifiedPenalty('Corporate Governance Code 2018', 'gazetted 08 Aug 2018'),
  },

  // ── DSE & CSE — Listing Service (exchange push) ───────────
  'DSECSE-QFS': {
    instrumentCode: 'DSE-LR', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Published quarterly FS', 'Exchange submission receipt (DSE + CSE)'],
    deadlineFormula: { kind: 'DAYS_FROM_QUARTER_END', days: 30, unverified: true, note: 'Within 1 month of quarter-end — confirm against current Listing Regulations.' },
    penaltyRef: unverifiedPenalty('DSE Listing Regulations', 'consolidated text'),
  },
  'DSECSE-SHP': {
    instrumentCode: 'DSE-LR', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Shareholding pattern disclosure receipt (DSE + CSE)'],
    deadlineFormula: { kind: 'DAYS_FROM_QUARTER_END', days: 30, unverified: true, note: 'Within 30 days of quarter — confirm against current Listing Regulations.' },
    penaltyRef: unverifiedPenalty('DSE Listing Regulations', 'consolidated text'),
  },
  'DSECSE-MEN': {
    instrumentCode: 'DSE-LR', trigger: 'EVENT', evaluationType: 'JUDGMENT',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Material Event Notice copy', 'Board/CEO sign-off on materiality'],
    deadlineFormula: { kind: 'ON_EVENT', unverified: true, note: 'Immediately upon occurrence — confirm notice mode and hours against current rulebook.' },
    penaltyRef: unverifiedPenalty('DSE Listing Regulations', 'consolidated text'),
    judgmentGuidance: 'Whether an event is material (and therefore notice-triggering) is a judgment call — assess price sensitivity before the obligation crystallises, and confirm notice hours against the current rulebook.',
  },
  'DSECSE-ICR': {
    instrumentCode: 'DSE-LR', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Investor complaint return copy'],
    deadlineFormula: { kind: 'QUARTERLY_WINDOW', unverified: true, note: 'Quarterly — confirm the prescribed window against current exchange circulars.' },
    penaltyRef: unverifiedPenalty('DSE Listing Regulations', 'consolidated text'),
  },

  // ── NBR — Tax & VAT Service ───────────────────────────────
  'NBR-ITR': {
    instrumentCode: 'ITA-2023', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['IT return (company) acknowledgment slip'],
    deadlineFormula: { kind: 'MONTHS_FROM_FY_END', months: 7, anchorDay: 15, unverified: true, note: '15th day of the 7th month after year-end per Income Tax Act 2023; secondary sources conflict (PwC: 9th month) — verify against Act text.' },
    penaltyRef: unverifiedPenalty('Income Tax Act 2023', 'Act No. XX of 2023'),
  },
  'NBR-M91': {
    instrumentCode: 'VATSD-2012', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Mushak 9.1 acknowledgment'],
    deadlineFormula: { kind: 'DAYS_FROM_MONTH_END', days: 15, unverified: false },
    penaltyRef: unverifiedPenalty('VAT & Supplementary Duty Act 2012', 'Act No. 47 of 2012'),
  },
  'NBR-TDS': {
    instrumentCode: 'ITA-2023', trigger: 'EVENT', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['TDS challan copy'],
    deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: null, unverified: true, note: 'Sources conflict (7 days vs 2 weeks per s. 142) — verify against Act text.' },
    penaltyRef: unverifiedPenalty('Income Tax Act 2023', 'Act No. XX of 2023'),
  },
  'NBR-WHR': {
    instrumentCode: 'ITA-2023', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Withholding statement acknowledgment'],
    deadlineFormula: { kind: 'DAY_OF_MONTH', candidates: [15, 25], unverified: true, note: '15th or 25th of the following month — sources conflict; verify against NBR rule.' },
    penaltyRef: unverifiedPenalty('Income Tax Act 2023', 'Act No. XX of 2023'),
  },

  // ── Department of Labour — Labour & WPPF Service ──────────
  'DOL-FORMA': {
    instrumentCode: 'BLA-2006', trigger: 'EVENT', evaluationType: 'DOCUMENTARY',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Establishment registration certificate (current particulars)'],
    deadlineFormula: { kind: 'ON_CHANGE', unverified: true, note: 'On change of particulars — verify against the amended Labour Act.' },
    penaltyRef: unverifiedPenalty('Bangladesh Labour Act 2006 (as amended 2025/2026)', 'Act No. XLII of 2006'),
  },
  'DOL-FORM3': {
    instrumentCode: 'BLA-2006', trigger: 'STATE', evaluationType: 'DOCUMENTARY',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Worker register (maintained and up to date)'],
    deadlineFormula: { kind: 'CONTINUOUS', unverified: true, note: 'On change / as maintained — verify against the amended Labour Act.' },
    penaltyRef: unverifiedPenalty('Bangladesh Labour Act 2006 (as amended 2025/2026)', 'Act No. XLII of 2006'),
  },
  'DOL-PF': {
    instrumentCode: 'BLA-2006', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'pf_scheme_in_force', truthy: true }] },
    requiredEvidence: ['PF annual return acknowledgment'],
    deadlineFormula: { kind: 'FIXED_DATE', month: 9, day: 30, unverified: true, note: '30 September (reference) — UNVERIFIED after 2025/2026 amendments, re-check.' },
    penaltyRef: unverifiedPenalty('Bangladesh Labour Act 2006 (as amended 2025/2026)', 'Act No. XLII of 2006'),
  },
  'DOL-WPPF': {
    instrumentCode: 'BLA-2006', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'wppf_applicable', truthy: true }] },
    requiredEvidence: ['WPPF statement (5% of profit, 80:10:10)', 'Trustee meeting minute'],
    deadlineFormula: { kind: 'MONTHS_FROM_FY_END', months: 9, unverified: true, note: 'Within 9 months of year-end — split and deadline re-verify against 2025/2026 amendments.' },
    penaltyRef: unverifiedPenalty('Bangladesh Labour Act 2006 (as amended 2025/2026)', 'Act No. XLII of 2006'),
  },
  'DOL-SAFETY': {
    instrumentCode: 'BLA-2006', trigger: 'CALENDAR', evaluationType: 'DOCUMENTARY',
    applicability: DEFAULT_APPLICABILITY,
    requiredEvidence: ['Safety audit report (current cycle)'],
    deadlineFormula: { kind: 'ANNUAL_CYCLE', unverified: true, note: 'Annual — confirm cycle against the amended Labour Act / factory rules.' },
    penaltyRef: unverifiedPenalty('Bangladesh Labour Act 2006 (as amended 2025/2026)', 'Act No. XLII of 2006'),
  },

  // ── Bangladesh Bank — Banking & Forex Service ─────────────
  'BB-FE2': {
    instrumentCode: 'BB-FE-MANUAL', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: { companyTypes: ['BANK'] },
    requiredEvidence: ['FE-2 submission receipt'],
    deadlineFormula: { kind: 'SCHEDULE_PER_CIRCULAR', unverified: true, note: 'Per BB FE Manual schedule — confirm exact dates against the current circular.' },
    penaltyRef: unverifiedPenalty('BB FE Manual / FERA 1947', 'current circular; Act No. VII of 1947'),
  },
  'BB-FE4': {
    instrumentCode: 'BB-FE-MANUAL', trigger: 'CALENDAR', evaluationType: 'DETERMINISTIC',
    applicability: { companyTypes: ['BANK'] },
    requiredEvidence: ['FE-4 submission receipt'],
    deadlineFormula: { kind: 'SCHEDULE_PER_CIRCULAR', unverified: true, note: 'Per BB FE Manual schedule — confirm exact dates against the current circular.' },
    penaltyRef: unverifiedPenalty('BB FE Manual / FERA 1947', 'current circular; Act No. VII of 1947'),
  },

  // ── NDGA — Data Privacy Service ───────────────────────────
  'NDGA-INV': {
    instrumentCode: 'PDPA-2026', trigger: 'STATE', evaluationType: 'DOCUMENTARY',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'processes_personal_data', truthy: true }] },
    requiredEvidence: ['Data inventory & consent registry (current)'],
    deadlineFormula: { kind: 'CONTINUOUS', unverified: false, note: 'Maintained continuously; review on processing change.' },
    penaltyRef: unverifiedPenalty('Personal Data Protection Act 2026', 'Act No. 63 of 2026'),
  },
  'NDGA-DSAR': {
    instrumentCode: 'PDPA-2026', trigger: 'EVENT', evaluationType: 'JUDGMENT',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'processes_personal_data', truthy: true }] },
    requiredEvidence: ['DSAR response record'],
    deadlineFormula: { kind: 'ON_EVENT', unverified: true, note: 'Timeframe "as prescribed" — subordinate rules not yet issued. Treat as PENDING.' },
    penaltyRef: unverifiedPenalty('Personal Data Protection Act 2026', 'Act No. 63 of 2026'),
    judgmentGuidance: 'Adequacy of a DSAR response is a judgment; the statutory timeframe is "as prescribed" and subordinate rules are not yet issued — treat the rule as PENDING until they are.',
  },
  'NDGA-BREACH': {
    instrumentCode: 'PDPA-2026', trigger: 'EVENT', evaluationType: 'JUDGMENT',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'processes_personal_data', truthy: true }] },
    requiredEvidence: ['Breach notification record (s. 20)'],
    deadlineFormula: { kind: 'ON_EVENT', unverified: true, note: 'Mandatory but time limit "as prescribed" — subordinate rules pending. The 72-hour figure is a GDPR default, NOT statutory in BD.' },
    penaltyRef: unverifiedPenalty('Personal Data Protection Act 2026', 'Act No. 63 of 2026'),
    judgmentGuidance: 'Whether a personal-data breach is notifiable under s. 20 is a judgment call. The time limit is "as prescribed" — subordinate rules are not yet issued; do NOT import the GDPR 72-hour default.',
  },
  'NDGA-DPIA': {
    instrumentCode: 'PDPA-2026', trigger: 'EVENT', evaluationType: 'DOCUMENTARY',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'processes_personal_data', truthy: true }] },
    requiredEvidence: ['DPIA report (high-risk processing)'],
    deadlineFormula: { kind: 'ON_EVENT', unverified: false, note: 'Before commencement of high-risk processing.' },
    penaltyRef: unverifiedPenalty('Personal Data Protection Act 2026', 'Act No. 63 of 2026'),
  },
  'NDGA-DPO': {
    instrumentCode: 'PDPA-2026', trigger: 'EVENT', evaluationType: 'DOCUMENTARY',
    applicability: { ...DEFAULT_APPLICABILITY, requireFacts: [{ key: 'processes_personal_data', truthy: true }] },
    requiredEvidence: ['DPO appointment record'],
    deadlineFormula: { kind: 'ON_CHANGE', unverified: false, note: 'On appointment / change.' },
    penaltyRef: unverifiedPenalty('Personal Data Protection Act 2026', 'Act No. 63 of 2026'),
  },
}

// ══════════════════════════════════════════════════════════════
// COMPANY FACT STORE — every fact carries a source, an as-of date
// and who verified it. Overrides (company-specific BSEC consents /
// exemptions) are fact-level rows scoped to a single rule ID.
// The evaluator is a pure function of (facts, rules, as-of date),
// so any past finding can be replayed exactly.
// ══════════════════════════════════════════════════════════════

export interface FactSeed {
  type: 'FACT' | 'OVERRIDE'
  key: string
  value: string
  scopeRefCode?: string | null
  source: string
  asOf: string
  verifiedBy?: string | null
  note?: string | null
}

export const CATALOGUE_PROFILE = {
  name: 'Padma Textiles & Apparels Ltd.',
  stockTickers: 'DSE: PADMATEX · CSE: PADMATEX',
  sector: 'TEXTILE',
  note: 'Listed public limited company — evaluated against every catalogue rule by the applicability gate.',
}

export const CATALOGUE_FACTS: FactSeed[] = [
  // Identity & listing (drive the applicability gate)
  { type: 'FACT', key: 'company_type', value: 'PLC', source: 'Certificate of incorporation + DSE/CSE listing (Companies Act 1994) — re-verified', asOf: '2025-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'listing_status', value: 'LISTED', source: 'DSE & CSE listing records — standing listing', asOf: '2025-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'exchange', value: 'BOTH', source: 'DSE: PADMATEX · CSE: PADMATEX — standing listing', asOf: '2025-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'category', value: 'A', source: 'DSE listing categorisation — latest shareholding pattern filing (Q2 FY2026-27)', asOf: '2026-10-15', verifiedBy: 'Tanvir Ahmed — Company Secretary', note: 'Category drives CGC / reporting variants — re-check after each quarterly filing. History retained below so earlier as-of dates replay.' },
  { type: 'FACT', key: 'category', value: 'A', source: 'DSE listing categorisation — FY2025-26 year-end re-check', asOf: '2026-04-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'sector', value: 'TEXTILE', source: 'Memorandum of association', asOf: '2025-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'fy_end', value: '06-30', source: 'Articles of Association — financial year ends 30 June', asOf: '2025-11-15', verifiedBy: 'Rahim Uddin — CFO' },

  // Regulatory-scope facts
  { type: 'FACT', key: 'processes_personal_data', value: 'true', source: 'HR/payroll + customer order data processing register (Data Privacy Service)', asOf: '2026-09-30', verifiedBy: 'Mahmud Hasan — DPO / Legal Counsel' },
  { type: 'FACT', key: 'wppf_applicable', value: 'true', source: 'Audited FS FY2025-26 — profit-making year, WPPF 5% accrual recognised', asOf: '2026-09-30', verifiedBy: 'Rahim Uddin — CFO' },
  { type: 'FACT', key: 'pf_scheme_in_force', value: 'true', source: 'PF trust deed + latest PF annual return', asOf: '2026-09-30', verifiedBy: 'Farhana Karim — Head of Internal Audit' },

  // Event anchors
  { type: 'FACT', key: 'last_agm_date', value: '2026-11-12', source: 'AGM Minutes — 12 Nov 2026 (Document Vault)', asOf: '2026-11-12', verifiedBy: 'Tanvir Ahmed — Company Secretary' },

  // Governance facts (inform JUDGMENT findings — never self-certify them)
  { type: 'FACT', key: 'board_size', value: '9', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'independent_directors', value: '4', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'audit_committee_formed', value: 'true', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'nomination_remuneration_committee_formed', value: 'true', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'cfo_appointed', value: 'true', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'company_secretary_appointed', value: 'true', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'head_internal_audit_appointed', value: 'true', source: 'Board Register & Committees — FY2026-27.xlsx (Document Vault)', asOf: '2026-11-15', verifiedBy: 'Tanvir Ahmed — Company Secretary' },

  // Documentary evidence facts (value VALID = evidence present and valid)
  { type: 'FACT', key: 'evidence.bsec-cgcc', value: 'PENDING', source: 'External firm engaged — draft checklist circulated (Obligation Register)', asOf: '2026-11-10', verifiedBy: 'Tanvir Ahmed — Company Secretary', note: 'Certificate not yet issued for FY2025-26.' },
  { type: 'FACT', key: 'evidence.dol-safety', value: 'PENDING', source: 'Safety audit vendor onboarding in progress', asOf: '2026-11-05', verifiedBy: 'Farhana Karim — Head of Internal Audit' },
  { type: 'FACT', key: 'evidence.rjsc-ar', value: 'IN_PREPARATION', source: 'Annual return draft in IN_REVIEW (Obligation Register)', asOf: '2026-11-14', verifiedBy: 'Tanvir Ahmed — Company Secretary' },
  { type: 'FACT', key: 'evidence.ndga-inv', value: 'VALID', source: 'Data inventory & consent registry v3 (Data Privacy Service)', asOf: '2026-09-30', verifiedBy: 'Mahmud Hasan — DPO / Legal Counsel' },
  { type: 'FACT', key: 'evidence.dol-form3', value: 'VALID', source: 'Worker register (HRIS export, reviewed)', asOf: '2026-11-01', verifiedBy: 'Farhana Karim — Head of Internal Audit' },
  { type: 'FACT', key: 'evidence.dol-forma', value: 'VALID', source: 'Establishment registration certificate — particulars unchanged since 2026-03', asOf: '2026-03-15', verifiedBy: 'Farhana Karim — Head of Internal Audit' },
  { type: 'FACT', key: 'evidence.ndga-dpo', value: 'VALID', source: 'Board resolution appointing DPO (Mahmud Hasan)', asOf: '2026-08-20', verifiedBy: 'Mahmud Hasan — DPO / Legal Counsel' },

  // Company-specific BSEC consent — fact-level override scoped to one rule
  { type: 'OVERRIDE', key: 'bsec_consent', value: 'PRE_APPROVED', scopeRefCode: 'BSEC-RPT', source: 'Board minutes 08 Oct 2026 — warehouse lease from sponsor entity (see RJSC-SR special resolution)', asOf: '2026-10-08', verifiedBy: 'Tanvir Ahmed — Company Secretary', note: 'Company-specific BSEC consent stored as a fact-level override. Consent circular number UNVERIFIED — confirm against BSEC records.' },
]

// ── rule resolution: template definition + rule layer, merged ──

export interface ResolvedRule extends CatalogueTemplate, RuleExtension {}

const extensionByRef = new Map(Object.entries(RULE_EXTENSIONS))

/** Merge a catalogue template with its rule-layer extension. Throws when a rule has no extension — every catalogue rule MUST be engine-evaluable. */
export function resolveRule(refCode: string): ResolvedRule {
  const t = CATALOGUE_TEMPLATES.find((x) => x.refCode === refCode)
  const ext = extensionByRef.get(refCode)
  if (!t || !ext) throw new Error(`Rule ${refCode} is missing a catalogue template or rule extension`)
  return { ...t, ...ext }
}

export const ALL_RESOLVED_RULES: ResolvedRule[] = CATALOGUE_TEMPLATES.map((t) => resolveRule(t.refCode))

// Fields that must reconcile per rule: base definition + rule layer.
export const RULE_JSON_FIELDS = ['forms', 'applicability', 'requiredEvidence', 'deadlineFormula'] as const

export const FULL_RULE_DEFINITION_FIELDS = [
  ...TEMPLATE_DEFINITION_FIELDS,
  'instrumentCode',
  'trigger',
  'evaluationType',
  'applicability',
  'requiredEvidence',
  'deadlineFormula',
  'penaltyRef',
] as const
