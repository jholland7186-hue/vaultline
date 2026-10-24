/**
 * Optional on-device OCR via expo-text-extractor (ML Kit / Vision).
 * Safe to call on any platform: returns null when native module is missing
 * (old APK / web) so OTA JS still works without a rebuild.
 */

export type OcrResult = {
  lines: string[];
  joined: string;
  source: 'native' | 'unavailable';
};

type TextExtractorModule = {
  isSupported: boolean;
  extractTextFromImage: (uri: string) => Promise<string[]>;
};

function loadExtractor(): TextExtractorModule | null {
  try {
    // Dynamic require so web / old binaries without the native module don't crash at import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-text-extractor') as TextExtractorModule;
    if (mod && typeof mod.extractTextFromImage === 'function') return mod;
    return null;
  } catch {
    return null;
  }
}

export function isOcrAvailable(): boolean {
  const mod = loadExtractor();
  return !!mod?.isSupported;
}

/** Extract text lines from an image URI. Null when OCR isn't available. */
export async function extractTextFromUri(uri: string): Promise<OcrResult | null> {
  const mod = loadExtractor();
  if (!mod?.isSupported) {
    return { lines: [], joined: '', source: 'unavailable' };
  }
  try {
    const lines = (await mod.extractTextFromImage(uri)).map((l) => l.trim()).filter(Boolean);
    return { lines, joined: lines.join('\n'), source: 'native' };
  } catch {
    return { lines: [], joined: '', source: 'unavailable' };
  }
}
