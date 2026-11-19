'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameIndex } from '../../../lib/useGameIndex';
import { makeAbCtx, makeKwMatcher } from '../../../lib/abCtx';
import { OPTS, badgesFor, groupTotal, parseQuery, queryHref, search, type AbQuery, type OptKey } from '../../../lib/abSearch';
import AbSearch from './AbSearch';
import PosterImage from '../mn/PosterImage';
import SectionHead from '../../brand/SectionHead';
import { BracketCorners } from '../../brand/SelectBrackets';
import { getPriceInfo, PRICE_TYPE_LABEL } from '../../../lib/price';
import { playersText } from '../../../lib/players';
import { barrierLabel } from '../../../lib/cardInfo';
import { gameName } from '../../../lib/gameName';
import { isComingSoon, comingSoonLabel } from '../../../lib/release';
import { summaryParts } from '../../../lib/abSearch';
import Loader from '../../status/Loader';
import ShareButton from '../../ShareButton';
import '../mn/mn.css';
import { PAGE_SIZE } from '../../../lib/useGameFilters';
import './ab.css';

// 에어비앤비식 검색 결과(docs/design/PageSearch.dc.html) — 맨 위 조건이 채워진 검색 바(+ 다시 찾기) → 왼쪽 "더 좁히기" 칩 + 오른쪽 가로 결과 카드(포스터 96px · 이름 · 정보 줄 · 근거 배지 · 오른쪽 끝 Steam 가격). 1등 카드(카드 전체)만 괄호 + "가장 잘 맞아요"
// 시안의 "정렬"·"한 판 시간" 필터는 정렬·플레이 시간 기능이 아직 없어 그리지 않는다
// 파티 합산("N명 다 사면")은 파티제 도입 전까지 그리지 않는다 (SHOW_GROUP_TOTAL)
// 조건은 전부 주소 쿼리(n·how·g·kw·o)에 있어서 링크로 공유된다. 결과가 0개면 덜 중요한 조건부터 풀고 알려 준다
const SHOW_GROUP_TOTAL = false;

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

  const sum = summaryParts(q);
  const optLabels = OPTS.filter((o) => q.opts.includes(o.key)).map((o) => o.label);
  const summary = [sum.who, sum.how, sum.what, ...optLabels].filter(Boolean).join(' · ') || '조건 없음';

  return (
    <div className="ab-res mn-wrap">
      <AbSearch games={index.games} initial={q} variant="results" onSubmit={go} />

      <div className="find-layout">
        <aside className="find-filter" aria-label="더 좁히기">
          <p className="sec-label">더 좁히기</p>
          <div className="ab-opts" role="group" aria-label="조건">
            {OPTS.map((o) => (
              <button key={o.key} type="button" className="mn-chip" aria-pressed={q.opts.includes(o.key)} onClick={() => toggleOpt(o.key)}>{o.label}</button>
            ))}
          </div>
        </aside>

        <div className="find-main">
          {!result ? (
            index.error ? (
              <div className="results-empty">
                <p className="results-empty-title">게임 목록을 불러오지 못했어요</p>
                <div className="results-empty-actions"><button type="button" className="btn btn-outline" onClick={index.retry}>다시 시도</button></div>
              </div>
            ) : <Loader />
          ) : (
            <>
              {result.genresAny && <p className="ab-gm-note" role="status">선택한 장르를 모두 가진 게임이 없어서, 하나라도 해당하는 게임을 보여줘요</p>}
              <SectionHead id="find-h" label={summary} title={`조건에 맞는 게임 ${result.list.length.toLocaleString('ko-KR')}개`} actions={<ShareButton variant="text" title="게임 검색 결과" text="이 조건으로 찾은 게임들 같이 보자!" />} />
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
                  <ul className="fr-list">
                    {result.list.slice(0, shown).map((g, i) => {
                      const badges = badgesFor(g, q, result.parts, ctx);
                      const total = SHOW_GROUP_TOTAL ? groupTotal(g, q.n) : null;
                      const price = getPriceInfo(g);
                      const barrier = barrierLabel(g);
                      const meta = [playersText(g), barrier ? `진입장벽 ${barrier}` : '', g.review_percent ? `${g.review_summary ? `${g.review_summary} ` : ''}${g.review_percent}%` : ''].filter(Boolean).join(' · ');
                      const first = i === 0;
                      return (
                        <li key={g.id} className={`fr-row${first ? ' sb-host' : ''}`}>
                          <Link href={`/games/${g.id}`} prefetch={false} className="fr-poster-link" aria-label={`${gameName(g)} 보기`}>
                            <span className="fr-poster sb-host">
                              <PosterImage cover={{ vertical: g.cover_vertical_url ?? null, appid: g.steam_appid ?? null, wide: g.card_image_url || g.cover_image_url || null }} eager={i < 4} />
                            </span>
                          </Link>
                          {first && <BracketCorners size="card" on />}
                          <div className="fr-body">
                            {first && <span className="fr-best">가장 잘 맞아요</span>}
                            <Link href={`/games/${g.id}`} prefetch={false} className="fr-name">{gameName(g)}</Link>
                            {meta && <span className="fr-meta">{meta}</span>}
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
                          </div>
                          <div className="fr-price">
                            <span className="fr-price-label">Steam 가격</span>
                            {isComingSoon(g) ? <span className="fr-price-now">{comingSoonLabel(g)}</span>
                              : g.is_free ? <span className="fr-price-now">무료</span>
                              : PRICE_TYPE_LABEL[g.price_type] ? <span className="fr-price-now">{PRICE_TYPE_LABEL[g.price_type]}</span>
                              : price ? (
                                <>
                                  <span className="fr-price-now">{price.formattedFinal}</span>
                                  {price.discount > 0 && <span className="fr-price-sale"><span className="mn-sale">-{price.discount}%</span><s>{price.formattedOriginal}</s></span>}
                                </>
                              ) : null}
                          </div>
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
      </div>
    </div>
  );
}
