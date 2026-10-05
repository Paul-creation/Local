'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MAX_COMPARE } from '../lib/compareRule';
import { readMeta, writePick, useComparePick, type PickMeta } from '../lib/compareStore';
import GameImage from './GameImage';

// 모든 페이지 오른쪽 아래 작은 알약 "비교 N/3" (1개 이상 담겼을 때만). 누르면 작은 팝오버:
// 담긴 게임(썸네일 + 이름 + × 빼기), "비교하기", "모두 비우기". 바깥을 누르거나 Esc면 닫힘
// 비교 화면(/compare)에서는 칸에 이미 보이므로 숨김
export default function CompareTray() {
  const { ids, bumpAt } = useComparePick();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Record<string, PickMeta>>({});
  const [bump, setBump] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 이름·썸네일: 기억해 둔 것 먼저, 없는 게임만 한 번 불러옴
  useEffect(() => {
    if (!ids.length) return;
    const known = readMeta();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage에 기억한 이름을 바로 보여 줌
    setMeta(known);
    const missing = ids.filter((id) => !known[id]);
    if (!missing.length) return;
    let alive = true;
    // DB 조회 코드는 필요할 때만 받는다 (모든 페이지 첫 로드 JS에 싣지 않음)
    import('../lib/visibleGames').then(({ selectGames }) => selectGames('id, name, cover_image_url').in('id', missing)).then(({ data }) => {
      if (!alive || !data) return;
      setMeta((m) => {
        const next = { ...m };
        for (const g of data as { id: string; name: string; cover_image_url: string | null }[]) next[g.id] = { id: g.id, name: g.name, thumb: g.cover_image_url };
        return next;
      });
    });
    return () => { alive = false; };
  }, [ids]);

  // 상세에서 담았을 때 0.3초 동안 살짝 튀어 오름
  useEffect(() => {
    if (!bumpAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 담기 이벤트에 맞춘 짧은 애니메이션
    setBump(true);
    const t = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(t);
  }, [bumpAt]);

  // 바깥 누르기·Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // 다 비우면 팝오버도 닫음
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록이 비면 닫기
    if (!ids.length) setOpen(false);
  }, [ids.length]);

  if (!ids.length || pathname.startsWith('/compare') || pathname.startsWith('/admin')) return null;

  const remove = (id: string) => writePick(ids.filter((x) => x !== id), { source: 'tray' });

  return (
    <div className="ctray" ref={boxRef}>
      {open && (
        <div className="ctray-pop" role="dialog" aria-label="비교함">
          <p className="ctray-title">비교함 <span className="num">{ids.length}/{MAX_COMPARE}</span></p>
          <ul className="ctray-list">
            {ids.map((id) => (
              <li key={id} className="ctray-item">
                <Link href={`/games/${id}`} className="ctray-game" onClick={() => setOpen(false)}>
                  {meta[id]?.thumb ? <GameImage src={meta[id].thumb} steamSize="capsule_sm_120" alt="" /> : <span className="ctray-noimg" />}
                  <span className="ctray-name">{meta[id]?.name || '불러오는 중…'}</span>
                </Link>
                <button type="button" className="ctray-remove" onClick={() => remove(id)} aria-label={`${meta[id]?.name || '게임'} 비교에서 빼기`}>×</button>
              </li>
            ))}
          </ul>
          {ids.length < 2 && <p className="ctray-hint">한 개 더 담으면 비교할 수 있어요</p>}
          <div className="ctray-actions">
            <button type="button" className="ctray-clear" onClick={() => writePick([], { source: 'tray' })}>모두 비우기</button>
            {ids.length >= 2 ? (
              <Link href={`/compare?ids=${ids.join(',')}`} className="btn btn-primary ctray-go" onClick={() => setOpen(false)}>비교하기</Link>
            ) : (
              <Link href="/compare" className="btn btn-outline ctray-go" onClick={() => setOpen(false)}>더 고르기</Link>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className={`ctray-pill${bump ? ' is-bump' : ''}${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        비교 <span className="num">{ids.length}/{MAX_COMPARE}</span>
      </button>
    </div>
  );
}
