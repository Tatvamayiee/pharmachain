// ---------------------------------------------------------------------------
// Server-side drug database — reference dataset for search, interaction
// checking and dosage validation. The dataset below is a curated reference
// formulary (common outpatient medicines with published adult dosing and
// well-known interaction pairs). It is NOT a licensed clinical dataset
// (RxNorm/DrugBank); every result is labelled 'reference_dataset' so the UI
// never presents it as clinically validated. Replace/extend rows from a
// licensed source when available — the API shape will not change.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const medicineRepo = createRepository({ name: 'drug_database', model: models.DrugReference, prefix: 'DRG' });

// ---------------------------------------------------------------------------
// MEDICINE MASTER DATABASE (imported, MIT-licensed source).
// Loaded lazily from server/ml/reference/medicine-master.json (built by
// scripts/data/import-medicine-master.cjs). EXTENDS — never overwrites — the
// curated REFERENCE_MEDICINES above, which keep clinical-dosing priority.
// Imported records prove NAME EXISTENCE only; they carry no clinical-dosing
// fields, and validation never treats existence as medical appropriateness.
// ---------------------------------------------------------------------------
const MASTER_PATH = path.join(__dirname, '..', 'ml', 'reference', 'medicine-master.json');
let masterIndex = null;   // { byName: Map, manifest: {...}, stats }
let masterLoadError = null;

function loadMaster() {
  if (masterIndex || masterLoadError) return masterIndex;
  try {
    if (!fs.existsSync(MASTER_PATH)) {
      masterLoadError = 'medicine-master.json not built yet (run npm run import:medicine-master)';
      return null;
    }
    const raw = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
    const byName = new Map();          // normalizedName → master record
    const aliasToName = new Map();     // alias/composition-brand → normalizedName
    for (const rec of raw.records || []) {
      byName.set(rec.normalizedName, rec);
      for (const a of rec.aliases || []) {
        if (!aliasToName.has(a)) aliasToName.set(a, rec.normalizedName);
      }
    }
    masterIndex = { byName, aliasToName, manifest: raw.manifest || null, size: byName.size };
    console.log(`[drugDatabase] master loaded: ${byName.size} medicines (source: ${raw.manifest && raw.manifest.source || 'unknown'})`);
  } catch (e) {
    masterLoadError = `failed to load master: ${e.message}`;
    masterIndex = null;
  }
  return masterIndex;
}

function masterStats() {
  const m = loadMaster();
  if (!m) {
    return {
      available: false, totalMedicines: 0, totalAliases: 0, totalStrengths: 0,
      duplicateRecords: null, source: null, sourceVersion: null,
      license: null, lastUpdated: null, note: masterLoadError || 'not loaded',
    };
  }
  let aliasTotal = 0, strengthTotal = 0;
  for (const rec of m.byName.values()) {
    aliasTotal += (rec.aliases || []).length;
    strengthTotal += (rec.strength || []).length;
  }
  return {
    available: true,
    totalMedicines: m.size,
    totalAliases: aliasTotal,
    totalStrengths: strengthTotal,
    duplicateRecords: (m.manifest && m.manifest.stats && m.manifest.stats.duplicates) != null
      ? m.manifest.stats.duplicates : null,
    source: m.manifest && m.manifest.source,
    sourceVersion: m.manifest && m.manifest.sourceVersion,
    license: m.manifest && m.manifest.license,
    lastUpdated: m.manifest && m.manifest.importedAt,
    note: null,
  };
}

