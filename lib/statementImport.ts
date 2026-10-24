import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

/**
 * Pick a bank statement / export (image, CSV, TXT).
 * Images go through OCR; text/CSV are read locally. PDF is accepted but often
 * needs a screenshot or CSV export — we try a text read and fall back with a hint.
 */

export type StatementPick =
  | {
      ok: true;
      kind: 'image' | 'text';
      uri: string;
      name: string;
      text?: string;
    }
  | {
      ok: false;
      canceled?: boolean;
      message: string;
    };

function isImage(mime?: string | null, name?: string | null): boolean {
  const m = (mime ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (m.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|heic|gif)$/i.test(n);
}

function isTextish(mime?: string | null, name?: string | null): boolean {
  const m = (mime ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (m.includes('csv') || m.includes('text') || m.includes('plain')) return true;
  return /\.(csv|txt|tsv)$/i.test(n);
}

function isPdf(mime?: string | null, name?: string | null): boolean {
  const m = (mime ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  return m.includes('pdf') || /\.pdf$/i.test(n);
}

async function readLocalText(uri: string): Promise<string> {
  try {
    return await readAsStringAsync(uri);
  } catch {
    return '';
  }
}

export async function pickBankStatement(): Promise<StatementPick> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'image/*',
      'text/plain',
      'text/csv',
      'text/comma-separated-values',
      'application/csv',
      'application/pdf',
      'application/vnd.ms-excel',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, canceled: true, message: 'Canceled.' };
  }

  const asset = result.assets[0];
  const name = asset.name || 'statement';
  const mime = asset.mimeType;
  const uri = asset.uri;

  if (isImage(mime, name)) {
    return { ok: true, kind: 'image', uri, name };
  }

  if (isTextish(mime, name) || isPdf(mime, name)) {
    const text = await readLocalText(uri);
    const looksUseful = /\$?\d/.test(text) && text.replace(/[^\x20-\x7E\n\r\t]/g, '').length > 20;
    if (looksUseful) {
      return { ok: true, kind: 'text', uri, name, text };
    }
    if (isPdf(mime, name)) {
      return {
        ok: false,
        message:
          'That PDF didn’t yield readable text. Export a CSV from your bank, or screenshot statement pages and Choose screenshot.',
      };
    }
    return {
      ok: false,
      message: 'Couldn’t read that file as text. Try a CSV export or a screenshot of the statement.',
    };
  }

  return {
    ok: false,
    message: 'Use an image, CSV, or TXT export — or screenshot the statement pages.',
  };
}
