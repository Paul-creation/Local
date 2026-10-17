'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ACTIVITIES, ACTIVITY_GROUPS, activityLabel } from '../lib/activities';
import { REPORT_KINDS, type ReportKind } from '../lib/activityReports';

// 상세 "가능한 활동" 카드의 제보 버튼 + 작은 시트
// - 빠진 활동: 분류표(activities.ts)에서 확정에 없는 활동을 묶음별로 고른다 / 틀린 활동: 지금 보이는 칩(확정·확인 중)에서 고른다
// - 표에 없는 활동은 기존 의견함으로 보내는 링크. 제보는 관리자가 승인해야 반영된다 (자동 반영 없음)
export default function ActivityReport({ gameId, confirmed, unsure }: { gameId: string; confirmed: string[]; unsure: string[] }) {
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const close = () => { setKind(null); setKey(null); setMsg(null); opener.current?.focus(); };
  const open = (k: ReportKind, el: HTMLElement) => { opener.current = el; setKind(k); setKey(null); setMsg(null); };

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [kind]);

  const send = async () => {
    if (!kind || !key || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/activity-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, key, kind }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: '제보해 주셔서 고마워요. 확인한 뒤 반영할게요.' } : { ok: false, text: data.error || '보내지 못했어요. 잠시 후 다시 시도해주세요.' });
      if (res.ok) setKey(null);
    } catch {
      setMsg({ ok: false, text: '보내지 못했어요. 잠시 후 다시 시도해주세요.' });
    }
    setBusy(false);
  };

  const wrongKeys = [...confirmed, ...unsure];
  const from = encodeURIComponent(`/games/${gameId}`);

  return (
    <>
      <div className="report-actions">
        <button type="button" className="report-open" onClick={(e) => open('missing', e.currentTarget)}>빠진 활동 추가</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="report-open" onClick={(e) => open('wrong', e.currentTarget)}>틀린 활동 신고</button>
      </div>
      {kind && (
        <div className="report-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={sheet} className="report-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" tabIndex={-1}>
            <div className="report-head">
              <h3 id="report-title">{REPORT_KINDS[kind]} {kind === 'missing' ? '추가' : '신고'}</h3>
              <button type="button" className="report-close" aria-label="닫기" onClick={close}>×</button>
            </div>
            <div className="report-tabs">
              {(Object.keys(REPORT_KINDS) as ReportKind[]).map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => { setKind(k); setKey(null); setMsg(null); }}>
                  {k === 'missing' ? '빠진 활동' : '틀린 활동'}
                </button>
              ))}
            </div>
            <p className="report-help">
              {kind === 'missing' ? '이 게임에서 할 수 있는데 빠져 있는 활동을 하나 골라주세요.' : '지금 보이는 활동 중 이 게임과 맞지 않는 것을 하나 골라주세요.'}
            </p>
            <div className="report-body">
              {kind === 'missing' ? (
                ACTIVITY_GROUPS.map((group) => {
                  const list = ACTIVITIES.filter((a) => a.group === group && !confirmed.includes(a.key));
                  return list.length === 0 ? null : (
                    <div key={group} className="report-group">
                      <div className="report-group-name">{group}</div>
                      <div className="report-chips">
                        {list.map((a) => <button key={a.key} type="button" className="chip" aria-pressed={key === a.key} onClick={() => { setKey(a.key); setMsg(null); }}>{a.label}</button>)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="report-chips">
                  {wrongKeys.map((k) => <button key={k} type="button" className="chip" aria-pressed={key === k} onClick={() => { setKey(k); setMsg(null); }}>{activityLabel(k)}</button>)}
                </div>
              )}
            </div>
            <div className="report-foot">
              {msg && <p className={`report-msg${msg.ok ? '' : ' is-error'}`} role="status">{msg.text}</p>}
              <div className="report-foot-row">
                <Link className="report-link" href={`/feedback?kind=info&from=${from}`}>목록에 없는 활동은 의견함으로</Link>
                <button type="button" className="btn btn-primary" disabled={!key || busy} onClick={send}>{busy ? '보내는 중...' : '제보하기'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
