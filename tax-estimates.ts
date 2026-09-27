import bundledData from './data/property-tax.json';

type Quality = 'ok' | 'censored' | 'missing' | 'sparse' | 'uncertain' | 'outlier';
type TaxData = {
  national: number;
  states: Record<string, number>;
  areas: Record<string, [number | null, Quality]>;
  locations: Record<string, [string, string]>;
};
const data = bundledData as unknown as TaxData;
export const taxDataInfo = bundledData.metadata;

export type TaxEstimate = {
  rate: number;
  source: 'ZIP-area estimate' | 'State fallback' | 'National fallback' | 'Manual override';
  label: string;
  confidence: 'Approximate' | 'Low' | 'Custom';
  note: string;
};

export function normalizeZip(value: string): string | null {
  const trimmed = value.trim();
  // Keep leading zeros; never turn arbitrary characters or partial ZIPs into matches.
  return /^\d{5}(?:-?\d{4})?$/.test(trimmed) ? trimmed.slice(0, 5) : null;
}

const qualityNotes: Record<Quality, string> = {
  ok: 'Ratio of local median annual taxes to median home value; not an individual property tax rate.',
  censored: 'Local tax or home-value median is capped by Census; no reliable local ratio.',
  missing: 'Local tax or home-value data is missing or suppressed.',
  sparse: 'Too few estimated owner-occupied homes for a local estimate.',
  uncertain: 'Local survey estimates have high or unavailable margins of error.',
  outlier: 'Local ratio failed the plausibility check.',
};

export function getTaxEstimate(zip: string, manualRate: string, useManual: boolean): TaxEstimate {
  if (useManual && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(manualRate.trim())) {
    const rate = Number(manualRate);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
      return { rate, source: 'Manual override', label: 'Your custom tax rate', confidence: 'Custom', note: 'Uses your rate, including 0% for an exempt property.' };
    }
  }
  const manualNote = useManual ? 'Enter a valid manual rate from 0% to 100%; using the automatic estimate for now. ' : '';
  const cleanZip = normalizeZip(zip);
  const national = (label: string, note: string): TaxEstimate => ({
    rate: data.national, source: 'National fallback', label, confidence: 'Low', note: manualNote + note,
  });
  if (!cleanZip) {
    return national('Enter a valid 5-digit ZIP or ZIP+4', 'Not a local estimate. A U.S. planning placeholder is included in the payment.');
  }
  const location = data.locations[cleanZip];
  const area = data.areas[cleanZip];
  if (!location && !area) {
    return national(`ZIP ${cleanZip} not in offline directory`, 'This may be an invalid or newly assigned ZIP. A U.S. placeholder is included; enter the actual tax rate.');
  }
  const [city, state] = location ?? ['', ''];
  const label = city ? `${city}${state ? `, ${state}` : ''} · ${cleanZip}` : `ZIP area ${cleanZip}`;
  if (area?.[1] === 'ok' && area[0] !== null) {
    return { rate: area[0], source: 'ZIP-area estimate', label, confidence: 'Approximate', note: manualNote + qualityNotes.ok };
  }
  const reason = area ? qualityNotes[area[1]] : 'No residential Census ZIP-area estimate (for example, a PO Box or unique ZIP).';
  if (state && data.states[state] !== undefined) {
    return { rate: data.states[state], source: 'State fallback', label: `${label} · ${state} statewide estimate`, confidence: 'Low', note: manualNote + reason + ' Using the statewide ratio, not a local rate.' };
  }
  return national(label, reason + ' No supported state/territory tax estimate. The U.S. placeholder may not apply here; use a manual rate.');
}
