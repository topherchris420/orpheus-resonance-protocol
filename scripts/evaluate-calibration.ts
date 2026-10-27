// Regenerates the committed calibration record. Run with `npm run evaluate`.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateDomainCalibration } from '../src/evidence/evaluation';

const SEED = 'orpheus-calibration-2026';
const TRIALS = 20000;

const { aware, naive } = evaluateDomainCalibration(SEED, TRIALS);
const target = path.resolve(__dirname, '../src/assistant/calibration.record.json');
writeFileSync(target, `${JSON.stringify(aware, null, 2)}\n`);
console.log(`aware-bayes-v1  ECE ${aware.ece}  Brier ${aware.brier}  coverage@${aware.threshold} ${aware.coverage}  selective accuracy ${aware.selectiveAccuracy}`);
console.log(`naive-bayes-v1  ECE ${naive.ece}  Brier ${naive.brier}  (comparison only; never displayed)`);
console.log(`wrote ${path.relative(process.cwd(), target)}`);
