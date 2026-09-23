'use client';

import { useState } from 'react';
import Link from 'next/link';

const MOODS = ['신나게', '느긋하게', '긴장감있게'];
const GROUP_SIZES = ['2인', '3-4인', '5인 이상'];
const VIBES = ['웃긴거', '몰입감있는거', '머리쓰는거'];

export default function AIRecommend() {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [vibe, setVibe] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ game: any; reason: string } | null>(null);
  const [error, setError] = useState('');

  const canSubmit = mood && groupSize && vibe;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, groupSize, vibe }),
      });
      const data = await res.json();
      if (data.error || !data.game) {
        setError(data.error || '추천할 게임을 찾지 못했어요.');
      } else {
        setResult(data);
      }
    } catch {
      setError('연결에 문제가 있어요. 다시 시도해줘.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMood('');
    setGroupSize('');
    setVibe('');
    setResult(null);
    setError('');
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <>

      {open && (
        <div className="ai-modal-overlay" onClick={close}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>오늘 뭐하고 놀지 물어볼게</h3>
              <button className="ai-modal-close" onClick={close}>✕</button>
            </div>

            {!result && (
              <>
                <div className="ai-question">
                  <p>오늘 기분은?</p>
                  <div className="ai-chip-row">
                    {MOODS.map((m) => (
                      <button key={m} className={`ai-chip ${mood === m ? 'selected' : ''}`} onClick={() => setMood(m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-question">
                  <p>같이 할 인원수는?</p>
                  <div className="ai-chip-row">
                    {GROUP_SIZES.map((g) => (
                      <button key={g} className={`ai-chip ${groupSize === g ? 'selected' : ''}`} onClick={() => setGroupSize(g)}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-question">
                  <p>원하는 분위기는?</p>
                  <div className="ai-chip-row">
                    {VIBES.map((v) => (
                      <button key={v} className={`ai-chip ${vibe === v ? 'selected' : ''}`} onClick={() => setVibe(v)}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="ai-error">{error}</p>}

                <button className="ai-submit" disabled={!canSubmit || loading} onClick={handleSubmit}>
                  {loading ? '추천 중...' : '추천받기'}
                </button>
              </>
            )}

            {result && (
              <div className="ai-result">
                <img src={result.game.cover_image_url} alt={result.game.name} className="ai-result-image" />
                <h4>{result.game.name}</h4>
                <p className="ai-result-reason">{result.reason}</p>
                <div className="ai-result-actions">
                  <Link href={`/games/${result.game.id}`} className="ai-result-link">자세히 보기 →</Link>
                  <button className="ai-result-retry" onClick={reset}>다시 물어보기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}