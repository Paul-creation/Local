// 상세 페이지 "선정적 표현 포함" 안내 — 스팀 content descriptors(games.content_descriptor_ids) 기준
// 성적 표현(1·3·4번)이 있을 때만 보인다. 폭력(2번)·일반 성인용(5번)만 있는 게임은 안내 없음
// 채우기: scripts/fill-content-descriptors.mjs, 새 게임은 bulk-import.mjs

// 스팀 한국어 상점 표기 (성적 표현 번호만)
const STEAM_LABEL: Record<number, string> = {
  1: '일부 노출 또는 성적인 콘텐츠',
  3: '성인 전용 성적인 콘텐츠',
  4: '빈번한 노출 또는 성적인 콘텐츠',
};
const SEXUAL = [1, 3, 4];

export default function ContentNotice({ ids }: { ids?: number[] | null }) {
  const sexual = (ids || []).filter((id) => SEXUAL.includes(id));
  if (!sexual.length) return null;
  return (
    <p className="content-notice">
      <strong>선정적 표현 포함</strong>
      <span> · 스팀 표기: {sexual.map((id) => STEAM_LABEL[id]).join(', ')}</span>
    </p>
  );
}