// name, genericName, category, dosageForm, strengths[], adultDose {dose, frequency, minAgeYears, maxSingleDose}, notes
const REFERENCE_MEDICINES = [
  {
    name: 'Paracetamol', genericName: 'Acetaminophen', category: 'Analgesic/Antipyretic', dosageForm: 'Tablet',
    aliases: ['acetaminophen', 'calpol', 'dolo', 'crocin', 'tylenol', 'paracetamol'],
    strengths: ['500 mg', '650 mg'],
    adult: { dose: '500-1000 mg', frequency: 'every 6-8 h', maxDailyMg: 4000, minAgeYears: 0, pediatricMgPerKg: 15 },
    notes: 'Max 4 g/day in healthy adults; reduce in hepatic impairment.',
  },
  {
    name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic (penicillin)', dosageForm: 'Capsule',
    aliases: ['amoxil', 'mox', 'novamox'],
    strengths: ['250 mg', '500 mg'],
    adult: { dose: '500 mg', frequency: 'every 8 h', maxDailyMg: 1500, minAgeYears: 0, pediatricMgPerKg: 25 },
    notes: 'Penicillin allergy is a contraindication.',
  },
  {
    name: 'Ibuprofen', genericName: 'Ibuprofen', category: 'NSAID', dosageForm: 'Tablet',
    aliases: ['brufen', 'advil', 'motrin', 'ibuprofen'],
    strengths: ['200 mg', '400 mg'],
    adult: { dose: '200-400 mg', frequency: 'every 6-8 h', maxDailyMg: 1200, minAgeYears: 6, pediatricMgPerKg: 10 },
    notes: 'Avoid in active peptic ulcer, severe renal impairment, third trimester.',
  },
  {
    name: 'Cetirizine', genericName: 'Cetirizine', category: 'Antihistamine', dosageForm: 'Tablet',
    aliases: ['zyrtec', 'cetzine', 'alerid', 'cetirizine'],
    strengths: ['5 mg', '10 mg'],
    adult: { dose: '10 mg', frequency: 'once daily', maxDailyMg: 10, minAgeYears: 6 },
    notes: 'Drowsiness possible; reduce dose in renal impairment.',
  },
  {
    name: 'Omeprazole', genericName: 'Omeprazole', category: 'Proton pump inhibitor', dosageForm: 'Capsule',
    aliases: ['prilosec', 'omec', 'risek', 'omeprazole'],
    strengths: ['20 mg', '40 mg'],
    adult: { dose: '20 mg', frequency: 'once daily before food', maxDailyMg: 40, minAgeYears: 1 },
    notes: 'Long-term use: monitor magnesium and B12.',
  },
  {
    name: 'Metformin', genericName: 'Metformin', category: 'Biguanide antidiabetic', dosageForm: 'Tablet',
    aliases: ['glucophage', 'glycomet', 'metformin'],
    strengths: ['500 mg', '850 mg', '1000 mg'],
    adult: { dose: '500-1000 mg', frequency: 'twice daily with meals', maxDailyMg: 2550, minAgeYears: 10 },
    notes: 'Contraindicated in severe renal impairment (eGFR < 30).',
  },
  {
    name: 'Amlodipine', genericName: 'Amlodipine', category: 'Calcium channel blocker', dosageForm: 'Tablet',
    aliases: ['norvasc', 'amlopres', 'amlodipine'],
    strengths: ['2.5 mg', '5 mg', '10 mg'],
    adult: { dose: '5 mg', frequency: 'once daily', maxDailyMg: 10, minAgeYears: 6 },
    notes: 'Ankle edema is a common adverse effect.',
  },
  {
    name: 'Azithromycin', genericName: 'Azithromycin', category: 'Antibiotic (macrolide)', dosageForm: 'Tablet',
    aliases: ['zithromax', 'azee', 'azithral', 'azithromycin'],
    strengths: ['250 mg', '500 mg'],
    adult: { dose: '500 mg', frequency: 'once daily', maxDailyMg: 500, minAgeYears: 0, pediatricMgPerKg: 10 },
    notes: 'QT prolongation risk with other QT-prolonging drugs.',
  },
  {
    name: 'Pantoprazole', genericName: 'Pantoprazole', category: 'Proton pump inhibitor', dosageForm: 'Tablet',
    aliases: ['protonix', 'pantocid', 'pan-40', 'pantoprazole'],
    strengths: ['20 mg', '40 mg'],
    adult: { dose: '40 mg', frequency: 'once daily before food', maxDailyMg: 40, minAgeYears: 0 },
    notes: 'Similar class cautions as omeprazole.',
  },
  {
    name: 'Cough syrup (codeine-free)', genericName: 'Dextromethorphan', category: 'Antitussive', dosageForm: 'Syrup',
    aliases: ['benadryl', 'ascoril', 'cough syrup', 'dextromethorphan'],
    strengths: ['100 ml'],
    adult: { dose: '10 ml', frequency: 'every 6 h', maxDailyMg: 120, minAgeYears: 6 },
    notes: 'Avoid combining with other CNS depressants.',
  },
  {
    name: 'Warfarin', genericName: 'Warfarin', category: 'Anticoagulant', dosageForm: 'Tablet',
    aliases: ['coumadin', 'warfarin'],
    strengths: ['1 mg', '2 mg', '5 mg'],
    adult: { dose: 'per INR-directed protocol', frequency: 'once daily', minAgeYears: 0 },
    notes: 'Requires INR monitoring; many interacting medicines — verify before dispensing.',
  },
  {
    name: 'Aspirin', genericName: 'Acetylsalicylic acid', category: 'NSAID/antiplatelet', dosageForm: 'Tablet',
    aliases: ['asa', 'ecotrin', 'disprin', 'aspirin'],
    strengths: ['75 mg', '100 mg', '325 mg'],
    adult: { dose: '75-325 mg', frequency: 'once daily', maxDailyMg: 3900, minAgeYears: 0 },
    notes: 'Avoid in children with viral illness (Reye syndrome).',
  },
  {
    name: 'Atorvastatin', genericName: 'Atorvastatin', category: 'Statin (antihyperlipidemic)', dosageForm: 'Tablet',
    aliases: ['lipitor', 'atorva', 'atorlip', 'atorvastatin'],
    strengths: ['10 mg', '20 mg', '40 mg', '80 mg'],
    adult: { dose: '10-80 mg', frequency: 'once daily', maxDailyMg: 80, minAgeYears: 0 },
    notes: 'Monitor liver enzymes and for muscle symptoms; avoid grapefruit juice.',
  },
];

