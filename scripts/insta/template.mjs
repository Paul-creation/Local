// scripts/insta/template.mjs
// 인스타 슬라이드 공통 템플릿(HTML/CSS 하나) + 슬라이드 타입별 본문. 화면에는 JamiDuNow만 쓴다.
const W = 1080;
const H = 1350;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// {강조}로 감싼 부분만 강조색, \n은 줄바꿈
export const rich = (s) => esc(s).replace(/\{([^{}]+)\}/g, '<em>$1</em>').replace(/\n/g, '<br>');

const CSS = (fontData, w = W, h = H) => `
@font-face { font-family: 'Pretendard'; font-weight: 45 920; font-display: block; src: url(data:font/woff2;base64,${fontData}) format('woff2-variations'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${w}px; height: ${h}px; background: #0b0b0b; }
body { position: relative; overflow: hidden; color: #fff; font-family: 'Pretendard', sans-serif; word-break: keep-all; -webkit-font-smoothing: antialiased; }
em { font-style: normal; color: #FFD84A; }
.slide { position: absolute; inset: 0; }
.pad { position: absolute; inset: 0; padding: 130px 84px 200px; display: flex; flex-direction: column; }
.page { position: absolute; top: 48px; right: 56px; z-index: 5; padding: 6px 22px; border-radius: 999px; background: rgba(0,0,0,.5); font-size: 34px; font-weight: 600; color: rgba(255,255,255,.85); font-variant-numeric: tabular-nums; }
.logo { position: absolute; right: 64px; bottom: 64px; z-index: 5; width: 92px; height: 92px; border-radius: 26px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-size: 66px; font-weight: 900; line-height: 1; }

/* og — 공유 미리보기 1200×630. 카톡이 가운데를 정사각형 가깝게 자르니 로고·문구는 가운데 630×630 안에 둔다 */
.og-wall { position: absolute; inset: 0; background-size: cover; background-position: center; }
.og-dim { position: absolute; inset: 0; background: rgba(0,0,0,.65); }
.og { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.og-logo { width: 156px; height: 156px; border-radius: 44px; background: #0b0b0b; border: 4px solid rgba(255,255,255,.85); color: #fff; display: grid; place-items: center; font-size: 112px; font-weight: 900; line-height: 1; }
.og-head { margin-top: 40px; font-size: 60px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; white-space: nowrap; }
.og-name { margin-top: 18px; font-size: 28px; font-weight: 600; letter-spacing: 0.02em; color: rgba(255,255,255,.8); }

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

/* detail-grid */
.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px 24px; padding-top: 34px; }
.cell { min-height: 0; display: flex; flex-direction: column; }
.cell-label { font-size: 30px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 12px; }
.gcard { flex: 1; min-height: 0; overflow: hidden; background: #121212; border: 1.5px solid #2e2e2e; border-radius: 28px; padding: 20px; display: flex; justify-content: center; align-items: flex-start; }
.gcard.people { align-items: center; }
.gcard img { display: block; width: 100%; height: auto; }
.gcard.spec img { width: auto; max-width: 100%; max-height: 360px; }
.foot { text-align: center; font-size: 36px; font-weight: 600; color: rgba(255,255,255,.7); padding-top: 20px; margin-right: 140px; margin-left: 140px; }

/* detail-split */
.split { position: absolute; display: flex; }
.sp { position: relative; height: 100%; overflow: hidden; background: #0a0a0a; border: 1.5px solid #2e2e2e; border-radius: 28px; }
.spc { position: absolute; left: 0; top: 0; width: 100%; overflow: hidden; }
.sp img { position: absolute; left: 0; display: block; height: auto; }
.next { position: absolute; right: 176px; bottom: 88px; z-index: 5; font-size: 44px; font-weight: 600; line-height: 1; color: rgba(255,255,255,.7); }
.foot-abs { position: absolute; left: 140px; right: 180px; bottom: 80px; text-align: center; font-size: 36px; font-weight: 600; color: rgba(255,255,255,.7); }

/* cta */
.cta-big { font-size: 190px; font-weight: 900; line-height: 1.15; letter-spacing: -0.045em; margin-top: 28px; }
.footer { margin-top: auto; font-size: 40px; font-weight: 600; color: rgba(255,255,255,.7); padding-right: 140px; }

/* end-card */
.end-card .page { background: none; color: #888; }
.end { position: absolute; inset: 0; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #0b0b0b; padding-bottom: 60px; }
.end svg { display: block; width: 340px; height: 340px; }
.end-name { margin-top: 56px; font-size: 132px; font-weight: 900; line-height: 1.1; letter-spacing: -0.04em; }
.end-sub { margin-top: 20px; font-size: 52px; font-weight: 600; color: #555; }
.end-url { position: absolute; left: 0; right: 0; bottom: 84px; text-align: center; font-size: 44px; font-weight: 600; color: #0b0b0b; }

/* collage-cover */
.collage { position: absolute; inset: 0; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 4px; background: #000; }
.collage div { background-size: cover; background-position: center; }
.collage-dim { position: absolute; inset: 0; background: rgba(0,0,0,.4); }
.collage-shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0) 55%, #000 100%); }
.collage-text { position: absolute; left: 84px; right: 84px; bottom: 150px; text-shadow: 0 2px 12px rgba(0,0,0,.25); }
.kicker { font-size: 50px; font-weight: 800; color: #FFD84A; letter-spacing: -0.01em; margin-bottom: 22px; }
.collage-head { white-space: nowrap; font-size: 124px; font-weight: 900; line-height: 1.12; letter-spacing: -0.045em; color: #fff; }

/* game-card */
.gcard-wrap { position: absolute; inset: 0; display: flex; flex-direction: column; }
.gshot { position: relative; flex: 1; min-height: 0; background-size: cover; background-position: center; }
.gshot::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(11,11,11,0) 75%, #0b0b0b 100%); }
.gbody { padding: 14px 84px 64px; display: flex; flex-direction: column; }
.gname { font-size: 92px; font-weight: 900; line-height: 1.15; letter-spacing: -0.04em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 100px; }
.gmeta { display: flex; align-items: center; gap: 22px; margin-top: 30px; }
.gpeople { border: 3px solid #5a5a5a; border-radius: 999px; padding: 10px 30px; font-size: 40px; font-weight: 600; }
.gbadge { background: #FFD84A; color: #0b0b0b; border-radius: 14px; padding: 8px 22px; font-size: 48px; font-weight: 900; font-variant-numeric: tabular-nums; }
.gprice { font-size: 56px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.gorig { font-size: 38px; font-weight: 600; color: rgba(255,255,255,.5); text-decoration: line-through; font-variant-numeric: tabular-nums; }
.gtag { margin-top: 32px; padding-right: 140px; font-size: 57px; font-weight: 500; line-height: 1.4; color: #EDEDED; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

/* poster-cover · poster-game — 스팀 세로 아트(library_600x900_2x) 전체 배경 */
.poster-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.poster-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 60%; background: linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,0)); }
.poster-logo { position: absolute; left: 64px; top: 56px; height: 44px; display: flex; align-items: center; gap: 12px; }
.poster-logo i { width: 44px; height: 44px; border-radius: 12px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 32px; font-weight: 900; line-height: 1; }
.poster-logo b { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,.35); }
.poster-text { position: absolute; left: 64px; right: 64px; bottom: 72px; }
.poster-kicker { font-size: 38px; font-weight: 600; color: #DDDDDD; margin-bottom: 20px; letter-spacing: -0.01em; }
.poster-head { font-size: 108px; font-weight: 900; line-height: 1.12; letter-spacing: -0.045em; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.poster-brand { display: flex; align-items: center; gap: 10px; height: 32px; margin-top: 28px; opacity: .8; }
.poster-brand i { width: 32px; height: 32px; border-radius: 9px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 23px; font-weight: 900; line-height: 1; }
.poster-brand b { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
.poster-chips { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 36px; }
.poster-chip { background: transparent; border: 3px solid rgba(255,255,255,.35); border-radius: 999px; padding: 12px 32px; font-size: 38px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.poster-chip.sale { border-color: #4ADE80; color: #4ADE80; }

/* game-data · shot-pair · shot · follow-card — 한 게시물 = 한 게임. 페이지 번호·J 로고 없음 */
.gd-bg, .fc-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.gd-dim { position: absolute; inset: 0; background: rgba(0,0,0,.7); }
.gd-text { position: absolute; left: 72px; right: 72px; bottom: 80px; }
.gd-name { font-size: 104px; font-weight: 900; line-height: 1.12; letter-spacing: -0.045em; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gd-price { display: flex; align-items: baseline; gap: 20px; margin-top: 28px; font-variant-numeric: tabular-nums; }
.gd-orig { font-size: 44px; font-weight: 600; color: rgba(255,255,255,.55); text-decoration: line-through; }
.gd-now { font-size: 76px; font-weight: 800; letter-spacing: -0.03em; color: #4ADE80; }
.gd-off { font-size: 52px; font-weight: 800; color: #4ADE80; }
.gd-chips { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 32px; }
.gd-chip { border: 3px solid rgba(255,255,255,.4); border-radius: 999px; padding: 10px 28px; font-size: 38px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.gd-sub { margin-top: 22px; font-size: 32px; font-weight: 500; color: #9A9A9A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gd-sub + .gd-sub { margin-top: 10px; }
/* game-data 영상 배경 — 아래 쪽 검정 그라데이션 위에 게임명 / 한 줄 소개 / (여백 20px) / 가격 줄 / 인원·특징 줄 */
.gv-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 52%; background: linear-gradient(to top, rgba(0,0,0,.9) 0%, rgba(0,0,0,.78) 40%, rgba(0,0,0,0) 100%); }
.gv-text { position: absolute; left: 64px; right: 64px; bottom: 110px; text-align: left; }
.gv-name { font-size: 58px; font-weight: 800; line-height: 1.2; letter-spacing: -0.03em; color: #fff; }
.gv-tag { margin-top: 8px; font-size: 30px; font-weight: 500; line-height: 1.35; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gv-gap { height: 20px; }
.gv-price { display: flex; align-items: baseline; gap: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.gv-now { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; color: #4ADE80; line-height: 1.2; }
.gv-orig { font-size: 31px; font-weight: 500; color: #9a9a9a; text-decoration: line-through; }
.gv-off { font-size: 31px; font-weight: 500; color: #4ADE80; }
.gv-end { align-self: center; font-size: 26px; font-weight: 500; color: #fff; border: 3px solid rgba(255,255,255,.25); border-radius: 999px; padding: 4px 18px; }
.gv-facts { margin-top: 13px; font-size: 29px; font-weight: 500; color: rgba(255,255,255,.8); white-space: nowrap; }
/* overview · minigame — --detailed 전용 */
.ov-bg, .mg-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.ov-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 62%; background: linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.8) 45%, rgba(0,0,0,0) 100%); }
.ov-text { position: absolute; left: 64px; right: 64px; bottom: 90px; }
.ov-head { font-size: 64px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ov-body { margin-top: 24px; font-size: 36px; font-weight: 500; line-height: 1.5; letter-spacing: -0.02em; color: rgba(255,255,255,.92); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.mg-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 40%; background: linear-gradient(to top, rgba(0,0,0,.9), rgba(0,0,0,0)); }
.mg-text { position: absolute; left: 64px; right: 64px; bottom: 80px; }
.mg-head { font-size: 60px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mg-body { margin-top: 16px; font-size: 36px; font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: rgba(255,255,255,.9); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.poster-bg.blurred { filter: blur(40px) brightness(.6); transform: scale(1.15); }
.poster-fit { position: absolute; left: 0; top: 40%; width: 100%; overflow: hidden; transform: translateY(-50%); }
.poster-fit img { display: block; height: auto; max-width: none; }
/* roundup-cover · roundup-game — --roundup 전용 (주황 #FF7A1A) */
.rc-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 40%; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.85)); }
.rc-text { position: absolute; left: 64px; right: 64px; bottom: 190px; }
.rc-kicker { font-size: 30px; font-weight: 700; color: #fff; letter-spacing: -0.02em; margin-bottom: 16px; text-shadow: 0 2px 8px rgba(0,0,0,.45); }
.rc-title { font-weight: 900; line-height: 1.22; letter-spacing: -0.045em; text-shadow: 0 2px 10px rgba(0,0,0,.45); }
.rc-title div { white-space: nowrap; }
.rc-t1 { font-size: 72px; color: #fff; }
.rc-t2 { font-size: 80px; color: #FF7A1A; }
.rc-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
.rc-grid div { background-size: cover; background-position: center; }
.rc-brand { position: absolute; left: 64px; bottom: 72px; display: flex; align-items: center; gap: 14px; }
.rc-brand i { width: 56px; height: 56px; border-radius: 16px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 40px; font-weight: 900; line-height: 1; }
.rc-brand b { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
.rg-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 42%; background: linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.8) 50%, rgba(0,0,0,0) 100%); }
.rg-text { position: absolute; left: 64px; right: 64px; bottom: 64px; text-align: left; }
.rg-name { font-size: 58px; font-weight: 900; line-height: 1.2; letter-spacing: -0.03em; color: #FF7A1A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rg-info { margin-top: 10px; font-size: 26px; font-weight: 600; color: #FF7A1A; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rg-info s { opacity: .75; }
.rg-dash { margin-top: 6px; font-size: 26px; font-weight: 600; color: rgba(255,255,255,.6); line-height: 1.2; }
.rg-desc { margin-top: 6px; font-size: 30px; font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: #fff; }
/* roundup-detail — 사이트 톤(흑백 + 흰색 글로우, 주황 없음) */
.rd-bg { position: absolute; inset: -20px; background-size: cover; background-position: center; filter: blur(8px); }
.rd-dim { position: absolute; inset: 0; background: rgba(0,0,0,.65); }
.rd-top { position: absolute; left: 72px; right: 72px; top: 72px; }
.rd-label { display: inline-block; padding: 6px 20px; border-radius: 999px; border: 2px solid rgba(255,255,255,.4); font-size: 26px; font-weight: 600; color: #EDEDED; box-shadow: 0 0 14px rgba(255,255,255,.15); }
.rd-name { margin-top: 24px; font-size: 52px; font-weight: 900; line-height: 1.2; letter-spacing: -0.03em; color: #fff; text-shadow: 0 0 22px rgba(255,255,255,.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-mid { position: absolute; left: 72px; right: 72px; top: 240px; bottom: 140px; display: flex; flex-direction: column; justify-content: center; gap: 38px; text-align: left; }
.rd-label-s { font-size: 26px; font-weight: 500; color: rgba(255,255,255,.55); letter-spacing: -0.01em; }
.rd-val { margin-top: 10px; font-size: 44px; font-weight: 700; line-height: 1.3; letter-spacing: -0.03em; color: #fff; text-shadow: 0 0 18px rgba(255,255,255,.28); }
.rd-val.small { font-size: 36px; font-weight: 600; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.rd-chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
.rd-chip { padding: 8px 24px; border-radius: 999px; border: 2px solid rgba(255,255,255,.45); font-size: 32px; font-weight: 600; color: #fff; box-shadow: 0 0 14px rgba(255,255,255,.12); }
.rd-badge { display: inline-block; margin-left: 16px; padding: 4px 18px; border-radius: 999px; border: 2px solid rgba(255,255,255,.5); font-size: 28px; font-weight: 600; vertical-align: middle; text-shadow: none; box-shadow: 0 0 12px rgba(255,255,255,.15); }
.rd-foot { position: absolute; left: 72px; right: 72px; bottom: 72px; font-size: 26px; font-weight: 500; color: rgba(255,255,255,.55); }
.sp-wrap { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 2px; background: #000; }
.sp-half { flex: 1; min-height: 0; background-size: cover; background-position: center; }
.sp-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 45%; background: linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,0)); }
.sp-text { position: absolute; left: 72px; right: 72px; bottom: 80px; }
.sp-head { font-size: 68px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; color: #fff; margin-bottom: 20px; }
.sp-body { font-size: 44px; font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: #fff; }
.shot-full { position: absolute; inset: 0; background-size: cover; background-position: center; }
.fc-bg { filter: blur(24px); transform: scale(1.12); }
.fc-dim { position: absolute; inset: 0; background: rgba(0,0,0,.45); }
.fc-mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 64px; padding: 0 60px; text-align: center; color: #fff; }
.fc-title { font-size: 76px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; }
.fc-sub { margin-top: -28px; font-size: 42px; font-weight: 500; line-height: 1.4; color: rgba(255,255,255,.88); }
.fc-pill { width: 756px; height: 150px; border-radius: 999px; background: #fff; display: flex; align-items: center; padding: 0 16px; gap: 24px; color: #0b0b0b; }
.fc-j { flex: none; width: 118px; height: 118px; border-radius: 50%; background: #0b0b0b; color: #fff; display: grid; place-items: center; font-size: 76px; font-weight: 900; line-height: 1; }
.fc-handle { flex: 1; font-size: 44px; font-weight: 800; letter-spacing: -0.02em; }
.fc-btn { flex: none; height: 94px; padding: 0 38px; border-radius: 999px; background: #0b0b0b; color: #fff; display: grid; place-items: center; font-size: 38px; font-weight: 800; }
.fc-brand { position: absolute; left: 0; right: 0; bottom: 84px; text-align: center; font-size: 34px; font-weight: 700; color: #fff; }
`;

