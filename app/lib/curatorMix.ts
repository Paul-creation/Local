// 메인 "인스타에서 봤던 그 게임" 카드 고르기 — 순수 함수라 curatorMix.test.mjs가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
export const HOME_CURATOR_CARDS = 12;

// 계정별 라운드로빈: 입력은 최신 소개순. 계정마다 자기 게임을 최신순으로 줄 세우고, 계정 순서(그 계정의 가장 최근 게시물이 앞선 순)대로 한 장씩 번갈아 뽑는다
// 한 계정 게임이 바닥나면 남은 계정끼리 계속, 최대 max장
export function roundRobinByCurator<T extends { curator: string }>(itemsNewestFirst: T[], max = HOME_CURATOR_CARDS): T[] {
  const queues = new Map<string, T[]>(); // Map은 처음 들어온 순서를 지킨다 = 계정의 가장 최근 게시물 순
  for (const it of itemsNewestFirst) (queues.get(it.curator) ?? queues.set(it.curator, []).get(it.curator)!).push(it);
  const lists = [...queues.values()];
  const out: T[] = [];
  for (let round = 0; out.length < max; round++) {
    let took = false;
    for (const list of lists) {
      if (out.length >= max) break;
      if (round < list.length) { out.push(list[round]); took = true; }
    }
    if (!took) break;
  }
  return out;
}

// 게시물 목록(최신순)에서 게임마다 가장 최신 게시물 하나만 — 같은 게임을 여러 계정이 소개했으면 최신 게시물의 계정이 출처
export function latestPerGame<T extends { game_id: string }>(postsNewestFirst: T[]): T[] {
  const seen = new Set<string>();
  return postsNewestFirst.filter((p) => (seen.has(p.game_id) ? false : (seen.add(p.game_id), true)));
}
