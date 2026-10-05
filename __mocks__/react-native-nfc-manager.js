// Manual Jest mock for react-native-nfc-manager — the real module touches
// its native module at import time, which throws outside a native runtime.
// Covers only what src/alarms/nfcVerification.ts actually calls.
const NfcManager = {
  start: jest.fn().mockResolvedValue(undefined),
  isSupported: jest.fn().mockResolvedValue(false),
  isEnabled: jest.fn().mockResolvedValue(false),
  registerTagEvent: jest.fn().mockResolvedValue(undefined),
  unregisterTagEvent: jest.fn().mockResolvedValue(undefined),
  setEventListener: jest.fn(),
  requestTechnology: jest.fn().mockResolvedValue(null),
  getTag: jest.fn().mockResolvedValue(null),
  cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),
};

module.exports = {
  __esModule: true,
  default: NfcManager,
  NfcEvents: { DiscoverTag: 'NfcManagerDiscoverTag', SessionClosed: 'NfcManagerSessionClosed', StateChanged: 'NfcManagerStateChanged' },
  NfcTech: {
    Ndef: 'Ndef',
    NfcA: 'NfcA',
    NfcB: 'NfcB',
    NfcF: 'NfcF',
    NfcV: 'NfcV',
    IsoDep: 'IsoDep',
    MifareClassic: 'MifareClassic',
    MifareUltralight: 'MifareUltralight',
  },
};
