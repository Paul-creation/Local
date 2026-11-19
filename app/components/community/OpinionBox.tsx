'use client';

import { useEffect, useState } from 'react';
import { LIMITS } from '../../lib/communityBoards';
import { send, loadNickname, saveNickname } from './api';
import { CommentItem, type Comment } from './Comments';
import GdSection from '../detail/GdSection';

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
    <GdSection title="의견 달기">
      <div className="gd-box gd-opinion">
      <form className="gd-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="gd-field">
          <span className="gd-field-label">이 게임 해본 사람 한마디</span>
          <textarea rows={3} placeholder={`친구랑 해보니 어땠어요? (${MAX}자)`} value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="gd-form-inputs">
          <input placeholder="닉네임" value={nickname} maxLength={LIMITS.nickname[1]} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
          <input type="password" placeholder="비밀번호" value={password} maxLength={LIMITS.password[1]} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="비밀번호" />
        </div>
        <div className="gd-form-foot">
          <span className="gd-form-hint">닉네임과 비밀번호로 수정·삭제할 수 있어요 · <a href="/community/policy">운영정책</a></span>
          <button type="submit" className="gd-submit" disabled={busy || !body.trim()}>등록</button>
        </div>
        {error && <p className="cm-error">{error}</p>}
      </form>
      {list.length === 0 ? (
        <p className="gd-empty">아직 의견이 없어요. 첫 의견을 남겨주세요!</p>
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
      </div>
    </GdSection>
  );
}
