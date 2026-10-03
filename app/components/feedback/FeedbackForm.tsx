'use client';

import { useState } from 'react';
import { FEEDBACK_KINDS, FEEDBACK_LIMITS, isFeedbackKind, type FeedbackKind } from '../../lib/feedback';
import { send } from '../community/api';

const KIND_KEYS = Object.keys(FEEDBACK_KINDS) as FeedbackKind[];

// 의견함 — 유형 + 본문(1000자) + 선택 연락처. 서버 API(/api/feedback)로만 보낸다
export default function FeedbackForm({ from, initialKind }: { from?: string; initialKind?: string }) {
  const [kind, setKind] = useState<FeedbackKind | null>(isFeedbackKind(initialKind) ? initialKind : null);
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!kind) return setError('의견 유형을 골라주세요.');
    setBusy(true);
    setError('');
    // 어느 페이지에서 왔는지 (사이트 안 경로만)
    const pageUrl = from && from.startsWith('/') && !from.startsWith('//') ? from : null;
    const r = await send('/api/feedback', 'POST', { kind, body, contact, pageUrl });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  };

  if (done) {
    return (
      <div className="cm-card">
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>보내주셔서 고마워요! 🙏</p>
        <p className="cm-sub" style={{ marginBottom: 16 }}>꼼꼼히 읽고 반영할게요.</p>
        <div className="cm-inline-row">
          <a href="/" className="cm-btn">홈으로</a>
          <button type="button" className="cm-btn" onClick={() => { setDone(false); setBody(''); setKind(null); }}>하나 더 보내기</button>
        </div>
      </div>
    );
  }

  return (
    <form className="cm-card cm-write" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="cm-board-pick" role="radiogroup" aria-label="의견 유형">
        {KIND_KEYS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {FEEDBACK_KINDS[k]}
          </button>
        ))}
      </div>
      <textarea
        className="cm-input cm-textarea"
        placeholder={kind === 'info' ? '어떤 게임의 어떤 정보가 다른지 알려주세요 (예: ○○ 최대 인원은 8명이에요)' : '내용을 입력하세요'}
        value={body} maxLength={FEEDBACK_LIMITS.body[1]} onChange={(e) => setBody(e.target.value)} aria-label="내용"
      />
      <p className="cm-hint">{[...body].length} / {FEEDBACK_LIMITS.body[1]}자</p>
      <input
        className="cm-input" placeholder="답변 받을 연락처 (선택) — 이메일·디스코드 ID 등"
        value={contact} maxLength={FEEDBACK_LIMITS.contact} onChange={(e) => setContact(e.target.value)} aria-label="연락처 (선택)"
      />
      <p className="cm-hint">연락처는 공개되지 않고 관리자만 봐요.</p>
      {error && <p className="cm-error">{error}</p>}
      <div className="cm-inline-row" style={{ justifyContent: 'flex-end' }}>
        <button className="cm-btn cm-btn-primary" disabled={busy}>{busy ? '보내는 중...' : '보내기'}</button>
      </div>
    </form>
  );
}