// Clinically well-established interaction pairs (severity, mechanism class).
const INTERACTION_PAIRS = [
  { a: 'ibuprofen', b: 'aspirin', severity: 'high', reason: 'Increased GI bleeding risk (NSAID + antiplatelet).', action: 'Use gastroprotection or separate analgesic.' },
  { a: 'ibuprofen', b: 'warfarin', severity: 'critical', reason: 'NSAIDs potentiate anticoagulation — major bleeding risk.', action: 'Avoid combination; use paracetamol.' },
  { a: 'ibuprofen', b: 'metformin', severity: 'moderate', reason: 'NSAIDs may reduce renal metformin clearance.', action: 'Monitor renal function.' },
  { a: 'amoxicillin', b: 'methotrexate', severity: 'high', reason: 'Reduced methotrexate clearance — toxicity risk.', action: 'Monitor methotrexate levels.' },
  { a: 'azithromycin', b: 'amiodarone', severity: 'critical', reason: 'Additive QT prolongation — arrhythmia risk.', action: 'Avoid combination.' },
  { a: 'azithromycin', b: 'omeprazole', severity: 'informational', reason: 'No significant pharmacokinetic interaction known.', action: 'None required.' },
  { a: 'omeprazole', b: 'clopidogrel', severity: 'high', reason: 'PPIs reduce clopidogrel activation.', action: 'Consider pantoprazole instead.' },
  { a: 'metformin', b: 'contrast_media', severity: 'critical', reason: 'Iodinated contrast + metformin — lactic acidosis risk.', action: 'Suspend metformin per radiology protocol.' },
  { a: 'cetirizine', b: 'alcohol', severity: 'moderate', reason: 'Additive CNS depression.', action: 'Advise avoidance of alcohol.' },
  { a: 'paracetamol', b: 'warfarin', severity: 'moderate', reason: 'Sustained paracetamol may raise INR.', action: 'Monitor INR if used regularly.' },
  { a: 'paracetamol', b: 'alcohol', severity: 'high', reason: 'Hepatotoxicity risk with chronic alcohol use.', action: 'Limit total daily dose.' },
  { a: 'amlodipine', b: 'simvastatin', severity: 'moderate', reason: 'Amlodipine raises simvastatin exposure.', action: 'Limit simvastatin to 20 mg/day.' },
  { a: 'pantoprazole', b: 'clopidogrel', severity: 'moderate', reason: 'Weaker CYP2C19 inhibition than omeprazole.', action: 'Prefer pantoprazole on clopidogrel.' },
];

