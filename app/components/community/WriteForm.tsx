'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { BOARD_KEYS, BOARDS, LIMITS, type BoardKey } from '../../lib/communityBoards';
import { send, loadNickname, saveNickname } from './api';
import { selectGames } from '../../lib/visibleGames';

type Game = { id: string; name: string };

export default function WriteForm({ initialBoard, initialGame }: { initialBoard: BoardKey; initialGame: Game | null }) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardKey>(initialBoard);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [game, setGame] = useState<Game | null>(initialGame);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setNickname(loadNickname()), []);

  const submit = async () => {
    setBusy(true);
    setError('');
    const r = await send('/api/community/posts', 'POST', { board, title, body, nickname, password, gameId: game?.id || null });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    saveNickname(nickname);
    router.push(`/community/post/${r.data.id}`);
  };

  return (
    <form className="cm-card cm-write" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="cm-board-pick" role="radiogroup" aria-label="게시판">
        {BOARD_KEYS.map((b) => (
          <button key={b} type="button" role="radio" aria-checked={board === b} className={board === b ? 'on' : ''} onClick={() => setBoard(b)}>
            {BOARDS[b].label}
          </button>
        ))}
      </div>
      {board === 'party' && (
        <p className="cm-notice">연락처(디스코드 ID 등)를 적으면 모두에게 공개돼요.</p>
      )}

      <input className="cm-input" placeholder="제목" value={title} maxLength={LIMITS.title[1]} onChange={(e) => setTitle(e.target.value)} aria-label="제목" />
      <textarea className="cm-input cm-textarea" placeholder="내용을 입력하세요" value={body} maxLength={LIMITS.body[1]} onChange={(e) => setBody(e.target.value)} aria-label="본문" />
      <p className="cm-hint">{[...body].length} / {LIMITS.body[1]}자 · 링크는 2개까지</p>

      <GamePicker game={game} onChange={setGame} />

      <div className="cm-inline-row">
        <input className="cm-input" placeholder="닉네임 (2~12자)" value={nickname} maxLength={LIMITS.nickname[1]} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
        <input className="cm-input" type="password" placeholder="비밀번호 (수정·삭제용)" value={password} maxLength={LIMITS.password[1]} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="비밀번호" />
      </div>
      {error && <p className="cm-error">{error}</p>}
      <div className="cm-inline-row is-end">
        <button type="button" className="cm-btn" onClick={() => router.back()}>취소</button>
        <button className="cm-btn cm-btn-primary" disabled={busy}>{busy ? '올리는 중...' : '등록'}</button>
      </div>
      <p className="cm-hint">글을 올리면 <a href="/community/policy">운영정책</a>에 동의한 것으로 봐요.</p>
    </form>
  );
}

// 관련 게임 (선택) — 이름 검색 자동완성. 게임 목록은 공개 정보라 읽기만 브라우저에서 한다
function GamePicker({ game, onChange }: { game: Game | null; onChange: (g: Game | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.replace(/[%,()*\\]/g, '').trim();
    if (term.length < 1) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const { data } = await selectGames('id, name')
        .or(`name.ilike.%${term}%,search_name_ko.ilike.%${term}%`).limit(8);
      setResults(data || []);
    }, 250);
  }, [q]);

  if (game) {
    return (
      <div className="cm-picked-game">
        관련 게임: <strong>{game.name}</strong>
        <button type="button" className="cm-link-btn" onClick={() => onChange(null)}>빼기</button>
      </div>
    );
  }
  return (
    <div className="cm-game-search">
      <input className="cm-input" placeholder="관련 게임 (선택) — 이름으로 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="관련 게임 검색" />
      {results.length > 0 && (
        <ul className="cm-suggest">
          {results.map((g) => (
            <li key={g.id}><button type="button" onClick={() => { onChange(g); setQ(''); setResults([]); }}>{g.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
