import { supabase } from '../lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SITUATIONS = [
  '처음 만나는 친구들과',
  '빡세게 도전하고 싶을 때',
  '느긋하게 쉬고 싶을 때',
  '술자리에서',
  '경쟁하고 싶을 때',
  '오래 같이 하고 싶을 때',
];

const MULTIPLAYER_SITUATIONS = ['처음 만나는 친구들과', '술자리에서', '오래 같이 하고 싶을 때'];

async function getSituationScores(games: any[], activeSituations: string[]) {
  const gameList = games.map(g =>
    `이름: ${g.name} | 태그: ${(g.tags || []).join(', ')} | 난이도: ${g.difficulty} | 인원: ${g.min_players}-${g.max_players} | 카테고리: ${g.category} | 솔로: ${g.solo_playable}`
  ).join('\n');

  const prompt = `아래 게임들을 각 상황에 얼마나 적합한지 1-5점으로 평가해줘.

게임 목록:
${gameList}

상황:
${activeSituations.map((s, i) => `${i + 1}. ${s}`).join('\n')}

JSON 형식으로만 출력:
[
  {
    "game": "게임이름",
    "scores": [${activeSituations.map((_, i) => `상황${i + 1}점수`).join(', ')}]
  }
]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return [];
  }
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: idsParam } = await searchParams;
  const ids = idsParam?.split(',').slice(0, 3) || [];

  if (ids.length < 2) {
    return (
      <main className="page">
        <nav className="topnav"><span className="logo">게임정보허브</span></nav>
        <p style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-dim)' }}>
          비교할 게임을 2개 이상 선택해줘요.
        </p>
      </main>
    );
  }

  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at, currency)')
    .in('id', ids);

  if (!games || games.length < 2) {
    return (
      <main className="page">
        <nav className="topnav"><span className="logo">게임정보허브</span></nav>
        <p style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-dim)' }}>
          게임을 불러오지 못했어요. 다시 시도해줘요.
        </p>
      </main>
    );
  }

  const hasMultiGame = games.some((g: any) => g.max_players > 1);
  const activeSituations = SITUATIONS.filter(s => {
    if (MULTIPLAYER_SITUATIONS.includes(s)) return hasMultiGame;
    return true;
  });

  const situationScores = await getSituationScores(games, activeSituations);

  type Row = {
    label: string;
    key?: string;
    render?: (g: any) => any;
  };

  const ROWS: Row[] = [
    { label: '카테고리', key: 'category' },
    { label: '인원수', render: (g: any) => {
      if (g.min_players === 1 && g.max_players === 1) return '1인';
      if (g.min_players && g.max_players) return `${g.min_players}-${g.max_players}인`;
      return '-';
    }},
    { label: '솔로 플레이', render: (g: any) =>
      g.solo_playable === true && g.max_players === 1
        ? <span style={{ color: '#4a9e3a', fontWeight: 700 }}>싱글 플레이 게임</span>
        : g.solo_playable === true
        ? <span style={{ color: '#4a9e3a', fontWeight: 700 }}>솔로 가능</span>
        : '멀티 필수'
    },
    { label: '난이도', key: 'difficulty' },
    { label: '한국어', key: 'korean_support' },
    { label: '필요 용량', render: (g: any) => g.storage_gb ? `${g.storage_gb}GB` : '-' },
    { label: '출시일', render: (g: any) => g.release_date ? new Date(g.release_date).toLocaleDateString('ko-KR') : '-' },
    { label: '가족 공유', render: (g: any) => g.family_sharing ? '가능' : '불가' },
    { label: '도전과제', render: (g: any) => g.achievement_count ? `${g.achievement_count}개` : '-' },
    { label: 'DLC', render: (g: any) => g.has_dlc ? '있음' : '없음' },
    { label: 'Steam 평점', render: (g: any) => g.review_positive_percent ? `${g.review_positive_percent}% (${g.review_total?.toLocaleString('ko-KR')}개)` : '-' },
    { label: '현재 접속자', render: (g: any) => g.current_players ? `${g.current_players.toLocaleString('ko-KR')}명` : '-' },
    { label: '역대 최저가', render: (g: any) => g.lowest_price ? `₩${g.lowest_price.toLocaleString('ko-KR')}` : '-' },
  ];

  return (
    <>
      <main className="page" style={{ paddingBottom: 80 }}>
        <nav className="topnav"><span className="logo">게임정보허브</span></nav>

        <Link href="/" className="back-link">← 돌아가기</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>
          게임 비교
        </h1>

        {/* 게임 헤더 — 모바일: 가로 스크롤 */}
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${games.length}, minmax(140px, 1fr))`,
            gap: 12, minWidth: games.length > 2 ? 420 : 'auto',
          }}>
            {games.map((g: any) => (
              <Link href={`/games/${g.id}`} key={g.id} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden', border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <img src={g.cover_image_url} alt={g.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{g.name}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 상황별 추천도 */}
        {activeSituations.length > 0 && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>상황별 추천도</h2>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)', marginBottom: 28, overflow: 'hidden',
            }}>
              {activeSituations.map((situation, si) => (
                <div key={situation} style={{
                  borderBottom: si < activeSituations.length - 1 ? '1px solid var(--border-light)' : 'none',
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
                    {situation}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {games.map((g: any) => {
                      const gameScore = situationScores.find((s: any) => s.game === g.name);
                      const score = gameScore?.scores?.[si] ?? 0;
                      return (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-dimmer)', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.name}
                          </span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(n => (
                              <span key={n} style={{ fontSize: 15, color: n <= score ? '#f59e0b' : 'var(--border)' }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-dimmer)' }}>{score}/5</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 스펙 비교 */}
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>스펙 비교</h2>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
        }}>
          {ROWS.map((row, i) => (
            <div key={row.label} style={{
              borderBottom: i < ROWS.length - 1 ? '1px solid var(--border-light)' : 'none',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-dimmer)', fontWeight: 600, marginBottom: 8 }}>
                {row.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {games.map((g: any) => (
                  <div key={g.id} style={{
                    flex: 1, minWidth: 100,
                    background: 'var(--bg)', borderRadius: 8,
                    padding: '8px 10px', fontSize: 13,
                    color: 'var(--text)', fontWeight: 500,
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dimmer)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </div>
                    {row.render ? row.render(g) : (g[row.key!] || '-')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 플로팅 하단 바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-nav)', color: '#fff',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
          {games.map((g: any) => (
            <span key={g.id} style={{
              fontSize: 12, background: 'rgba(255,255,255,0.15)',
              padding: '4px 10px', borderRadius: 100,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
            }}>
              {g.name}
            </span>
          ))}
        </div>
        <Link href="/" style={{
          background: 'var(--accent)', color: '#fff',
          padding: '8px 16px', borderRadius: 100,
          fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
        }}>
          돌아가기
        </Link>
      </div>
    </>
  );
}