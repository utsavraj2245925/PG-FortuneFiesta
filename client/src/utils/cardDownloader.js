import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

/**
 * Capture an HTMLElement to an HTMLCanvasElement with high scale (DPI)
 * Pre-waits for all images, QR codes, and webfonts to settle completely.
 */
export async function captureElementToCanvas(element, scale = 3) {
  if (!element) {
    throw new Error('Element to capture is null or undefined');
  }

  // 1. Ensure all <img> tags inside element are loaded and decoded
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        // Fallback timeout in case image fails silently
        setTimeout(resolve, 800);
      });
    })
  );

  // 2. Ensure web fonts are completely ready
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  // 3. Small render tick
  await new Promise(resolve => setTimeout(resolve, 80));

  const elWidth = element.offsetWidth || 320;
  const elHeight = element.offsetHeight || 202;

  const canvas = await html2canvas(element, {
    scale: scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: elWidth,
    height: elHeight,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight,
    imageTimeout: 15000,
  });

  return canvas;
}

/**
 * Trigger browser file download from a Blob or DataURL
 */
export function triggerDownload(urlOrBlob, filename) {
  const link = document.createElement('a');
  if (typeof urlOrBlob === 'string') {
    link.href = urlOrBlob;
  } else {
    link.href = URL.createObjectURL(urlOrBlob);
  }
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof urlOrBlob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(link.href), 15000);
  }
}

/**
 * Generate A4 PDF with laid-out cards (8 cards per page or 4 side-by-side pairs)
 * Exactly matched to standard visiting/credit card geometry (85.6mm x 54mm)
 */
export function createA4PdfDocument(images, isBothSides = false) {
  // A4 portrait: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;

  if (isBothSides) {
    // Both sides side-by-side: Exactly 2 * 85.55mm = 171.1mm wide x 54mm tall
    // 4 rows per page with balanced margins
    const cardW = 171.1;
    const cardH = 54;
    const leftMargin = (pageWidth - cardW) / 2; // ~19.45mm
    const topMargin = 16;
    const rowGap = 12;

    images.forEach((imgData, idx) => {
      const posOnPage = idx % 4;

      if (idx > 0 && posOnPage === 0) {
        pdf.addPage();
      }

      const y = topMargin + posOnPage * (cardH + rowGap);
      pdf.addImage(imgData, 'JPEG', leftMargin, y, cardW, cardH, undefined, 'NONE');

      // Subtle cutting guide border
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.rect(leftMargin, y, cardW, cardH);

      // Subtle center divider for folding / cutting between Side 1 and Side 2
      pdf.setDrawColor(215, 215, 215);
      pdf.setLineDashPattern([1, 2], 0);
      pdf.line(leftMargin + cardW / 2, y, leftMargin + cardW / 2, y + cardH);
      pdf.setLineDashPattern([], 0);
    });
  } else {
    // Single side: 85.55mm x 54mm
    // 2 columns x 4 rows = 8 cards per A4 page
    const cardW = 85.55;
    const cardH = 54;
    const colGap = 8;
    const rowGap = 10;
    const totalW = cardW * 2 + colGap; // 179.1mm
    const leftMargin = (pageWidth - totalW) / 2; // ~15.45mm
    const topMargin = 16;

    images.forEach((imgData, idx) => {
      const posOnPage = idx % 8;

      if (idx > 0 && posOnPage === 0) {
        pdf.addPage();
      }

      const col = posOnPage % 2;
      const row = Math.floor(posOnPage / 2);

      const x = leftMargin + col * (cardW + colGap);
      const y = topMargin + row * (cardH + rowGap);

      pdf.addImage(imgData, 'JPEG', x, y, cardW, cardH, undefined, 'NONE');

      // Subtle cutting guide border
      pdf.setDrawColor(210, 210, 210);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, cardW, cardH);
    });
  }

  return pdf;
}

/**
 * Create Single-card sized PDF (85.55mm x 54mm, or 171.1mm x 54mm for both sides)
 */
export function createExactCardPdf(images, isBothSides = false) {
  const cardW = isBothSides ? 171.1 : 85.55;
  const cardH = 54;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [cardW, cardH],
  });

  images.forEach((imgData, idx) => {
    if (idx > 0) {
      pdf.addPage([cardW, cardH], 'landscape');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, cardW, cardH, undefined, 'NONE');
  });

  return pdf;
}
