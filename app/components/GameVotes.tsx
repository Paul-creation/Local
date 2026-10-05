'use client';

import { useState, useEffect } from 'react';

import { VOTE_SITUATIONS } from '../lib/situations';

const SITUATIONS = VOTE_SITUATIONS;

export default function GameVotes({ gameId }: { gameId: string }) {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 내 투표 로컬스토리지에서 불러오기
    const stored = JSON.parse(localStorage.getItem(`votes_${gameId}`) || '[]');
    setMyVotes(stored);

    // 전체 투표 수 불러오기
    fetch(`/api/votes?gameId=${gameId}`)
      .then(r => r.json())
      .then(data => { setVotes(data); setLoading(false); });
  }, [gameId]);

  const vote = async (situation: string) => {
    if (myVotes.includes(situation)) return;

    const newMyVotes = [...myVotes, situation];
    setMyVotes(newMyVotes);
    localStorage.setItem(`votes_${gameId}`, JSON.stringify(newMyVotes));
    setVotes(prev => ({ ...prev, [situation]: (prev[situation] || 0) + 1 }));

    await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, situation }),
    });
  };

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <section className="detail-card">
      <h3 className="detail-card-title">이 게임 어떤 상황에서 좋아요?</h3>
      <p className="detail-card-sub">해당하는 상황을 모두 눌러 주세요 · <span className="num">{totalVotes}</span>명 참여</p>
      <div className="vote-chips">
        {SITUATIONS.map(situation => {
          const count = votes[situation] || 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = myVotes.includes(situation);
          return (
            <button
              key={situation}
              type="button"
              onClick={() => vote(situation)}
              aria-pressed={voted}
              disabled={voted}
              className={`chip vote-chip${voted ? ' on' : ''}`}
            >
              {situation}
              {!loading && count > 0 && <span className="vote-count">{count}명 · {percent}%</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
