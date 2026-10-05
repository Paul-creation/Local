'use client';

import { useEffect, useState } from 'react';
import { LIMITS } from '../../lib/communityBoards';
import { send, loadNickname, saveNickname } from './api';
import { CommentItem, type Comment } from './Comments';

const MAX = LIMITS.gameComment[1];

export default function OpinionBox({ gameId, initial }: { gameId: string; initial: Comment[] }) {
  const [list, setList] = useState(initial);
  const [body, setBody] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setNickname(loadNickname()), []);

  const submit = async () => {
    setBusy(true);
    setError('');
    const r = await send('/api/game-comments', 'POST', { gameId, body, nickname, password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveNickname(nickname);
    setList((l) => [r.data.comment, ...l]);
    setBody('');
  };

  return (
    <section className="detail-card">
      <h3 className="detail-card-title">의견 달기</h3>
      <form className="cm-comment-form cm-opinion-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea className="cm-input cm-textarea-xs" placeholder="이 게임 어땠어요? 한두 줄로 남겨주세요" value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)} aria-label="의견" />
        <div className="cm-inline-row">
          <input className="cm-input" placeholder="닉네임" value={nickname} maxLength={LIMITS.nickname[1]} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
          <input className="cm-input" type="password" placeholder="비밀번호" value={password} maxLength={LIMITS.password[1]} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="비밀번호" />
          <button className="cm-btn cm-btn-primary" disabled={busy || !body.trim()}>등록</button>
        </div>
        <p className="cm-hint">{[...body].length} / {MAX}자 · 비밀번호는 수정·삭제할 때 써요 · <a href="/community/policy">운영정책</a></p>
        {error && <p className="cm-error">{error}</p>}
      </form>
      {list.length === 0 ? (
        <p className="cm-hint" style={{ marginTop: 12 }}>아직 의견이 없어요. 첫 의견을 남겨주세요!</p>
      ) : (
        <ul className="cm-comment-list">
          {list.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              api="/api/game-comments"
              reportType="game_comment"
              max={MAX}
              onChange={(next) => setList((all) => (next ? all.map((x) => (x.id === c.id ? next : x)) : all.filter((x) => x.id !== c.id)))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
