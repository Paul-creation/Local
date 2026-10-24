// 메인 "인스타에서 봤던 그 게임" 카드 섞기 — 순수 함수라 curatorMix.test.mjs가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
// 입력은 최신 소개순. 앞에서부터 하나씩 담되, 한 계정이 maxRun장 연속이면 다른 계정의 가장 최신 카드를 먼저 담는다
// 담을 수 있는 다른 계정 카드가 없으면 규칙을 어기지 않고 거기서 멈춘다 (max장보다 적을 수 있음)
export const HOME_CURATOR_CARDS = 12;
export const HOME_CURATOR_MAX_RUN = 2;

export function mixByCurator<T extends { curator: string }>(items: T[], max = HOME_CURATOR_CARDS, maxRun = HOME_CURATOR_MAX_RUN): T[] {
  const rest = [...items];
  const out: T[] = [];
  while (out.length < max && rest.length) {
    const tail = out.slice(-maxRun);
    const blocked = tail.length === maxRun && tail.every((x) => x.curator === tail[0].curator) ? tail[0].curator : null;
    const i = rest.findIndex((x) => x.curator !== blocked);
    if (i < 0) break;
    out.push(...rest.splice(i, 1));
  }
  return out;
}

// 게시물 목록(최신순)에서 게임마다 가장 최신 게시물 하나만 — 같은 게임을 여러 계정이 소개했으면 최신 게시물의 계정이 출처
export function latestPerGame<T extends { game_id: string }>(postsNewestFirst: T[]): T[] {
  const seen = new Set<string>();
  return postsNewestFirst.filter((p) => (seen.has(p.game_id) ? false : (seen.add(p.game_id), true)));
}
