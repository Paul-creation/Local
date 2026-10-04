// 상세 페이지 "선정적 표현 포함" 같은 안내 — 스팀 content descriptors(games.content_descriptor_ids) 기준
// 채우기: scripts/fill-content-descriptors.mjs, 새 게임은 bulk-import.mjs

// 스팀 한국어 상점 표기
const STEAM_LABEL: Record<number, string> = {
  1: '일부 노출 또는 성적인 콘텐츠',
  2: '빈번한 폭력 또는 유혈',
  3: '성인 전용 성적인 콘텐츠',
  4: '빈번한 노출 또는 성적인 콘텐츠',
  5: '일반 성인용 콘텐츠',
};
const SEXUAL = [1, 3, 4];

export default function ContentNotice({ ids }: { ids?: number[] | null }) {
  const known = (ids || []).filter((id) => STEAM_LABEL[id]);
  if (!known.length) return null;
  // 성적 표현이 있으면 그것을 앞에, 아니면 폭력, 그 밖은 일반 성인용
  const lead = known.some((id) => SEXUAL.includes(id)) ? '선정적 표현 포함'
    : known.includes(2) ? '폭력적 표현 포함'
    : '성인용 콘텐츠 포함';
  return (
    <p className="content-notice">
      <strong>{lead}</strong>
      <span> · 스팀 표기: {known.map((id) => STEAM_LABEL[id]).join(', ')}</span>
    </p>
  );
}
