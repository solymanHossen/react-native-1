import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
];
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const findings = [];
for (const file of tracked) {
  if (file.includes('node_modules') || file.includes('debug.keystore')) continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [name, pattern] of patterns) {
    if (pattern.test(content)) findings.push({ type: name, file });
  }
}
const result = { generatedAt: new Date().toISOString(), status: findings.length ? 'FAIL' : 'PASS', findings };
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/secret-scan.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 2;
