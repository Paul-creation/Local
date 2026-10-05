'use client';

import { useId, useState } from 'react';
import { getTagDescription } from './search/TagHelp';
import type { ChipGroup } from '../lib/tagGroups';

const DEFAULT_HINT = '태그를 누르면 설명이 나와요';

// 상세 태그 목록 — 그룹별 줄(수상·순위 / 플레이 방식 / 장르 / 특징). 칩을 호버·포커스·탭하면 아래 한 줄 안내 영역에 설명이 바뀌어 보임 (높이 고정)
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
            {g.chips.map((c) => (
              <button
                key={c.text}
                type="button"
                className={`category-tag tag-chip-btn${c.kind === 'special' ? ' tag-special' : ''}`}
                aria-describedby={hintId}
                aria-pressed={pinned === c.text}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(c.text); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocus(c.text); }}
                onBlur={() => setFocus(null)}
                onClick={() => setPinned((v) => (v === c.text ? null : c.text))}
              >{c.text}</button>
            ))}
          </div>
        </div>
      ))}
      <p id={hintId} className={`tag-hint${shown ? ' is-active' : ''}`} aria-live="polite">
        {shown ? <><strong>{shown}</strong> {desc}</> : DEFAULT_HINT}
      </p>
    </div>
  );
}
