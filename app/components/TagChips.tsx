'use client';

import { useId, useState } from 'react';
import { getTagDescription } from './search/TagHelp';

const DEFAULT_HINT = '태그를 누르면 설명이 나와요';

// 상세 태그 목록 — 칩을 호버·포커스·탭하면 아래 한 줄 안내 영역에 설명이 바뀌어 보임 (높이 고정)
export default function TagChips({ tags }: { tags: string[] }) {
  const hintId = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = hover ?? focus ?? pinned;
  const desc = shown ? getTagDescription(shown) || '아직 설명이 없는 태그예요' : '';

  return (
    <div className="tag-block">
      <div className="main-tag-row">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="category-tag tag-chip-btn"
            aria-describedby={hintId}
            aria-pressed={pinned === tag}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(tag); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocus(tag); }}
            onBlur={() => setFocus(null)}
            onClick={() => setPinned((v) => (v === tag ? null : tag))}
          >{tag}</button>
        ))}
      </div>
      <p id={hintId} className={`tag-hint${shown ? ' is-active' : ''}`} aria-live="polite">
        {shown ? <><strong>{shown}</strong> {desc}</> : DEFAULT_HINT}
      </p>
    </div>
  );
}
