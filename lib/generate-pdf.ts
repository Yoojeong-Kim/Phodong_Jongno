// PDF 다운로드 – 브라우저 Print API 사용
// 한글 완벽 지원 + 이미지 원본 비율 유지
// A4 가로: 297 × 210 mm

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

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgTag(url: string | undefined, alt: string) {
  if (!url) return `<div class="img-placeholder">🖼</div>`;
  return `<img src="${esc(url)}" alt="${esc(alt)}" loading="eager"/>`;
}

function buildHtml(story: PdfStoryData): string {
  const pages: string[] = [];

  // ── 표지 ──────────────────────────────────────────────────────
  pages.push(`
    <div class="page cover-page">
      <div class="img-side">
        ${imgTag(story.pages[0]?.image_url, '표지')}
      </div>
      <div class="text-side cover-text-side">
        <div class="cover-content">
          <small>${esc(story.child_name)}의 ${esc(story.genre)} 동화</small>
          <h1>${esc(story.title)}</h1>
          <p class="cover-sub">소중한 물건: ${esc(story.object_name)}</p>
        </div>
      </div>
    </div>`);

  // ── 스토리 5장 ────────────────────────────────────────────────
  story.pages.forEach((p, i) => {
    const pageTitle = i === 0 ? story.title : p.title;
    pages.push(`
      <div class="page story-page">
        <div class="img-side">
          ${imgTag(p.image_url, pageTitle)}
        </div>
        <div class="text-side">
          <small>${esc(story.child_name)}의 ${esc(story.genre)} 동화</small>
          <span class="page-num">${i + 1} / ${story.pages.length}</span>
          <h2>${esc(pageTitle)}</h2>
          <hr/>
          <p>${esc(p.text)}</p>
        </div>
      </div>`);
  });

  // ── 뒷 표지 ──────────────────────────────────────────────────
  const lastPage = story.pages[story.pages.length - 1];
  pages.push(`
    <div class="page back-page">
      <div class="img-side">
        ${imgTag(lastPage?.image_url, '뒷표지')}
        <div class="back-overlay">
          <p>포동이와 함께한 모험,<br/>어땠어?</p>
          <small>우리가 고른 ${esc(story.genre)} 세상에서 멋진 일들이 있었지!</small>
        </div>
      </div>
      <div class="text-side cover-text-side">
        <div class="cover-content">
          <small>${esc(story.child_name)}의 ${esc(story.genre)} 동화</small>
          <p class="back-object">소중한 물건<br/><strong>${esc(story.object_name)}</strong></p>
        </div>
      </div>
    </div>`);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
    @page { size: A4 landscape; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans KR', sans-serif; background: #fff; }

    .page {
      width: 297mm;
      height: 210mm;
      display: grid;
      grid-template-columns: 210mm 87mm;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: avoid; }

    /* 이미지 영역 – 항상 210×210mm 정사각형, 비율 유지 */
    .img-side {
      width: 210mm;
      height: 210mm;
      position: relative;
      background: #f5d6df;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .img-side img {
      width: 100%;
      height: 100%;
      object-fit: cover;   /* 비율 유지하면서 영역 채우기 */
      display: block;
    }
    .img-placeholder {
      font-size: 80px;
      opacity: .4;
    }

    /* 텍스트 영역 (87mm) */
    .text-side {
      width: 87mm;
      height: 210mm;
      padding: 14mm 10mm 10mm 11mm;
      display: flex;
      flex-direction: column;
      gap: 5mm;
      background: #fffdfb;
      position: relative;
      overflow: hidden;
    }
    .text-side small {
      font-size: 8pt;
      color: #f55f91;
      font-weight: 700;
    }
    .page-num {
      position: absolute;
      top: 8mm;
      right: 10mm;
      font-size: 8pt;
      color: #f55f91;
      font-weight: 700;
    }
    .text-side h2 {
      font-size: 14pt;
      font-weight: 900;
      color: #3d2940;
      line-height: 1.35;
      word-break: keep-all;
    }
    .text-side hr {
      border: none;
      border-top: 0.5pt solid #ffe2ec;
      margin: 1mm 0;
    }
    .text-side p {
      font-size: 9.5pt;
      line-height: 1.85;
      color: #432e3a;
      word-break: keep-all;
      overflow: hidden;
    }

    /* 표지 텍스트 영역 */
    .cover-text-side {
      background: linear-gradient(160deg, #fff7fa, #ffe8f0);
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .cover-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5mm;
    }
    .cover-content small {
      font-size: 8pt;
      color: #f55f91;
      font-weight: 700;
    }
    .cover-content h1 {
      font-size: 18pt;
      font-weight: 900;
      color: #3d2940;
      line-height: 1.3;
      word-break: keep-all;
    }
    .cover-sub {
      font-size: 9pt;
      color: #8d5f70;
    }

    /* 뒷 표지 오버레이 */
    .back-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,.75), transparent);
      padding: 10mm 8mm 8mm;
      color: #fff;
      text-align: center;
    }
    .back-overlay p {
      font-size: 13pt;
      font-weight: 900;
      line-height: 1.4;
      color: #fff;
    }
    .back-overlay small {
      font-size: 8pt;
      color: rgba(255,255,255,.85);
      margin-top: 2mm;
      display: block;
    }
    .back-object {
      font-size: 10pt;
      color: #8d5f70;
      line-height: 1.6;
    }
    .back-object strong {
      font-size: 14pt;
      color: #3d2940;
      font-weight: 900;
    }
  `;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(story.title)}_동화</title>
  <style>${css}</style>
</head>
<body>
  ${pages.join('\n')}
  <script>
    // 이미지·폰트 로드 완료 후 프린트 다이얼로그 열기
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 800);
    });
  </script>
</body>
</html>`;
}

export function downloadStoryPdf(story: PdfStoryData) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('팝업이 차단되었어요. 브라우저 주소창 옆 팝업 허용 버튼을 눌러 주세요.');
    return;
  }
  win.document.write(buildHtml(story));
  win.document.close();
}
