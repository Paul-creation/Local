// 첫 방문 안내 띠 — 닫은 기록 키와, 첫 그림 전에 띠 자리만 미리 잡는 스타일의 id·스크립트
// (서버 HTML에는 빈 슬롯만 있고, 이 스크립트가 "아직 안 닫은 사람"에게만 높이를 예약한다. app/page.tsx가 홈 섹션 앞에 싣는다)
export const GUIDE_SEEN_KEY = 'jdn_guide_seen';
export const GUIDE_RESERVE_STYLE_ID = 'guide-reserve-style';

export const GUIDE_RESERVE_SCRIPT = `(function(){try{var seen=false;try{seen=localStorage.getItem('${GUIDE_SEEN_KEY}')==='1'}catch(e){}if(!seen){var s=document.createElement('style');s.id='${GUIDE_RESERVE_STYLE_ID}';s.textContent='.guide-slot{min-height:calc(var(--guide-h) + var(--guide-mt) + var(--guide-mb))}';document.head.appendChild(s)}}catch(e){}})();`;

export function markGuideSeen() {
  try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch { /* 저장소를 못 쓰면 이번 방문에서만 닫힘 */ }
}
