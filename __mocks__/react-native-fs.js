// Manual Jest mock — the real module resolves its native module at import
// time, which throws outside a native runtime. Covers only what this app's
// src/vault/vaultBackup.ts actually calls.
module.exports = {
  __esModule: true,
  default: {
    CachesDirectoryPath: '/mock/caches',
    DocumentDirectoryPath: '/mock/documents',
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
  },
};
