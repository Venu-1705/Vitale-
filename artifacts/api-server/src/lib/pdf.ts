// =============================================================================
// Vitalé — minimal, dependency-free PDF writer (invoice rendering)
// -----------------------------------------------------------------------------
// Finding #3 remediation. The invoice endpoint previously sent UTF-8 text under a
// `Content-Type: application/pdf` header — a malformed response that any PDF viewer
// rejects. Rather than pull in a heavyweight PDF dependency (pdfkit/puppeteer) into
// an otherwise dependency-light service, we emit a *genuinely valid* single-page PDF
// (PDF 1.4) built by hand: header → 5 objects (catalog, pages, page, font, content
// stream) → byte-accurate xref table → trailer. The result opens in any conformant
// reader and `file(1)` identifies it as a PDF document.
//
// Scope: plain text lines in the standard-14 Helvetica font. The standard 14 fonts
// carry no rupee (₹) glyph, so amounts are rendered as "INR " — a deliberate,
// documented substitution (embedding a Unicode font is out of scope here). All text
// is reduced to printable Latin-1; offsets are computed in BYTES (not string length)
// so multi-byte input can never corrupt the xref table.
// =============================================================================

/** Escape the three characters that are special inside a PDF literal string. */
function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Reduce to printable Latin-1; the standard-14 fonts have no ₹ glyph → "INR ". */
function toLatin1(s: string): string {
  return s.replace(/₹/g, "INR ").replace(/[^\x20-\x7E]/g, "?");
}

/**
 * Build a valid single-page PDF (one text column) from a list of lines.
 * Returns the raw bytes ready to write to the HTTP response.
 */
export function buildTextPdf(lines: string[]): Buffer {
  const fontSize = 10;
  const leading = 14; // line height for the T* operator
  const startX = 50;
  const startY = 800; // top of an A4 page (MediaBox height 842)

  const textBody = lines
    .map((l) => `(${escapePdfText(toLatin1(l))}) Tj T*`)
    .join("\n");
  const content = `BT /F1 ${fontSize} Tf ${startX} ${startY} Td ${leading} TL\n${textBody}\nET`;
  const contentLen = Buffer.byteLength(content, "latin1");

  // The 5 indirect objects (1-based; object N is "N 0 obj").
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Length ${contentLen} >>\nstream\n${content}\nendstream`,
  ];

  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (s: string) => {
    const b = Buffer.from(s, "latin1");
    chunks.push(b);
    offset += b.length;
  };

  push("%PDF-1.4\n");

  const xrefOffsets: number[] = [];
  objects.forEach((obj, i) => {
    xrefOffsets[i] = offset; // byte offset of the start of "N 0 obj"
    push(`${i + 1} 0 obj\n${obj}\nendobj\n`);
  });

  const startxref = offset;
  const pad10 = (n: number) => n.toString().padStart(10, "0");
  // Each xref entry is exactly 20 bytes (10-digit offset, gen, type, two spaces, EOL).
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of xrefOffsets) xref += `${pad10(o)} 00000 n \n`;
  xref +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${startxref}\n%%EOF\n`;
  push(xref);

  return Buffer.concat(chunks);
}
