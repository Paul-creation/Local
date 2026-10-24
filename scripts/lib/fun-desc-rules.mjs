// scripts/lib/fun-desc-rules.mjs
// write-fun-descriptions의 인원 판단 — 순수 함수 (테스트 대상)
// max_players가 null이면 "모름"이라 멀티 없는 게임으로 보지 않는다 (예전에는 1명으로 보고 "혼자"를 강제해 협동 게임에 잘못된 소개문이 저장됨)
export const hasCoop = (g) => !!(g.has_online_coop || g.has_local_coop);

export const noMulti = (g) => g.max_players === 1 || (!hasCoop(g) && !g.has_pvp && g.max_players != null && g.max_players <= 1);
