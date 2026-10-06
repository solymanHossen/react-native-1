import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { buildClinicalReportData } from './reportData';
import { buildClinicalReportHtml } from './reportTemplate';

/** Compiles the clinical report and writes it to a PDF on-device. Pure generation, no share sheet — kept separate so a future caller (e.g. silently refreshing a cached copy) doesn't have to also trigger UI. */
export async function generateClinicalReportPdf(): Promise<string> {
  const data = await buildClinicalReportData();
  const html = buildClinicalReportHtml(data);
  const result = await generatePDF({
    html,
    fileName: `medius-health-report-${Date.now()}`,
    base64: false,
    // Without this, WebView print defaults strip background colors/fills —
    // the adherence score card and demographics panel would render as plain
    // unstyled text blocks instead of the designed layout.
    shouldPrintBackgrounds: true,
  });
  if (!result.filePath) {
    throw new Error('PDF generation did not return a file path.');
  }
  return result.filePath;
}

/** Hands the generated PDF to the OS share sheet — WhatsApp, email, Drive, or the system print dialog are all just share targets from here, not separate integrations this app has to build. */
export async function shareClinicalReportPdf(filePath: string): Promise<void> {
  await Share.open({
    url: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
    type: 'application/pdf',
    failOnCancel: false,
  });
}
