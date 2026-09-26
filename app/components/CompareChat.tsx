'use client';

import { useState } from 'react';

const QUICK_QUESTIONS = [
  '이 중에 뭐가 제일 재밌어?',
  '처음 만나는 친구들이랑 하기엔?',
  '가성비 제일 좋은 게 뭐야?',
  '혼자 하기엔 어때?',
];

export default function CompareChat({ games }: { games: any[] }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const ask = async (question: string) => {
    if (count >= 5) return;
    if (!question.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: question }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const gameInfo = games.map(g =>
        `게임: ${g.name} | 태그: ${(g.tags || []).join(', ')} | 난이도: ${g.difficulty} | 인원: ${g.min_players}-${g.max_players}인 | 한국어: ${g.korean_support} | 솔로: ${g.solo_playable} | 평점: ${g.review_positive_percent}% | 설명: ${g.description || ''}`
      ).join('\n\n');

      const res = await fetch('/api/compare-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, gameInfo, history: messages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'ai', text: data.answer }]);
      setCount(c => c + 1);
    } catch {
      setMessages([...newMessages, { role: 'ai', text: '오류가 발생했어요. 다시 시도해줘.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>AI에게 물어보기</h2>
      <p style={{ fontSize: 13, color: 'var(--text-dimmer)', marginBottom: 16 }}>
        이 게임들에 대해 뭐든 물어봐 (세션당 최대 5회)
      </p>

      {/* 빠른 질문 */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {QUICK_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => ask(q)}
              style={{
                background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                borderRadius: 100, padding: '8px 14px',
                fontSize: 13, color: 'var(--text)', cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 대화 내역 */}
      {messages.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)', padding: 16,
          marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                fontSize: 14, lineHeight: 1.6,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ color: 'var(--text-dimmer)', fontSize: 13 }}>생각 중...</div>
          )}
        </div>
      )}

      {/* 입력창 */}
      {count < 5 ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(input)}
            placeholder="궁금한 거 물어봐..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 100,
              border: '1.5px solid var(--border)', background: 'var(--bg-card)',
              fontSize: 14, color: 'var(--text)', outline: 'none',
            }}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            style={{
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 100,
              padding: '10px 18px', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            전송
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-dimmer)', textAlign: 'center' }}>
          세션당 최대 5회까지 질문할 수 있어요.
        </p>
      )}
    </div>
  );
}