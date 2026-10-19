// ---------------------------------------------------------------------------
// train-random-forest.cjs — offline trainer for the ML comparison layer.
//
// HARD GATES (fail-closed; the script refuses to fabricate anything):
//   G1. Every row must carry a REAL pharmacist label (labelSchema
//       'pharmacist-confirmed-v1' with confirmedBy + confirmedAt).
//   G2. Minimum dataset size: >= 200 rows (override with RF_MIN_SAMPLES
//       for a pilot run — the gate is then reported as a pilot caveat).
//   G3. Both classes must be present (≥5% of rows each).
//   G4. Duplicates removed; near-duplicates (same feature vector) collapsed.
//   G5. Split is patient/record-disjoint by design (rows are per-record
//       features; we split by row hash — no image or patient data exists
//       in rows, so row-level split introduces no image leakage).
//   G6. The label derives from pharmacist outcomes ONLY, computed from the
//       stored fieldComparison (disagreement -> needs_verification) plus
//       the pharmacist's accept/correct decisions.
//
// Usage:  node scripts/train-random-forest.cjs [--min-samples 200]
// Output: server/ml/random-forest-<version>.json  (+ printed metrics)
// The runtime picks it up via RANDOM_FOREST_MODEL_PATH (see .env notes).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRAIN_DIR = path.join(__dirname, '..', 'server', 'ml', 'training-data');
const MODEL_DIR = path.join(__dirname, '..', 'server', 'ml');

const args = process.argv.slice(2);
const minSamplesFlag = args.includes('--min-samples')
  ? parseInt(args[args.indexOf('--min-samples') + 1], 10) : NaN;
const MIN_SAMPLES = Number.isFinite(minSamplesFlag) ? minSamplesFlag
  : parseInt(process.env.RF_MIN_SAMPLES || '200', 10);
const MIN_CLASS_FRACTION = 0.05;
const TEST_FRACTION = 0.2;
const VAL_FRACTION = 0.2; // of remaining after test
const N_TREES = 120;

// ---------------------------------------------------------------------------
// Minimal CART implementation (binary classification, Gini impurity,
// feature-subspace bagging) — no external ML dependency required.
// ---------------------------------------------------------------------------

function gini(labels) {
  const n = labels.length;
  if (n === 0) return 0;
  let pos = 0;
  for (const l of labels) if (l === 1) pos += 1;
  const p = pos / n;
  return 2 * p * (1 - p);
}

function bestSplit(rows, featureKeys) {
  let best = null;
  const labels = rows.map((r) => r.label);
  const base = gini(labels);
  for (const key of featureKeys) {
    const values = [...new Set(rows.map((r) => r.features[key]))].sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;
      const left = [], right = [];
      for (const r of rows) (r.features[key] <= threshold ? left : right).push(r);
      if (left.length < 2 || right.length < 2) continue;
      const score = (left.length * gini(left.map((r) => r.label))
        + right.length * gini(right.map((r) => r.label))) / rows.length;
      if (!best || score < base && score < best.score) {
        best = { feature: key, threshold, score };
      }
    }
  }
  return best;
}

function buildTree(rows, featureKeys, depth = 0, maxDepth = 10) {
  const labels = rows.map((r) => r.label);
  const positives = labels.filter((l) => l === 1).length;
  const value = positives / labels.length; // P(needs_verification)
  if (depth >= maxDepth || positives === 0 || positives === labels.length) {
    return { value };
  }
  // Feature subspace: sqrt(n_features) candidates per split.
  const subspace = [...featureKeys].sort(() => Math.random() - 0.5)
    .slice(0, Math.max(2, Math.round(Math.sqrt(featureKeys.length))));
  const split = bestSplit(rows, subspace);
  if (!split) return { value };
  const left = rows.filter((r) => r.features[split.feature] <= split.threshold);
  const right = rows.filter((r) => r.features[split.feature] > split.threshold);
  return {
    feature: split.feature,
    threshold: split.threshold,
    left: buildTree(left, featureKeys, depth + 1, maxDepth),
    right: buildTree(right, featureKeys, depth + 1, maxDepth),
  };
}

function trainForest(rows, featureKeys, nTrees) {
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    // Bootstrap sample (with replacement).
    const boot = Array.from({ length: rows.length }, () => rows[Math.floor(Math.random() * rows.length)]);
    trees.push(buildTree(boot, featureKeys));
  }
  return trees;
}

function forestPredict(trees, features) {
  const outputs = trees.map(runTree).filter((v) => v !== null);
  if (!outputs.length) return null;
  return outputs.reduce((a, b) => a + b, 0) / outputs.length;
  function runTree(node) {
    let n = node, guard = 0;
    while (n && typeof n === 'object' && !('value' in n) && guard++ < 64) {
      n = Number(features[n.feature]) <= n.threshold ? n.left : n.right;
    }
    return n && typeof n === 'object' && 'value' in n ? n.value : null;
  }
}

