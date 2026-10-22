// ---------------------------------------------------------------------------
// import-medicine-master.cjs — one-shot importer for the Indian Medicine
// Master Database (MIT-licensed, junioralive/Indian-Medicine-Dataset).
//
// Pipeline: SOURCE CSV → schema mapping → normalize names → normalize
// aliases/compositions → normalize strengths → dedup → provenance →
// server/ml/reference/medicine-master.json (consumed by drugDatabaseService).
//
// HARD RULES (fail-closed, nothing fabricated):
//   - no field is invented: missing manufacturer stays '', etc.
//   - provenance (source, sourceVersion, license, importedAt) on every record
//     AND a dataset-level manifest
//   - dedup on normalized brand name; keeps the first occurrence
//   - existing curated REFERENCE_MEDICINES (clinical dosing, interactions)
//     are NEVER overwritten — the external dataset EXTENDS, not replaces
//   - imported records are lookup-only: they prove NAME EXISTENCE, never
//     clinical appropriateness (validation marks that separately)
//
// Usage: node scripts/data/import-medicine-master.cjs [--limit N] [--max-mb 40]
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'server', 'ml', 'reference', 'indian_medicine_data.csv');
const OUT = path.join(ROOT, 'server', 'ml', 'reference', 'medicine-master.json');

const SOURCE_URL = 'https://github.com/junioralive/Indian-Medicine-Dataset';
const SOURCE_VERSION = '2024 snapshot (repo main, MIT)';
const LICENSE = 'MIT (c) 2024 JuniorAlive — commercial and research use permitted';

const args = process.argv.slice(2);
const limitFlag = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : Infinity;
const maxMb = args.includes('--max-mb') ? parseFloat(args[args.indexOf('--max-mb') + 1]) : 40;

// --- normalization (mirrors drugDatabaseService rules) ----------------------
const DOSE_FORM_PREFIX = /^(tab|tablets?|cap|caps?|capsules?|syr|syrup|susp|suspension|inj|injection|oin|ointment|drops?|gel|cream|lotion|inhaler|spray|sachet|kit|respules|solution|powder)\b\s*/i;

function normalizeName(raw) {
  let s = String(raw || '').toLowerCase().trim();
  for (;;) {
    const stripped = s.replace(DOSE_FORM_PREFIX, '').trim();
    if (stripped === s || !stripped) break;
    s = stripped;
  }
  return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeStrength(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/(\d)\s*(mg|mcg|g|ml|iu)\b/g, '$1$2').trim();
}

/** Pull "Salt (500mg)" pieces out of a composition string. */
function parseComposition(comp) {
  const out = [];
  for (const part of String(comp || '').split(/[/+,;]|\band\b/i)) {
    const m = part.trim().match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (m && m[1]) out.push({ salt: m[1].replace(/\s+/g, ' ').trim(), strength: normalizeStrength(m[2]) });
    else if (part.trim()) out.push({ salt: part.replace(/\s+/g, ' ').trim(), strength: '' });
  }
  return out.filter((c) => c.salt);
}

// --- CSV parsing (RFC-4180: quoted fields with embedded commas) -------------
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

