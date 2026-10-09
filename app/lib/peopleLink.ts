// 메인 인원 버튼이 가는 검색 주소 — 순수 함수라 테스트(peopleLink.test.mjs)가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
// 인원 범위 표기는 rangeFilter의 formatPlayers와 같다: 2~4인은 "N-N", 5인 이상은 "5-최대인원"(playersMax = PLAYERS_MAX)

// "N인 게임 전체 보기" 주소 — 메인 검색 주소(?players=)에 인원과 내 PC 조건을 담는다
export const peopleHref = (n: number, myPc: boolean, playersMax: number) =>
  `/?players=${n >= 5 ? `5-${playersMax}` : `${n}-${n}`}${myPc ? '&mypc=1' : ''}`;

// 인원 버튼을 눌렀을 때 이동할 주소. 인원별 추천 데이터가 있으면(recsReady) null — 이동 없이 아래 추천만 바뀐다
export const peopleButtonTarget = (recsReady: boolean, n: number, myPc: boolean, playersMax: number): string | null =>
  recsReady ? null : peopleHref(n, myPc, playersMax);
