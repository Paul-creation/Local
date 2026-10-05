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

      const res = await fetch('/api/compare-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, gameIds: games.map((g: any) => g.id), history: messages }),
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
    <section className="cmp-ai">
      {/* CHAT_SIZE_V2 */}
      <h2 className="cmp-h2">AI에게 물어보기</h2>
      <p className="cmp-ai-sub">이 게임들에 대해 뭐든 물어보세요 (세션당 최대 5회)</p>

      {/* 추천 질문 */}
      {messages.length === 0 && (
        <div className="cmp-ai-chips">
          {QUICK_QUESTIONS.map(q => (
            <button key={q} type="button" className="chip" onClick={() => ask(q)}>{q}</button>
          ))}
        </div>
      )}

      {/* 대화 내역 */}
      {messages.length > 0 && (
        <div className="cmp-ai-log">
          {messages.map((m, i) => (
            <div key={i} className={`cmp-ai-msg is-${m.role === 'user' ? 'user' : 'ai'}`}>
              <div className="cmp-ai-bubble">{m.text}</div>
            </div>
          ))}
          {loading && <div className="cmp-ai-wait">생각 중...</div>}
        </div>
      )}

      {/* 입력창 — 포커스 시 포인트 테두리 + 옅은 빛 */}
      {count < 5 ? (
        <div className="cmp-ai-form">
          <input
            type="text"
            className="input cmp-ai-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(input)}
            placeholder="궁금한 걸 물어보세요"
            aria-label="AI에게 질문"
          />
          <button type="button" className="btn btn-primary" onClick={() => ask(input)} disabled={loading || !input.trim()}>
            전송
          </button>
        </div>
      ) : (
        <p className="cmp-ai-sub is-center">세션당 최대 5회까지 질문할 수 있어요.</p>
      )}
    </section>
  );
}