// --- main --------------------------------------------------------------------
function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source CSV not found: ${SRC}`);
    console.error('Download from ' + SOURCE_URL + ' (DATA/indian_medicine_data.csv)');
    process.exit(1);
  }
  const sizeMb = fs.statSync(SRC).size / (1024 * 1024);
  if (sizeMb > maxMb) {
    console.error(`Source CSV is ${sizeMb.toFixed(1)} MB (> --max-mb ${maxMb}). Refusing without an explicit larger cap.`);
    process.exit(1);
  }

  console.log(`Reading ${(sizeMb).toFixed(1)} MB source…`);
  const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  console.log('columns:', header.join(' | '));

  const byKey = new Map();           // normalized brand name → record
  const compositionIndex = new Map();// normalized salt name → Set(normalized brand)
  const stats = { rows: 0, malformed: 0, imported: 0, duplicates: 0, discontinued: 0 };

  for (let i = 1; i < lines.length; i++) {
    if (stats.imported >= limitFlag) break;
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const f = parseCsvLine(line);
    const row = {
      id: (f[idx.id] || '').trim(),
      name: (f[idx.name] || '').trim(),
      price: (f[idx['price(₹)']] || '').trim(),
      discontinued: String((f[idx.Is_discontinued] || '')).trim().toUpperCase() === 'TRUE',
      manufacturer: (f[idx.manufacturer_name] || '').trim(),
      type: (f[idx.type] || '').trim(),
      packSize: (f[idx.pack_size_label] || '').trim(),
      comp1: (f[idx.short_composition1] || '').trim(),
      comp2: (f[idx.short_composition2] || '').trim(),
    };
    stats.rows++;
    if (!row.name) { stats.malformed++; continue; }
    if (row.discontinued) stats.discontinued++;

    const normalized = normalizeName(row.name);
    if (!normalized) { stats.malformed++; continue; }

    const compositions = [...parseComposition(row.comp1), ...parseComposition(row.comp2)];
    const strengths = [...new Set(compositions.map((c) => c.strength).filter(Boolean))];

    const rec = {
      name: row.name,
      normalizedName: normalized,
      aliases: [],                    // brand aliases are NOT invented — only compositions act as lookup keys
      composition: compositions,      // [{salt, strength}] — no inference
      strength: strengths,            // normalized distinct strengths from compositions
      dosageForm: (row.packSize.match(/\b(tablet|capsule|syrup|injection|drops?|cream|gel|ointment|suspension|inhaler|spray)\b/i) || [])[1] || '',
      manufacturer: row.manufacturer,
      status: row.discontinued ? 'discontinued' : 'marketed',
      source: 'indian_medicine_dataset',
      sourceVersion: SOURCE_VERSION,
      sourceId: row.id,
      license: LICENSE,
      importedAt: new Date().toISOString(),
    };

    const existing = byKey.get(normalized);
    if (existing) { stats.duplicates++; continue; }
    byKey.set(normalized, rec);
    stats.imported++;

    for (const c of compositions) {
      const saltKey = normalizeName(c.salt);
      if (!saltKey) continue;
      if (!compositionIndex.has(saltKey)) compositionIndex.set(saltKey, new Set());
      compositionIndex.get(saltKey).add(normalized);
    }
  }

  // Composition index → alias lists (salt name → brand normalized names).
  // These are REAL equivalences from the source (brand X contains salt Y),
  // not fabricated aliases.
  let aliasCount = 0;
  for (const rec of byKey.values()) {
    const salts = rec.composition.map((c) => normalizeName(c.salt)).filter(Boolean);
    for (const s of salts) {
      const brands = compositionIndex.get(s);
      if (brands && brands.size <= 8) { // only small salt→brand groups are useful aliases
        for (const b of brands) {
          if (b !== rec.normalizedName && !rec.aliases.includes(b)) { rec.aliases.push(b); aliasCount++; }
        }
      }
    }
    rec.aliases = rec.aliases.slice(0, 12);
  }

  const manifest = {
    dataset: 'medicine-master',
    source: SOURCE_URL,
    sourceVersion: SOURCE_VERSION,
    license: LICENSE,
    licenseVerified: true,
    importedAt: new Date().toISOString(),
    stats,
    provenance: 'Every record carries source, sourceVersion, sourceId, license, importedAt. Composition-derived aliases come only from real salt↔brand rows in the source; no field is inferred where absent.',
  };
  const payload = { manifest, records: [...byKey.values()] };
  fs.writeFileSync(OUT, JSON.stringify(payload));
  const outMb = fs.statSync(OUT).size / (1024 * 1024);
  console.log(`\n== Import complete ==`);
  console.log(`rows read: ${stats.rows} | imported: ${stats.imported} | duplicates: ${stats.duplicates} | malformed: ${stats.malformed} | discontinued: ${stats.discontinued}`);
  console.log(`composition aliases: ${aliasCount}`);
  console.log(`wrote ${OUT} (${outMb.toFixed(1)} MB)`);
}

main();
