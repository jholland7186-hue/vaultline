import type { ObligationType, SpendBucket } from '@/types';

/**
 * Local stub “OCR” — no cloud, no Plaid.
 * Prefers pasted receipt text; otherwise light hints from a filename.
 * Always confirm before logging.
 */
export type ScreenshotGuess = {
  amount: number | null;
  merchant: string;
  bucket: SpendBucket;
  looksLikeBill: boolean;
  suggestedObligationType: ObligationType | null;
  confidenceNote: string;
};

const BILL_HINTS: Array<{
  match: RegExp;
  merchant: string;
  type: ObligationType;
  bucket: SpendBucket;
}> = [
  { match: /t-?mobile|tmobile/i, merchant: 'T-Mobile', type: 'subscription', bucket: 'needs' },
  { match: /verizon|at&t|att\b|mint mobile/i, merchant: 'Phone bill', type: 'subscription', bucket: 'needs' },
  { match: /netflix|spotify|hulu|disney\+|apple\s*tv|youtube\s*premium/i, merchant: 'Subscription', type: 'subscription', bucket: 'wants' },
  { match: /geico|progressive|state\s*farm|allstate|insurance/i, merchant: 'Insurance', type: 'insurance', bucket: 'needs' },
  { match: /\brent\b|apartment|landlord/i, merchant: 'Rent', type: 'rent', bucket: 'needs' },
  { match: /chase|capital\s*one|citi|amex|credit\s*card/i, merchant: 'Card payment', type: 'credit_card', bucket: 'needs' },
  { match: /cash\s*app|venmo\s*payback|borrow/i, merchant: 'Cash App payback', type: 'cash_app_payback', bucket: 'needs' },
  { match: /loan|sofi|lendingclub/i, merchant: 'Loan payment', type: 'loan', bucket: 'needs' },
];

const FOOD_HINTS = /taco|burger|pizza|cafe|coffee|doordash|uber\s*eats|restaurant|chipotle|mcdonald/i;
const GROCERY_HINTS = /grocery|walmart|kroger|aldi|costco|trader\s*joe|whole\s*foods/i;

function extractAmount(text: string): number | null {
  if (!text) return null;
  // Prefer explicit currency amounts
  const currency = text.match(/\$\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/);
  if (currency) {
    const n = Number.parseFloat(currency[1].replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const plain = text.match(/(?:^|[^\d])(\d{1,4}\.\d{2})(?:[^\d]|$)/);
  if (plain) {
    const n = Number.parseFloat(plain[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function extractMerchant(text: string): string {
  const line = text
    .split(/[\n|]/)
    .map((l) => l.trim())
    .find((l) => l && !/^\$?\d/.test(l) && !/total|amount|date|card/i.test(l));
  if (!line) return '';
  return line.replace(/^merchant[:\s]+/i, '').slice(0, 48);
}

export function stubParseScreenshot(input: {
  fileName?: string | null;
  pastedText?: string | null;
}): ScreenshotGuess {
  const blob = `${input.pastedText ?? ''}\n${input.fileName ?? ''}`.trim();
  const amount = extractAmount(blob);
  const bill = BILL_HINTS.find((h) => h.match.test(blob));

  if (bill) {
    return {
      amount,
      merchant: bill.merchant,
      bucket: bill.bucket,
      looksLikeBill: true,
      suggestedObligationType: bill.type,
      confidenceNote: amount
        ? 'Stub read — confirm amount & merchant before logging.'
        : 'Looks like a bill — enter the amount and confirm.',
    };
  }

  let bucket: SpendBucket = 'other';
  if (FOOD_HINTS.test(blob)) bucket = 'eating_out';
  else if (GROCERY_HINTS.test(blob)) bucket = 'needs';
  else if (/amazon|target|wish|impulse|shop/i.test(blob)) bucket = 'wants';

  const merchant = extractMerchant(input.pastedText ?? '') || guessMerchantFromFile(input.fileName);

  return {
    amount,
    merchant,
    bucket,
    looksLikeBill: false,
    suggestedObligationType: null,
    confidenceNote: amount
      ? 'Stub read from text/filename — always confirm before it hits your log.'
      : 'Couldn’t guess an amount. Type what you spent — screenshot is just a reminder.',
  };
}

function guessMerchantFromFile(fileName?: string | null): string {
  if (!fileName) return '';
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
  if (/screenshot|img|image|photo|receipt|download/i.test(base)) return '';
  return base.slice(0, 40);
}
