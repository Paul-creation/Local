'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITS } from '../../lib/communityBoards';
import { send } from './api';
import ReportButton from './ReportButton';

type Props = { post: { id: number; title: string; body: string; board: string; likeCount: number }; initialLiked: boolean };

// 글 아래 추천·신고·수정·삭제
export default function PostActions({ post, initialLiked }: Props) {
  const router = useRouter();
  const [likes, setLikes] = useState(post.likeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [mode, setMode] = useState<'' | 'edit' | 'delete'>('');
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const like = async () => {
    if (liked) return;
    setLiked(true);
    const r = await send(`/api/community/posts/${post.id}/like`, 'POST', {});
    if (r.ok) setLikes(r.data.likeCount);
    else setLiked(false);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    const r = mode === 'edit'
      ? await send(`/api/community/posts/${post.id}`, 'PATCH', { password, title, body })
      : await send(`/api/community/posts/${post.id}`, 'DELETE', { password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (mode === 'delete') router.push(`/community/${post.board}`);
    else { setMode(''); setPassword(''); }
    router.refresh();
  };

  return (
    <div className="cm-actions">
      <div className="cm-actions-row">
        <button type="button" className={`cm-like ${liked ? 'on' : ''}`} onClick={like} disabled={liked} aria-pressed={liked}>
          👍 추천 {likes}
        </button>
        <span className="cm-actions-right">
          <button type="button" className="cm-link-btn" onClick={() => { setMode(mode === 'edit' ? '' : 'edit'); setError(''); }}>수정</button>
          <button type="button" className="cm-link-btn" onClick={() => { setMode(mode === 'delete' ? '' : 'delete'); setError(''); }}>삭제</button>
          <ReportButton type="post" id={post.id} onHidden={() => router.refresh()} />
        </span>
      </div>

      {mode && (
        <form className="cm-inline-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {mode === 'edit' && (
            <>
              <input className="cm-input" value={title} maxLength={LIMITS.title[1]} onChange={(e) => setTitle(e.target.value)} aria-label="제목" />
              <textarea className="cm-input cm-textarea" value={body} maxLength={LIMITS.body[1]} onChange={(e) => setBody(e.target.value)} aria-label="본문" />
            </>
          )}
          <div className="cm-inline-row">
            <input className="cm-input" type="password" placeholder="글 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" aria-label="글 비밀번호" />
            <button className={`cm-btn ${mode === 'delete' ? 'cm-btn-danger' : 'cm-btn-primary'}`} disabled={busy || !password}>
              {mode === 'edit' ? '수정 완료' : '삭제하기'}
            </button>
          </div>
          {error && <p className="cm-error">{error}</p>}
        </form>
      )}
    </div>
  );
}
