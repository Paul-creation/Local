'use client';

import { useEffect, useState } from 'react';
import HiddenPosts from './HiddenPosts';
import { formatDateTime } from '../../lib/date';
import { FEEDBACK_KINDS, type FeedbackKind } from '../../lib/feedback';

export type ModTab = 'reports' | 'hidden' | 'feedback';
type TargetType = 'post' | 'comment' | 'game_comment';
type ReportItem = {
  type: TargetType; id: number; count: number; reasons: Record<string, number>; latest: string;
  target: { title?: string; body: string; nickname: string; hidden: boolean; post_id?: number; game_id?: string; games?: { name: string } | null } | null;
};
type FeedbackItem = { id: number; kind: FeedbackKind; body: string; contact: string | null; page_url: string | null; resolved_at: string | null; created_at: string };

const TYPE_LABEL: Record<TargetType, string> = { post: '글', comment: '댓글', game_comment: '게임 의견' };
const when = (iso: string) => formatDateTime(iso);

// 관리자 운영 탭: 신고 목록 · 숨김 항목(글·댓글·게임 의견) · 의견함
export default function Moderation({ initial = 'reports' }: { initial?: ModTab }) {
  const [tab, setTab] = useState<ModTab>(initial);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };
  const loadReports = async () => {
    const res = await fetch('/api/admin/reports');
    setReports(res.ok ? (await res.json()).items : []);
  };
  const loadFeedback = async () => {
    const res = await fetch('/api/admin/feedback');
    setFeedback(res.ok ? (await res.json()).items : []);
  };
  useEffect(() => { loadReports(); loadFeedback(); }, []);

  const send = async (url: string, body: object, done: string) => {
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    flash(res.ok ? done : '실패했어요 ❌');
  };
  const resolveReport = async (r: ReportItem) => { await send('/api/admin/reports', { type: r.type, id: r.id }, '처리 완료로 표시했어요 ✅'); loadReports(); };
  const resolveFeedback = async (f: FeedbackItem, resolved: boolean) => {
    await send('/api/admin/feedback', { id: f.id, resolved }, resolved ? '처리 완료로 표시했어요 ✅' : '다시 처리 전으로 돌렸어요');
    loadFeedback();
  };

  const openFeedback = (feedback || []).filter((f) => !f.resolved_at);
  const tabs: [ModTab, string, number | null][] = [
    ['reports', '신고 목록', reports?.length ?? null],
    ['hidden', '숨김 항목', null],
    ['feedback', '의견함', feedback ? openFeedback.length : null],
  ];

  const targetLink = (r: ReportItem) => {
    if (!r.target) return null;
    if (r.type === 'post') return `/community/post/${r.id}`;
    if (r.type === 'comment') return `/community/post/${r.target.post_id}`;
    return `/games/${r.target.game_id}`;
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...chip, background: tab === k ? '#16202b' : '#fff', color: tab === k ? '#fff' : '#16202b' }}>
            {label}{n ? ` (${n})` : ''}
          </button>
        ))}
      </div>
      {msg && <p style={{ fontWeight: 700, marginBottom: 12 }}>{msg}</p>}

      {tab === 'hidden' && <HiddenPosts />}

      {tab === 'reports' && (
        !reports ? <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p> :
        reports.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>처리할 신고가 없어요</p> :
        reports.map((r) => {
          const link = targetLink(r);
          return (
            <div key={`${r.type}:${r.id}`} style={card}>
              <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-dim)', marginBottom: 6 }}>
                {TYPE_LABEL[r.type]} #{r.id} · 신고 {r.count}건 · 최근 {when(r.latest)}
                {r.target?.hidden && <b style={{ color: '#d64545' }}> · 숨김 중</b>}
                {!r.target && <b> · 이미 삭제됨</b>}
              </div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
                {Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(' · ')}
              </div>
              {r.target?.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.target.title}</div>}
              {r.target && <div style={bodyStyle}>{r.target.body}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {link && <a href={link} target="_blank" rel="noreferrer" style={{ ...btn, background: '#eee', color: '#16202b', textDecoration: 'none' }}>보기</a>}
                <button onClick={() => resolveReport(r)} style={{ ...btn, background: '#16202b' }}>처리 완료</button>
              </div>
            </div>
          );
        })
      )}

      {tab === 'feedback' && (
        !feedback ? <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p> : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 12 }}>
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              처리 완료한 의견도 보기
            </label>
            {(showResolved ? feedback : openFeedback).length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>새 의견이 없어요</p>}
            {(showResolved ? feedback : openFeedback).map((f) => (
              <div key={f.id} style={{ ...card, opacity: f.resolved_at ? 0.6 : 1 }}>
                <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-dim)', marginBottom: 6 }}>
                  #{f.id} · <b style={{ color: '#16202b' }}>{FEEDBACK_KINDS[f.kind] || f.kind}</b> · {when(f.created_at)}
                  {f.page_url && <> · 보낸 곳 <a href={f.page_url} target="_blank" rel="noreferrer" style={{ color: '#0071e3' }}>{f.page_url}</a></>}
                  {f.resolved_at && <> · 처리 완료 {when(f.resolved_at)}</>}
                </div>
                <div style={bodyStyle}>{f.body}</div>
                {f.contact && <div style={{ fontSize: 14, marginTop: 6 }}>연락처: {f.contact}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {f.resolved_at
                    ? <button onClick={() => resolveFeedback(f, false)} style={{ ...btn, background: '#eee', color: '#16202b' }}>처리 전으로</button>
                    : <button onClick={() => resolveFeedback(f, true)} style={{ ...btn, background: '#16202b' }}>처리 완료</button>}
                </div>
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
}

const chip: React.CSSProperties = { padding: '8px 14px', borderRadius: 100, border: '1px solid #e5e3dc', cursor: 'pointer', fontSize: 14, fontWeight: 700 };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid #e5e3dc' };
const btn: React.CSSProperties = { padding: '8px 16px', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const bodyStyle: React.CSSProperties = { fontSize: 15, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto', color: '#333' };
