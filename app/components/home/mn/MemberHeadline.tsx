'use client';

import { useEffect, useState } from 'react';
import { fetchMyName } from '../../AuthMenu';

// 로그인 후 메인 멘트 — docs/design/hero-lines.json의 lines를 2시간마다 하나씩 (index = floor(Date.now() / 7200000) % 개수), {name}은 스팀 닉네임으로 치환
// 서버에서 고르면 ISR 캐시 때문에 안 바뀌므로 브라우저에서 고른다. 하이드레이션 전(첫 HTML)은 1번 멘트. 애니메이션 없음
const SLOT_MS = 2 * 60 * 60 * 1000;
const slotOf = (n: number) => Math.floor(Date.now() / SLOT_MS) % n;

export default function MemberHeadline({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!lines.length) return;
    let timer: number;
    const tick = () => {
      setIndex(slotOf(lines.length));
      timer = window.setTimeout(tick, SLOT_MS - (Date.now() % SLOT_MS)); // 탭을 오래 열어 둬도 다음 2시간 경계에 바뀜
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [lines.length]);
  useEffect(() => {
    let alive = true;
    fetchMyName().then((n) => { if (alive) setName(n); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!lines.length) return null;
  return <h1 className="mn-member-h1">{lines[index].replaceAll('{name}', name || '스팀 사용자')}</h1>;
}