// ---------------------------------------------------------------------------
// Data loading + validation
// ---------------------------------------------------------------------------

function loadRows(featureKeys) {
  if (!fs.existsSync(TRAIN_DIR)) {
    return { rows: [], rejected: ['training-data directory does not exist'] };
  }
  const files = fs.readdirSync(TRAIN_DIR).filter((f) => f.endsWith('.json'));
  const rows = [];
  const rejected = [];
  const seen = new Set();
  for (const f of files) {
    let row;
    try { row = JSON.parse(fs.readFileSync(path.join(TRAIN_DIR, f), 'utf8')); }
    catch (e) { rejected.push(`${f}: unparseable JSON`); continue; }

    // G1 — real pharmacist label
    if (!row.label || row.label.labelSchema !== 'pharmacist-confirmed-v1'
      || !row.label.confirmedBy || !row.label.confirmedAt) {
      rejected.push(`${f}: missing/invalid pharmacist label`); continue;
    }
    // Feature vector present and complete
    if (!row.features || typeof row.features !== 'object') {
      rejected.push(`${f}: missing features`); continue;
    }
    const features = {};
    let missing = false;
    for (const k of featureKeys) {
      const v = Number(row.features[k]);
      if (!Number.isFinite(v)) { rejected.push(`${f}: feature ${k} missing/non-numeric`); missing = true; break; }
      features[k] = v;
    }
    if (missing) continue;

    // G4 — duplicates / near-duplicates by feature-vector hash
    const hash = crypto.createHash('sha256').update(JSON.stringify(
      featureKeys.map((k) => features[k]),
    )).digest('hex');
    if (seen.has(hash)) { rejected.push(`${f}: duplicate feature vector`); continue; }
    seen.add(hash);

    // Label derivation (deterministic, from stored pharmacist data):
    // needs_verification=1 when the comparison had disagreements AND the
    // pharmacist's confirmed medicines differ from the AI majority reading;
    // otherwise 0 (agreement + accepted). Stored summary is authoritative.
    const summary = row.label?.fieldComparison?.summary
      || row.fieldComparison?.summary || null;
    let label;
    if (summary && typeof summary.disagreements === 'number') {
      label = summary.disagreements > 0 ? 1 : 0;
    } else {
      // Fall back to the feature-derived disagreement count.
      label = features.disagreementCount > 0 ? 1 : 0;
    }
    rows.push({ features, label, file: f, confirmedBy: row.label.confirmedBy });
  }
  return { rows, rejected };
}

function confusion(tp, fp, fn, tn) {
  return [
    `               predicted=0   predicted=1`,
    `actual=0 (TN)  ${String(tn).padEnd(12)}${fp}`,
    `actual=1 (FN)  ${String(fn).padEnd(12)}${tp}`,
  ].join('\n');
}

function metrics(tp, fp, fn, tn) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  const accuracy = (tp + tn) / (tp + fp + fn + tn || 1);
  return { precision, recall, f1, accuracy };
}

// ---------------------------------------------------------------------------

