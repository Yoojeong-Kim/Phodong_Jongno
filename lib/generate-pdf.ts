// PDF 다운로드 유틸리티 – jsPDF만 사용 (html2canvas 불필요)
// A4 가로 (landscape): 297 × 210 mm

export interface PdfStoryPage {
  title: string;
  text: string;
  image_url?: string;
}

export interface PdfStoryData {
  title: string;
  child_name: string;
  genre: string;
  object_name: string;
  pages: PdfStoryPage[];
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fillRect(doc: any, x: number, y: number, w: number, h: number, hex: string) {
  doc.setFillColor(hex);
  doc.rect(x, y, w, h, 'F');
}

export async function downloadStoryPdf(story: PdfStoryData) {
  const { jsPDF } = await import('jspdf');

  const W = 297;
  const H = 210;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PINK      = '#f55f91';
  const DARK      = '#3d2940';
  const SOFT_PINK = '#fff0f5';
  const MID_PINK  = '#ffe2ec';
  const TEXT_COLOR = '#432e3a';

  // ── 표지 ──────────────────────────────────────────────────────
  {
    const imgUrl = story.pages[0]?.image_url;
    if (imgUrl) {
      const dataUrl = await loadImageDataUrl(imgUrl);
      if (dataUrl) {
        doc.addImage(dataUrl, 'JPEG', 0, 0, W / 2, H);
        doc.setFillColor(0, 0, 0);
        doc.setGState(doc.GState({ opacity: 0.38 }));
        doc.rect(0, 0, W / 2, H, 'F');
        doc.setGState(doc.GState({ opacity: 1 }));
      }
    }
    fillRect(doc, W / 2, 0, W / 2, H, SOFT_PINK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(DARK);
    const titleLines = doc.splitTextToSize(story.title, W / 2 - 28);
    doc.text(titleLines, W * 3 / 4, H / 2 - 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(PINK);
    doc.text(`${story.child_name}의 ${story.genre} 동화`, W * 3 / 4, H / 2 + titleLines.length * 12 + 4, { align: 'center' });
  }

  // ── 스토리 페이지 5장 ─────────────────────────────────────────
  for (let i = 0; i < story.pages.length; i++) {
    const p = story.pages[i];
    doc.addPage();

    if (p.image_url) {
      const dataUrl = await loadImageDataUrl(p.image_url);
      if (dataUrl) {
        doc.addImage(dataUrl, 'JPEG', 0, 0, W / 2, H);
      } else {
        fillRect(doc, 0, 0, W / 2, H, MID_PINK);
      }
    } else {
      fillRect(doc, 0, 0, W / 2, H, MID_PINK);
    }

    fillRect(doc, W / 2, 0, W / 2, H, '#fffdfb');
    doc.setDrawColor(MID_PINK);
    doc.setLineWidth(0.5);
    doc.line(W / 2, 0, W / 2, H);

    const PX = W / 2 + 14;
    const PW = W / 2 - 28;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PINK);
    doc.text(`${story.child_name}의 ${story.genre} 동화`, PX, 20);
    doc.setFontSize(9);
    doc.text(`${i + 1} / ${story.pages.length}`, W - 14, 14, { align: 'right' });

    const pageTitle = i === 0 ? story.title : p.title;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(i === 0 ? 19 : 15);
    doc.setTextColor(DARK);
    const titleLines = doc.splitTextToSize(pageTitle, PW);
    doc.text(titleLines, PX, 32);

    const lineY = 32 + titleLines.length * (i === 0 ? 8 : 6.5) + 5;
    doc.setDrawColor(MID_PINK);
    doc.setLineWidth(0.4);
    doc.line(PX, lineY, PX + PW, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(TEXT_COLOR);
    const bodyLines = doc.splitTextToSize(p.text, PW);
    doc.text(bodyLines, PX, lineY + 10, { lineHeightFactor: 1.75 });
  }

  // ── 뒷 표지 ──────────────────────────────────────────────────
  {
    doc.addPage();
    const lastImg = story.pages[story.pages.length - 1]?.image_url;
    if (lastImg) {
      const dataUrl = await loadImageDataUrl(lastImg);
      if (dataUrl) {
        doc.addImage(dataUrl, 'JPEG', 0, 0, W / 2, H);
        doc.setFillColor(0, 0, 0);
        doc.setGState(doc.GState({ opacity: 0.45 }));
        doc.rect(0, 0, W / 2, H, 'F');
        doc.setGState(doc.GState({ opacity: 1 }));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor('#ffffff');
        doc.text('포동이와 함께한 모험, 어땠어?', W / 4, H - 44, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`우리가 고른 ${story.genre} 세상에서 멋진 일들이 있었지!`, W / 4, H - 30, { align: 'center' });
      }
    }
    fillRect(doc, W / 2, 0, W / 2, H, SOFT_PINK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(DARK);
    doc.text(`소중한 물건: ${story.object_name}`, W * 3 / 4, H / 2 - 6, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(PINK);
    doc.text(`${story.child_name}의 ${story.genre} 동화`, W * 3 / 4, H / 2 + 10, { align: 'center' });
  }

  const safeName = story.title.replace(/\s+/g, '_') || 'story';
  doc.save(`${safeName}_동화.pdf`);
}
