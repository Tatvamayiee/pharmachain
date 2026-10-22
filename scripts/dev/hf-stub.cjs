// Mock Hugging Face router for the analyzer tests. Emulates
// POST /v1/chat/completions with configurable failure modes:
//   node scripts/dev/hf-stub.cjs [port] [mode]
// modes: ok (default) | timeout | malformed | http500
const http = require('http');

const port = Number(process.argv[2]) || 4598;
const mode = process.argv[3] || 'ok';

const OK_JSON = {
  patient: { name: null, age: 42, gender: null },
  doctor: { name: 'Dr A. Sharma', specialization: null, registration_number: null },
  prescription_date: '2026-09-20',
  medicines: [
    { name: 'Paracetamol', strength: '650 mg', dosage: '1 tablet', frequency: '3 times daily', duration: '5 days', route: 'oral', instructions: 'after food', confidence: 0.92 },
    { name: 'Cetirizine', strength: '10 mg', dosage: '1 tablet', frequency: 'once daily', duration: '5 days', route: 'oral', instructions: 'at night', confidence: 0.55 },
    { name: 'Amoxicillin', strength: '500 mg', dosage: '1 capsule', frequency: 'twice daily', duration: '7 days', route: 'oral', instructions: 'with meals', confidence: 0.88 },
  ],
  diagnosis: [],
  tests: [],
  additional_instructions: [],
  warnings: ['Low confidence reading for "Cetirizine".'],
  overall_confidence: 0.84,
};

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (mode === 'timeout') { setTimeout(() => res.destroy(), 70_000); return; }
    if (mode === 'http500') { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'upstream exploded' })); return; }
    if (mode === 'malformed') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'I looked at the prescription but cannot output JSON, sorry!' } }] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(OK_JSON) + '\n```' } }] }));
  });
}).listen(port, () => console.log(`HF stub (${mode}) on http://127.0.0.1:${port}/v1/chat/completions`));
