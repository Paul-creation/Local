'use client';

import { useState } from 'react';
import { REPORT_REASONS } from '../../lib/communityBoards';
import { send } from './api';

export default function ReportButton({ type, id, onHidden }: { type: 'post' | 'comment'; id: number; onHidden?: () => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const report = async (reason: string) => {
    setOpen(false);
    const r = await send('/api/community/report', 'POST', { type, id, reason });
    if (!r.ok) return setMsg(r.error);
    setMsg(r.data.already ? '이미 신고했어요' : '신고했어요');
    if (r.data.hidden) onHidden?.();
  };

  if (msg) return <span className="cm-small-msg">{msg}</span>;
  return (
    <span className="cm-report">
      <button type="button" className="cm-link-btn" onClick={() => setOpen(!open)}>신고</button>
      {open && (
        <span className="cm-report-menu" role="menu">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" role="menuitem" onClick={() => report(r)}>{r}</button>
          ))}
        </span>
      )}
    </span>
  );
}