// Age-aware dosing validation helper. Returns a normalized review object.
function parseStrengthMg(strength) {
  if (!strength) return null;
  const m = String(strength).match(/(\d+(?:\.\d+)?)\s*mg/i);
  return m ? parseFloat(m[1]) : null;
}

function validateDosage({ medicineName, strength, frequency, duration, patientAge, quantity }) {
  const ref = lookupMedicine(medicineName);
  const issues = [];
  if (!ref) {
    return { matched: false, medicine: medicineName || null, issues: [], message: 'Medicine information unavailable — verify manually.' };
  }
  const perDoseMg = parseStrengthMg(strength);
  if (perDoseMg == null) {
    issues.push({ type: 'strength', severity: 'moderate', message: 'Could not parse strength — verify dose manually.' });
  }
  if (patientAge != null) {
    if (patientAge < (ref.adult.minAgeYears || 0)) {
      issues.push({ type: 'age', severity: 'high', message: `Patient age ${patientAge} is below the reference minimum age (${ref.adult.minAgeYears}+). Pediatric dosing by weight required.` });
    } else if (patientAge < 12 && perDoseMg != null && ref.adult.pediatricMgPerKg) {
      issues.push({ type: 'pediatric', severity: 'moderate', message: `Patient is pediatric — weight-based dosing (~${ref.adult.pediatricMgPerKg} mg/kg/dose) must be confirmed, not adult tablet strength.` });
    }
  } else {
    issues.push({ type: 'age', severity: 'informational', message: 'Patient age not provided — age-specific dose check skipped.' });
  }
  if (perDoseMg != null && ref.adult.maxDailyMg != null && /every|twice|thrice|daily|hour|times/i.test(frequency || '')) {
    const timesPerDay = timesPerDayOf(frequency);
    if (timesPerDay != null) {
      const dailyMg = perDoseMg * timesPerDay;
      if (dailyMg > ref.adult.maxDailyMg) {
        issues.push({ type: 'max_daily', severity: 'critical', message: `Computed daily dose ${dailyMg} mg exceeds the reference maximum of ${ref.adult.maxDailyMg} mg/day.` });
      }
    }
  }
  if (quantity != null && duration) {
    const days = (() => {
      const m = String(duration).match(/(\d+)\s*day/i);
      if (m) return parseInt(m[1], 10);
      const w = String(duration).match(/(\d+)\s*week/i);
      if (w) return parseInt(w[1], 10) * 7;
      return null;
    })();
    if (days != null && timesPerDayOf(frequency) != null) {
      const expected = days * timesPerDayOf(frequency);
      if (quantity < expected) issues.push({ type: 'quantity', severity: 'moderate', message: `Quantity ${quantity} looks low for ${days} days at the stated frequency (expected ~${expected}).` });
      if (quantity > expected * 2) issues.push({ type: 'quantity', severity: 'moderate', message: `Quantity ${quantity} is more than double the expected ~${expected} for the stated duration.` });
    }
  }
  return { matched: true, medicine: ref.name, genericName: ref.genericName, referenceDose: `${ref.adult.dose} ${ref.adult.frequency}`, notes: ref.notes, issues };
}

function timesPerDayOf(frequency) {
  if (!frequency) return null;
  const f = String(frequency).toLowerCase();
  if (/once/.test(f)) return 1;
  if (/twice|bid/.test(f)) return 2;
  if (/thrice|tid|three/.test(f)) return 3;
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  for (const [word, n] of Object.entries(numberWords)) {
    if (new RegExp(`\\b${word}(\\ss)?\\s*times?\\b`).test(f) || new RegExp(`\\b${word}\\s+times\\b`).test(f)) return n;
  }
  const m = f.match(/(\d+)/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (f.includes('day') && !f.includes('hour')) return h; // "3 times a day"
    if (f.includes('hour') && h > 0) return Math.max(1, Math.round(24 / h));
  }
  return null;
}

