'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameIndex } from '../../../lib/useGameIndex';
import { makeAbCtx, makeKwMatcher } from '../../../lib/abCtx';
import { OPTS, badgesFor, groupTotal, parseQuery, queryHref, search, type AbQuery, type OptKey } from '../../../lib/abSearch';
import GameCard from '../GameCard';
import AbSearch from './AbSearch';
import Loader from '../../status/Loader';
import ShareButton from '../../ShareButton';
import { PAGE_SIZE } from '../../../lib/useGameFilters';
import './ab.css';

// 에어비앤비식 검색 결과 — 맨 위 접힌 검색창 → 조건 칩(누르면 바로 다시 필터) → 카드(근거 배지 + "N명 다 사면") 순
// 조건은 전부 주소 쿼리(n·how·g·kw·o)에 있어서 링크로 공유된다. 결과가 0개면 덜 중요한 조건부터 풀고 알려 준다
export default function AbResults() {
  const sp = useSearchParams();
  const router = useRouter();
  const index = useGameIndex();
  const q = useMemo(() => parseQuery(sp), [sp]);
  const [shown, setShown] = useState(PAGE_SIZE);

  const ctx = useMemo(() => makeAbCtx(index.tree), [index.tree]);
  const kw = useMemo(() => makeKwMatcher(index.tree), [index.tree]);
  const result = useMemo(() => (index.games ? search(index.games, q, ctx, kw) : null), [index.games, q, ctx, kw]);

  // 조건이 바뀌면 처음 24개부터
  const key = sp.toString();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 조건(주소)이 바뀔 때 목록 길이를 되돌리는 동기화
    setShown(PAGE_SIZE);
  }, [key]);

  const go = (next: AbQuery) => router.replace(queryHref(next), { scroll: false });
  const toggleOpt = (o: OptKey) => go({ ...q, opts: q.opts.includes(o) ? q.opts.filter((x) => x !== o) : [...q.opts, o] });

  return (
    <div className="ab-res mn-wrap">
      <Link href="/" className="results-home ab-back">← 홈으로</Link>
      <AbSearch games={index.games} initial={q} variant="results" onSubmit={go} />

      <div className="ab-opts" role="group" aria-label="조건">
        {OPTS.map((o) => (
          <button key={o.key} type="button" className={`mn-chip${q.opts.includes(o.key) ? ' on' : ''}`} aria-pressed={q.opts.includes(o.key)} onClick={() => toggleOpt(o.key)}>{o.label}</button>
        ))}
      </div>

      {!result ? (
        index.error ? (
          <div className="results-empty">
            <p className="results-empty-title">게임 목록을 불러오지 못했어요</p>
            <div className="results-empty-actions"><button type="button" className="btn btn-outline" onClick={index.retry}>다시 시도</button></div>
          </div>
        ) : <Loader />
      ) : (
        <>
          <div className="ab-head">
            <h1 className="ab-count-h">같이 할 만한 게임 <strong className="num">{result.list.length.toLocaleString('ko-KR')}</strong>개</h1>
            <ShareButton variant="text" title="게임 검색 결과" text="이 조건으로 찾은 게임들 같이 보자!" />
          </div>
          {result.relaxed.length > 0 && (
            <p className="ab-relaxed" role="status">조건을 조금 넓혔어요 <span>({result.relaxed.join(', ')} 조건을 뺐어요)</span></p>
          )}
          {result.list.length === 0 ? (
            <div className="results-empty">
              <p className="results-empty-title">맞는 게임을 찾지 못했어요</p>
              <p className="results-empty-summary">조건을 바꿔서 다시 찾아 보세요.</p>
              <div className="results-empty-actions"><Link href="/find" className="btn btn-outline">조건 모두 지우기</Link></div>
            </div>
          ) : (
            <>
              <ul className="ab-grid">
                {result.list.slice(0, shown).map((g, i) => {
                  const badges = badgesFor(g, q, result.parts, ctx);
                  const total = groupTotal(g, q.n);
                  return (
                    <li key={g.id} className="ab-item">
                      <GameCard game={g} tree={index.tree} eager={i < 4} />
                      {(badges.length > 0 || total) && (
                        <div className="ab-evidence" data-tour={i === 0 ? 'evidence' : undefined}>
                          {badges.length > 0 && (
                            <ul className="ab-badges" aria-label="이 게임이 조건에 맞는 이유">
                              {badges.map((b) => (
                                <li key={b.text} className={b.ok ? 'is-ok' : 'is-warn'}><span aria-hidden="true">{b.ok ? '✓' : '⚠'}</span><span className="ab-sr">{b.ok ? '맞음: ' : '주의: '}</span>{b.text}</li>
                              ))}
                            </ul>
                          )}
                          {total && <p className="ab-total">{total}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {result.list.length > shown && (
                <div className="results-more">
                  <button type="button" className="btn btn-outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>더 보기 ({shown}/{result.list.length})</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

