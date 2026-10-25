// scripts/lib/expired-demos.mjs
// 내려간 데모 판정 — 스팀 응답만 보고 판단하는 순수 함수 (스팀·DB 호출 없음, 테스트 대상)
// check-expired-demos가 쓴다

// 부모 게임 appdetails 응답({ success, data }) 안 demos[]에 demoAppid가 있는지
// - 응답을 못 믿으면(success가 true가 아님) null — 판정하지 않고 건너뜀
export function parentListsDemo(parentRes, demoAppid) {
  if (parentRes?.success !== true) return null;
  const demos = Array.isArray(parentRes.data?.demos) ? parentRes.data.demos : [];
  return demos.some((d) => String(d?.appid ?? '') === String(demoAppid));
}

// 데모 appdetails 응답({ success: false }) 여부. 응답 자체가 없으면 null(모름)
export function demoGone(demoRes) {
  if (!demoRes || typeof demoRes !== 'object') return null;
  return demoRes.success === false;
}

// 최종 판정: 'expired' | 'alive' | 'skip'
// - 부모 demos[]에 없으면 expired. 있으면 데모 appdetails가 success:false일 때만 expired
// - 부모 응답이 없거나 실패면 skip (다음 날 다시 확인)
export function judgeDemo(parentRes, demoAppid, demoRes) {
  const listed = parentListsDemo(parentRes, demoAppid);
  if (listed === null) return 'skip';
  if (!listed) return 'expired';
  return demoGone(demoRes) === true ? 'expired' : 'alive';
}
