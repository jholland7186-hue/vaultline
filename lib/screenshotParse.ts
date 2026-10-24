import type { ObligationType, SpendBucket } from '@/types';

/**
 * Best-effort multi-line parse of bank / Cash App / paycheck / history text.
 * Prefer OCR or pasted text; filename is a last-resort hint.
 * Always confirm before saving — never silent import.
 */

export type DetectedKind = 'income' | 'spend' | 'bill';

export type DetectedLine = {
  id: string;
  kind: DetectedKind;
  amount: number | null;
  label: string;
  day: string | null;
  bucket: SpendBucket;
  looksLikeBill: boolean;
  suggestedObligationType: ObligationType | null;
  /** Included in confirm batch by default */
  included: boolean;
  raw: string;
};

export type ScreenshotParseResult = {
  lines: DetectedLine[];
  confidenceNote: string;
  rawText: string;
};

const BILL_HINTS: Array<{
  match: RegExp;
  merchant: string;
  type: ObligationType;
  bucket: SpendBucket;
}> = [
  { match: /t-?mobile|tmobile/i, merchant: 'T-Mobile', type: 'subscription', bucket: 'needs' },
  { match: /verizon|at&t|att\b|mint mobile/i, merchant: 'Phone bill', type: 'subscription', bucket: 'needs' },
  {
    match: /netflix|spotify|hulu|disney\+|apple\s*tv|youtube\s*premium/i,
    merchant: 'Subscription',
    type: 'subscription',
    bucket: 'wants',
  },
  {
    match: /geico|progressive|state\s*farm|allstate|insurance/i,
    merchant: 'Insurance',
    type: 'insurance',
    bucket: 'needs',
  },
  { match: /\brent\b|apartment|landlord/i, merchant: 'Rent', type: 'rent', bucket: 'needs' },
  {
    match: /chase|capital\s*one|citi|amex|credit\s*card/i,
    merchant: 'Card payment',
    type: 'credit_card',
    bucket: 'needs',
  },
  {
    match: /cash\s*app|venmo\s*payback|borrow/i,
    merchant: 'Cash App payback',
    type: 'cash_app_payback',
    bucket: 'needs',
  },
  { match: /loan|sofi|lendingclub/i, merchant: 'Loan payment', type: 'loan', bucket: 'needs' },
];

const INCOME_HINTS =
  /\b(direct\s*dep|direct\s*deposit|payroll|paycheck|pay\s*stub|deposit|salary|wages|income|got\s*paid|payment\s*received|cash\s*from|received|refund)\b/i;

const FOOD_HINTS =
  /taco|burger|pizza|cafe|coffee|doordash|uber\s*eats|restaurant|chipotle|mcdonald/i;
const GROCERY_HINTS =
  /grocery|walmart|kroger|aldi|costco|trader\s*joe|whole\s*foods/i;

const SKIP_LINE =
  /^(balance|available|pending|total|subtotal|account|routing|\*+|ending|statement|transaction\s*history|date\s*description|debit\s*credit)$/i;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function extractAmounts(text: string): number[] {
  if (!text) return [];
  const found: number[] = [];
  const re = /\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number.parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0 && n < 100000) found.push(n);
  }
  return found;
}

