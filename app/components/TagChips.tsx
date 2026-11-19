'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { getTagDescription } from './search/TagHelp';
import { chipHref } from '../lib/tagChipHref';
import type { ChipGroup } from '../lib/tagGroups';

// 상세 "특징" 칩 — 그룹 구분 없이 한 줄로 이어진 칩(radius 4). 태그는 누르면 그 태그의 게임 목록으로 이동
// 특별 칩(TOP 10·올해의 게임)은 링크 없이 눌러서 설명만 고정. 칩을 호버·포커스하면 그 태그 설명이 아래에 한 줄 보인다 (안내 문구는 평소엔 없음)
export default function TagChips({ groups }: { groups: ChipGroup[] }) {
  const hintId = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const chips = groups.flatMap((g) => g.chips);
  const shown = hover ?? focus ?? pinned;
  const chip = shown ? chips.find((c) => c.text === shown) : undefined;
  const desc = shown ? chip?.desc || getTagDescription(shown) || '아직 설명이 없는 태그예요' : '';

  return (
    <>
      <div className="gd-chips">
        {chips.map((c) => {
          const href = chipHref(c);
          const handlers = {
            onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(c.text); },
            onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(null); },
            onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) setFocus(c.text); },
            onBlur: () => setFocus(null),
          };
          return href ? (
            <Link key={c.text} href={href} className="gd-chip is-tag" aria-describedby={hintId} {...handlers}>{c.text}</Link>
          ) : (
            <button
              key={c.text}
              type="button"
              className="gd-chip is-tag"
              aria-describedby={hintId}
              aria-pressed={pinned === c.text}
              {...handlers}
              onClick={() => setPinned((v) => (v === c.text ? null : c.text))}
            >{c.text}</button>
          );
        })}
      </div>
      <p id={hintId} className="gd-chip-desc" aria-live="polite">
        {shown ? <><strong>{shown}</strong> {desc}</> : null}
      </p>
    </>
  );
}
