const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 41837;
const BASE = `http://127.0.0.1:${PORT}`;

async function req(method, endpoint, { token, body, headers = {} } = {}) {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null };
}

async function main() {
  console.log('=== VERIFYING END-TO-END HTTP API ANALYSIS ===\n');

  // 1. Authenticate
  const login = await req('POST', '/api/auth/login', {
    body: { email: 'dealer@pharmachain.com', password: 'dealer123' },
  });
  if (login.status !== 200 || !login.cookie || login.data.token) {
    console.error('Login failed:', login.data);
    process.exit(1);
  }
  const token = login.cookie;
  console.log('✓ Logged in as pharmacy (HttpOnly session cookie set)');

  // 2. Test Prescriptions A, B, C through Express API
  const testImages = [
    { label: 'Prescription A', file: 'rx-sample-a.png', patient: 'Rahul Verma', ref: 'PT-101' },
    { label: 'Prescription B', file: 'rx-sample-b.png', patient: 'Priya Sharma', ref: 'PT-102' },
    { label: 'Prescription C', file: 'rx-sample-c.png', patient: 'Vikram Malhotra', ref: 'PT-103' },
  ];

  const results = [];

  for (const t of testImages) {
    console.log(`\n--- Testing ${t.label} via API ---`);

    // Create record
    const create = await req('POST', '/api/prescriptions', {
      token,
      body: {
        patientReference: t.ref,
        prescriptionDate: '2026-09-24',
        patientAge: 30,
        patientGender: 'male',
      },
    });
    const pid = create.data.prescriptionId;
    console.log(`✓ Created prescription record: ${pid}`);

    // Read real image
    const imgBuf = fs.readFileSync(path.join(__dirname, '..', '..', 'public', t.file));
    const base64Data = imgBuf.toString('base64');

    // Call /api/prescriptions/:id/analyze
    console.log(`Calling POST /api/prescriptions/${pid}/analyze...`);
    const an = await req('POST', `/api/prescriptions/${pid}/analyze`, {
      token,
      body: {
        image: {
          data: base64Data,
          mimetype: 'image/png',
        },
      },
    });

    console.log(`Analyze HTTP Status: ${an.status}`);
    if (an.status !== 200) {
      console.log('Analysis response:', an.data);
      console.log(`Note: If OpenAI returned error (${an.data.error}), verify error structure.`);
    } else {
      console.log(`✓ Status: ${an.data.status}`);
      console.log(`✓ Extracted medicines count: ${an.data.medicines.length}`);
      an.data.medicines.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.name} | ${m.strength} | ${m.dosage} | ${m.frequency} | ${m.duration}`);
      });
      results.push({ label: t.label, medicines: an.data.medicines });
    }
  }

  if (results.length >= 2) {
    const aMeds = results[0].medicines.map(m => m.name).join(', ');
    const bMeds = results[1].medicines.map(m => m.name).join(', ');
    console.log('\n=== SUMMARY ===');
    console.log('Result A:', aMeds);
    console.log('Result B:', bMeds);
    if (aMeds !== bMeds) {
      console.log('✓ Verified: Different prescription images produce different medicine results!');
    }
  }
}

main().catch(console.error);
