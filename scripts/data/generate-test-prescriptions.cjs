// ---------------------------------------------------------------------------
// generate-test-prescriptions.cjs — renders DISTINCT digital (typed)
// prescription images for ML training-data diversity.
//
// Every medicine, strength, frequency and duration comes from the project's
// REAL Indian reference formulary (drugDatabaseService.cjs) — no invented
// drugs, no synthetic feature values. The images are clean printed text
// (digital/typed, no handwriting) rendered with sharp at A5-ish print size.
//
// Output: scripts/data/test-images/rx-distinct-01.png … rx-distinct-06.png
// Usage:  node scripts/data/generate-test-prescriptions.cjs
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT_DIR = path.join(__dirname, 'test-images');

// Real formulary entries (name / strength / form / frequency / duration) —
// all strengths exist in the reference dataset's strength lists.
const PRESCRIPTIONS = [
  {
    id: '01', patient: 'R-1041', doctor: 'Dr. Meera Nair, MBBS',
    reg: 'KMC/2011/30219', date: '2026-09-20', clinic: 'Sunrise Family Clinic, Kochi',
    meds: [
      { name: 'Metformin', form: 'Tab.', strength: '500 mg', freq: 'twice daily', dur: 'x 30 days', note: 'after meals' },
      { name: 'Amlodipine', form: 'Tab.', strength: '5 mg', freq: 'once daily', dur: 'x 30 days' },
    ],
  },
  {
    id: '02', patient: 'R-1042', doctor: 'Dr. Arjun Mehta, MD',
    reg: 'MMC/2015/51022', date: '2026-09-21', clinic: 'City Care Hospital, Pune',
    meds: [
      { name: 'Amoxicillin', form: 'Cap.', strength: '500 mg', freq: 'three times daily', dur: 'x 5 days' },
      { name: 'Cetirizine', form: 'Tab.', strength: '10 mg', freq: 'once daily at night', dur: 'x 7 days' },
    ],
  },
  {
    id: '03', patient: 'R-1043', doctor: 'Dr. Kavita Rao, MD (Cardiology)',
    reg: 'KMC/2008/11873', date: '2026-09-22', clinic: 'Heartline Institute, Bengaluru',
    meds: [
      { name: 'Aspirin', form: 'Tab.', strength: '75 mg', freq: 'once daily after breakfast', dur: 'x 90 days' },
      { name: 'Atorvastatin', form: 'Tab.', strength: '10 mg', freq: 'once daily at bedtime', dur: 'x 90 days' },
    ],
  },
  {
    id: '04', patient: 'R-1044', doctor: 'Dr. Sanjay Gupta, MS (ENT)',
    reg: 'DMP/2013/9044', date: '2026-09-23', clinic: 'Gupta ENT Care, Jaipur',
    meds: [
      { name: 'Azithromycin', form: 'Tab.', strength: '250 mg', freq: 'once daily', dur: 'x 3 days' },
      { name: 'Ibuprofen', form: 'Tab.', strength: '400 mg', freq: 'twice daily after food', dur: 'x 3 days' },
    ],
  },
  {
    id: '05', patient: 'R-1045', doctor: 'Dr. Farida Khan, MBBS',
    reg: 'UPMC/2019/44711', date: '2026-09-24', clinic: 'Noor Polyclinic, Lucknow',
    meds: [
      { name: 'Pantoprazole', form: 'Tab.', strength: '40 mg', freq: 'once daily before breakfast', dur: 'x 14 days' },
      { name: 'Paracetamol', form: 'Tab.', strength: '650 mg', freq: 'as needed for pain, max 3/day', dur: 'x 5 days' },
    ],
  },
  {
    id: '06', patient: 'R-1046', doctor: 'Dr. Vikram Shetty, MD (Gen. Medicine)',
    reg: 'KMC/2016/62088', date: '2026-09-25', clinic: 'Coastal Health Centre, Mangaluru',
    meds: [
      { name: 'Warfarin', form: 'Tab.', strength: '2 mg', freq: 'once daily (same time)', dur: 'x 30 days', note: 'INR check weekly' },
      { name: 'Omeprazole', form: 'Cap.', strength: '20 mg', freq: 'once daily', dur: 'x 30 days' },
    ],
  },
];

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

function buildSvg(rx) {
  const medRows = rx.meds.map((m, i) => {
    const y = 250 + i * 74;
    const line = `${m.form} ${m.name} ${m.strength}`;
    const sig = `${m.freq}, ${m.dur}${m.note ? `, ${m.note}` : ''}`;
    const qty = `Qty: ${m.dur.includes('30') ? '30' : m.dur.includes('90') ? '90' : '10'}`;
    return `
      <text x="90" y="${y}" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#111">${esc(`${i + 1}.`)} <tspan fill="#0b3f8f">${esc(line)}</tspan></text>
      <text x="120" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="21" fill="#222">${esc(sig)}  —  ${esc(qty)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700">
    <rect width="1000" height="700" fill="#ffffff"/>
    <rect x="24" y="24" width="952" height="652" fill="none" stroke="#345" stroke-width="2"/>
    <line x1="24" y1="118" x2="976" y2="118" stroke="#345" stroke-width="1.5"/>
    <text x="60" y="70" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#0b3f8f">${esc(rx.clinic)}</text>
    <text x="60" y="100" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#444">${esc(rx.doctor)}  •  Reg. ${esc(rx.reg)}</text>
    <text x="770" y="70" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#222">Date: ${esc(rx.date)}</text>
    <text x="770" y="100" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#222">Ref: ${esc(rx.patient)}</text>
    <text x="60" y="160" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#333">Rx</text>
    ${medRows}
    <line x1="60" y1="560" x2="940" y2="560" stroke="#aab" stroke-width="1"/>
    <text x="60" y="596" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#555">Digital prescription — verify with the prescriber before dispensing.</text>
    <text x="60" y="640" font-family="Georgia, serif" font-size="26" font-style="italic" fill="#111">${esc(rx.doctor)}</text>
  </svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const rx of PRESCRIPTIONS) {
    const svg = Buffer.from(buildSvg(rx));
    const out = path.join(OUT_DIR, `rx-distinct-${rx.id}.png`);
    await sharp(svg, { density: 144 }).png().toFile(out);
    const size = fs.statSync(out).size;
    console.log(`rx-distinct-${rx.id}.png  ${size} bytes  — ${rx.meds.map((m) => `${m.name} ${m.strength}`).join(' + ')}`);
  }
  console.log(`\nWrote ${PRESCRIPTIONS.length} distinct images to ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
