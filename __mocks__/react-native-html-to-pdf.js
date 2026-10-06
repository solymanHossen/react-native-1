// Manual Jest mock — the real module resolves its TurboModule at import
// time, which throws outside a native runtime.
module.exports = {
  __esModule: true,
  generatePDF: jest.fn().mockResolvedValue({ filePath: '/mock/medius-health-report.pdf' }),
};