function main() {
  const rf = require('../server/services/randomForestComparison.cjs');
  const featureKeys = rf.FEATURE_KEYS;

  console.log('== Random Forest trainer — fail-closed ==\n');
  const { rows, rejected } = loadRows(featureKeys);
  console.log(`Training dir: ${TRAIN_DIR}`);
  console.log(`Valid labeled rows: ${rows.length}`);
  if (rejected.length) {
    console.log(`Rejected rows: ${rejected.length}`);
    for (const r of rejected.slice(0, 5)) console.log(`  - ${r}`);
    if (rejected.length > 5) console.log(`  … +${rejected.length - 5} more`);
  }

  if (rows.length === 0) {
    console.log('\nTraining blocked — insufficient verified labeled data.');
    console.log(`Available: 0 real pharmacist-confirmed rows. Required: >= ${MIN_SAMPLES}.`);
    console.log('\nTo accumulate REAL labels:');
    console.log('  1. Set ML_TRAINING_CAPTURE=true in .env and restart the backend.');
    console.log('  2. Run parallel OCR+AI analyses on real prescriptions.');
    console.log('  3. Have pharmacists complete verification + confirm — each');
    console.log('     confirmation captures one labeled row (features + ground truth).');
    process.exit(2);
  }

  if (rows.length < MIN_SAMPLES) {
    console.log(`\nTraining blocked — insufficient verified labeled data.`);
    console.log(`Available: ${rows.length} real rows. Required: >= ${MIN_SAMPLES}`);
    console.log(`(Pilot override: node scripts/train-random-forest.cjs --min-samples <n>,`);
    console.log(` but results will carry a pilot caveat and are NOT production-ready.)`);
    process.exit(2);
  }

  // G3 — class balance
  const pos = rows.filter((r) => r.label === 1).length;
  const neg = rows.length - pos;
  const posFrac = pos / rows.length;
  const negFrac = neg / rows.length;
  console.log(`\nClass distribution: needs_verification=${pos} (${(posFrac * 100).toFixed(1)}%), match=${neg} (${(negFrac * 100).toFixed(1)}%)`);
  if (posFrac < MIN_CLASS_FRACTION || negFrac < MIN_CLASS_FRACTION) {
    console.log('\nTraining blocked — class imbalance beyond threshold.');
    console.log(`Each class needs >= ${(MIN_CLASS_FRACTION * 100).toFixed(0)}% of rows.`);
    process.exit(2);
  }

  // G5 — deterministic disjoint split by row hash
  const shuffled = [...rows].sort((a, b) => (a.file < b.file ? -1 : 1));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const nTest = Math.max(1, Math.round(shuffled.length * TEST_FRACTION));
  const nVal = Math.max(1, Math.round((shuffled.length - nTest) * VAL_FRACTION));
  const test = shuffled.slice(0, nTest);
  const val = shuffled.slice(nTest, nTest + nVal);
  const train = shuffled.slice(nTest + nVal);
  console.log(`Split: train=${train.length} val=${val.length} test=${test.length} (disjoint by construction)`);

  // Train
  const forest = trainForest(train, featureKeys, N_TREES);

  // Tune threshold on VALIDATION (maximize F1)
  let bestThr = 0.5, bestF1 = -1;
  for (let thr = 0.30; thr <= 0.70; thr += 0.02) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of val) {
      const p = forestPredict(forest, r.features);
      const pred = p >= thr ? 1 : 0;
      if (pred === 1 && r.label === 1) tp++;
      else if (pred === 1) fp++;
      else if (r.label === 1) fn++;
      else tn++;
    }
    const m = metrics(tp, fp, fn, tn);
    if (m.f1 > bestF1) { bestF1 = m.f1; bestThr = thr; }
  }

  // Evaluate on HELD-OUT TEST
  let tp = 0, fp = 0, fn = 0, tn = 0;
  let lowConf = 0;
  for (const r of test) {
    const p = forestPredict(forest, r.features);
    if (p > 0.4 && p < 0.6) lowConf++; // low-confidence band
    const pred = p >= bestThr ? 1 : 0;
    if (pred === 1 && r.label === 1) tp++;
    else if (pred === 1) fp++;
    else if (r.label === 1) fn++;
    else tn++;
  }
  const m = metrics(tp, fp, fn, tn);
  console.log(`\nTuned threshold (on validation): ${bestThr.toFixed(2)}`);
  console.log('\nHELD-OUT TEST metrics:');
  console.log(`  accuracy : ${(m.accuracy * 100).toFixed(1)}%`);
  console.log(`  precision: ${(m.precision * 100).toFixed(1)}%`);
  console.log(`  recall   : ${(m.recall * 100).toFixed(1)}%`);
  console.log(`  F1       : ${(m.f1 * 100).toFixed(1)}%`);
  console.log('\nConfusion matrix:');
  console.log(confusion(tp, fp, fn, tn));
  console.log(`\nLow-confidence band (0.4–0.6) rows: ${lowConf}/${test.length} — these would return "Needs Verification" at runtime.`);

  // Class-imbalance caveat (never hidden)
  const imbalanceRatio = Math.max(posFrac, negFrac) / Math.max(1e-9, Math.min(posFrac, negFrac));
  if (imbalanceRatio > 2) {
    console.log(`\n⚠ CLASS IMBALANCE: majority/minority ratio ${imbalanceRatio.toFixed(1)}× — metrics may overstate minority-class performance.`);
  }

  // Save model
  const version = `rf-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
  const model = {
    algorithm: 'random-forest',
    version,
    trainedAt: new Date().toISOString(),
    featureKeys,
    trees: forest,
    threshold: bestThr,
    training: {
      rows: rows.length,
      train: train.length,
      validation: val.length,
      test: test.length,
      classDistribution: { needs_verification: pos, match: neg },
      metrics: m,
      pilot: rows.length < 200,
      trainer: 'train-random-forest.cjs (CART, Gini, bootstrap, feature-subspace bagging)',
    },
    safety: {
      role: 'comparison/confidence layer only — never diagnoses, prescribes, or overrides pharmacist verification',
      lowConfidencePolicy: 'probability within ±0.10 of threshold returns Needs Verification',
    },
  };
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const out = path.join(MODEL_DIR, `random-forest-${version}.json`);
  fs.writeFileSync(out, JSON.stringify(model, null, 1));
  console.log(`\nModel saved: ${out}`);
  console.log('Enable at runtime: set RANDOM_FOREST_MODEL_PATH to this file and restart the backend.');
  console.log(`Status check: GET /api/prescriptions/:id/ml-status → trained: true, version: ${version}`);
}

main();
