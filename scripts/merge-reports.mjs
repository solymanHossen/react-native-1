import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (file, fallback) => {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) : fallback;
};
const policy = readJson('reports/policy-checks.json', { results: [] });
const secrets = readJson('reports/secret-scan.json', { status: 'NOT_RUN', findings: [] });
const dependencies = readJson('reports/dependency-audit.json', { status: 'NOT_RUN', counts: {} });
const testCases = readJson('audit/test-cases.json', []);
const checks = [...policy.results.map((item) => ({ ...item, source: 'policy' })), {
  id: 'SEC-SECRET-SCAN',
  title: 'Tracked secret scan',
  status: secrets.status,
  severity: 'critical',
  evidence: secrets.findings.length ? `${secrets.findings.length} finding(s)` : 'No supported secret patterns found',
  source: 'secret-scan',
}, {
  id: 'SEC-DEPENDENCY-AUDIT',
  title: 'npm dependency vulnerability audit',
  status: dependencies.status,
  severity: 'high',
  evidence: `${dependencies.counts.high ?? 0} high, ${dependencies.counts.critical ?? 0} critical, ${dependencies.counts.moderate ?? 0} moderate`,
  source: 'npm-audit',
}];
const failures = [...checks, ...testCases].filter((item) => ['FAIL', 'BLOCKED', 'REVIEW_REQUIRED'].includes(item.status));
const gate = failures.some((item) => item.status === 'FAIL' && ['critical', 'high'].includes(item.severity))
  ? 'FAIL'
  : failures.some((item) => item.status === 'BLOCKED')
    ? 'BLOCKED'
    : failures.length
      ? 'REVIEW_REQUIRED'
      : 'READY_FOR_SUBMISSION';
const report = {
  auditDate: new Date().toISOString(),
  projectVersion: readJson('package.json', {}).version ?? 'unknown',
  runtime: { node: process.version, platform: process.platform, iosBuildAvailable: false },
  gate,
  checks,
  testCases,
  limitations: [
    'iOS build/archive was not run because Xcode is unavailable on Linux.',
    'Android release build requires production signing configuration before it can be a submission artifact.',
    'Store metadata, privacy policy URL, Data Safety answers, and reviewer access require manual confirmation.',
  ],
};
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/app-readiness-report.json'), JSON.stringify(report, null, 2));
const lines = [
  '# App Store Readiness Audit',
  '',
  `- Audit date: ${report.auditDate}`,
  `- Project version: ${report.projectVersion}`,
  `- Environment: ${report.runtime.platform}, Node ${report.runtime.node}`,
  `- Current release gate: **${report.gate}**`,
  '',
  '## Automated checks',
  '',
  '| ID | Severity | Status | Finding | Evidence |',
  '|---|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.severity} | ${item.status} | ${item.title} | ${item.evidence} |`),
  '',
  '## Test catalog',
  '',
  '| ID | Platform | Severity | Status | Title |',
  '|---|---|---|---|---|',
  ...testCases.map((item) => `| ${item.id} | ${item.platform} | ${item.severity} | ${item.status} | ${item.title} |`),
  '',
  '## Outstanding limitations',
  '',
  ...report.limitations.map((item) => `- ${item}`),
  '',
  'This report records checks actually performed; it is not a prediction or guarantee of store approval.',
];
fs.writeFileSync(path.join(root, 'reports/app-readiness-report.md'), `${lines.join('\n')}\n`);
console.log(`Release gate: ${gate}`);
