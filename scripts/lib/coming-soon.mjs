// scripts/lib/coming-soon.mjs
// 출시 예정(coming soon)·데모 게임 — 스팀 appdetails에서 games.release_status·demo_appid·release_date_text 값을 뽑는 순수 함수 (스팀·DB 호출 없음, 테스트 대상)
// bulk-import --curator(처음 넣을 때)와 check-coming-soon(매일 출시 여부 확인)이 같이 쓴다
import fs from 'fs';

const FILE = 'scripts/.cache/coming-soon-check.json';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// appdetails의 data(한국어 응답 권장: release_date.date가 "2026년 11월"처럼 나옴) → 저장할 값
// - 출시 예정이 아니면 release_status만 'released' (데모·출시일 원문은 채우지 않음)
// - demos[]는 첫 번째 데모의 앱 번호만 문자열로 (없으면 null)
export function releaseFields(data) {
  const rd = data?.release_date;
  if (rd?.coming_soon !== true) return { release_status: 'released', demo_appid: null, release_date_text: null };
  const demo = (data.demos || []).find((d) => /^\d+$/.test(String(d?.appid ?? '')));
  const text = typeof rd.date === 'string' ? rd.date.trim() : '';
  return {
    release_status: 'coming_soon',
    demo_appid: demo ? String(demo.appid) : null,
    release_date_text: text || null,
  };
}

// 이미 coming_soon인 게임의 새 appdetails → DB에 바꿀 칸 (바뀐 칸만, 없으면 null)
// - 출시됐으면 release_status만 바꿈 (다음 데일리부터 가격·리뷰 수집, 데모·출시일 원문은 건드리지 않음)
// - 아직 출시 전이면 출시일 원문·데모가 스팀에서 바뀐 경우만 따라감. 스팀 응답에 값이 없다고 기존 값을 비우지는 않음
export function comingSoonPatch(current, data) {
  const next = releaseFields(data);
  if (next.release_status === 'released') return { released: true, patch: { release_status: 'released' } };
  const patch = {};
  if (next.release_date_text && next.release_date_text !== current.release_date_text) patch.release_date_text = next.release_date_text;
  if (next.demo_appid && next.demo_appid !== current.demo_appid) patch.demo_appid = next.demo_appid;
  return { released: false, patch: Object.keys(patch).length ? patch : null };
}

// 스팀 데모 상점 페이지 주소
export const demoUrl = (demoAppid) => `https://store.steampowered.com/app/${demoAppid}`;

// 일일 요약용 작은 파일 (오늘 기록만 유효)
export function readComingSoonCheck() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

export function recordComingSoonCheck({ checked, released, failed }) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ checked, released, failed, date: today() }));
  } catch (e) {
    console.log(`출시 전환 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}

// 일일 요약 한 줄 (확인할 출시 예정 게임이 없으면 줄 자체를 뺌)
export function comingSoonLine(check) {
  if (!check || !check.checked) return '';
  return `\n🚀 출시 전환 ${check.released}개 (출시 예정 ${check.checked}개 확인${check.failed ? ` · 확인 실패 ${check.failed}개` : ''})`;
}
