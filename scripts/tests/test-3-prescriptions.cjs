const fs = require('fs');
const path = require('path');
const analyzer = require('../../server/services/huggingfacePrescriptionAnalyzer.cjs');

async function testAll() {
  console.log('=== TESTING REAL PRESCRIPTION ANALYSIS PIPELINE ===\n');
  const provider = analyzer._internal.resolveProvider();
  console.log('Active Provider:', provider ? `${provider.label} (${provider.model})` : 'NONE');

  const files = [
    { name: 'Prescription A (Rahul Verma)', path: path.join(__dirname, '../../public/rx-sample-a.png') },
    { name: 'Prescription B (Priya Sharma)', path: path.join(__dirname, '../../public/rx-sample-b.png') },
    { name: 'Prescription C (Vikram Malhotra)', path: path.join(__dirname, '../../public/rx-sample-c.png') },
  ];

  const results = [];

  for (const f of files) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Analyzing: ${f.name}`);
    const buf = fs.readFileSync(f.path);
    console.log(`File size: ${buf.length} bytes`);

    const result = await analyzer.analyzeImage(buf, 'image/png');
    console.log(`\n[RESULT for ${f.name}]:`);
    console.log(`Doctor:`, result.doctor);
    console.log(`Patient:`, result.patient);
    console.log(`Date:`, result.prescription_date);
    console.log(`Medicines Extracted (${result.medicines.length}):`);
    result.medicines.forEach((m, idx) => {
      console.log(`  ${idx + 1}. ${m.name} | Strength: ${m.strength} | Dosage: ${m.dosage} | Freq: ${m.frequency} | Dur: ${m.duration}`);
    });
    console.log(`Overall Confidence: ${(result.overall_confidence * 100).toFixed(1)}%`);

    results.push({ name: f.name, result });
  }

  console.log('\n==================================================');
  console.log('=== VERIFYING DYNAMIC DIVERSITY (NO MOCK DATA) ===');
  const medNamesA = results[0].result.medicines.map(m => (m.name || '').toLowerCase()).sort().join(',');
  const medNamesB = results[1].result.medicines.map(m => (m.name || '').toLowerCase()).sort().join(',');
  const medNamesC = results[2].result.medicines.map(m => (m.name || '').toLowerCase()).sort().join(',');

  console.log('Meds A:', medNamesA);
  console.log('Meds B:', medNamesB);
  console.log('Meds C:', medNamesC);

  if (medNamesA !== medNamesB && medNamesB !== medNamesC && medNamesA !== medNamesC) {
    console.log('\n>>> SUCCESS: All 3 prescriptions produced completely distinct, dynamic results! <<<');
  } else {
    console.error('\n>>> ERROR: Duplicate or identical results detected! <<<');
    process.exit(1);
  }
}

testAll().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
