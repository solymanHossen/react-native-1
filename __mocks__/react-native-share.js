// Manual Jest mock — the real module resolves its native module at import
// time, which throws outside a native runtime.
const Share = {
  open: jest.fn().mockResolvedValue({ success: true }),
};

module.exports = {
  __esModule: true,
  default: Share,
};
