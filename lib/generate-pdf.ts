// PDF 다운로드 – html2canvas + jsPDF 사용
// 한글 완벽 지원 + 인쇄 다이얼로그 없이 바로 다운로드
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
  return `<img src="${esc(url)}" alt="${esc(alt)}" crossorigin="anonymous" />`;
}

export async function downloadStoryPdf(story: PdfStoryData) {
  // 숨겨진 컨테이너 생성
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const pagesHtml: string[] = [];

  // ── 표지 ──────────────────────────────────────────────────────
  pagesHtml.push(`
    <div class="pdf-page cover-page">
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
    pagesHtml.push(`
      <div class="pdf-page story-page">
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
  pagesHtml.push(`
    <div class="pdf-page back-page">
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

  // 스타일 설정 - 가로 297mm x 세로 210mm (비율: 1122.5 x 793.7 픽셀, 96dpi 기준)
  // 해상도를 높이기 위해 2배수 사이즈로 설정
  const W = 1122;
  const H = 793;

  container.innerHTML = `
    <style>
      .pdf-wrapper {
        font-family: 'Noto Sans KR', sans-serif;
        background: #fff;
        width: ${W}px;
      }
      .pdf-page {
        width: ${W}px;
        height: ${H}px;
        display: flex;
        overflow: hidden;
        background: #fff;
      }
      
      /* 왼쪽 절반: 이미지 영역 (가로 절반) */
      .img-side {
        width: ${W / 2}px;
        height: ${H}px;
        background: #f5d6df;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      /* 이미지가 가로폭에 꽉 차고, 세로는 비율에 맞게(위아래 여백 발생) */
      .img-side img {
        width: 100%;
        height: auto;
        object-fit: contain;
        display: block;
      }
      .img-placeholder {
        font-size: 80px;
        opacity: .4;
      }

      /* 오른쪽 절반: 텍스트 영역 */
      .text-side {
        width: ${W / 2}px;
        height: ${H}px;
        padding: 50px 40px 40px 45px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        background: #fffdfb;
        position: relative;
        box-sizing: border-box;
      }
      .text-side small {
        font-size: 16px;
        color: #f55f91;
        font-weight: 700;
      }
      .page-num {
        position: absolute;
        top: 30px;
        right: 40px;
        font-size: 16px;
        color: #f55f91;
        font-weight: 700;
      }
      .text-side h2 {
        font-size: 28px;
        font-weight: 900;
        color: #3d2940;
        line-height: 1.35;
        word-break: keep-all;
        margin: 0;
      }
      .text-side hr {
        border: none;
        border-top: 2px solid #ffe2ec;
        margin: 5px 0;
      }
      .text-side p {
        font-size: 19px;
        line-height: 1.85;
        color: #432e3a;
        word-break: keep-all;
        margin: 0;
      }

      /* 표지 & 뒷표지 텍스트 영역 */
      .cover-text-side {
        background: linear-gradient(160deg, #fff7fa, #ffe8f0);
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 40px;
      }
      .cover-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }
      .cover-content h1 {
        font-size: 36px;
        font-weight: 900;
        color: #3d2940;
        line-height: 1.3;
        word-break: keep-all;
        margin: 0;
      }
      .cover-sub {
        font-size: 18px;
        color: #8d5f70;
      }

      /* 뒷 표지 오버레이 */
      .back-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0,0,0,.75), transparent);
        padding: 40px 30px 30px;
        color: #fff;
        text-align: center;
      }
      .back-overlay p {
        font-size: 26px;
        font-weight: 900;
        line-height: 1.4;
        color: #fff;
        margin: 0;
      }
      .back-overlay small {
        font-size: 16px;
        color: rgba(255,255,255,.85);
        margin-top: 8px;
        display: block;
      }
      .back-object {
        font-size: 20px;
        color: #8d5f70;
        line-height: 1.6;
      }
      .back-object strong {
        font-size: 28px;
        color: #3d2940;
        font-weight: 900;
        display: block;
        margin-top: 10px;
      }
    </style>
    <div class="pdf-wrapper">
      ${pagesHtml.join('')}
    </div>
  `;

  // 이미지 렌더링 완료 대기 (꼼수: 잠시 대기)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pages = container.querySelectorAll('.pdf-page');

  for (let i = 0; i < pages.length; i++) {
    const pageEl = pages[i] as HTMLElement;
    const canvas = await html2canvas(pageEl, {
      scale: 2, // 고해상도
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    if (i > 0) {
      doc.addPage();
    }
    
    // A4 가로: 297 x 210
    doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);
  }

  // 삭제
  document.body.removeChild(container);

  // 다운로드
  const safeName = story.title.replace(/\\s+/g, '_') || 'story';
  doc.save(`${safeName}_동화.pdf`);
}
