# App Store Readiness Audit

- Audit date: 2026-10-09T12:44:51.461Z
- Project version: 0.0.1
- Environment: linux, Node v20.20.0
- Current release gate: **FAIL**

## Automated checks

| ID | Severity | Status | Finding | Evidence |
|---|---|---|---|---|
| POLICY-ANDROID-TARGET | high | PASS | Android target API | targetSdkVersion=36 |
| POLICY-ANDROID-SIGNING | critical | FAIL | Android release signing | release build uses signingConfigs.debug |
| POLICY-CLEARTEXT | high | REVIEW_REQUIRED | Cleartext transport disabled | manifest placeholder present; explicit property=false |
| POLICY-IOS-PRIVACY | high | PASS | Apple privacy manifest exists | ios/myApp/PrivacyInfo.xcprivacy exists |
| POLICY-CAMERA-PURPOSE | high | PASS | Camera purpose string | Camera purpose explains prescription scanning |
| POLICY-VERSION | medium | PASS | Version metadata | package=0.0.1 |
| SEC-SECRET-SCAN | critical | PASS | Tracked secret scan | No supported secret patterns found |
| SEC-DEPENDENCY-AUDIT | high | FAIL | npm dependency vulnerability audit | 57 high, 0 critical, 12 moderate |

## Test catalog

| ID | Platform | Severity | Status | Title |
|---|---|---|---|---|
| FUNC-001 | both | high | PASS | Cold start and database initialization |
| FUNC-002 | both | high | PASS | Medication course and alarm policy |
| FUNC-003 | both | high | PASS | Prescription parsing and review |
| FUNC-004 | both | medium | REVIEW_REQUIRED | Camera and gallery permission denial |
| SEC-001 | both | critical | FAIL | Release signing does not use debug credentials |
| PRIV-001 | both | high | REVIEW_REQUIRED | Permission purpose and disclosure review |
| REL-001 | android | high | BLOCKED | Android release artifact |
| REL-002 | ios | high | BLOCKED | iOS archive and signing |

## Outstanding limitations

- iOS build/archive was not run because Xcode is unavailable on Linux.
- Android release build requires production signing configuration before it can be a submission artifact.
- Store metadata, privacy policy URL, Data Safety answers, and reviewer access require manual confirmation.

This report records checks actually performed; it is not a prediction or guarantee of store approval.
