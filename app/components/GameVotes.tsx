'use client';

import { useState, useEffect } from 'react';

import { VOTE_GROUPS, MIN_VOTES_FOR_GAUGE } from '../lib/situations';
import { sortGroupItems, gaugeRatio } from '../lib/voteLayout';

export default function GameVotes({ gameId }: { gameId: string }) {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [loadedVotes, setLoadedVotes] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 내 투표 로컬스토리지에서 불러오기
    const stored = JSON.parse(localStorage.getItem(`votes_${gameId}`) || '[]');
    setMyVotes(stored);

    // 전체 투표 수 불러오기
    fetch(`/api/votes?gameId=${gameId}`)
      .then(r => r.json())
      .then(data => { setVotes(data); setLoadedVotes(data); setLoading(false); });
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

  const loadedTotal = loadedVotes ? Object.values(loadedVotes).reduce((a, b) => a + b, 0) : 0;
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const lowVotes = !loading && totalVotes < MIN_VOTES_FOR_GAUGE;
  // 순서는 페이지 로드 시점의 투표 수 기준으로 한 번만 정하고, 투표 직후엔 게이지 숫자만 바뀐다
  const orderBase = loadedVotes && loadedTotal >= MIN_VOTES_FOR_GAUGE ? loadedVotes : null;

  return (
    <section className="detail-card is-roomy">
      <h3 className="detail-card-title">이 게임 어떤 상황에서 좋아요?</h3>
      <p className="detail-card-sub">해당하는 상황을 모두 눌러 주세요 · <span className="num">{totalVotes}</span>명 참여</p>
      {lowVotes && <p className="detail-card-sub vote-low">아직 투표가 적어요. 첫 투표를 남겨주세요</p>}
      {VOTE_GROUPS.map(group => {
        const items = orderBase ? sortGroupItems(group.items, orderBase) : group.items;
        return (
          <div key={group.title} className="vote-group" role="group" aria-label={group.title}>
            <h4 className="vote-group-title">{group.title}</h4>
            <div className="vote-chips">
              {items.map(situation => {
                const count = votes[situation] || 0;
                const voted = myVotes.includes(situation);
                const gauge = !loading && !lowVotes && count > 0;
                return (
                  <button
                    key={situation}
                    type="button"
                    onClick={() => vote(situation)}
                    aria-pressed={voted}
                    disabled={voted}
                    className={`chip vote-chip${voted ? ' on' : ''}${gauge ? ' has-gauge' : ''}`}
                    style={gauge ? ({ '--vote-ratio': gaugeRatio(count, votes) } as React.CSSProperties) : undefined}
                  >
                    {situation}
                    {!loading && count > 0 && <span className="vote-count">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
