'use client';

import { useState } from 'react';
import { judgePc, verdictText, type SpecLike } from '../../lib/specJudge';
import { toUserPc } from '../../lib/myPc';
import PcSpecPanel from './PcSpecPanel';
import { useMyPc } from './useMyPc';

// 상세 페이지 "PC 사양" 카드 바로 위 한 줄 — 내 PC 사양과 이 게임의 spec_parsed를 비교한 결과
// 미입력: 안내 문구 + 패널 열기 / 입력됨: 판정 문구 + "변경" / 판정할 사양을 못 읽은 게임은 서버에서 아예 그리지 않는다 (page.tsx)
export default function PcVerdictLine({ parsed }: { parsed: { min?: SpecLike | null; rec?: SpecLike | null } }) {
  const { pc, ready } = useMyPc();
  const [open, setOpen] = useState(false);
  if (!ready) return <div className="pcs-wrap"><div className="pcs-line" aria-hidden="true" /></div>; // 저장된 값을 읽기 전: 자리만 잡아 화면이 밀리지 않게

  const verdict = pc ? judgePc(toUserPc(pc), parsed) : null;
  const text = verdict ? verdictText(verdict) : null;

  return (
    <div className="pcs-wrap">
      <div className="pcs-line">
        {text ? (
          <p className="pcs-text">
            <span className="pcs-main">{text.main}</span>
            {text.flags.map((f) => <span key={f} className="pcs-flag"> · {f}</span>)}
          </p>
        ) : (
          <p className="pcs-text pcs-text-empty">내 PC 사양을 입력하면 실행 가능 여부를 알려드려요</p>
        )}
        <button type="button" className="pcs-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {pc ? '변경' : '내 PC 사양 입력'}
        </button>
      </div>
      {open && <PcSpecPanel onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />}
    </div>
  );
}
