'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITS, timeAgo } from '../../lib/communityBoards';
import { send, loadNickname, saveNickname } from './api';
import ReportButton from './ReportButton';

type Comment = { id: number; body: string; nickname: string; hidden: boolean; created_at: string };

export default function Comments({ postId, initial }: { postId: number; initial: Comment[] }) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setNickname(loadNickname()), []);

  const submit = async () => {
    setBusy(true);
    setError('');
    const r = await send(`/api/community/posts/${postId}/comments`, 'POST', { body, nickname, password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveNickname(nickname);
    setComments((c) => [...c, r.data.comment]);
    setBody('');
    router.refresh();
  };

  const visible = comments.filter((c) => !c.hidden).length;

  return (
    <section className="cm-card cm-comments">
      <h2 className="cm-h2">댓글 {visible}</h2>
      {comments.length > 0 && (
        <ul className="cm-comment-list">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              onChange={(next) => setComments((all) => (next ? all.map((x) => (x.id === c.id ? next : x)) : all.filter((x) => x.id !== c.id)))}
            />
          ))}
        </ul>
      )}
      <form className="cm-comment-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea className="cm-input cm-textarea-sm" placeholder="댓글을 남겨주세요" value={body} maxLength={LIMITS.comment[1]} onChange={(e) => setBody(e.target.value)} aria-label="댓글" />
        <div className="cm-inline-row">
          <input className="cm-input" placeholder="닉네임" value={nickname} maxLength={LIMITS.nickname[1]} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
          <input className="cm-input" type="password" placeholder="비밀번호" value={password} maxLength={LIMITS.password[1]} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="비밀번호" />
          <button className="cm-btn cm-btn-primary" disabled={busy || !body.trim()}>등록</button>
        </div>
        {error && <p className="cm-error">{error}</p>}
      </form>
    </section>
  );
}

function CommentItem({ c, onChange }: { c: Comment; onChange: (next: Comment | null) => void }) {
  const [mode, setMode] = useState<'' | 'edit' | 'delete'>('');
  const [body, setBody] = useState(c.body);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (c.hidden) return <li className="cm-comment cm-comment-hidden">신고로 숨겨진 댓글이에요.</li>;

  const submit = async () => {
    setError('');
    const r = mode === 'edit'
      ? await send(`/api/community/comments/${c.id}`, 'PATCH', { password, body })
      : await send(`/api/community/comments/${c.id}`, 'DELETE', { password });
    if (!r.ok) return setError(r.error);
    onChange(mode === 'edit' ? { ...c, body: r.data.body } : null);
    setMode('');
    setPassword('');
  };

  return (
    <li className="cm-comment">
      <div className="cm-row-meta">
        <strong>{c.nickname}</strong>
        <span>· {timeAgo(c.created_at)}</span>
        <span className="cm-actions-right">
          <button type="button" className="cm-link-btn" onClick={() => setMode(mode === 'edit' ? '' : 'edit')}>수정</button>
          <button type="button" className="cm-link-btn" onClick={() => setMode(mode === 'delete' ? '' : 'delete')}>삭제</button>
          <ReportButton type="comment" id={c.id} onHidden={() => onChange({ ...c, hidden: true })} />
        </span>
      </div>
      {mode === 'edit'
        ? <textarea className="cm-input cm-textarea-sm" value={body} maxLength={LIMITS.comment[1]} onChange={(e) => setBody(e.target.value)} aria-label="댓글 수정" />
        : <p className="cm-comment-body">{c.body}</p>}
      {mode && (
        <form className="cm-inline-row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input className="cm-input" type="password" placeholder="댓글 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" aria-label="댓글 비밀번호" />
          <button className={`cm-btn ${mode === 'delete' ? 'cm-btn-danger' : 'cm-btn-primary'}`} disabled={!password}>{mode === 'edit' ? '수정 완료' : '삭제하기'}</button>
        </form>
      )}
      {error && <p className="cm-error">{error}</p>}
    </li>
  );
}
