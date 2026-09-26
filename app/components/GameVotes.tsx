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
    <section className="detail-section-v2">
      <h3>이 게임 어떤 상황에서 좋아요?</h3>
      <p style={{ fontSize: 15, color: 'var(--text-dimmer)', marginBottom: 16 }}>
        해당하는 상황을 모두 눌러줘요 · {totalVotes}명 참여
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SITUATIONS.map(situation => {
          const count = votes[situation] || 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = myVotes.includes(situation);
          return (
            <button
              key={situation}
              onClick={() => vote(situation)}
              disabled={voted}
              style={{
                position: 'relative',
                background: voted ? 'rgba(0,113,227,0.08)' : 'var(--bg)',
                border: `1.5px solid ${voted ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '12px 16px',
                cursor: voted ? 'default' : 'pointer',
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              {/* 게이지 바 */}
              {totalVotes > 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: voted ? 'rgba(0,113,227,0.08)' : 'rgba(0,0,0,0.03)',
                  width: `${percent}%`,
                  borderRadius: 10,
                  transition: 'width 0.4s ease',
                }} />
              )}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: voted ? 700 : 500, color: voted ? 'var(--accent)' : 'var(--text)' }}>
                  {voted ? '✓ ' : ''}{situation}
                </span>
                {!loading && (
                  <span style={{ fontSize: 15, color: 'var(--text-dimmer)', fontWeight: 600 }}>
                    {count > 0 ? `${count}명 (${percent}%)` : ''}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}