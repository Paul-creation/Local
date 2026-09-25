'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Question {
  question: string;
  options: string[];
}

export default function AIRecommend() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'intro' | 'asking' | 'result' | 'error'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ game: any; reason: string } | null>(null);
  const [error, setError] = useState('');

  const startGame = async () => {
    setStep('asking');
    setLoading(true);
    setAnswers([]);
    setQuestions([]);
    await fetchNextQuestion([]);
    setLoading(false);
  };

  const fetchNextQuestion = async (currentAnswers: { question: string; answer: string }[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'akinator', answers: currentAnswers }),
      });
      const data = await res.json();

      if (data.done || data.game) {
        setResult(data);
        setStep('result');
      } else if (data.question) {
        setCurrentQuestion({ question: data.question, options: data.options });
        setRemainingCount(data.remaining ?? 0);
      } else {
        setError(data.error || '오류가 발생했어요.');
        setStep('error');
      }
    } catch {
      setError('연결에 문제가 있어요.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion) return;
    const newAnswers = [...answers, { question: currentQuestion.question, answer }];
    setAnswers(newAnswers);
    setCurrentQuestion(null);
    await fetchNextQuestion(newAnswers);
  };

  const reset = () => {
    setStep('intro');
    setAnswers([]);
    setQuestions([]);
    setCurrentQuestion(null);
    setResult(null);
    setError('');
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <>
      <button className="ai-trigger-clean" onClick={() => setOpen(true)}>
        AI 추천
      </button>

      {open && (
        <div className="ai-modal-overlay" onClick={close}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>
                {step === 'intro' && '🎮 게임 찾기'}
                {step === 'asking' && `🔍 질문 ${answers.length + 1}`}
                {step === 'result' && '🎯 찾았어요!'}
                {step === 'error' && '😅 오류'}
              </h3>
              <button className="ai-modal-close" onClick={close}>✕</button>
            </div>

            {step === 'intro' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.6 }}>
                  몇 가지 질문으로<br />딱 맞는 게임을 찾아드릴게요
                </p>
                <button className="ai-submit" onClick={startGame}>
                  시작하기
                </button>
              </div>
            )}

            {step === 'asking' && (
              <>
                {/* 진행 바 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, color: 'var(--text-dimmer)', marginBottom: 6
                  }}>
                    <span>후보 게임 {remainingCount}개</span>
                    <span>{answers.length}개 답변 완료</span>
                  </div>
                  <div style={{
                    height: 4, background: 'var(--border)',
                    borderRadius: 2, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', background: 'var(--accent)',
                      borderRadius: 2,
                      width: `${Math.min(100, (answers.length / 6) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dimmer)' }}>
                    생각 중...
                  </div>
                ) : currentQuestion && (
                  <div className="ai-question">
                    <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                      {currentQuestion.question}
                    </p>
                    <div className="ai-chip-row">
                      {currentQuestion.options.map((opt) => (
                        <button
                          key={opt}
                          className="ai-chip"
                          onClick={() => handleAnswer(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 이전 답변 요약 */}
                {answers.length > 0 && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    {answers.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, color: 'var(--text-dimmer)', marginBottom: 4
                      }}>
                        <span>{a.question}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{a.answer}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 'result' && result && (
              <div className="ai-result">
                <img src={result.game.cover_image_url} alt={result.game.name} className="ai-result-image" />
                <h4>{result.game.name}</h4>
                <p className="ai-result-reason">{result.reason}</p>
                <div className="ai-result-actions">
                  <Link href={`/games/${result.game.id}`} className="ai-result-link">자세히 보기 →</Link>
                  <button className="ai-result-retry" onClick={reset}>다시 찾기</button>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>
                <button className="ai-submit" onClick={reset}>다시 시도</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}