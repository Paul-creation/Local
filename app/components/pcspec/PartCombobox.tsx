'use client';

import { useId, useMemo, useState } from 'react';
import type { MyPart } from '../../lib/myPc';

// 부품 검색 콤보박스 — 글자를 치면 등급표에서 걸러 보여주고, 목록에서 골라야 선택된다 (치기만 한 글자는 선택이 아님)
// GPU·CPU 입력에 같이 쓴다 (PcSpecPanel). 4단계 검색 필터에서도 그대로 쓸 수 있다
export type PartOption = MyPart;

const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, '');
const MAX_SHOWN = 40;

export default function PartCombobox({ label, options, value, onChange, placeholder, loading }: {
  label: string;
  options: PartOption[];
  value: MyPart | null;
  onChange: (part: MyPart | null) => void;
  placeholder?: string;
  loading?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // 바깥에서 값이 바뀌면(감지 제안 선택 등) 입력칸도 맞춘다
  const [seen, setSeen] = useState(value?.key);
  if (seen !== value?.key) { setSeen(value?.key); if (value) setText(value.name); }

  const results = useMemo(() => {
    const tokens = text.trim().split(/\s+/).filter(Boolean).map(norm);
    if (!tokens.length) return options.slice(0, MAX_SHOWN);
    return options.filter((o) => { const n = norm(o.name); return tokens.every((t) => n.includes(t)); }).slice(0, MAX_SHOWN);
  }, [options, text]);

  const pick = (o: PartOption) => { onChange({ key: o.key, name: o.name, vendor: o.vendor, tier: o.tier }); setText(o.name); setOpen(false); };
  const listId = `${id}-list`;

  return (
    <div className="pcs-field">
      <label className="pcs-label" htmlFor={`${id}-input`}>{label}</label>
      <input
        id={`${id}-input`}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${id}-o${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={loading ? '등급표를 불러오는 중…' : placeholder}
        disabled={loading}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={`${label} 검색 결과`} className="pcs-list">
          {results.length === 0 && <li className="pcs-empty" role="presentation">찾는 부품이 없어요</li>}
          {results.map((o, i) => (
            <li
              key={o.key}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={value?.key === o.key}
              className={`pcs-option${i === active ? ' is-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} // blur로 목록이 닫히기 전에 선택
              onMouseEnter={() => setActive(i)}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