const GRID_CELLS = [['people', '인원'], ['price', '가격·역대 최저가'], ['spec', '내 PC 사양'], ['video', '친구랑 하는 영상']];

// 포스터 레이아웃 — 배경(세로 아트) · 아래 그라데이션 · 왼쪽 위 로고 · 왼쪽 아래 kicker/제목/칩. chips는 {text, sale}
const poster = (s, ctx, headline, chips, brandBelow = false) => `
    ${s.fit === 'blur'
      ? `<div class="poster-bg blurred" style="background-image:url(${ctx.poster.image})"></div><div class="poster-fit"><img src="${ctx.poster.image}" style="width:${(s.zoom ?? 1.3) * 100}%; margin-left:-${((s.zoom ?? 1.3) - 1) * (s.focusX ?? 0.5) * 100}%"></div>`
      : `<div class="poster-bg" style="background-image:url(${ctx.poster.image});${s.zoom ? ` transform:scale(${s.zoom}); transform-origin:${(s.focusX ?? 0.5) * 100}% ${(s.focusY ?? 0.5) * 100}%;` : ''}"></div>`}
    <div class="poster-shade"></div>
    ${brandBelow ? '' : '<div class="poster-logo"><i>J</i><b>JamiDuNow</b></div>'}
    <div class="poster-text">
      ${s.kicker ? `<div class="poster-kicker">${rich(s.kicker)}</div>` : ''}
      <div class="poster-head">${rich(headline)}</div>
      ${chips.length ? `<div class="poster-chips">${chips.map((c) => `<span class="poster-chip${c.sale ? ' sale' : ''}">${rich(c.text)}</span>`).join('')}</div>` : ''}
      ${brandBelow ? '<div class="poster-brand"><i>J</i><b>JamiDuNow</b></div>' : ''}
    </div>`;

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
  'detail-grid': (s, ctx) => `
    <div class="pad" style="padding-bottom:100px">
      <div class="label">${rich(s.label)}</div>
      <div class="grid">${GRID_CELLS.map(([key, name]) => `
        <div class="cell"><div class="cell-label">${name}</div><div class="gcard ${key}"><img src="${ctx.parts[key]}" alt=""></div></div>`).join('')}
      </div>
      <div class="foot">${rich(s.small ?? 'jamidunow.com')}</div>
    </div>`,
  'detail-split': (s, ctx) => {
    const sp = ctx.split;
    return `
    ${sp.first ? `<div class="pad" style="padding-bottom:0"><div class="label">${rich(s.label ?? '')}</div></div>` : ''}
    <div class="split" style="top:${sp.top}px;height:${sp.areaH}px;left:${sp.side}px;right:${sp.side}px;gap:${sp.gap}px">
      ${sp.pieces.map((p) => `<div class="sp" style="width:${p.outerW}px"><div class="spc" style="height:${p.h}px">${p.imgs.map((i) => `<img src="${i.src}" style="top:${i.top}px;width:${i.w}px" alt="">`).join('')}</div></div>`).join('')}
    </div>
    ${sp.last ? `<div class="foot-abs">${rich(s.small ?? 'jamidunow.com')}</div>` : '<div class="next">→</div>'}`;
  },
  cta: (s) => `
    <div class="pad">
      <div class="small">${rich(s.small)}</div>
      <div class="cta-big">${rich(s.big)}</div>
      <div class="footer">${rich(s.footer)}</div>
    </div>`,
  'end-card': () => `
    <div class="end">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="#0b0b0b"/><path d="M62 20 V58 A16 16 0 0 1 30 58" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/></svg>
      <div class="end-name">JamiDuNow</div>
      <div class="end-sub">모든 정보를 한곳에</div>
      <div class="end-url">jamidunow.com</div>
    </div>`,
  'collage-cover': (s, ctx) => `
    <div class="collage">${ctx.photos.map((p) => `<div style="background-image:url(${p})"></div>`).join('')}</div>
    <div class="collage-dim"></div>
    <div class="collage-shade"></div>
    <div class="collage-text">
      <div class="kicker">${rich(s.kicker)}</div>
      <div class="collage-head">${rich(s.headline)}</div>
    </div>`,
  'poster-cover': (s, ctx) => poster(s, ctx, s.headline, ctx.poster.chips, true),
  'poster-game': (s, ctx) => poster(s, ctx, ctx.poster.name, ctx.poster.chips),
  'game-data': (s, ctx) => {
    const g = ctx.single;
    if (g.video) return `
    <style>html, body { background: transparent !important; }</style>
    <div class="gv-shade"></div>
    <div class="gv-text">
      <div class="gv-name" data-fit="58,44">${rich(g.name)}</div>
      ${g.tagline ? `<div class="gv-tag">${rich(g.tagline)}</div>` : ''}
      <div class="gv-gap"></div>
      <div class="gv-price">
        <span class="gv-now">${rich(g.price)}</span>
        ${g.original ? `<span class="gv-orig">${rich(g.original)}</span>` : ''}
        ${g.discount ? `<span class="gv-off">-${esc(g.discount)}%</span>` : ''}
        ${g.saleEnd ? `<span class="gv-end">${esc(g.saleEnd)}까지</span>` : ''}
      </div>
      <div class="gv-facts">${g.chips.map((c) => rich(c)).join(' · ')}</div>
    </div>`;
    return `
    ${g.video ? '<style>html, body { background: transparent !important; }</style>' : `<div class="gd-bg" style="background-image:url(${g.bg})"></div>`}
    <div class="gd-dim" style="background:rgba(0,0,0,${g.video ? 0.55 : 0.7})"></div>
    <div class="gd-text">
      <div class="gd-name">${rich(g.name)}</div>
      <div class="gd-price">
        ${g.original ? `<span class="gd-orig">${rich(g.original)}</span>` : ''}
        <span class="gd-now">${rich(g.price)}</span>
        ${g.discount ? `<span class="gd-off">-${esc(g.discount)}%</span>` : ''}
      </div>
      <div class="gd-chips">${g.chips.map((c) => `<span class="gd-chip">${rich(c)}</span>`).join('')}</div>
      ${g.saleEnd ? `<div class="gd-sub">할인 종료 ${esc(g.saleEnd)}</div>` : ''}
      ${g.spec ? `<div class="gd-sub">최소 사양 · ${esc(g.spec)}</div>` : ''}
    </div>`;
  },
  overview: (s, ctx) => `
    <div class="ov-bg" style="background-image:url(${ctx.single.images[0]})"></div>
    <div class="ov-shade"></div>
    <div class="ov-text">
      <div class="ov-head" data-fit="64,44,1">${rich(s.headline)}</div>
      <div class="ov-body">${rich(s.body)}</div>
    </div>`,
  minigame: (s, ctx) => `
    <div class="mg-bg" style="background-image:url(${ctx.single.images[0]})"></div>
    ${s.heading || s.body ? `<div class="mg-shade"></div>
    <div class="mg-text">
      ${s.heading ? `<div class="mg-head">${rich(s.heading)}</div>` : ''}
      ${s.body ? `<div class="mg-body">${rich(s.body)}</div>` : ''}
    </div>` : ''}`,
  'roundup-cover': (s, ctx) => `
    ${ctx.single.collage ? `<div class="rc-grid">${ctx.single.collage.map((u) => `<div style="background-image:url(${u})"></div>`).join('')}</div>` : `<div class="ov-bg" style="background-image:url(${ctx.single.images[0]})${ctx.single.bgPosX != null ? `; background-size: auto 100%; background-position: ${ctx.single.bgPosX}% 50%` : ''}"></div>`}
    <div class="rc-shade"></div>
    <div class="rc-text">
      <div class="rc-kicker">${rich(s.kicker)}</div>
      <div class="rc-title"><div class="rc-t1" data-fit="72,40">${rich(s.title1)}</div><div class="rc-t2" data-fit="80,44">${rich(s.title2)}</div></div>
    </div>
    <div class="rc-brand"><i>J</i><b>JamiDuNow</b></div>`,
  'roundup-game': (s, ctx) => {
    const g = ctx.single;
    const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
    return `
    <div class="sp-wrap">${g.images.map((u) => `<div class="sp-half" style="background-image:url(${u})"></div>`).join('')}</div>
    <div class="rg-shade"></div>
    <div class="rg-text">
      <div class="rg-name" data-fit="58,36,1">${esc(g.name)}</div>
      <div class="rg-info">${[esc(g.review ?? '평가 없음'), `한글${g.korean ? 'O' : 'X'}`, '멀티O', `${g.original ? `<s>${won(g.original)}</s> → ` : ''}${won(g.price)}${g.end ? ` (~${esc(g.end)})` : ''}`].join(' | ')}</div>
      <div class="rg-dash">-</div>
      <div class="rg-desc">${rich(s.desc)}</div>
    </div>`;
  },
  'roundup-detail': (s, ctx) => {
    const g = ctx.single;
    return `
    <div class="rd-bg" style="background-image:url(${g.bg})"></div>
    <div class="rd-dim"></div>
    <div class="rd-top"><span class="rd-label">JamiDuNow 데이터</span><div class="rd-name" data-fit="52,34,1">${esc(g.name)}</div></div>
    <div class="rd-mid">${g.rows.map((r) => `<div class="rd-row"><div class="rd-label-s">${esc(r.label)}</div>${r.chips
      ? `<div class="rd-chips">${r.chips.map((c) => `<span class="rd-chip">${esc(c)}</span>`).join('')}</div>`
      : `<div class="rd-val${r.label === '한 줄 평' ? ' small' : ''}">${esc(r.value)}${r.badge ? `<span class="rd-badge">${esc(r.badge)}</span>` : ''}</div>`}</div>`).join('')}</div>
    <div class="rd-foot">더 자세한 비교는 jamidunow.com</div>`;
  },
  'shot-pair': (s, ctx) => `
    <div class="sp-wrap">${ctx.single.images.map((u) => `<div class="sp-half" style="background-image:url(${u})"></div>`).join('')}</div>
    <div class="sp-shade"></div>
    <div class="sp-text">
      ${s.heading ? `<div class="sp-head">${rich(s.heading)}</div>` : ''}
      <div class="sp-body">${rich(s.body)}</div>
    </div>`,
  shot: (s, ctx) => `<div class="shot-full" style="background-image:url(${ctx.single.images[0]})"></div>`,
  'follow-card': (s, ctx) => `
    <div class="fc-bg" style="background-image:url(${ctx.single.art})"></div>
    <div class="fc-dim"></div>
    <div class="fc-mid">
      <div class="fc-title">${rich(s.title)}</div>
      ${s.sub ? `<div class="fc-sub">${rich(s.sub)}</div>` : ''}
      <div class="fc-pill"><span class="fc-j">J</span><span class="fc-handle">jamidunow</span><span class="fc-btn">팔로우</span></div>
    </div>
    <div class="fc-brand">JamiDuNow</div>`,
  og: (s, ctx) => `
    <div class="og-wall" style="background-image:url(${ctx.wall})"></div>
    <div class="og-dim"></div>
    <div class="og">
      <div class="og-logo">J</div>
      <div class="og-head">친구들이랑 뭐 하지?</div>
      <div class="og-name">JamiDuNow</div>
    </div>`,
  'game-card': (s, ctx) => `
    <div class="gcard-wrap">
      <div class="gshot" style="background-image:url(${ctx.photo ?? ''})"></div>
      <div class="gbody">
        <div class="gname">${rich(s.name)}</div>
        <div class="gmeta">
          <span class="gpeople">${rich(s.people)}</span>
          ${s.discount ? `<span class="gbadge">-${esc(s.discount)}%</span>` : ''}
          <span class="gprice">${rich(s.price)}</span>
          ${s.original ? `<span class="gorig">${rich(s.original)}</span>` : ''}
        </div>
        <div class="gtag">${rich(s.tagline)}</div>
      </div>
    </div>`,
};

