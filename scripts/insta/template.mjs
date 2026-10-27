// scripts/insta/template.mjs
// 인스타 슬라이드 공통 템플릿(HTML/CSS 하나) + 슬라이드 타입별 본문. 화면에는 JamiDuNow만 쓴다.
const W = 1080;
const H = 1350;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// {강조}로 감싼 부분만 강조색, \n은 줄바꿈
export const rich = (s) => esc(s).replace(/\{([^{}]+)\}/g, '<em>$1</em>').replace(/\n/g, '<br>');

const CSS = (fontData) => `
@font-face { font-family: 'Pretendard'; font-weight: 45 920; font-display: block; src: url(data:font/woff2;base64,${fontData}) format('woff2-variations'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; background: #0b0b0b; }
body { position: relative; overflow: hidden; color: #fff; font-family: 'Pretendard', sans-serif; word-break: keep-all; -webkit-font-smoothing: antialiased; }
em { font-style: normal; color: #FFD84A; }
.slide { position: absolute; inset: 0; }
.pad { position: absolute; inset: 0; padding: 130px 84px 200px; display: flex; flex-direction: column; }
.page { position: absolute; top: 56px; right: 64px; z-index: 5; font-size: 34px; font-weight: 600; color: rgba(255,255,255,.6); font-variant-numeric: tabular-nums; }
.logo { position: absolute; right: 64px; bottom: 64px; z-index: 5; width: 92px; height: 92px; border-radius: 26px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-size: 66px; font-weight: 900; line-height: 1; }

/* wall-cover */
.wall { position: absolute; inset: 0; background-size: cover; background-position: center; }
.wall-dim { position: absolute; inset: 0; background: #0b0b0b; }
.wall-text { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 0 60px; font-size: 156px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; }

/* list */
.title { font-size: 46px; font-weight: 700; color: rgba(255,255,255,.65); margin-bottom: 44px; }
.items { list-style: none; border-top: 2px solid #2b2b2b; }
.items li { padding: 38px 0; border-bottom: 2px solid #2b2b2b; font-size: 52px; font-weight: 700; line-height: 1.3; letter-spacing: -0.02em; }
.push { margin-top: auto; }
.small { font-size: 44px; font-weight: 600; color: rgba(255,255,255,.7); margin-bottom: 8px; line-height: 1.35; }
.punch { font-size: 168px; font-weight: 900; line-height: 1.1; letter-spacing: -0.04em; }

/* chips */
.big { font-size: 128px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; }
.chips { display: flex; flex-wrap: wrap; gap: 22px; margin-top: auto; }
.chip { border: 3px solid #5a5a5a; border-radius: 999px; padding: 20px 44px; font-size: 46px; font-weight: 600; }

/* screenshot */
.label { font-size: 88px; font-weight: 900; letter-spacing: -0.04em; line-height: 1.2; text-align: center; text-wrap: balance; }
.shot { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; padding-top: 36px; }
.frame { border: 8px solid #333; border-radius: 56px; overflow: hidden; background: #0a0a0a; padding: 28px 0 28px 28px; line-height: 0; }
.frame img { display: block; max-width: 860px; max-height: 822px; width: auto; height: auto; }

/* detail-pair */
.pair { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; gap: 26px; padding-top: 34px; }
.phone { border: 8px solid #333; border-radius: 44px; overflow: hidden; background: #0a0a0a; line-height: 0; }
.phone img { display: block; width: 412px; height: auto; }
.foot { text-align: center; font-size: 36px; font-weight: 600; color: rgba(255,255,255,.7); padding-top: 20px; margin-right: 140px; margin-left: 140px; }

/* cta */
.cta-big { font-size: 190px; font-weight: 900; line-height: 1.15; letter-spacing: -0.045em; margin-top: 28px; }
.footer { margin-top: auto; font-size: 40px; font-weight: 600; color: rgba(255,255,255,.7); padding-right: 140px; }

/* photo-cover (데이터 게시물용 자리) */
.photo { position: absolute; inset: 0; background-size: cover; background-position: center; }
.photo-text { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 0 60px; font-size: 150px; font-weight: 900; line-height: 1.2; letter-spacing: -0.03em; color: #fff; -webkit-text-stroke: 14px #000; paint-order: stroke fill; }
`;

const BODY = {
  'wall-cover': (s, ctx) => `
    <div class="wall" style="background-image:url(${ctx.wall}); filter: blur(${s.blur ?? 3}px); transform: scale(1.06);"></div>
    <div class="wall-dim" style="opacity:${s.overlay ?? 0.62}"></div>
    <div class="wall-text"><div>${rich(s.headline)}</div></div>`,
  list: (s) => `
    <div class="pad">
      <div class="title">${rich(s.title)}</div>
      <ul class="items">${s.items.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>
      <div class="push">
        ${s.small ? `<div class="small">${rich(s.small)}</div>` : ''}
        ${s.punch ? `<div class="punch">${rich(s.punch)}</div>` : ''}
      </div>
    </div>`,
  chips: (s) => `
    <div class="pad">
      <div class="big">${rich(s.big)}</div>
      <div class="chips">${s.chips.map((c) => `<span class="chip">${rich(c)}</span>`).join('')}</div>
    </div>`,
  screenshot: (s, ctx) => `
    <div class="pad" style="padding-bottom:166px">
      <div class="label">${rich(s.label)}</div>
      <div class="shot"><div class="frame"><img src="${ctx.screenshot}" alt=""></div></div>
    </div>`,
  'detail-pair': (s, ctx) => `
    <div class="pad" style="padding-bottom:84px">
      <div class="label" ${s.size ? `style="font-size:${+s.size}px"` : ''}>${rich(s.label)}</div>
      <div class="pair">
        <div class="phone"><img src="${ctx.top}" alt=""></div>
        <div class="phone"><img src="${ctx.spec}" alt=""></div>
      </div>
      <div class="foot">${rich(s.small ?? 'jamidunow.com')}</div>
    </div>`,
  cta: (s) => `
    <div class="pad">
      <div class="small">${rich(s.small)}</div>
      <div class="cta-big">${rich(s.big)}</div>
      <div class="footer">${rich(s.footer)}</div>
    </div>`,
  'photo-cover': (s, ctx) => `
    <div class="photo" style="background-image:url(${ctx.photo ?? ''})"></div>
    <div class="photo-text"><div>${rich(s.headline)}</div></div>`,
};

export const SLIDE_TYPES = Object.keys(BODY);

export function renderSlide(slide, index, total, ctx) {
  const body = BODY[slide.type];
  if (!body) throw new Error(`알 수 없는 슬라이드 타입: ${slide.type} (${SLIDE_TYPES.join(', ')})`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS(ctx.font)}</style></head><body>
    <div class="slide">${body(slide, ctx)}</div>
    ${index > 0 ? `<div class="page">${index + 1}/${total}</div>` : ''}
    <div class="logo">J</div>
  </body></html>`;
}

export const SIZE = { width: W, height: H };
