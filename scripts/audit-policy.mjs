import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
const check = (id, title, status, severity, evidence, recommendation = null) =>
  results.push({ id, title, status, severity, evidence, recommendation });

const gradle = read('android/build.gradle');
const appGradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const plist = read('ios/myApp/Info.plist');
const privacy = fs.existsSync(path.join(root, 'ios/myApp/PrivacyInfo.xcprivacy'));
const packageJson = JSON.parse(read('package.json'));

const target = Number(gradle.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1] ?? 0);
check(
  'POLICY-ANDROID-TARGET',
  'Android target API',
  target >= 35 ? 'PASS' : 'FAIL',
  target >= 35 ? 'high' : 'critical',
  `targetSdkVersion=${target}`,
  'Verify the current Play target API requirement before submission.',
);

const debugSigning = /signingConfig\s+signingConfigs\.debug/.test(appGradle.match(/release\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '');
check(
  'POLICY-ANDROID-SIGNING',
  'Android release signing',
  debugSigning ? 'FAIL' : 'PASS',
  'critical',
  debugSigning ? 'release build uses signingConfigs.debug' : 'release build does not use debug signing',
  debugSigning ? 'Configure a production keystore through CI secrets and remove the debug fallback.' : null,
);

const cleartext = /usesCleartextTraffic="\$\{usesCleartextTraffic\}"/.test(manifest) && /usesCleartextTraffic\s*=\s*false/.test(read('android/gradle.properties'));
check('POLICY-CLEARTEXT', 'Cleartext transport disabled', cleartext ? 'PASS' : 'REVIEW_REQUIRED', 'high', `manifest placeholder present; explicit property=${cleartext}`);

check(
  'POLICY-IOS-PRIVACY',
  'Apple privacy manifest exists',
  privacy ? 'PASS' : 'FAIL',
  'high',
  privacy ? 'ios/myApp/PrivacyInfo.xcprivacy exists' : 'PrivacyInfo.xcprivacy is missing',
  privacy ? null : 'Add the required privacy manifest and API-reason declarations.',
);

const cameraPurpose = /NSCameraUsageDescription[\s\S]*?prescription/.test(plist);
check('POLICY-CAMERA-PURPOSE', 'Camera purpose string', cameraPurpose ? 'PASS' : 'FAIL', 'high', cameraPurpose ? 'Camera purpose explains prescription scanning' : 'Camera purpose is missing or vague');

const versioned = packageJson.version && /versionCode\s+\d+/.test(appGradle) && /MARKETING_VERSION\s*=\s*[\d.]+/.test(read('ios/myApp.xcodeproj/project.pbxproj'));
check('POLICY-VERSION', 'Version metadata', versioned ? 'PASS' : 'REVIEW_REQUIRED', 'medium', `package=${packageJson.version}`);

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/policy-checks.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify({ results }, null, 2));
if (results.some((result) => result.status === 'FAIL' && result.severity === 'critical')) process.exitCode = 2;