export const SLIDE_TYPES = Object.keys(BODY);

export const sizeOf = (slide) => (slide.type === 'og' ? { width: 1200, height: 630 } : SIZE);

export function renderSlide(slide, index, total, ctx) {
  const body = BODY[slide.type];
  const { width, height } = sizeOf(slide);
  const og = slide.type === 'og';
  if (!body) throw new Error(`알 수 없는 슬라이드 타입: ${slide.type} (${SLIDE_TYPES.join(', ')})`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS(ctx.font, width, height)}</style></head><body${slide.type === 'end-card' ? ' class="end-card"' : ''}>
    <div class="slide">${body(slide, ctx)}</div>
    ${index > 0 && !og && !slide.type.startsWith('poster-') && !BARE.includes(slide.type) ? `<div class="page">${index + 1}/${total}</div>` : ''}
    ${slide.type === 'end-card' || og || slide.type.startsWith('poster-') || BARE.includes(slide.type) ? '' : '<div class="logo">J</div>'}
  </body></html>`;
}

export const SIZE = { width: W, height: H };
const BARE = ['game-data', 'shot-pair', 'shot', 'follow-card', 'overview', 'minigame', 'roundup-cover', 'roundup-game', 'roundup-detail']; // 페이지 번호·J 로고 없는 타입(poster-*와 같이)
