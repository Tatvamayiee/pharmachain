// ---------------------------------------------------------------------------
// MOCK DRUG DATABASE SERVICE — PROTOTYPE ONLY.
//
// This is NOT a real clinical database. Every interaction, dosage rule and
// match below is synthetic demo data chosen to exercise the UI. A production
// deployment must replace this module with a validated drug database
// (e.g. a server-side API wrapping RxNorm / DrugBank / a local formulary)
// via the DrugDatabaseService interface below.
//
// No network requests are made from this module.
// ---------------------------------------------------------------------------

import type { DosageStatus, MatchStatus } from '../types/prescription';

// ---------------------------- Public interface -----------------------------

export interface DrugDetails {
  id: string;
  genericName: string;
  brandName: string;
  strengths: string[];
  dosageForms: string[];
  commonUses: string[];
  contraindications: string[];
  warnings: string[];
  storage: string;
  /** IDs of other drugs with known (demo) interactions. */
  interactsWith: { drugId: string; severity: 'critical' | 'high' | 'moderate' | 'informational'; note: string }[];
  source: string;
  lastUpdated: string;
}

export interface PatientContext {
  ageYears: number;
  knownAllergies?: string;
  existingConditions?: string;
  currentMedicines?: string;
}

export interface DosageValidationRequest {
  medicineName: string;
  strength: string;
  frequencyPerDay: number;
  durationDays: number;
  patient: PatientContext;
}

export interface DosageValidationResult {
  status: DosageStatus;
  reason: string;
  flaggedField: string | null;
  missingInformation: string[];
  suggestedAction: string;
}

export interface DrugDatabaseService {
  /** Fuzzy name search; returns matches ordered by quality. */
  searchMedicine(name: string): Promise<{ drugId: string; name: string; status: MatchStatus }[]>;
  getMedicineById(id: string): Promise<DrugDetails | null>;
  getMedicineDetails(id: string): Promise<DrugDetails | null>;
  checkInteractions(medicineIds: string[]): Promise<{
    severity: 'critical' | 'high' | 'moderate' | 'informational';
    drugPair: [string, string];
    reason: string;
    potentialConcern: string;
    recommendedAction: string;
    source: string;
  }[]>;
  validateDosage(req: DosageValidationRequest): Promise<DosageValidationResult>;
  getAlternatives(medicineId: string): Promise<DrugDetails[]>;
}

// ------------------------------ Mock dataset -------------------------------

