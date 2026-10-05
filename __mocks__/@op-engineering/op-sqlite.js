// Manual Jest mock for @op-engineering/op-sqlite — the real module touches
// its native TurboModule at import time ("Base module not found"), which
// throws outside a native runtime.
//
// isSQLCipher() returning false makes src/db/client.ts's own startup guard
// throw its readable "not compiled with SQLCipher" error, which
// initializeDatabase() surfaces as a caught rejection — so the render smoke
// test exercises this app's own error-handling path instead of needing a
// full fake SQL engine.
module.exports = {
  __esModule: true,
  isSQLCipher: jest.fn().mockReturnValue(false),
  isLibsql: jest.fn().mockReturnValue(false),
  isTurso: jest.fn().mockReturnValue(false),
  open: jest.fn(),
  openAsync: jest.fn(),
  moveAssetsDatabase: jest.fn().mockResolvedValue(false),
};
