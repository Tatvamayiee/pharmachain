const { datasetReport } = require('../../server/services/trainingData.cjs');

const report = datasetReport();
console.log('RANDOM FOREST TRAINING DATA VALIDATION');
console.log(`Total rows: ${report.rawRows}`);
console.log(`Valid rows: ${report.validRows}`);
console.log(`Invalid rows: ${report.invalidRows}`);
console.log(`Duplicate rows: ${report.duplicateRows}`);
console.log(`Missing labels: ${report.missingLabels}`);
console.log(`Missing features: ${report.missingFeatures}`);
console.log(`Class distribution: match=${report.matchRows}, needs_verification=${report.needsVerificationRows}`);
console.log(`Minimum requirement: ${report.minimumRequired}`);
console.log(`Rows needed: ${report.rowsNeeded}`);
console.log(`Dataset ready: ${report.datasetReady ? 'YES' : 'NO'}`);
console.log(`Training status: ${report.trainingStatus}`);
process.exitCode = report.invalidRows || report.duplicateRows ? 1 : 0;
