// Minimal mock AI provider for local testing of POST /api/prescriptions/:id/analyze.
// Usage:   node scripts/mock-ai.cjs [port]
// Point the server at it with, in pharmachain2/.env:
//   PHARMACHAIN_AI_PROVIDER=custom
//   PHARMACHAIN_AI_BASE_URL=http://127.0.0.1:4599/analyze
// Returns a deterministic analysis echoing whatever medicines appear in the
// supplied extractedText. Test helper only — never run in production.
const http = require('http');

const port = Number(process.argv[2]) || 4599;

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let ctx = {};
    try { ctx = JSON.parse(body || '{}'); } catch { /* ignore */ }
    const text = String(ctx.extractedText || '');
    // Deterministic "extraction": every uppercase word token becomes a medicine.
    const names = [...new Set((text.match(/\b[A-Z][a-zA-Z]+/g) || []).filter((w) => !['Rx'].includes(w)))];
    const medicines = names.map((n) => ({
      name: n, strength: '500 mg', dosage: '1 tab', frequency: 'TDS',
      duration: '5 days', route: 'oral', quantity: 15, confidence: 0.93,
    }));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      extractedText: text,
      medicines,
      interactionAlerts: names.length >= 2
        ? [{ severity: 'moderate', medicines: names.slice(0, 2), reason: 'mock interaction check', concern: 'demo only', action: 'pharmacist review' }]
        : [],
      dosageAlerts: [],
      confidence: 0.93,
    }));
  });
}).listen(port, () => console.log(`mock AI listening on http://127.0.0.1:${port}/analyze`));
