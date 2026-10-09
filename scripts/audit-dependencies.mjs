import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
let audit = {};
let exitCode = 0;
try {
  audit = JSON.parse(execFileSync('npm', ['audit', '--json'], { cwd: root, encoding: 'utf8' }));
} catch (error) {
  exitCode = error.status ?? 1;
  audit = JSON.parse(error.stdout?.toString() ?? '{}');
}
const counts = audit.metadata?.vulnerabilities ?? {};
const result = {
  generatedAt: new Date().toISOString(),
  status: (counts.high ?? 0) > 0 || (counts.critical ?? 0) > 0 ? 'FAIL' : 'PASS',
  counts,
  exitCode,
};
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/dependency-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.status === 'FAIL') process.exitCode = 2;
