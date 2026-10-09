// scripts/lib/steam-trailer.mjs
// 스팀 appdetails?filters=movies 응답에서 공식 트레일러(HLS .m3u8) 주소 고르기 — enrich-videos가 씀
// 반환: 주소(문자열) | null(스팀에 영상이 없음 — 확실한 답) | undefined(빈 응답: 요청 제한일 수 있어 다시 시도해야 함)
export function trailerFromAppdetails(json, appid) {
  if (!json || typeof json !== 'object' || !Object.prototype.hasOwnProperty.call(json, String(appid))) return undefined;
  const entry = json[appid];
  if (!entry || typeof entry !== 'object') return undefined;
  if (!entry.success) return null; // 상점 페이지가 없음 (판매 중단·지역 제한) — 다시 물어도 같은 답
  const movies = entry.data?.movies || [];
  const pick = movies.find((m) => m.highlight && m.hls_h264) || movies.find((m) => m.hls_h264);
  const url = pick?.hls_h264;
  return url && /^https:\/\/video\.[a-z.]*steamstatic\.com\/.+\.m3u8/.test(url) ? url.replace(/\?.*$/, '') : null;
}
