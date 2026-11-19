'use client';

import { useMemo } from 'react';
import PosterCard, { posterBadge } from './PosterCard';
import SectionHead from '../../brand/SectionHead';
import { useMyPc } from '../../pcspec/useMyPc';
import { toUserPc } from '../../../lib/myPc';
import { runsOnMyPc } from '../../../lib/specJudge';
import { getPriceInfo } from '../../../lib/price';
import { hasDemo, type ReleaseGame } from '../../../lib/release';
import type { PeopleRecs as Data } from '../../../lib/peopleRecs';
import { choosePeopleGames } from '../../../lib/peopleShow';
import { usePeople } from '../PeopleContext';
import { peopleLabel, peopleHref, trendingHref } from '../PeopleSelect';
import LibraryLink from '../LibraryLink';
import PeopleTabs from './PeopleTabs';
import PeopleChips from './PeopleChips';

// 메인 "N인 추천 게임" — 서버가 인원 4종 후보를 한 번에 보냈으므로 인원 탭을 눌러도 이동·추가 요청 없이 바로 바뀐다
// 후보(재부상 + 신작, 날짜 시드 순서)에서 필터 칩(무료·출시 전 데모·지금 할인 중)을 거치고, 내 PC 토글이 켜져 있으면 최소 사양 통과 게임만 거른 뒤(규칙은 lib/peopleShow) 앞 6개를 세로 표지 카드로
// 6장은 컨테이너 폭에 딱 맞는 격자(데스크톱 6열 · 태블릿 3열 · 휴대폰 2~3열) — 가로 스크롤이 없어 잘리는 카드가 없다
const SHOW = 6;

export default function PeopleSection({ recs }: { recs: Data | null }) {
  const { n, myPcOn, setMyPcOn, chips } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const chipOn = chips.free || chips.demo || chips.sale;
  const { games, filteredOut } = useMemo(() => {
    if (!recs) return { games: [], filteredOut: false };
    const user = myPcActive && pc ? toUserPc(pc) : null;
    const pool = recs.ids[n].map((id) => recs.games[id]).filter((g) =>
      (!chips.free || !!g.is_free) && (!chips.demo || hasDemo(g as ReleaseGame)) && (!chips.sale || (getPriceInfo(g)?.discount ?? 0) > 0));
    return choosePeopleGames(pool, user ? (g) => runsOnMyPc(user, g) : null, SHOW);
  }, [recs, n, myPcActive, pc, chips]);
  // 지금 켜진 칩을 검색 주소에 그대로 실어 "전체 보기"가 같은 조건으로 열리게
  const chipQuery = `${chips.free ? '&price=0-0' : ''}${chips.sale ? '&sale=1' : ''}${chips.demo ? '&demo=1' : ''}`;
  const allHref = `${peopleHref(n, myPcActive)}${chipQuery}`;
  // 추천 데이터가 없어도 머리(제목 + 인원 탭)는 그린다 — 탭이 그 인원의 검색 결과로 가는 길이라서
  return (
    <section className="mn-sec" aria-labelledby="mn-people-title">
      <SectionHead id="mn-people-title" title={`${peopleLabel(n)} 추천 게임`} more={{ href: trendingHref(n, myPcActive), text: '뜨는 게임 더 보기', hard: true }} />
      <div className="mn-filter-row">
        <PeopleTabs />
        <span className="mn-vsep" aria-hidden="true" />
        <PeopleChips />
      </div>
      {filteredOut && (
        <p className="mn-note">
          내 PC 사양을 통과한 추천이 없어 전체 추천을 보여줘요
          <button type="button" className="mn-chip" onClick={() => setMyPcOn(false)}>내 PC 필터 끄기</button>
        </p>
      )}
      {!recs ? null : games.length > 0 ? (
        <ul className="mn-grid" aria-label={`${peopleLabel(n)} 추천 게임 목록`}>
          {games.map((g, i) => <li key={g.id}><PosterCard brackets game={g} eager={i < 3} tourId={i === 0 ? 'first-card' : undefined} badge={posterBadge(g, recs.badges[g.id])} /></li>)}
        </ul>
      ) : (
        <p className="mn-note">
          {chipOn ? '고른 조건에 맞는 추천 게임이 지금은 없어요' : '조건에 맞는 추천 게임이 아직 없어요'}
          {chipOn && <a href={allHref} className="sec-more">이 조건으로 전체 게임 보기 →</a>}
        </p>
      )}
      {recs && <div className="mn-links">
        <a href={allHref} className="sec-more">{peopleLabel(n)} 게임 전체 보기 →</a>
        <LibraryLink />
      </div>}
    </section>
  );
}
