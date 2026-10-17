'use client';

import { useMemo, useState } from 'react';
import ResultCard from '../search/ResultCard';
import PeopleProvider, { usePeople } from '../home/PeopleContext';
import { peopleLabel } from '../home/PeopleSelect';
import { useOwned } from '../owned/useOwned';
import { useGameIndex } from '../../lib/useGameIndex';
import { useTaste } from '../../lib/useTaste';
import { friendGames } from '../../lib/library';
import { MIN_OWNED_FOR_TASTE, rankByTaste } from '../../lib/taste';
import { getPriceInfo } from '../../lib/price';
import { PEOPLE_CHOICES } from '../../lib/peopleRecs';
import { buildTree, type TagDict } from '../../lib/tagTree';
import tagDict from '../../lib/tag-search-dict.json';

const TREE = buildTree(tagDict as unknown as TagDict);
const PAGE = 12;
type Tab = 'friends' | 'taste';

// 내 라이브러리 (/library) — 로그인한 사용자의 보유 게임으로 "친구랑 할 게임"과 "취향 비슷한 게임"을 보여준다
// 보유 목록과 취향 계산은 전부 브라우저 안에서 — 서버로 보내지 않는다 (취향 탭은 게임별 태그·득표·활동만 받아 온다, /api/games/taste)
// 상태: 확인 중(정지된 틀) / 로그인 안 함 / 스팀 프로필 비공개 / 아직 못 가져옴 / 보유 0개 / 정상
export default function LibraryView() {
  return (
    <PeopleProvider filters={null}>
      <Library />
    </PeopleProvider>
  );
}

