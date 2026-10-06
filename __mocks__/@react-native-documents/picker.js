// Manual Jest mock — the real module resolves its TurboModule at import
// time, which throws outside a native runtime.
module.exports = {
  __esModule: true,
  pick: jest.fn().mockResolvedValue([{ uri: 'content://mock/backup.db', name: 'backup.db' }]),
  keepLocalCopy: jest.fn().mockResolvedValue([{ status: 'success', sourceUri: 'content://mock/backup.db', localUri: 'file:///mock/backup.db' }]),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: jest.fn().mockReturnValue(false),
};