function lookupMedicine(name) {
  if (!name) return null;
  const q = String(name).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  if (!q) return null;
  // exact name, then alias, then token-subset match (OCR fragments).
  let hit = REFERENCE_MEDICINES.find((m) => m.name.toLowerCase() === q);
  if (hit) return hit;
  hit = REFERENCE_MEDICINES.find((m) => m.aliases.some((a) => q.includes(a) || a.includes(q)));
  if (hit) return hit;
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  hit = REFERENCE_MEDICINES.find((m) => {
    const hay = `${m.name} ${m.genericName} ${m.aliases.join(' ')}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });
  return hit || null;
}

// ---------------------------------------------------------------------------
// Controlled fuzzy medicine validation — used by the parallel OCR+AI pipeline.
// Deterministic, auditable, threshold-gated. NEVER invents a match: below the
// similarity cutoff the result is exists:false + uncertain:true so the caller
// marks "Needs Verification" instead of guessing.
// ---------------------------------------------------------------------------

const MATCH_CUTOFF = 0.62; // controlled trigram-similarity floor for fuzzy matches
const DOSE_FORM_PREFIXES = /^(tab|tablets?|cap|caps?|capsules?|syr|syrup|susp|suspension|inj|injection|oin|ointment|drops?)\b\s*/i;

/**
 * Separate strength/dosage tokens from a normalized medicine name so name
 * matching never sees "azithromycin 500 mg" as the NAME (spec: name and
 * strength validation must be independent). A token is treated as strength
 * when it starts with a digit ("500", "500mg", "2.5mg") or is a bare unit
 * ("mg", "ml", "mcg", "g", "iu"). Everything else stays part of the name.
 * Returns { name, strengthToken } — strengthToken is used only as a fallback
 * when no explicit strength field was extracted.
 */
function splitStrengthFromName(normalized) {
  const tokens = normalized.split(' ').filter(Boolean);
  let nameTokens = tokens;
  let strengthToken = '';
  // Walk from the END: only TRAILING strength tokens split off. Interior
  // numbers are part of real brand names ("Augmentin 625 Duo") and must stay.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!strengthToken && /^(mg|mcg|ml|g|iu)$/.test(t)) continue; // stray trailing unit
    if (!strengthToken && /^\d+([.,]\d+)?(mg|mcg|ml|g|iu)?$/.test(t)) { strengthToken = t; continue; }
    // anything else ends the strength run
    nameTokens = tokens.slice(0, i + 1);
    break;
  }
  return { name: nameTokens.join(' '), strengthToken };
}

function normalizeMedicineName(raw) {
  let s = String(raw || '').toLowerCase().trim();
  // Strip dosage-form prefixes repeatedly ("Tab. Azithromycin" → "azithromycin").
  for (;;) {
    const stripped = s.replace(DOSE_FORM_PREFIXES, '').trim();
    if (stripped === s || !stripped) break;
    s = stripped;
  }
  return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function trigramSim(a, b) {
  const sa = String(a || '').replace(/[^a-z0-9]/g, '');
  const sb = String(b || '').replace(/[^a-z0-9]/g, '');
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  const grams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    if (set.size === 0) set.add(s);
    return set;
  };
  const ga = grams(sa), gb = grams(sb);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / (ga.size + gb.size - inter);
}

/** Normalized Levenshtein similarity (1 − editDistance/maxLen) — the right
 * metric for single-character OCR slips ("azitromycin" → 0.92, while a
 * trigram Jaccard would unfairly score it below cutoff). */
function levSim(a, b) {
  const sa = String(a || '').replace(/[^a-z0-9]/g, '');
  const sb = String(b || '').replace(/[^a-z0-9]/g, '');
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  let prev = new Array(sb.length + 1);
  let cur = new Array(sb.length + 1);
  for (let j = 0; j <= sb.length; j++) prev[j] = j;
  for (let i = 1; i <= sa.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= sb.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (sa[i - 1] === sb[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[sb.length] / Math.max(sa.length, sb.length);
}

function normalizeStrength(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/(\d)\s*(mg|mcg|g|ml|iu)\b/g, '$1$2').trim();
}

/**
 * Validate one extracted medicine name against the reference dataset.
 * Returns { exists, matchedName, confidence, similarity, method, source,
 *           genericName, category, dosageForm, strengthStatus, listedStrengths,
 *           uncertain, needsVerification }.
 * The confidence is the match certainty of the NAME LOOKUP only — it is not a
 * clinical correctness score and never approves a medicine by itself.
 */
function validateMedicine(rawName, rawStrength) {
  const normalized = normalizeMedicineName(rawName);
  const split = splitStrengthFromName(normalized);
  // Name used for LOOKUP excludes strength tokens; strength used for the
  // strength check prefers the explicitly extracted strength field, falling
  // back to a strength token found inside the name string (e.g. "Azithro 500").
  const lookupName = split.name;
  const effectiveStrength = rawStrength || split.strengthToken || '';
  const base = {
    queriedName: rawName || null,
    normalizedName: normalized || null,
    lookupName: lookupName || null,
    matchedName: null,
    confidence: 0,
    similarity: 0,
    method: 'none',
    source: 'reference_dataset',
    exists: false,
    uncertain: true,
    needsVerification: true,
    genericName: null,
    category: null,
    dosageForm: null,
    strengthStatus: 'unknown',
    listedStrengths: null,
  };
  if (!lookupName) {
    return { ...base, status: 'invalid_extraction' };
  }

  let hit = null;
  let method = 'none';
  let confidence = 0;

  // STEP 1 — exact normalized medicine name / generic / alias.
  hit = REFERENCE_MEDICINES.find((m) =>
    m.name.toLowerCase() === lookupName || m.genericName.toLowerCase() === lookupName
    || m.aliases.some((a) => a.toLowerCase() === lookupName));
  if (hit) { method = 'exact'; confidence = 1; }

  // STEP 2 — alias/composition containment, guarded: the alias must be a
  // whole token of the lookup name (or vice versa) so short brand aliases
  // ("mox") match "mox 500"→"mox" but not arbitrary words. A single-token
  // lookup equal to a short alias is still accepted ("Mox" alone is real).
  if (!hit) {
    const lookupTokens = lookupName.split(' ');
    hit = REFERENCE_MEDICINES.find((m) =>
      [...m.aliases, m.name.toLowerCase()].some((a) => {
        if (a.length < 3) return false;
        if (lookupTokens.includes(a)) return true; // whole-token alias hit
        // containment guarded by length on BOTH sides
        return a.length >= 4 && lookupName.length >= 4
          && (lookupName.includes(a) || a.includes(lookupName));
      }));
    if (hit) { method = 'alias'; confidence = 0.9; }
  }

  // STEP 2b — MEDICINE MASTER lookup: exact normalized brand name, then a
  // composition/brand alias, from the imported master database. An alias hit
  // is a REAL source equivalence (brand contains salt X / brand alias),
  // reported honestly as 'master_alias' — never upgraded to exact.
  if (!hit) {
    const master = loadMaster();
    if (master) {
      const direct = master.byName.get(lookupName);
      if (direct) {
        const strengths = (direct.strength || []).map(normalizeStrength);
        const ns = normalizeStrength(effectiveStrength);
        const nsMg = /^\d+$/.test(ns) ? normalizeStrength(`${ns}mg`) : null;
        const strengthStatus = !ns ? 'unknown'
          : strengths.includes(ns) || (nsMg && strengths.includes(nsMg)) ? 'listed' : 'not_listed';
        return {
          ...base,
          matchedName: direct.name,
          confidence: 1,
          similarity: 1,
          method: 'master_exact',
          status: 'matched',
          source: 'medicine_master',
          exists: true,
          uncertain: strengthStatus === 'not_listed',
          needsVerification: strengthStatus === 'not_listed',
          genericName: (direct.composition && direct.composition[0] && direct.composition[0].salt) || '',
          category: direct.type || '',
          dosageForm: direct.dosageForm || '',
          manufacturer: direct.manufacturer || '',
          drugStatus: direct.status || '',
          strengthStatus,
          listedStrengths: strengths,
        };
      }
      const aliasTarget = master.aliasToName.get(lookupName);
      if (aliasTarget) {
        const rec = master.byName.get(aliasTarget);
        if (rec) {
          const strengths = (rec.strength || []).map(normalizeStrength);
          const ns = normalizeStrength(effectiveStrength);
          const nsMg = /^\d+$/.test(ns) ? normalizeStrength(`${ns}mg`) : null;
          const strengthStatus = !ns ? 'unknown'
            : strengths.includes(ns) || (nsMg && strengths.includes(nsMg)) ? 'listed' : 'not_listed';
          return {
            ...base,
            matchedName: rec.name,
            confidence: 0.9,
            similarity: 0.9,
            method: 'master_alias',
            status: 'matched',
            source: 'medicine_master',
            exists: true,
            uncertain: true, // alias equivalences are real but weaker — keep human verification
            needsVerification: true,
            genericName: (rec.composition && rec.composition[0] && rec.composition[0].salt) || '',
            category: rec.type || '',
            dosageForm: rec.dosageForm || '',
            manufacturer: rec.manufacturer || '',
            drugStatus: rec.status || '',
            strengthStatus,
            listedStrengths: strengths,
          };
        }
      }
    }
  }

  // STEP 3 — token subset (OCR fragment: "azithro 500" → token "azithro").
  if (!hit) {
    const tokens = lookupName.split(' ').filter((t) => t.length > 3);
    hit = REFERENCE_MEDICINES.find((m) => {
      const hay = `${m.name} ${m.genericName} ${m.aliases.join(' ')}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    if (hit) { method = 'token'; confidence = 0.8; }
  }

  // STEP 4 — controlled fuzzy: best normalized-Levenshtein similarity across
  // all names, accepted only above MATCH_CUTOFF and only for names long
  // enough to be meaningful (absorbs OCR spelling errors like
  // "azitromycin", "panterozole" without matching arbitrary words).
  let best = null, bestSim = 0;
  if (!hit) {
    if (lookupName.replace(/ /g, '').length >= 5) {
      for (const m of REFERENCE_MEDICINES) {
        for (const candidate of [m.name, m.genericName, ...m.aliases]) {
          const sim = levSim(lookupName, candidate);
          if (sim > bestSim) { bestSim = sim; best = m; }
        }
      }
      if (best && bestSim >= MATCH_CUTOFF) {
        hit = best;
        method = 'fuzzy';
        confidence = Number(bestSim.toFixed(4));
      }
    }
  }

  // STEP 4b — master fuzzy: same controlled Levenshtein threshold, applied to
  // the master's brand names when curated fuzzy found nothing. Method stays
  // 'master_fuzzy' and the result is Needs Verification — never auto-exact.
  if (!hit) {
    const master = loadMaster();
    if (master && lookupName.replace(/ /g, '').length >= 5) {
      // Iterate a bounded subset for performance: names starting with the
      // same letter, then any, tracking the global best.
      let mBest = null, mBestSim = 0;
      const firstChar = lookupName[0];
      for (const [norm, rec] of master.byName) {
        if (norm[0] !== firstChar && Math.abs(norm.length - lookupName.length) > 3) continue;
        const sim = levSim(lookupName, norm);
        if (sim > mBestSim) { mBestSim = sim; mBest = rec; }
        if (mBestSim >= 0.999) break;
      }
      if (mBest && mBestSim >= MATCH_CUTOFF) {
        const strengths = (mBest.strength || []).map(normalizeStrength);
        const ns = normalizeStrength(effectiveStrength);
        const nsMg = /^\d+$/.test(ns) ? normalizeStrength(`${ns}mg`) : null;
        const strengthStatus = !ns ? 'unknown'
          : strengths.includes(ns) || (nsMg && strengths.includes(nsMg)) ? 'listed' : 'not_listed';
        return {
          ...base,
          matchedName: mBest.name,
          confidence: Number(mBestSim.toFixed(4)),
          similarity: Number(mBestSim.toFixed(4)),
          method: 'master_fuzzy',
          status: 'fuzzy_match',
          source: 'medicine_master',
          exists: true,
          uncertain: true,
          needsVerification: true,
          genericName: (mBest.composition && mBest.composition[0] && mBest.composition[0].salt) || '',
          category: mBest.type || '',
          dosageForm: mBest.dosageForm || '',
          manufacturer: mBest.manufacturer || '',
          drugStatus: mBest.status || '',
          strengthStatus,
          listedStrengths: strengths,
        };
      }
    }
  }

  if (!hit) {
    // Honest no-match: report the closest candidate (if any) for human review.
    return {
      ...base,
      similarity: Number(bestSim.toFixed(4)),
      matchedName: best ? best.name : null,
      method: best ? 'below_cutoff' : 'none',
      status: best ? 'unmatched' : 'database_not_found',
    };
  }
  // Strength status — checked against the matched medicine's listed
  // strengths, independent of the name match; informational only,
  // never auto-approving.
  const listed = (hit.strengths || []).map(normalizeStrength);
  const ns = normalizeStrength(effectiveStrength);
  // Bare-number strengths from name tokens ("Mox 500") conventionally mean
  // mg — try that candidate too. This only refines the informational
  // strength status; it never auto-approves the medicine.
  const nsMg = /^\d+$/.test(ns) ? normalizeStrength(`${ns}mg`) : null;
  const strengthStatus = !ns ? 'unknown'
    : listed.includes(ns) || (nsMg && listed.includes(nsMg)) ? 'listed' : 'not_listed';

  return {
    ...base,
    matchedName: hit.name,
    confidence,
    similarity: method === 'fuzzy' ? Number(bestSim.toFixed(4)) : confidence,
    method,
    status: method === 'fuzzy' ? 'fuzzy_match' : 'matched',
    exists: true,
    uncertain: method === 'fuzzy' || strengthStatus === 'not_listed',
    needsVerification: method === 'fuzzy' || strengthStatus === 'not_listed',
    genericName: hit.genericName,
    category: hit.category,
    dosageForm: hit.dosageForm,
    strengthStatus,
    listedStrengths: hit.strengths || [],
  };
}

function searchMedicines(q, limit = 20) {
  if (!q) return [];
  const query = String(q).toLowerCase();
  return REFERENCE_MEDICINES
    .filter((m) => `${m.name} ${m.genericName} ${(m.aliases || []).join(' ')}`.toLowerCase().includes(query))
    .slice(0, limit)
    .map((m) => ({ name: m.name, genericName: m.genericName, category: m.category, dosageForm: m.dosageForm, strengths: m.strengths, source: 'reference_dataset' }));
}

function checkInteractions(names) {
  const list = (names || []).map((n) => lookupMedicine(n)).filter(Boolean).map((m) => m.name.toLowerCase());
  const alerts = [];
  for (const pair of INTERACTION_PAIRS) {
    if (list.includes(pair.a) && list.includes(pair.b)) {
      alerts.push({ ...pair, source: 'reference_dataset' });
    }
  }
  // Warn on any medicine we could NOT identify at all (safety net, not a clinical alert).
  const unmatched = (names || []).filter((n) => !lookupMedicine(n));
  return { alerts, unmatched, source: 'reference_dataset' };
}

module.exports = {
  medicineRepo,
  lookupMedicine,
  validateMedicine,
  normalizeMedicineName,
  searchMedicines,
  checkInteractions,
  validateDosage,
  REFERENCE_MEDICINES,
  INTERACTION_PAIRS,
  masterStats,
  loadMaster,
};
