'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { getTagDescription } from './search/TagHelp';
import type { ChipGroup } from '../lib/tagGroups';

const DEFAULT_HINT = '태그를 누르면 같은 태그의 게임 목록이 열려요';

// 누르면 이동할 목록 주소 — 메인 검색 결과(?r=1)에 태그 필터를 담는다 (useGameFilters가 tags를 읽음).
// 태그 나무 칸은 번호, 협동·대전은 이름(FLAG_TAGS), '혼자 플레이'는 분류(cat). 특별 칩(TOP 10·올해의 게임)은 태그가 아니라 링크 없음
const PLAY_TAGS = new Set(['협동', '온라인 협동', '로컬 협동', '대전']);
function chipHref(c: { text: string; kind: string; tagId?: number }): string | null {
  if (c.tagId != null) return `/?r=1&tags=${c.tagId}`;
  if (c.kind === 'play') {
    if (PLAY_TAGS.has(c.text)) return `/?r=1&tags=${encodeURIComponent(c.text)}`;
    if (c.text === '혼자 플레이') return `/?r=1&cat=${encodeURIComponent('혼자')}`;
  }
  return null;
}

// 상세 태그 목록 — 그룹별 줄(수상·순위 / 플레이 방식 / 장르 / 특징). 칩을 호버·포커스하면 아래 한 줄 안내 영역에 설명이 바뀌어 보이고(높이 고정), 누르면 그 태그의 게임 목록으로 이동
// 링크라는 표시는 호버·포커스 때 포인트색 테두리뿐 (평소에는 그대로 칩 모양). 특별 칩은 링크 없이 눌러서 설명만 고정
export default function TagChips({ groups }: { groups: ChipGroup[] }) {
  const hintId = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = hover ?? focus ?? pinned;
  const chip = shown ? groups.flatMap((g) => g.chips).find((c) => c.text === shown) : undefined;
  const desc = shown ? chip?.desc || getTagDescription(shown) || '아직 설명이 없는 태그예요' : '';

  return (
    <div className="tag-block">
      {groups.map((g) => (
        <div key={g.label} className="tag-group">
          <span className="tag-group-label">{g.label}</span>
          <div className="main-tag-row">
            {g.chips.map((c) => {
              const href = chipHref(c);
              const handlers = {
                onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(c.text); },
                onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(null); },
                onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) setFocus(c.text); },
                onBlur: () => setFocus(null),
              };
              return href ? (
                <Link key={c.text} href={href} className="category-tag tag-chip-btn" aria-describedby={hintId} {...handlers}>{c.text}</Link>
              ) : (
              <button
                key={c.text}
                type="button"
                className={`category-tag tag-chip-btn${c.kind === 'special' ? ' tag-special' : ''}`}
                aria-describedby={hintId}
                aria-pressed={pinned === c.text}
                {...handlers}
                onClick={() => setPinned((v) => (v === c.text ? null : c.text))}
              >{c.text}</button>
              );
            })}
          </div>
        </div>
      ))}
      <p id={hintId} className={`tag-hint${shown ? ' is-active' : ''}`} aria-live="polite">
        {shown ? <><strong>{shown}</strong> {desc}</> : DEFAULT_HINT}
      </p>
    </div>
  );
}