function Library() {
  const owned = useOwned();
  const { games: index, error: indexError, retry } = useGameIndex();
  const [tab, setTab] = useState<Tab>('friends');
  const ok = owned.ready && owned.visibility === 'public' && owned.count > 0;

  const ownedGames = useMemo(() => (index && ok ? (index as any[]).filter((g) => owned.has(g.steam_appid)) : []), [index, ok, owned]); // eslint-disable-line @typescript-eslint/no-explicit-any

  const head = (
    <>
      <h1 className="section-title lib-title">내 라이브러리</h1>
      <p className="lib-note">Steam 보유 게임 중 이 사이트에 등록된 게임으로 골라 줘요. 계산은 내 브라우저 안에서만 해요.</p>
    </>
  );

  if (!owned.ready) return <>{head}<div className="lib-skel" aria-hidden="true" /></>;
  if (owned.visibility === null) {
    return (
      <>{head}
        <div className="lib-state">
          <p>Steam으로 로그인하면 내가 가진 게임으로 친구랑 할 게임과 취향이 비슷한 게임을 골라 줘요.</p>
          <a className="btn btn-outline" href="/api/auth/steam/login?next=/library">Steam으로 로그인</a>
        </div>
      </>
    );
  }
  if (owned.visibility === 'private') {
    return <>{head}<div className="lib-state"><p>스팀 프로필의 게임 세부 정보를 공개로 바꾸면 내 라이브러리를 볼 수 있어요. 공개로 바꾼 뒤 다시 로그인하면 바로 가져와요.</p></div></>;
  }
  if (owned.visibility === 'unknown') {
    return <>{head}<div className="lib-state"><p>보유 게임을 아직 가져오지 못했어요. 잠시 뒤 다시 열어 보세요.</p></div></>;
  }
  if (owned.count === 0) {
    return <>{head}<div className="lib-state"><p>이 사이트에 등록된 게임 중 가진 게임이 아직 없어요.</p></div></>;
  }
  if (indexError) {
    return <>{head}<div className="lib-state"><p>게임 목록을 불러오지 못했어요.</p><button type="button" className="btn btn-outline" onClick={retry}>다시 시도</button></div></>;
  }

  return (
    <>
      {head}
      <div className="tabs lib-tabs" role="group" aria-label="보기">
        <button type="button" className="tab" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>친구랑 할 게임</button>
        <button type="button" className="tab" aria-pressed={tab === 'taste'} onClick={() => setTab('taste')}>취향 비슷한 게임</button>
      </div>
      {!index ? <div className="lib-skel" aria-hidden="true" /> : tab === 'friends' ? <FriendsTab games={ownedGames} /> : <TasteTab ownedGames={ownedGames} index={index} ownedCount={owned.count} />}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
function Grid({ games }: { games: any[] }) {
  const [shown, setShown] = useState(PAGE);
  const list = games.slice(0, shown);
  return (
    <>
      <div className="similar-grid">
        {list.map((g, i) => <ResultCard key={g.id} game={g} tree={TREE} compact eager={i < 2} />)}
      </div>
      {list.length < games.length && <button type="button" className="btn btn-outline lib-more" onClick={() => setShown((n) => n + PAGE)}>{Math.min(PAGE, games.length - list.length)}개 더 보기</button>}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FriendsTab({ games }: { games: any[] }) {
  const { n, setN } = usePeople();
  const { fit, other } = useMemo(() => friendGames(games, n), [games, n]);
  return (
    <section aria-label="친구랑 할 게임">
      <div className="people-btns lib-people" role="group" aria-label="몇 명이서 할까요?">
        {PEOPLE_CHOICES.map((v) => (
          <button key={v} type="button" className={`people-btn${n === v ? ' on' : ''}`} aria-pressed={n === v} onClick={() => setN(v)}>{peopleLabel(v)}</button>
        ))}
      </div>
      {fit.length + other.length === 0 ? (
        <div className="lib-state"><p>보유 게임 중에 온라인 협동·대전이 확인된 게임이 없어요.</p></div>
      ) : (
        <>
          {fit.length > 0 ? (
            <>
              <h2 className="lib-sub">{peopleLabel(n)}으로 할 수 있는 게임 {fit.length}개</h2>
              <Grid key={`fit${n}`} games={fit} />
            </>
          ) : (
            <p className="lib-empty">{peopleLabel(n)}에 맞는 보유 게임은 없어요.</p>
          )}
          {other.length > 0 && (
            <>
              <h2 className="lib-sub">다른 인원으로 하는 온라인 게임 {other.length}개</h2>
              <Grid key={`other${n}`} games={other} />
            </>
          )}
        </>
      )}
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TasteTab({ ownedGames, index, ownedCount }: { ownedGames: any[]; index: any[]; ownedCount: number }) {
  const enough = ownedCount >= MIN_OWNED_FOR_TASTE;
  const { rows, error, retry } = useTaste(enough);
  const ranked = useMemo(() => {
    if (!rows) return null;
    const byId = new Map(index.map((g) => [g.id, g]));
    const ownedIds = new Set(ownedGames.map((g) => g.id as string));
    return rankByTaste(rows, ownedIds, (id) => { const g = byId.get(id); return (g && getPriceInfo(g)?.discount) || 0; }, (id) => byId.get(id)?.heat_rank ?? Infinity)
      .map((r) => byId.get(r.id))
      .filter(Boolean);
  }, [rows, index, ownedGames]);

  if (!enough) return <div className="lib-state"><p>게임이 더 쌓이면 취향 추천이 열려요. (보유 게임 {MIN_OWNED_FOR_TASTE}개부터, 지금 {ownedCount}개)</p></div>;
  if (error) return <div className="lib-state"><p>취향 정보를 불러오지 못했어요.</p><button type="button" className="btn btn-outline" onClick={retry}>다시 시도</button></div>;
  if (!ranked) return <div className="lib-skel" aria-hidden="true" />;
  if (ranked.length === 0) return <div className="lib-state"><p>보유 게임과 겹치는 취향 정보가 아직 부족해요.</p></div>;
  return (
    <section aria-label="취향 비슷한 게임">
      <h2 className="lib-sub">내가 가진 게임과 취향이 비슷한 게임</h2>
      <p className="lib-note">보유하지 않은 게임을 태그·활동이 비슷한 순으로 보여줘요. 할인 중이면 순서가 조금 올라가요.</p>
      <Grid games={ranked} />
    </section>
  );
}
