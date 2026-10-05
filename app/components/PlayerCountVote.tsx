'use client';

import { useEffect, useState } from 'react';
import { PLAYER_CHOICES, MIN_VOTES_TO_SHOW, choiceLabel, type PlayerChoice } from '../lib/playerVotes';

// 상세 "몇 명이서 할 때 제일 재밌었나요?" — 멀티 게임만. 하나만 고르고 한 번만 (익명 쿠키 기준, 서버 API로만 저장)
// 결과는 20표 이상 모였을 때만 "가장 많은 선택: 4명 (N%)", 그 전에는 "투표 모으는 중"
export default function PlayerCountVote({ gameId }: { gameId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/player-votes?gameId=${gameId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { setCounts(d.counts || {}); setMine(d.mine || null); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [gameId]);

  const vote = async (choice: PlayerChoice) => {
    if (mine || busy) return;
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/player-votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, choice }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) {
      setMine(choice);
      setCounts((c) => ({ ...c, [choice]: (c[choice] || 0) + 1 }));
    } else setMsg(d?.error || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <section className="detail-card is-roomy">
      <h3 className="detail-card-title">몇 명이서 할 때 제일 재밌었나요?</h3>
      <p className="detail-card-sub">
        {total >= MIN_VOTES_TO_SHOW && top
          ? <>가장 많은 선택: <strong className="vote-top">{choiceLabel(top[0])}</strong> (<span className="num">{Math.round((top[1] / total) * 100)}%</span>) · <span className="num">{total}</span>명 참여</>
          : '투표 모으는 중'}
      </p>
      <div className="vote-chips" role="radiogroup" aria-label="재밌었던 인원">
        {PLAYER_CHOICES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mine === k}
            className={`chip vote-chip${mine === k ? ' on' : ''}`}
            disabled={!!mine || busy}
            onClick={() => vote(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {mine && <p className="detail-card-note" role="status">내 선택: {choiceLabel(mine)} · 고마워요!</p>}
      {msg && <p className="cm-error" role="alert">{msg}</p>}
    </section>
  );
}