function extractDay(text: string, now = new Date()): string | null {
  // ISO
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // MM/DD/YYYY or M/D/YY
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const month = Number.parseInt(slash[1], 10);
    const day = Number.parseInt(slash[2], 10);
    let year = slash[3] ? Number.parseInt(slash[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Mon DD or Month DD
  const mon = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(20\d{2}))?\b/i
  );
  if (mon) {
    const months: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const mi = months[mon[1].slice(0, 3).toLowerCase()];
    const day = Number.parseInt(mon[2], 10);
    const year = mon[3] ? Number.parseInt(mon[3], 10) : now.getFullYear();
    if (mi && day >= 1 && day <= 31) {
      return `${year}-${String(mi).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

function cleanLabel(text: string, amount: number | null): string {
  let s = text
    .replace(/\$\s*\d{1,5}(?:,\d{3})*(?:\.\d{2})?/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || /^\d+(\.\d+)?$/.test(s)) {
    return amount != null ? `Line $${amount.toFixed(2)}` : 'Detected line';
  }
  return s.slice(0, 56);
}

function classifyLine(text: string): {
  kind: DetectedKind;
  bucket: SpendBucket;
  looksLikeBill: boolean;
  suggestedObligationType: ObligationType | null;
  labelHint: string;
} {
  const bill = BILL_HINTS.find((h) => h.match.test(text));
  if (bill) {
    return {
      kind: 'bill',
      bucket: bill.bucket,
      looksLikeBill: true,
      suggestedObligationType: bill.type,
      labelHint: bill.merchant,
    };
  }
  if (INCOME_HINTS.test(text) || /\+\s*\$?\d/.test(text) || /\bcredit\b/i.test(text)) {
    return {
      kind: 'income',
      bucket: 'other',
      looksLikeBill: false,
      suggestedObligationType: null,
      labelHint: 'Paycheck / deposit',
    };
  }
  let bucket: SpendBucket = 'other';
  if (FOOD_HINTS.test(text)) bucket = 'eating_out';
  else if (GROCERY_HINTS.test(text)) bucket = 'needs';
  else if (/amazon|target|wish|impulse|shop/i.test(text)) bucket = 'wants';
  return {
    kind: 'spend',
    bucket,
    looksLikeBill: false,
    suggestedObligationType: null,
    labelHint: '',
  };
}

function shouldSkip(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2) return true;
  if (SKIP_LINE.test(t)) return true;
  if (/^\*+$/.test(t)) return true;
  return false;
}

/**
 * Parse OCR / pasted screenshot text into reviewable lines.
 * Multiple money amounts on one line → one DetectedLine (first amount).
 * Lines without amounts are skipped unless they clearly name income/bills with a nearby amount.
 */
export function parseScreenshotText(input: {
  text?: string | null;
  fileName?: string | null;
}): ScreenshotParseResult {
  const rawText = `${input.text ?? ''}`.trim();
  const blob = `${rawText}\n${input.fileName ?? ''}`.trim();

  const rows = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !shouldSkip(l));

  const lines: DetectedLine[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const amounts = extractAmounts(row);
    if (amounts.length === 0) continue;
    const amount = amounts[0];
    const day = extractDay(row);
    const cls = classifyLine(row);
    const label = cls.labelHint || cleanLabel(row, amount);
    const key = `${cls.kind}|${amount}|${label.toLowerCase()}|${day ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      id: uid('dl'),
      kind: cls.kind,
      amount,
      label,
      day,
      bucket: cls.bucket,
      looksLikeBill: cls.looksLikeBill,
      suggestedObligationType: cls.suggestedObligationType,
      included: true,
      raw: row.slice(0, 120),
    });
  }

  // Fallback: whole blob has one amount (receipt / single transfer)
  if (lines.length === 0 && blob) {
    const amounts = extractAmounts(blob);
    const amount = amounts[0] ?? null;
    const cls = classifyLine(blob);
    const day = extractDay(blob);
    const fromFile = guessMerchantFromFile(input.fileName);
    lines.push({
      id: uid('dl'),
      kind: cls.kind === 'bill' ? 'bill' : cls.kind,
      amount,
      label: cls.labelHint || fromFile || (amount != null ? `Detected $${amount.toFixed(2)}` : 'Add details'),
      day,
      bucket: cls.bucket,
      looksLikeBill: cls.looksLikeBill,
      suggestedObligationType: cls.suggestedObligationType,
      included: true,
      raw: blob.slice(0, 120),
    });
  }

  const withAmount = lines.filter((l) => l.amount != null && l.amount > 0);
  const incomeN = withAmount.filter((l) => l.kind === 'income').length;
  const spendN = withAmount.filter((l) => l.kind !== 'income').length;

  let confidenceNote: string;
  if (withAmount.length === 0) {
    confidenceNote =
      'Couldn’t read amounts yet. Paste a few lines from the screenshot or type them in — nothing saves until you confirm.';
  } else if (!rawText) {
    confidenceNote =
      'Light guess from the filename only. Paste history text or use on-device read when available, then confirm each line.';
  } else {
    confidenceNote = `Found ${withAmount.length} line${withAmount.length === 1 ? '' : 's'} (${incomeN} income, ${spendN} spend/bill). Check the list — toggle off anything that doesn’t belong, then confirm.`;
  }

  return { lines, confidenceNote, rawText };
}

/** @deprecated single-guess API — prefer parseScreenshotText */
export type ScreenshotGuess = {
  amount: number | null;
  merchant: string;
  bucket: SpendBucket;
  looksLikeBill: boolean;
  suggestedObligationType: ObligationType | null;
  confidenceNote: string;
};

export function stubParseScreenshot(input: {
  fileName?: string | null;
  pastedText?: string | null;
}): ScreenshotGuess {
  const result = parseScreenshotText({
    text: input.pastedText,
    fileName: input.fileName,
  });
  const first = result.lines[0];
  return {
    amount: first?.amount ?? null,
    merchant: first?.label ?? '',
    bucket: first?.bucket ?? 'other',
    looksLikeBill: first?.looksLikeBill ?? false,
    suggestedObligationType: first?.suggestedObligationType ?? null,
    confidenceNote: result.confidenceNote,
  };
}

function guessMerchantFromFile(fileName?: string | null): string {
  if (!fileName) return '';
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
  if (/screenshot|img|image|photo|receipt|download/i.test(base)) return '';
  return base.slice(0, 40);
}
