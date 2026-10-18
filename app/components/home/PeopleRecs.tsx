'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameCard from './GameCard';
import { useMyPc } from '../pcspec/useMyPc';
import { toUserPc } from '../../lib/myPc';
import { runsOnMyPc } from '../../lib/specJudge';
import type { PeopleRecs as Data } from '../../lib/peopleRecs';
import { choosePeopleGames, PEOPLE_CANDIDATES } from '../../lib/peopleShow';
import { usePeople } from './PeopleContext';
import { peopleLabel, peopleHref } from './PeopleSelect';
import LibraryLink from './LibraryLink';

// 메인 인원별 추천 — 서버가 인원 4종 후보를 한 번에 보냈으므로 버튼을 눌러도 페이지 이동·추가 요청 없이 바로 바뀐다
// 서버가 인원별 후보 8개(재부상 5 + 신작 3, 앞 3개가 재부상 2 + 신작 1)를 날짜 시드로 골라 보냄. 카드 왼쪽 위 배지는 다시 뜨는 중·신작·스트리머 화제 (recs.badges)
// 후보 8개 전부를 가로 캐러셀(scroll-snap)로 보여준다. PC는 3.5장 + 좌우 화살표(끝에서 비활성), 모바일은 1.15장 스와이프. 마지막에 "전체 보기" 카드
// 내 PC 토글(기본 꺼짐)이 꺼져 있거나 사양이 없으면 후보 전부, 켜져 있으면 최소 사양 통과 게임만
// (통과가 1~2개면 그만큼만 보여주고, 0개면 필터 전 앞 3개 + 안내 한 줄과 필터 끄기 버튼. 후보 자체가 없을 때만 "추천 게임이 아직 없어요")
// "전체 보기"는 메인 검색 주소(?players=)에 같은 조건(내 PC 포함)을 담아 연결
export default function PeopleRecs({ recs }: { recs: Data | null }) {
  const { n, myPcOn, setMyPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const { games, filteredOut } = useMemo(() => {
    if (!recs) return { games: [], filteredOut: false };
    const user = myPcActive && pc ? toUserPc(pc) : null;
    return choosePeopleGames(recs.ids[n].map((id) => recs.games[id]), user ? (g) => runsOnMyPc(user, g) : null, PEOPLE_CANDIDATES);
  }, [recs, n, myPcActive, pc]);
  // 카드 수가 바뀌면(인원·내 PC 필터 전환) 모바일 가로 줄을 맨 앞으로 — 안 그러면 브라우저가 이전에 맞춰 둔 카드를 따라가 첫 카드가 잘린 채로 보인다
  const rowRef = useRef<HTMLDivElement>(null);
  const gamesKey = games.map((g) => g.id).join(',');
  const [edge, setEdge] = useState({ start: true, end: false });
  const updateEdge = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);
  useEffect(() => { rowRef.current?.scrollTo({ left: 0, behavior: 'instant' }); updateEdge(); }, [gamesKey, updateEdge]);
  useEffect(() => {
    window.addEventListener('resize', updateEdge);
    return () => window.removeEventListener('resize', updateEdge);
  }, [updateEdge]);
  const page = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9 });
  };
  if (!recs) return null;
  const href = peopleHref(n, myPcActive);
  return (
    <section className="home-block people-block" aria-labelledby="people-recs-title">
      <div className="home-block-head">
        <h2 id="people-recs-title" className="section-title">{peopleLabel(n)} 추천 게임</h2>
        {games.length > 3 && (
          <div className="people-arrows">
            <button type="button" className="people-arrow" aria-label="이전 추천 게임" disabled={edge.start} onClick={() => page(-1)}>‹</button>
            <button type="button" className="people-arrow" aria-label="다음 추천 게임" disabled={edge.end} onClick={() => page(1)}>›</button>
          </div>
        )}
      </div>
      {filteredOut && (
        <div className="people-empty-box">
          <p className="people-empty">내 PC 사양을 통과한 추천이 없어 전체 추천을 보여줘요</p>
          <button type="button" className="btn btn-outline" onClick={() => setMyPcOn(false)}>내 PC 필터 끄기</button>
        </div>
      )}
      {games.length > 0 ? (
        <div className="people-cards" ref={rowRef} onScroll={updateEdge} tabIndex={0} role="region" aria-label={`${peopleLabel(n)} 추천 게임 목록`}>
          {games.map((g, i) => (
            <div key={g.id} className="people-item">
              <GameCard game={g} eager={i === 0} badge={recs.badges[g.id]?.length ? <span className="gc-trend">{recs.badges[g.id].map((b) => <span key={b}>{b}</span>)}</span> : undefined} />
            </div>
          ))}
          <div className="people-item people-end">
            <a href={href} className="people-end-card">{peopleLabel(n)} 게임 전체 보기 →</a>
          </div>
        </div>
      ) : (
        <p className="people-empty">조건에 맞는 추천 게임이 아직 없어요</p>
      )}
      <div className="people-links">
        <a href={href} className="people-more">{peopleLabel(n)} 게임 전체 보기 →</a>
        <LibraryLink />
      </div>
    </section>
  );
}
