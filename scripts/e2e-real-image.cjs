// E2E proof: render a real prescription-looking PNG (sharp SVG->PNG),
// create a prescription, run /analyze against the LIVE Hugging Face model,
// and print exactly what the AI extracted. No stubs, no mocks.
const sharp = require('sharp');

const SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
<rect width='800' height='600' fill='white'/>
<text x='40' y='60' font-family='Georgia' font-size='28' font-weight='bold'>City Care Clinic</text>
<text x='40' y='100' font-family='Georgia' font-size='18'>Dr. Anita Rao, MBBS, MD (General Medicine)</text>
<text x='40' y='130' font-family='Georgia' font-size='16'>Reg. No: MMC/2013/45871</text>
<line x1='40' y1='150' x2='760' y2='150' stroke='black' stroke-width='2'/>
<text x='40' y='190' font-family='Georgia' font-size='17'>Patient Name: Rahul Verma</text>
<text x='40' y='220' font-family='Georgia' font-size='17'>Age/Sex: 34 yrs / Male</text>
<text x='40' y='250' font-family='Georgia' font-size='17'>Date: 24/09/2026</text>
<text x='40' y='290' font-family='Georgia' font-size='17'>Rx</text>
<text x='60' y='330' font-family='Georgia' font-size='18'>1. Tab. Azithromycin 500 mg - once daily x 3 days</text>
<text x='60' y='365' font-family='Georgia' font-size='18'>2. Tab. Paracetamol 650 mg - twice daily x 5 days</text>
<text x='60' y='400' font-family='Georgia' font-size='18'>3. Cap. Omeprazole 20 mg - once daily before food x 5 days</text>
<text x='40' y='450' font-family='Georgia' font-size='16'>Advice: plenty of fluids, rest.</text>
<text x='560' y='560' font-family='Georgia' font-size='20' font-style='italic'>Dr. Anita Rao</text>
</svg>`;

const BASE = 'http://127.0.0.1:41837';

async function main() {
  const png = await sharp(Buffer.from(SVG)).png().toBuffer();
  console.log('PNG rendered:', png.length, 'bytes');

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer@pharmachain.com', password: 'dealer123' }),
  });
  const { token } = await login.json();
  if (!token) throw new Error('login failed');

  const create = await fetch(BASE + '/api/prescriptions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ patientReference: 'LIVE-AI-DOC-' + Date.now(), patientAge: 34, prescriptionDate: '2026-09-24' }),
  });
  const PID = (await create.json()).prescriptionId;
  console.log('created', PID);

  const t0 = Date.now();
  const an = await fetch(BASE + '/api/prescriptions/' + PID + '/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ image: { data: png.toString('base64'), mimetype: 'image/png' } }),
  });
  const res = await an.json();
  const d = res.data || res;
  console.log('HTTP', an.status, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('provider:', d.analysisProvider, '| model:', d.analysisModel, '| conf:', d.analysisConfidence, '| status:', d.status);
  const meds = d.medicines || [];
  console.log('--- medicines extracted by the AI ---');
  for (const m of meds) {
    console.log(`  ${m.name} ${m.strength || ''} | ${m.frequency || ''} | ${m.duration || ''} | conf ${m.confidence}`);
  }
  const et = String(d.extractedText || '');
  console.log('--- extracted text head ---');
  console.log(et.slice(0, 300).replace(/\n/g, ' | '));
  if (!meds.length) console.log('(no medicines — full response:', JSON.stringify(res).slice(0, 400), ')');
}

main().catch((e) => { console.log('ERR', e.message); process.exit(1); });
