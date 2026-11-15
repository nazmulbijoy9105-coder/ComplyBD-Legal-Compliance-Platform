/**
 * Seed: Bangladesh Regulatory Mapping v2 (source-reviewed, 2026-11-15)
 * Every row carries legal_basis + source_tier + status + verification.
 * Items marked UNVERIFIED are preserved as UNVERIFIED — they require
 * primary-source confirmation (bdlaws.minlaw.gov.bd, rjsc.gov.bd,
 * bsec.gov.bd, nbr.gov.bd, bb.org.bd) before being treated as authoritative.
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'
import {
  CATALOGUE_FACTS,
  CATALOGUE_INSTRUMENTS,
  CATALOGUE_PROFILE,
  CATALOGUE_REGULATORS as regulators,
  CATALOGUE_TEMPLATES as templates,
  definitionDrift,
  FULL_RULE_DEFINITION_FIELDS,
  REGULATOR_DEFINITION_FIELDS,
  resolveRule,
} from '../src/lib/catalogue'

const prisma = new PrismaClient()

// ── helpers ──────────────────────────────────────────────────
const NOW = new Date('2026-11-15T09:00:00Z')
function daysFromNow(days: number, hour = 17) {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}


// forms: JSON string arrays

const assignees = {
  cs: 'Tanvir Ahmed — Company Secretary',
  co: 'Nusrat Jahan — Compliance Officer',
  cfo: 'Rahim Uddin — CFO',
  audit: 'Farhana Karim — Head of Internal Audit',
  dpo: 'Mahmud Hasan — DPO / Legal Counsel',
}

type ObligationSeed = {
  refCode: string
  title: string
  regulatorCode: string
  cadence: string
  periodLabel: string
  dueDate: Date
  status: string
  priority: string
  assignee: string
  notes?: string
  filedAt?: Date
  forms?: string[]
  docs?: { name: string; classification: string; fileType: string; sizeKb: number; daysAgo: number }[]
  activities?: { type: string; actor: string; message: string; daysAgo: number }[]
}

const filedFY = daysFromNow(-25)

const obligations: ObligationSeed[] = [
  // RJSC
  {
    refCode: 'RJSC-AR', title: 'Annual Return (RJSC) — FY2025-26', regulatorCode: 'RJSC', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(10), status: 'IN_REVIEW', priority: 'HIGH', assignee: assignees.cs,
    notes: 'AGM held 12 Nov 2026. Reference rule "30 days from AGM" is UNVERIFIED — legal team confirming against Companies Act 1994 before filing.',
    docs: [{ name: 'AGM Minutes — 12 Nov 2026.pdf', classification: 'CONFIDENTIAL', fileType: 'PDF', sizeKb: 2410, daysAgo: 3 }],
    activities: [
      { type: 'CREATED', actor: assignees.cs, message: 'Obligation created from Companies Act 1994 template', daysAgo: 40 },
      { type: 'DOCUMENT_UPLOADED', actor: assignees.cs, message: 'Uploaded "AGM Minutes — 12 Nov 2026.pdf"', daysAgo: 3 },
      { type: 'STATUS_CHANGE', actor: assignees.co, message: 'Status moved DRAFT → IN_REVIEW', daysAgo: 2 },
    ],
  },
  {
    refCode: 'RJSC-DC', title: 'Director Change Form — Mr. S. Chowdhury resignation', regulatorCode: 'RJSC', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(-6), status: 'DRAFT', priority: 'HIGH', assignee: assignees.cs,
    notes: 'Director resigned 26 Oct 2026. Deadline rule UNVERIFIED (14-day claim not BD-sourced) — file as soon as form data complete.',
    activities: [
      { type: 'CREATED', actor: assignees.cs, message: 'Obligation created for director resignation', daysAgo: 20 },
      { type: 'COMMENT', actor: assignees.co, message: 'Waiting on signed resignation letter and board acceptance minute.', daysAgo: 5 },
    ],
  },
  {
    refCode: 'RJSC-SR', title: 'Special Resolution Filing — Private placement approval', regulatorCode: 'RJSC', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(-25), status: 'FILED', priority: 'MEDIUM', assignee: assignees.cs,
    filedAt: filedFY,
    docs: [{ name: 'Special Resolution — EGM 08 Oct 2026.pdf', classification: 'CONFIDENTIAL', fileType: 'PDF', sizeKb: 1180, daysAgo: 26 }],
    activities: [
      { type: 'CREATED', actor: assignees.cs, message: 'Special resolution passed at EGM', daysAgo: 38 },
      { type: 'STATUS_CHANGE', actor: assignees.cs, message: 'Status moved APPROVED → FILED', daysAgo: 25 },
      { type: 'FILED', actor: assignees.cs, message: 'Filed with RJSC; filing receipt archived to Document Vault', daysAgo: 25 },
    ],
  },
  {
    refCode: 'RJSC-ALLOT', title: 'Allotment Return — Q2 placement shares', regulatorCode: 'RJSC', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(48), status: 'DRAFT', priority: 'LOW', assignee: assignees.cs,
    activities: [{ type: 'CREATED', actor: assignees.cs, message: 'Obligation created for pending share allotment', daysAgo: 12 }],
  },

  // BSEC
  {
    refCode: 'BSEC-PSD', title: 'PSD — New export contract with EU retailer', regulatorCode: 'BSEC', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(1), status: 'IN_REVIEW', priority: 'HIGH', assignee: assignees.co,
    notes: '24-hour max per Listing Regs. Board approval received; disclosure text under CFO sign-off.',
    activities: [
      { type: 'CREATED', actor: assignees.co, message: 'Price-sensitive event logged by CFO office', daysAgo: 1 },
      { type: 'STATUS_CHANGE', actor: assignees.co, message: 'Status moved DRAFT → IN_REVIEW', daysAgo: 0 },
    ],
  },
  {
    refCode: 'BSEC-CGCC', title: 'CGC Compliance Certificate — FY2025-26', regulatorCode: 'BSEC', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(75), status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: assignees.cs,
    notes: 'Certificate from practising professional accountant/secretary mandatory. Engaged external firm; draft checklist circulated.',
    docs: [{ name: 'CGC Compliance Checklist — Draft v2.docx', classification: 'INTERNAL', fileType: 'DOCX', sizeKb: 320, daysAgo: 6 }],
    activities: [
      { type: 'CREATED', actor: assignees.cs, message: 'Obligation created from Corporate Governance Code 2018 template', daysAgo: 30 },
      { type: 'DOCUMENT_UPLOADED', actor: assignees.cs, message: 'Uploaded "CGC Compliance Checklist — Draft v2.docx"', daysAgo: 6 },
    ],
  },
  {
    refCode: 'BSEC-RPT', title: 'RPT Disclosure — Warehouse lease from sponsor entity', regulatorCode: 'BSEC', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(-40), status: 'FILED', priority: 'MEDIUM', assignee: assignees.co,
    filedAt: daysFromNow(-40),
    activities: [
      { type: 'CREATED', actor: assignees.co, message: 'RPT identified and logged', daysAgo: 48 },
      { type: 'FILED', actor: assignees.co, message: 'RPT disclosure published and submitted to BSEC', daysAgo: 40 },
    ],
  },
  {
    refCode: 'BSEC-INSIDER', title: 'Insider Declaration — CFO share allotment', regulatorCode: 'BSEC', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(3), status: 'IN_PROGRESS', priority: 'HIGH', assignee: assignees.cfo,
    notes: '7 days post-trade rule (verify against current BSEC rules). Trade executed 15 Nov 2026.',
    activities: [{ type: 'CREATED', actor: assignees.cfo, message: 'Insider trade declared by CFO', daysAgo: 1 }],
  },
  {
    refCode: 'BSEC-CGCR', title: 'Annual CGC Report — FY2025-26', regulatorCode: 'BSEC', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(80), status: 'DRAFT', priority: 'MEDIUM', assignee: assignees.cs,
    activities: [{ type: 'CREATED', actor: assignees.cs, message: 'Obligation created from CGC 2018 template', daysAgo: 30 }],
  },

  // DSE & CSE
  {
    refCode: 'DSECSE-QFS', title: 'Quarterly FS — Q1 FY2026-27 (Jul–Sep)', regulatorCode: 'DSECSE', cadence: 'QUARTERLY',
    periodLabel: 'Q1 FY2026-27', dueDate: daysFromNow(-30), status: 'FILED', priority: 'HIGH', assignee: assignees.cfo,
    filedAt: daysFromNow(-33),
    docs: [{ name: 'Q1 FY2026-27 Un-audited Financial Statements.pdf', classification: 'PUBLIC', fileType: 'PDF', sizeKb: 4820, daysAgo: 33 }],
    activities: [
      { type: 'CREATED', actor: assignees.cfo, message: 'Quarter-end triggered QFS obligation', daysAgo: 50 },
      { type: 'FILED', actor: assignees.cfo, message: 'Published and pushed to DSE & CSE within 1 month of quarter-end', daysAgo: 33 },
    ],
  },
  {
    refCode: 'DSECSE-QFS', title: 'Quarterly FS — Q2 FY2026-27 (Oct–Dec)', regulatorCode: 'DSECSE', cadence: 'QUARTERLY',
    periodLabel: 'Q2 FY2026-27', dueDate: daysFromNow(46), status: 'DRAFT', priority: 'MEDIUM', assignee: assignees.cfo,
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Quarter-end scheduler created obligation', daysAgo: 0 }],
  },
  {
    refCode: 'DSECSE-SHP', title: 'Shareholding Pattern — Q2 FY2026-27', regulatorCode: 'DSECSE', cadence: 'QUARTERLY',
    periodLabel: 'Q2 FY2026-27', dueDate: daysFromNow(14), status: 'IN_REVIEW', priority: 'MEDIUM', assignee: assignees.cs,
    notes: 'Within 30 days of quarter per DSE/CSE Listing Regulations (consolidated text — verify).',
    activities: [
      { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Quarter-end scheduler created obligation', daysAgo: 0 },
      { type: 'STATUS_CHANGE', actor: assignees.cs, message: 'Status moved DRAFT → IN_REVIEW', daysAgo: 1 },
    ],
  },
  {
    refCode: 'DSECSE-MEN', title: 'Material Event Notice — Chittagong plant commissioning', regulatorCode: 'DSECSE', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(-18), status: 'FILED', priority: 'HIGH', assignee: assignees.co,
    filedAt: daysFromNow(-18),
    activities: [
      { type: 'CREATED', actor: assignees.co, message: 'Material event logged', daysAgo: 20 },
      { type: 'FILED', actor: assignees.co, message: 'Notice served to both exchanges same day', daysAgo: 18 },
    ],
  },
  {
    refCode: 'DSECSE-ICR', title: 'Investor Complaint Return — Q2 FY2026-27', regulatorCode: 'DSECSE', cadence: 'QUARTERLY',
    periodLabel: 'Q2 FY2026-27', dueDate: daysFromNow(52), status: 'DRAFT', priority: 'LOW', assignee: assignees.cs,
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Quarter-end scheduler created obligation', daysAgo: 0 }],
  },

  // NBR
  {
    refCode: 'NBR-ITR', title: 'Corporate IT Return — FY2025-26', regulatorCode: 'NBR', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(61), status: 'IN_PROGRESS', priority: 'HIGH', assignee: assignees.cfo,
    notes: 'Deadline rule: 15th day of 7th month after year-end = 15 Jan 2027 for 30 June YE. PwC secondary source says 15 March — flagged for Act-text verification.',
    docs: [{ name: 'FY2025-26 Provisional Accounts.xlsx', classification: 'CONFIDENTIAL', fileType: 'XLSX', sizeKb: 860, daysAgo: 9 }],
    activities: [
      { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Fiscal-year scheduler created obligation', daysAgo: 90 },
      { type: 'DOCUMENT_UPLOADED', actor: assignees.cfo, message: 'Uploaded "FY2025-26 Provisional Accounts.xlsx"', daysAgo: 9 },
      { type: 'STATUS_CHANGE', actor: assignees.cfo, message: 'Status moved DRAFT → IN_PROGRESS', daysAgo: 8 },
    ],
  },
  {
    refCode: 'NBR-M91', title: 'Mushak 9.1 — October 2026', regulatorCode: 'NBR', cadence: 'MONTHLY',
    periodLabel: 'Oct 2026', dueDate: daysFromNow(-1), status: 'IN_REVIEW', priority: 'HIGH', assignee: assignees.cfo,
    notes: 'Within 15 days of month-end. Submitted late fee risk if review not closed today.',
    docs: [{ name: 'Mushak 9.1 — Oct 2026 (final).pdf', classification: 'INTERNAL', fileType: 'PDF', sizeKb: 540, daysAgo: 2 }],
    activities: [
      { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Monthly scheduler created obligation', daysAgo: 31 },
      { type: 'DOCUMENT_UPLOADED', actor: assignees.cfo, message: 'Uploaded "Mushak 9.1 — Oct 2026 (final).pdf"', daysAgo: 2 },
      { type: 'STATUS_CHANGE', actor: assignees.cfo, message: 'Status moved IN_PROGRESS → IN_REVIEW', daysAgo: 1 },
    ],
  },
  {
    refCode: 'NBR-M91', title: 'Mushak 9.1 — November 2026', regulatorCode: 'NBR', cadence: 'MONTHLY',
    periodLabel: 'Nov 2026', dueDate: daysFromNow(30), status: 'DRAFT', priority: 'LOW', assignee: assignees.cfo,
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Monthly scheduler created obligation', daysAgo: 0 }],
  },
  {
    refCode: 'NBR-TDS', title: 'TDS Deposit & Challan — October 2026', regulatorCode: 'NBR', cadence: 'MONTHLY',
    periodLabel: 'Oct 2026', dueDate: daysFromNow(-11), status: 'FILED', priority: 'HIGH', assignee: assignees.cfo,
    filedAt: daysFromNow(-12),
    activities: [
      { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Monthly scheduler created obligation', daysAgo: 31 },
      { type: 'FILED', actor: assignees.cfo, message: 'TDS deposited; challan archived', daysAgo: 12 },
    ],
  },
  {
    refCode: 'NBR-TDS', title: 'TDS Deposit & Challan — November 2026', regulatorCode: 'NBR', cadence: 'MONTHLY',
    periodLabel: 'Nov 2026', dueDate: daysFromNow(19), status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: assignees.cfo,
    notes: 'Deadline UNVERIFIED — 7 days vs 2 weeks per s.142 conflict; company practice: deposit by 2nd week.',
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Monthly scheduler created obligation', daysAgo: 0 }],
  },
  {
    refCode: 'NBR-WHR', title: 'Withholding Return — October 2026', regulatorCode: 'NBR', cadence: 'MONTHLY',
    periodLabel: 'Oct 2026', dueDate: daysFromNow(9), status: 'DRAFT', priority: 'MEDIUM', assignee: assignees.cfo,
    notes: '15th or 25th of following month — UNVERIFIED, sources conflict. Padded to the earlier date for safety.',
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Monthly scheduler created obligation', daysAgo: 0 }],
  },

  // Department of Labour
  {
    refCode: 'DOL-PF', title: 'PF Annual Return — FY2025-26', regulatorCode: 'DOL', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(-46), status: 'IN_REVIEW', priority: 'HIGH', assignee: assignees.audit,
    notes: 'OVERDUE. "30 Sept" reference date UNVERIFIED after 2025/2026 Labour Act amendments — HIA reviewing citation before submission.',
    docs: [{ name: 'PF Annual Return — FY2025-26 (draft).xlsx', classification: 'CONFIDENTIAL', fileType: 'XLSX', sizeKb: 210, daysAgo: 15 }],
    activities: [
      { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Annual scheduler created obligation', daysAgo: 120 },
      { type: 'DOCUMENT_UPLOADED', actor: assignees.audit, message: 'Uploaded draft PF return', daysAgo: 15 },
      { type: 'STATUS_CHANGE', actor: assignees.audit, message: 'Status moved IN_PROGRESS → IN_REVIEW', daysAgo: 12 },
    ],
  },
  {
    refCode: 'DOL-WPPF', title: 'WPPF Statement — FY2025-26 (5% of net profit)', regulatorCode: 'DOL', cadence: 'ANNUAL',
    periodLabel: 'FY2025-26', dueDate: daysFromNow(136), status: 'DRAFT', priority: 'MEDIUM', assignee: assignees.cfo,
    notes: 'Within 9 months of year-end (31 Mar 2027). Split 80:10:10 — WPPF / WWF / BWWF. Computation pending final FY accounts.',
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Annual scheduler created obligation', daysAgo: 60 }],
  },
  {
    refCode: 'DOL-FORMA', title: 'Form-A (Establishment) — Address update, Gazipur unit', regulatorCode: 'DOL', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(-90), status: 'FILED', priority: 'LOW', assignee: assignees.co,
    filedAt: daysFromNow(-92),
    activities: [
      { type: 'CREATED', actor: assignees.co, message: 'Establishment particulars changed', daysAgo: 100 },
      { type: 'FILED', actor: assignees.co, message: 'Form-A update filed with Department of Labour', daysAgo: 92 },
    ],
  },
  {
    refCode: 'DOL-FORM3', title: 'Form-III (Worker Register) — Annual refresh', regulatorCode: 'DOL', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(28), status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: assignees.co,
    activities: [{ type: 'CREATED', actor: assignees.co, message: 'Worker register refresh scheduled', daysAgo: 30 }],
  },
  {
    refCode: 'DOL-SAFETY', title: 'Safety Audit Report — FY2026', regulatorCode: 'DOL', cadence: 'ANNUAL',
    periodLabel: 'FY2026', dueDate: daysFromNow(100), status: 'DRAFT', priority: 'LOW', assignee: assignees.audit,
    activities: [{ type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Annual scheduler created obligation', daysAgo: 45 }],
  },

  // Bangladesh Bank — banks only; non-bank listed PLC: tracked as NOT APPLICABLE
  {
    refCode: 'BB-FE2', title: 'FE-2 / FE-4 Returns — scope check', regulatorCode: 'BB', cadence: 'MONTHLY',
    periodLabel: 'Continuous', dueDate: daysFromNow(200), status: 'DRAFT', priority: 'LOW', assignee: assignees.cfo,
    notes: 'NOT APPLICABLE — banking-company returns apply ONLY to banks. Padma Textiles is a non-bank listed PLC: FE-2/FE-4 not filed. Kept on register for annual scope re-confirmation.',
    activities: [{ type: 'COMMENT', actor: assignees.cs, message: 'Scope re-confirmed: non-bank entity — BB returns out of scope. Re-check each January.', daysAgo: 20 }],
  },

  // NDGA
  {
    refCode: 'NDGA-INV', title: 'Data Inventory Register — FY2026-27 refresh', regulatorCode: 'NDGA', cadence: 'EVENT',
    periodLabel: 'FY2026-27', dueDate: daysFromNow(22), status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: assignees.dpo,
    notes: 'PDPA 2026 in force 6 Nov 2025 except s.23, ss.31–35 (18-month delay). Register refresh includes HR and CRM systems.',
    activities: [
      { type: 'CREATED', actor: assignees.dpo, message: 'Annual register refresh scheduled', daysAgo: 40 },
      { type: 'STATUS_CHANGE', actor: assignees.dpo, message: 'Status moved DRAFT → IN_PROGRESS', daysAgo: 10 },
    ],
  },
  {
    refCode: 'NDGA-DSAR', title: 'DSAR Response — ex-employee data access request', regulatorCode: 'NDGA', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(-8), status: 'FILED', priority: 'HIGH', assignee: assignees.dpo,
    filedAt: daysFromNow(-8),
    notes: 'Statutory timeframe "as prescribed" — UNVERIFIED (rules pending). Responded within 14 days as good practice.',
    docs: [{ name: 'DSAR Response Pack — REQ-2026-041.pdf', classification: 'RESTRICTED', fileType: 'PDF', sizeKb: 1560, daysAgo: 9 }],
    activities: [
      { type: 'CREATED', actor: assignees.dpo, message: 'DSAR received via privacy mailbox', daysAgo: 24 },
      { type: 'FILED', actor: assignees.dpo, message: 'Response delivered and logged', daysAgo: 8 },
    ],
  },
  {
    refCode: 'NDGA-DPIA', title: 'DPIA Report — New vendor payroll platform', regulatorCode: 'NDGA', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(38), status: 'DRAFT', priority: 'MEDIUM', assignee: assignees.dpo,
    notes: 'Required before commencement of high-risk processing (employee data migration to SaaS payroll).',
    activities: [{ type: 'CREATED', actor: assignees.dpo, message: 'DPIA created for vendor migration project', daysAgo: 14 }],
  },
  {
    refCode: 'NDGA-BREACH', title: 'Breach Notification Readiness — tabletop test', regulatorCode: 'NDGA', cadence: 'EVENT',
    periodLabel: 'Event', dueDate: daysFromNow(-20), status: 'FILED', priority: 'MEDIUM', assignee: assignees.dpo,
    filedAt: daysFromNow(-20),
    notes: 's.20 mandatory; time limit "as prescribed" still pending (72-hour figure is GDPR, NOT statutory in BD). Internal SLA set at 72h pending rules.',
    activities: [
      { type: 'CREATED', actor: assignees.dpo, message: 'Tabletop breach drill scheduled', daysAgo: 40 },
      { type: 'FILED', actor: assignees.dpo, message: 'Drill completed; breach playbook v3 approved', daysAgo: 20 },
    ],
  },
  {
    refCode: 'NDGA-DPO', title: 'DPO Appointment — Mahmud Hasan (renewal)', regulatorCode: 'NDGA', cadence: 'ON_CHANGE',
    periodLabel: 'On change', dueDate: daysFromNow(-60), status: 'FILED', priority: 'LOW', assignee: assignees.dpo,
    filedAt: daysFromNow(-60),
    activities: [{ type: 'FILED', actor: assignees.dpo, message: 'DPO appointment record updated with NDGA register', daysAgo: 60 }],
  },
]



async function main() {
  console.log('Seeding Legal Compliance Platform…')

  await prisma.complianceFinding.deleteMany()
  await prisma.engineAlert.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.accessLog.deleteMany()
  await prisma.reviewDecision.deleteMany()
  await prisma.ruleVerification.deleteMany()
  await prisma.changeRequest.deleteMany()
  await prisma.complianceRun.deleteMany()
  await prisma.companyFact.deleteMany()
  await prisma.companyProfile.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.legalInstrumentVersion.deleteMany()
  await prisma.legalInstrument.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.document.deleteMany()
  await prisma.obligation.deleteMany()
  await prisma.obligationTemplate.deleteMany()
  await prisma.regulator.deleteMany()

  // Tenants — the demo tenant owns all seeded domain rows; the second
  // tenant exists to prove row-level isolation (its rows must be invisible
  // to padma users and vice versa).
  const tenantPadma = await prisma.tenant.create({
    data: {
      name: 'Padma Textiles & Apparels Ltd.',
      slug: 'padma-textiles',
      plan: 'STANDARD',
      status: 'ACTIVE',
      dataResidency: 'BD',
    },
  })
  const tenantRupali = await prisma.tenant.create({
    data: {
      name: 'Rupali Steel & Re-rolling Mills Ltd.',
      slug: 'rupali-steel',
      plan: 'PILOT',
      status: 'ACTIVE',
      dataResidency: 'BD',
    },
  })
  const tenantId = tenantPadma.id
  console.log(`  tenants: padma-textiles (demo) + rupali-steel (isolation proof)`)

  // Users — provisioned (no JIT signup). Demo password: ComplyBD#2026
  const DEMO_PASSWORD = 'ComplyBD#2026'
  const passwordHash = hashPassword(DEMO_PASSWORD)
  const users = [
    { name: 'Tanvir Ahmed', email: 'tanvir@padmatex.bd', role: 'COMPANY_SECRETARY' },
    { name: 'Nusrat Jahan', email: 'nusrat@padmatex.bd', role: 'COMPLIANCE_OFFICER' },
    { name: 'Sabbir Rahman', email: 'sabbir@auditca.bd', role: 'EXTERNAL_AUDITOR' },
    { name: 'Md. Rafiqul Islam', email: 'rafiq@padmatex.bd', role: 'EXECUTIVE' },
    { name: 'Ruhul Amin', email: 'ruhul@rupalisteel.bd', role: 'COMPANY_SECRETARY', tenantId: tenantRupali.id },
  ]
  for (const u of users) {
    await prisma.user.create({
      data: {
        tenantId: u.tenantId ?? tenantId,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        active: true,
        emailVerified: NOW,
      },
    })
  }
  console.log(`  users: ${users.length} provisioned (NextAuth credentials + SSO-ready)`)

  for (const r of regulators) {
    await prisma.regulator.create({ data: r })
  }
  console.log(`  regulators: ${regulators.length}`)

  // Legal instrument registry — the engine reads rule citations from here
  // and nowhere else. Versions are appended immutably (amendments never edit).
  for (const inst of CATALOGUE_INSTRUMENTS) {
    const { versions, verifiedAt, ...instrument } = inst
    await prisma.legalInstrument.create({
      data: {
        ...instrument,
        verifiedAt: verifiedAt ? new Date(`${verifiedAt}T09:00:00Z`) : null,
        versions: { create: versions },
      },
    })
  }
  console.log(`  legal instruments: ${CATALOGUE_INSTRUMENTS.length} (immutable version history)`)

  // Rule layer — every catalogue rule merged with its extension
  // (applicability, trigger, evidence, deadline formula, penalty, evaluation type).
  //
  // VERSIONING: the manifest is the BASELINE — every seeded rule is
  // version 1, effective from its instrument's effective date (year-level
  // precision preserved where that's what the source gives), effectiveTo
  // null = current. Edits later append versions via the API — never in place.
  const instrumentByCode = new Map(CATALOGUE_INSTRUMENTS.map((i) => [i.code, i]))
  const REGISTRATION_BASELINE = '2026-01-01' // rules whose instrument carries no confirmed date
  const ruleEffectiveFrom = (instrumentCode: string | null | undefined): string => {
    if (!instrumentCode) return REGISTRATION_BASELINE
    const inst = instrumentByCode.get(instrumentCode)
    const current = inst?.versions.find((v) => v.effectiveTo === null) ?? inst?.versions[inst.versions.length - 1]
    const eff = current?.effectiveFrom ?? ''
    return /^(19|20)\d{2}/.test(eff) ? eff : REGISTRATION_BASELINE
  }

  for (const t of templates) {
    const rule = resolveRule(t.refCode)
    await prisma.obligationTemplate.create({
      data: {
        tenantId,
        ...t,
        instrumentCode: rule.instrumentCode,
        trigger: rule.trigger,
        evaluationType: rule.evaluationType,
        applicability: JSON.stringify(rule.applicability),
        requiredEvidence: JSON.stringify(rule.requiredEvidence),
        deadlineFormula: JSON.stringify(rule.deadlineFormula),
        penaltyRef: rule.penaltyRef,
        version: 1,
        effectiveFrom: ruleEffectiveFrom(rule.instrumentCode),
        effectiveTo: null,
        sourceRef: null, // baseline rows come straight from the manifest
      },
    })
  }
  console.log(`  templates: ${templates.length} (rule layer attached, v1 baseline with effective windows)`)

  // Company profile + fact store (facts and fact-level overrides)
  await prisma.companyProfile.create({ data: { tenantId, ...CATALOGUE_PROFILE } })
  for (const f of CATALOGUE_FACTS) {
    await prisma.companyFact.create({ data: { tenantId, ...f, scopeRefCode: f.scopeRefCode ?? null } })
  }
  console.log(`  company facts: ${CATALOGUE_FACTS.length} (source + as-of + verifiedBy on every row)`)

  // Review queue — JUDGMENT findings go to an advocate or company secretary
  // for sign-off; the reasoning and timestamp are logged, and the decision
  // mirrors into the fact store as judgment.<refCode> (replayable history).
  // BSEC-RPT signed SATISFIED, NDGA-DSAR escalated to counsel — the other
  // judgment rules (DSECSE-MEN, NDGA-BREACH) stay OPEN in the queue.
  const reviewSeeds = [
    {
      refCode: 'BSEC-RPT',
      decision: 'SATISFIED',
      reasoning:
        'Reviewed the FY2025-26 related-party transactions against the listing conditions: disclosures in the annual report carry arm\u2019s-length valuations and the audit committee minutes record the review. Substance and disclosure assessed as adequate.',
      decidedBy: 'Adv. Shahana Akter — External Counsel',
      decidedRole: 'Advocate',
      daysAgo: 6,
    },
    {
      refCode: 'NDGA-DSAR',
      decision: 'ESCALATED',
      reasoning:
        'One DSAR response exceeded the platform\u2019s internal 21-day service standard. The statutory timeframe is "as prescribed" and subordinate rules are not yet issued, so the matter is escalated to counsel for a documented position before sign-off.',
      decidedBy: 'Mahmud Hasan — DPO / Legal Counsel',
      decidedRole: 'Company Secretary (delegating to counsel)',
      daysAgo: 2,
    },
  ]
  for (const r of reviewSeeds) {
    const decidedAt = new Date(NOW.getTime() - r.daysAgo * 86400000)
    await prisma.reviewDecision.create({
      data: {
        tenantId,
        refCode: r.refCode,
        decision: r.decision,
        reasoning: r.reasoning,
        decidedBy: r.decidedBy,
        decidedRole: r.decidedRole,
        decidedAt,
      },
    })
    await prisma.companyFact.create({
      data: {
        tenantId,
        type: 'FACT',
        key: `judgment.${r.refCode}`,
        value: r.decision,
        source: `Review queue sign-off (${r.decidedRole})`,
        asOf: decidedAt.toISOString().slice(0, 10),
        verifiedBy: r.decidedBy,
        note: r.reasoning,
      },
    })
  }
  console.log(`  review queue: ${reviewSeeds.length} sign-off(s) mirrored into the fact store, 2 judgment rules left open`)

  // Change pipeline — ingested circulars in human-approved flow. Seeded in
  // pre-approval states so the version chains stay at the manifest baseline;
  // approving one live creates the next rule version + impact report.
  const changeSeeds = [
    {
      refCode: 'BSEC-PSD',
      title: 'Clarification of price-sensitive information disclosure timeline',
      issuer: 'BSEC',
      reference: 'BSEC/CMRRCD/2026/Nov-03',
      publishedAt: '2026-11-03',
      summary:
        'BSEC clarifies that PSD disclosure must reach the exchanges within the same trading day (24-hour window reaffirmed) and that board approval of the disclosure text may precede publication rather than follow it.',
      effectiveFrom: '2026-12-01',
      proposedFields: JSON.stringify({
        deadlineRule: 'Disclose within 24 hours of the board decision (board approval may precede publication)',
        deadlineNote: 'Per BSEC clarification circular Nov 2026 — board approval no longer delays the clock.',
        deadlineFormula: { kind: 'DAYS_FROM_EVENT', days: 1, unverified: false, note: '24-hour window reaffirmed by BSEC/CMRRCD/2026/Nov-03.' },
      }),
      status: 'RECEIVED',
      daysAgo: 1,
    },
    {
      refCode: 'DSECSE-SHP',
      title: 'Amended shareholding-pattern reporting window (30 → 15 days)',
      issuer: 'DSE',
      reference: 'DSE/LIST/2026/229',
      publishedAt: '2026-10-28',
      summary:
        'DSE listing department amends the shareholding-pattern reporting window from 30 days to 15 days after each quarter-end, effective for quarters ending on or after 31 December 2026.',
      effectiveFrom: '2027-01-01',
      proposedFields: JSON.stringify({
        deadlineRule: 'Within 15 days of each fiscal quarter-end (amended window)',
        deadlineNote: 'Per DSE/LIST/2026/229 — effective for quarters ending on or after 31 Dec 2026.',
        deadlineFormula: { kind: 'DAYS_FROM_QUARTER_END', days: 15, unverified: false, note: '15-day window per DSE/LIST/2026/229.' },
      }),
      status: 'UNDER_REVIEW',
      daysAgo: 5,
    },
    {
      refCode: 'RJSC-AR',
      title: 'Draft circular on annual-return filing fees (withdrawn)',
      issuer: 'RJSC',
      reference: 'RJSC/CIRC/2026/44-DRAFT',
      publishedAt: '2026-10-20',
      summary:
        'Draft RJSC circular circulating on reduced late-filing fees for annual returns. Withdrawn after stakeholder consultation — never gazetted, so it must not change the register.',
      effectiveFrom: '2026-12-15',
      proposedFields: JSON.stringify({
        deadlineNote: 'DRAFT — never gazetted; fee change only, no deadline change.',
      }),
      status: 'RECEIVED',
      daysAgo: 9,
    },
  ]
  for (const c of changeSeeds) {
    await prisma.changeRequest.create({
      data: {
        tenantId,
        refCode: c.refCode,
        title: c.title,
        issuer: c.issuer,
        reference: c.reference,
        publishedAt: c.publishedAt,
        summary: c.summary,
        proposedFields: c.proposedFields,
        effectiveFrom: c.effectiveFrom,
        status: c.status,
        reviewedBy: c.status === 'UNDER_REVIEW' ? 'Nusrat Jahan — Compliance Officer' : null,
        reviewedAt: c.status === 'UNDER_REVIEW' ? new Date(NOW.getTime() - 2 * 86400000) : null,
        reviewNote: c.status === 'UNDER_REVIEW' ? 'Verifying the circular text against the DSE listing regulations before approval.' : null,
        createdAt: new Date(NOW.getTime() - c.daysAgo * 86400000),
      },
    })
  }
  console.log(`  change pipeline: ${changeSeeds.length} circular(s) — 1 received, 1 under review, 1 rejected-in-flow candidate`)

  // Verification queue — PENDING entries waiting for a human to confirm the
  // rule's deadline formula / penalty / citation against the REGISTERED
  // instrument text. Confirming applies the verified definition as a NEW
  // rule version (never in place) and flips the finding from
  // UNVERIFIED_DEADLINE / caveated to instrument-backed. Seeded PENDING so
  // the queue demonstrates the entry-governance flow live.
  const verificationSeeds = [
    {
      refCode: 'RJSC-AR',
      ruleVersion: 1,
      subject: 'DEADLINE_FORMULA',
      instrumentCode: 'CA-1994',
      instrumentReference: 'Companies Act 1994 (Act No. XVIII of 1994) — s. 133, bdlaws',
      note: 'Awaiting confirmation of the annual-return window against the s. 133 text on bdlaws before the formula is marked instrument-verified.',
    },
    {
      refCode: 'DSECSE-SHP',
      ruleVersion: 1,
      subject: 'PENALTY_REF',
      instrumentCode: 'DSE-LR',
      instrumentReference: 'DSE Listing Regulations (consolidated text) — sanction provisions',
      note: 'Penalty provision currently asserts "UNVERIFIED — confirm the penalty provision" — needs the exact sanction clause from the consolidated listing regulations.',
    },
    {
      refCode: 'BSEC-INSIDER',
      ruleVersion: 1,
      subject: 'CITATION',
      instrumentCode: 'BSEC-ITR',
      instrumentReference: 'BSEC Insider Trading Rules — circular reference unverified',
      note: 'Citation carries an unverified circular reference; confirm the rule number against the BSEC portal before reliance.',
    },
  ]
  for (const v of verificationSeeds) {
    await prisma.ruleVerification.create({
      data: {
        tenantId,
        refCode: v.refCode,
        ruleVersion: v.ruleVersion,
        subject: v.subject,
        claim: 'Claim as registered — pending confirmation against the instrument text held in the source registry.',
        instrumentCode: v.instrumentCode,
        instrumentReference: v.instrumentReference,
        status: 'PENDING',
        note: v.note,
      },
    })
  }
  console.log(`  verification queue: ${verificationSeeds.length} PENDING entr(ies) — deadline formula, penalty ref, citation`)

  for (const o of obligations) {
    const tpl = templates.find((t) => t.refCode === o.refCode)
    const tplRow = tpl ? await prisma.obligationTemplate.findFirst({ where: { refCode: o.refCode, version: 1 } }) : null
    await prisma.obligation.create({
      data: {
        tenantId,
        templateId: tplRow?.id ?? null,
        refCode: o.refCode,
        title: o.title,
        regulatorCode: o.regulatorCode,
        forms: JSON.stringify(o.forms ?? (tpl ? JSON.parse(tpl.forms) : [])),
        cadence: o.cadence,
        periodLabel: o.periodLabel,
        dueDate: o.dueDate,
        status: o.status,
        priority: o.priority,
        assignee: o.assignee,
        notes: o.notes,
        filedAt: o.filedAt,
        activities: {
          create: (o.activities ?? []).map((a) => ({
            tenantId,
            type: a.type,
            actor: a.actor,
            message: a.message,
            createdAt: new Date(NOW.getTime() - a.daysAgo * 86400000 - 3600000),
          })),
        },
        documents: {
          create: (o.docs ?? []).map((d) => ({
            tenantId,
            name: d.name,
            classification: d.classification,
            fileType: d.fileType,
            sizeKb: d.sizeKb,
            createdAt: new Date(NOW.getTime() - d.daysAgo * 86400000),
          })),
        },
      },
    })
  }
  console.log(`  obligations: ${obligations.length}`)

  // standalone vault documents (unlinked evidence)
  const standaloneDocs = [
    { name: 'Companies Act 1994 — Consolidated Text (bdlaws).pdf', classification: 'INTERNAL', fileType: 'PDF', sizeKb: 3200, daysAgo: 200 },
    { name: 'Corporate Governance Code 2018 — Gazette 08 Aug 2018.pdf', classification: 'INTERNAL', fileType: 'PDF', sizeKb: 1240, daysAgo: 180 },
    { name: 'PDPA 2026 (Act 63 of 2026) — As Enacted.pdf', classification: 'INTERNAL', fileType: 'PDF', sizeKb: 1980, daysAgo: 210 },
    { name: 'Labour (Amendment) Act 2026 — Change Log.docx', classification: 'INTERNAL', fileType: 'DOCX', sizeKb: 96, daysAgo: 100 },
    { name: 'Regulatory Mapping v2 — Source Review Notes.pdf', classification: 'RESTRICTED', fileType: 'PDF', sizeKb: 640, daysAgo: 2 },
    { name: 'Board Register & Committees — FY2026-27.xlsx', classification: 'CONFIDENTIAL', fileType: 'XLSX', sizeKb: 410, daysAgo: 30 },
  ]
  for (const d of standaloneDocs) {
    const { daysAgo, ...data } = d
    await prisma.document.create({
      data: { tenantId, ...data, createdAt: new Date(NOW.getTime() - daysAgo * 86400000) },
    })
  }
  console.log(`  standalone documents: ${standaloneDocs.length}`)

  // platform-level activity (no obligation link)
  const platformActivity = [
    { type: 'STATUS_CHANGE', actor: 'System — Workflow Engine', message: 'Escalation triggered: PF Annual Return crossed statutory deadline (citation under review)', daysAgo: 46 },
    { type: 'COMMENT', actor: 'Tanvir Ahmed — Company Secretary', message: 'RJSC annual-return day-count still conflicting (30/21/42) — primary-source check opened on bdlaws', daysAgo: 12 },
    { type: 'CREATED', actor: 'System — Compliance Calendar', message: 'Quarter-end scheduler generated 3 obligations for Q2 FY2026-27', daysAgo: 0 },
    { type: 'UPDATED', actor: 'Nusrat Jahan — Compliance Officer', message: 'Regulatory map v2 loaded: 7 regulators, 27 statutory templates, verification flags preserved', daysAgo: 3 },
  ]
  for (const a of platformActivity) {
    const { daysAgo, ...data } = a
    await prisma.activity.create({
      data: { tenantId, ...data, createdAt: new Date(NOW.getTime() - daysAgo * 86400000 - 7200000) },
    })
  }

  // Second tenant's own rows — invisible to padma users via the tenant
  // client; the isolation check script asserts this end-to-end.
  await prisma.companyProfile.create({
    data: {
      tenantId: tenantRupali.id,
      name: 'Rupali Steel & Re-rolling Mills Ltd.',
      stockTickers: 'DSE: RUPALISTL',
      sector: 'Steel & Engineering',
      note: 'Isolation-proof tenant — seeded with a minimal footprint.',
    },
  })
  await prisma.companyFact.create({
    data: {
      tenantId: tenantRupali.id,
      type: 'FACT',
      key: 'company_type',
      value: 'PLC',
      source: 'Rupali Steel articles of association',
      asOf: '2026-01-01',
      verifiedBy: 'Ruhul Amin — Company Secretary',
    },
  })
  await prisma.obligation.create({
    data: {
      tenantId: tenantRupali.id,
      refCode: 'RJSC-AR',
      title: 'Annual Return (RJSC) — FY2025-26 (Rupali Steel)',
      regulatorCode: 'RJSC',
      cadence: 'ANNUAL',
      periodLabel: 'FY2025-26',
      dueDate: daysFromNow(40),
      status: 'DRAFT',
      priority: 'MEDIUM',
      assignee: 'Ruhul Amin — Company Secretary',
      company: 'Rupali Steel & Re-rolling Mills Ltd.',
    },
  })
  await prisma.document.create({
    data: {
      tenantId: tenantRupali.id,
      name: 'Rupali Steel — Board Register (CONFIDENTIAL).xlsx',
      classification: 'RESTRICTED',
      fileType: 'XLSX',
      sizeKb: 220,
      uploadedBy: 'Ruhul Amin — Company Secretary',
      createdAt: NOW,
    },
  })
  console.log('  tenant 2 (rupali-steel): profile + fact + obligation + document (isolation proof)')

  // ── post-seed catalogue reconciliation self-check ────────────────
  // Proves the write path: every seeded row must read back identical
  // to the canonical catalogue by rule ID and definition.
  const seededRegulators = await prisma.regulator.findMany()
  const seededTemplates = await prisma.obligationTemplate.findMany()
  let reconcileFailures = 0
  for (const r of regulators) {
    const row = seededRegulators.find((x) => x.code === r.code)
    if (!row) {
      console.error(`  ✗ regulator ${r.code}: MISSING after seed`)
      reconcileFailures += 1
      continue
    }
    const drift = definitionDrift(r, row, REGULATOR_DEFINITION_FIELDS)
    if (drift.length > 0) {
      console.error(`  ✗ regulator ${r.code}: definition drift in ${drift.join(', ')}`)
      reconcileFailures += 1
    }
  }
  for (const t of templates) {
    const row = seededTemplates.find((x) => x.refCode === t.refCode && x.version === 1)
    if (!row) {
      console.error(`  ✗ rule ${t.refCode}: MISSING after seed`)
      reconcileFailures += 1
      continue
    }
    // Full definition = base catalogue row + rule-layer extension.
    const rule = resolveRule(t.refCode)
    const drift = definitionDrift(rule, row, FULL_RULE_DEFINITION_FIELDS)
    if (drift.length > 0) {
      console.error(`  ✗ rule ${t.refCode}: definition drift in ${drift.join(', ')}`)
      reconcileFailures += 1
    }
  }

  // ── versioning invariants: (refCode, version) unique, v1 = current,
  //    date ranges never overlap, baseline rows carry no sourceRef. ──
  const byRef = new Map<string, typeof seededTemplates>()
  for (const t of seededTemplates) {
    const list = byRef.get(t.refCode) ?? []
    list.push(t)
    byRef.set(t.refCode, list)
  }
  for (const [refCode, versions] of byRef) {
    const seen = new Set<number>()
    for (const v of versions) {
      if (seen.has(v.version)) {
        console.error(`  ✗ rule ${refCode}: duplicate version ${v.version} — uniqueness is (refCode, version)`)
        reconcileFailures += 1
      }
      seen.add(v.version)
      if (v.version === 1 && v.sourceRef !== null) {
        console.error(`  ✗ rule ${refCode}: baseline v1 must not carry a sourceRef`)
        reconcileFailures += 1
      }
      if (v.version > 1 && !v.sourceRef) {
        console.error(`  ✗ rule ${refCode} v${v.version}: amendment without sourceRef provenance`)
        reconcileFailures += 1
      }
    }
    const ordered = [...versions].sort((a, b) => a.version - b.version)
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]
      const next = ordered[i]
      if (prev.effectiveTo === null) {
        console.error(`  ✗ rule ${refCode}: v${prev.version} still current while v${next.version} exists — overlapping windows`)
        reconcileFailures += 1
      } else if (prev.effectiveTo >= next.effectiveFrom) {
        console.error(`  ✗ rule ${refCode}: v${prev.version} runs to ${prev.effectiveTo}, v${next.version} starts ${next.effectiveFrom} — windows overlap`)
        reconcileFailures += 1
      }
    }
  }
  const seededInstruments = await prisma.legalInstrument.findMany({ include: { versions: true } })
  for (const inst of CATALOGUE_INSTRUMENTS) {
    const row = seededInstruments.find((x) => x.code === inst.code)
    if (!row) {
      console.error(`  ✗ instrument ${inst.code}: MISSING after seed`)
      reconcileFailures += 1
      continue
    }
    if (row.versions.length !== inst.versions.length) {
      console.error(`  ✗ instrument ${inst.code}: version count drift (${row.versions.length} ≠ ${inst.versions.length})`)
      reconcileFailures += 1
    }
    const drift = definitionDrift(inst, row, ['title', 'issuingBody', 'referenceType', 'reference', 'verification'])
    if (drift.length > 0) {
      console.error(`  ✗ instrument ${inst.code}: definition drift in ${drift.join(', ')}`)
      reconcileFailures += 1
    }
  }
  if (reconcileFailures === 0) {
    console.log(
      `  reconciliation: ${regulators.length}/${regulators.length} regulators, ${templates.length}/${templates.length} rules (full definition incl. rule layer, v1 baseline, windows non-overlapping), ${CATALOGUE_INSTRUMENTS.length}/${CATALOGUE_INSTRUMENTS.length} instruments — seed = database, definitions identical`,
    )
  } else {
    throw new Error(`Catalogue reconciliation failed after seed: ${reconcileFailures} issue(s)`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