const DEMO_DRUGS: DrugDetails[] = [
  {
    id: 'drug-paracetamol',
    genericName: 'Paracetamol',
    brandName: 'Dolo / Calpol',
    strengths: ['500 mg', '650 mg'],
    dosageForms: ['Tablet', 'Syrup', 'IV'],
    commonUses: ['Fever', 'Mild to moderate pain'],
    contraindications: ['Severe hepatic impairment'],
    warnings: ['Maximum 4 g per 24 h from all sources', 'Caution with chronic alcohol use'],
    storage: 'Store below 30 °C, protect from moisture',
    interactsWith: [
      { drugId: 'drug-warfarin', severity: 'moderate', note: 'May potentiate anticoagulant effect (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-amoxicillin',
    genericName: 'Amoxicillin',
    brandName: 'Mox / Novamox',
    strengths: ['250 mg', '500 mg'],
    dosageForms: ['Capsule', 'Syrup'],
    commonUses: ['Bacterial infections'],
    contraindications: ['Known penicillin hypersensitivity'],
    warnings: ['Complete the full course', 'Rash may indicate allergy — stop and review'],
    storage: 'Store below 25 °C; reformed syrup refrigerate',
    interactsWith: [
      { drugId: 'drug-methotrexate', severity: 'high', note: 'May increase methotrexate toxicity risk (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-azithromycin',
    genericName: 'Azithromycin',
    brandName: 'Azithral / Azee',
    strengths: ['250 mg', '500 mg'],
    dosageForms: ['Tablet', 'Suspension'],
    commonUses: ['Respiratory and skin infections'],
    contraindications: ['Known macrolide hypersensitivity', 'Severe hepatic disease'],
    warnings: ['QT prolongation risk with other QT-prolonging drugs'],
    storage: 'Store below 30 °C',
    interactsWith: [
      { drugId: 'drug-omeprazole', severity: 'informational', note: 'No major interaction expected (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-cetirizine',
    genericName: 'Cetirizine',
    brandName: 'Cetzine / Alerid',
    strengths: ['10 mg', '5 mg'],
    dosageForms: ['Tablet', 'Syrup', 'Drops'],
    commonUses: ['Allergic rhinitis', 'Urticaria'],
    contraindications: ['Severe renal impairment (dose adjust)'],
    warnings: ['May cause drowsiness — caution driving'],
    storage: 'Store below 30 °C',
    interactsWith: [],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-metformin',
    genericName: 'Metformin',
    brandName: 'Glycomet / Glucophage',
    strengths: ['500 mg', '850 mg', '1000 mg'],
    dosageForms: ['Tablet', 'SR Tablet'],
    commonUses: ['Type 2 diabetes'],
    contraindications: ['eGFR < 30', 'Acute metabolic acidosis'],
    warnings: ['Withhold around iodinated contrast imaging'],
    storage: 'Store below 30 °C',
    interactsWith: [],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-ibuprofen',
    genericName: 'Ibuprofen',
    brandName: 'Brufen / Combiflam (combo)',
    strengths: ['200 mg', '400 mg'],
    dosageForms: ['Tablet', 'Suspension'],
    commonUses: ['Pain', 'Inflammation', 'Fever'],
    contraindications: ['Active peptic ulcer', 'Severe heart failure', 'Third trimester pregnancy'],
    warnings: ['GI bleeding risk', 'Renal risk in dehydration'],
    storage: 'Store below 30 °C',
    interactsWith: [
      { drugId: 'drug-warfarin', severity: 'critical', note: 'Increased bleeding risk with anticoagulants (demo)' },
      { drugId: 'drug-paracetamol', severity: 'informational', note: 'Often co-prescribed; mind total dose (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-omeprazole',
    genericName: 'Omeprazole',
    brandName: 'Omez / Prilosec',
    strengths: ['20 mg', '40 mg'],
    dosageForms: ['Capsule', 'Tablet'],
    commonUses: ['Acid peptic disease', 'GERD'],
    contraindications: ['Known PPI hypersensitivity'],
    warnings: ['Long-term use: magnesium and B12 monitoring (demo)'],
    storage: 'Store below 30 °C, protect from light',
    interactsWith: [],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-vitamin-d3',
    genericName: 'Cholecalciferol (Vitamin D3)',
    brandName: 'Calcirol / Uprise-D3',
    strengths: ['60000 IU', '1000 IU'],
    dosageForms: [' Sachet', 'Softgel', 'Drops'],
    commonUses: ['Vitamin D deficiency'],
    contraindications: ['Hypercalcemia', 'Vitamin D toxicity'],
    warnings: ['Hypercalcemia with very high chronic doses'],
    storage: 'Store below 30 °C',
    interactsWith: [],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-warfarin',
    genericName: 'Warfarin',
    brandName: 'Warf',
    strengths: ['1 mg', '2 mg', '5 mg'],
    dosageForms: ['Tablet'],
    commonUses: ['Anticoagulation'],
    contraindications: ['Active bleeding', 'Pregnancy'],
    warnings: ['Narrow therapeutic index — INR monitoring required'],
    storage: 'Store below 30 °C',
    interactsWith: [
      { drugId: 'drug-ibuprofen', severity: 'critical', note: 'Increased bleeding risk with NSAIDs (demo)' },
      { drugId: 'drug-paracetamol', severity: 'moderate', note: 'May potentiate anticoagulant effect (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
  {
    id: 'drug-methotrexate',
    genericName: 'Methotrexate',
    brandName: 'Folitrax',
    strengths: ['2.5 mg', '10 mg', '15 mg'],
    dosageForms: ['Tablet', 'Injection'],
    commonUses: ['Rheumatoid arthritis', 'Psoriasis', 'Chemotherapy'],
    contraindications: ['Pregnancy', 'Severe hepatic or renal impairment'],
    warnings: ['Weekly dosing errors can be fatal — verify frequency', 'Avoid NSAID dose spikes without review'],
    storage: 'Store below 30 °C',
    interactsWith: [
      { drugId: 'drug-amoxicillin', severity: 'high', note: 'Antibiotics may raise methotrexate levels (demo)' },
    ],
    source: 'Demo formulary (synthetic)',
    lastUpdated: '2026-09-01',
  },
];

const DB_VERSION = 'demo-2026.09 (synthetic)';
const MANUAL_REVIEW_THRESHOLD = 0.62;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(' ').filter(Boolean));
  const bt = new Set(b.split(' ').filter(Boolean));
  if (at.size === 0 || bt.size === 0) return 0;
  let hit = 0;
  at.forEach((t) => { if (bt.has(t)) hit += 1; });
  return hit / Math.max(at.size, bt.size);
}

/** Sorted-letter key — “cetrizine” and “cetirizine” sort to near-identical keys. */
function anagramKey(token: string): string {
  return token.split('').sort().join('');
}

/** True when an OCR token is a transposition of, or one dropped/added letter
 *  away from, a generic-name token (e.g. “cetrizine” → “cetirizine”). */
function isOcrVariant(query: string, genericName: string): boolean {
  const qKeys = query.split(' ').filter((t) => t.length >= 6).map(anagramKey);
  if (qKeys.length === 0) return false;
  return genericName
    .toLowerCase()
    .split(' ')
    .filter((t) => t.length >= 6)
    .some((g) => {
      const key = anagramKey(g);
      return qKeys.some((q) => {
        if (q === key) return true;
        if (Math.abs(q.length - key.length) !== 1) return false;
        const [long, short] = q.length > key.length ? [q, key] : [key, q];
        for (let i = 0; i < long.length; i += 1) {
          if (long.slice(0, i) + long.slice(i + 1) === short) return true;
        }
        return false;
      });
    });
}

// --------------------------- Mock implementation ---------------------------

/** Explicitly labelled mock implementation of DrugDatabaseService. */
export const mockDrugDatabaseService: DrugDatabaseService = {
  async searchMedicine(name) {
    await delay(180);
    const q = normalise(name);
    if (!q) return [];    return DEMO_DRUGS.map((d) => {
      const best = Math.max(
        tokenOverlap(q, normalise(d.genericName)),
        tokenOverlap(q, normalise(d.brandName)),
        ...(q.includes(normalise(d.genericName).split(' ')[0]) ? [0.9] : []),
      );
      const status: MatchStatus =
        best >= 0.85 ? 'matched'
        : best >= 0.55 ? 'possible_match'
        : best >= 0.3 || isOcrVariant(q, d.genericName) ? 'needs_review'
        : 'not_found';
      return { drugId: d.id, name: `${d.genericName} ${d.strengths[0]}`, status };
    })
      .filter((r) => r.status !== 'not_found')
      .sort((a, b) => (a.status === 'matched' ? -1 : b.status === 'matched' ? 1 : 0))
      .slice(0, 3);
  },

  async getMedicineById(id) {
    await delay(120);
    return DEMO_DRUGS.find((d) => d.id === id) ?? null;
  },

  async getMedicineDetails(id) {
    return this.getMedicineById(id);
  },

  async checkInteractions(medicineIds) {
    await delay(260);
    const results: Awaited<ReturnType<DrugDatabaseService['checkInteractions']>> = [];
    const unique = [...new Set(medicineIds)];
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const a = DEMO_DRUGS.find((d) => d.id === unique[i]);
        const b = DEMO_DRUGS.find((d) => d.id === unique[j]);
        if (!a || !b) continue;
        const edge = a.interactsWith.find((w) => w.drugId === b.id) ??
          b.interactsWith.find((w) => w.drugId === a.id);
        if (edge) {
          const primary = a.interactsWith.includes(edge) ? a : b;
          const other = primary === a ? b : a;
          results.push({
            severity: edge.severity,
            drugPair: [primary.genericName, other.genericName],
            reason: edge.note,
            potentialConcern:
              edge.severity === 'critical'
                ? 'Serious harm possible without pharmacist review (demo)'
                : edge.severity === 'high'
                  ? 'Clinically significant risk possible (demo)'
                  : 'Monitor or review may be appropriate (demo)',
            recommendedAction:
              edge.severity === 'critical'
                ? 'Pharmacist review required before dispensing; consult prescriber (demo)'
                : 'Review with prescriber or monitor patient (demo)',
            source: `Demo interaction dataset ${DB_VERSION}`,
          });
        }
      }
    }
    return results;
  },

  async validateDosage({ medicineName, strength, frequencyPerDay, durationDays, patient }) {
    await delay(220);
    const drug = DEMO_DRUGS.find(
      (d) => normalise(d.genericName) === normalise(medicineName) ||
        normalise(d.brandName) === normalise(medicineName) ||
        normalise(medicineName).includes(normalise(d.genericName).split(' ')[0]),
    );
    if (!drug) {
      return {
        status: 'unable_to_validate',
        reason: 'Medicine not present in the demo dataset.',
        flaggedField: null,
        missingInformation: ['Validated clinical dosage reference'],
        suggestedAction: 'Verify dosage manually against an approved formulary.',
      };
    }
    const numericStrength = parseFloat(strength) || 0;
    const allergy = patient.knownAllergies?.toLowerCase() ?? '';
    if (drug.id === 'drug-amoxicillin' && allergy.includes('penicillin')) {
      return {
        status: 'patient_specific_review_required',
        reason: 'Recorded penicillin allergy conflicts with this medicine (demo rule).',
        flaggedField: 'Known allergies',
        missingInformation: ['Allergy severity details'],
        suggestedAction: 'Pharmacist must confirm allergy history before dispensing.',
      };
    }
    if (drug.id === 'drug-methotrexate' && frequencyPerDay >= 7) {
      return {
        status: 'frequency_concern',
        reason: 'Methotrexate is typically weekly; daily frequency looks like an error (demo rule).',
        flaggedField: 'Frequency',
        missingInformation: ['Prescriber intent confirmation'],
        suggestedAction: 'Confirm frequency with the prescriber before dispensing.',
      };
    }
    if (drug.id === 'drug-paracetamol' && frequencyPerDay > 4) {
      return {
        status: 'frequency_concern',
        reason: `More than 4 doses per 24 h may exceed the maximum daily dose for ${strength || '500 mg'} (demo rule).`,
        flaggedField: 'Frequency',
        missingInformation: ['Other paracetamol sources the patient may be taking'],
        suggestedAction: 'Verify total daily paracetamol from all sources.',
      };
    }
    if (drug.id === 'drug-paracetamol' && numericStrength >= 1000 && patient.ageYears < 12) {
      return {
        status: 'possible_overdose',
        reason: '1000 mg strength is high for paediatric patients (demo rule).',
        flaggedField: 'Strength',
        missingInformation: ['Patient weight'],
        suggestedAction: 'Confirm paediatric dosing with the prescriber.',
      };
    }
    if (durationDays > 30 && drug.id !== 'drug-metformin' && drug.id !== 'drug-warfarin' && drug.id !== 'drug-methotrexate') {
      return {
        status: 'duration_concern',
        reason: `Long duration (${durationDays} days) is unusual for this medicine (demo rule).`,
        flaggedField: 'Duration',
        missingInformation: ['Clinical justification'],
        suggestedAction: 'Review duration with the prescriber.',
      };
    }
    if (numericStrength === 0 || frequencyPerDay === 0) {
      return {
        status: 'unable_to_validate',
        reason: 'Strength or frequency could not be parsed from the prescription text.',
        flaggedField: 'Strength / Frequency',
        missingInformation: numericStrength === 0 ? ['Readable strength'] : ['Readable frequency'],
        suggestedAction: 'Correct the extracted values and re-run validation.',
      };
    }
    return {
      status: 'within_expected_range',
      reason: 'Within the demo dataset’s expected range for this age group.',
      flaggedField: null,
      missingInformation: patient.existingConditions ? [] : ['Existing conditions (optional)'],
      suggestedAction: 'Proceed with pharmacist review.',
    };
  },

  async getAlternatives(medicineId) {
    await delay(160);
    const drug = DEMO_DRUGS.find((d) => d.id === medicineId);
    if (!drug) return [];
    return DEMO_DRUGS.filter((d) => d.commonUses.some((u) => drug.commonUses.includes(u)) && d.id !== drug.id).slice(0, 3);
  },
};

export const DRUG_DB_META = {
  isMock: true,
  name: 'Demo drug database (synthetic)',
  version: DB_VERSION,
  manualReviewThreshold: MANUAL_REVIEW_THRESHOLD,
} as const;
