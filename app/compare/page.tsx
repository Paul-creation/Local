import { supabase } from '../lib/supabase';
import Link from 'next/link';
import CompareChat from '../components/CompareChat';

export const dynamic = 'force-dynamic';

const SITUATIONS = [
  '처음 보는 사람들이랑 어색할 때',
  '친한 친구들이랑 밤새',
  '혼자 심심할 때',
  '가족이랑 같이',
  '술 한 잔 하면서',
  '머리 비우고 싶을 때',
  '진지하게 몰입하고 싶을 때',
  '짧게 한 판만',
  '고수들끼리 빡세게',
  '한 번 시작하면 못 끊음',
];

const MULTIPLAYER_SITUATIONS = [
  '처음 보는 사람들이랑 어색할 때',
  '친한 친구들이랑 밤새',
  '가족이랑 같이',
  '술 한 잔 하면서',
];

// SCORES_V2 — 게임 순서(번호)로 매칭 + 올바른 결과만 캐시
function isValidScores(scores: any, games: any[], count: number) {
  return (
    Array.isArray(scores) &&
    scores.length === games.length &&
    games.every((g) => {
      const row = scores.find((x: any) => x?.game === g.name);
      return row && Array.isArray(row.scores) && row.scores.length === count &&
        row.scores.every((n: any) => Number.isInteger(n) && n >= 1 && n <= 5);
    })
  );
}

async function getSituationScores(games: any[], activeSituations: string[]) {
  const gameIds = games.map((g) => g.id).sort().join(',');

  const { data: cached } = await supabase
    .from('compare_cache')
    .select('situation_scores')
    .eq('game_ids', gameIds)
    .maybeSingle();

  if (cached && isValidScores(cached.situation_scores, games, activeSituations.length)) {
    return cached.situation_scores;
  }

  const gameList = games
    .map((g, i) =>
      `${i + 1}번. ${g.name} | 태그: ${(g.tags || []).join(', ')} | 난이도: ${g.difficulty} | 인원: ${g.min_players}-${g.max_players} | 카테고리: ${g.category} | 솔로: ${g.solo_playable}`
    )
    .join('\n');

  const prompt = `아래 게임들이 각 상황에 얼마나 적합한지 1~5 정수로 평가해줘.

게임 목록:
${gameList}

상황:
${activeSituations.map((s, i) => `${i + 1}. ${s}`).join('\n')}

게임 번호 순서대로, 각 게임마다 상황 ${activeSituations.length}개의 점수를 담아서 JSON으로만 답해. 설명이나 코드블록은 쓰지 마.
{"results": [{"index": 1, "scores": [${activeSituations.map(() => '점수').join(', ')}]}]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error('상황별 추천도 AI 오류:', data.error.message);
      return [];
    }

    const text: string = (data.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(start, end + 1));

    const scores = games.map((g, i) => {
      const row = (parsed.results || []).find((r: any) => Number(r.index) === i + 1);
      return {
        game: g.name,
        scores: (row?.scores || []).map((n: any) => Math.min(5, Math.max(1, Math.round(Number(n)) || 1))),
      };
    });

    if (isValidScores(scores, games, activeSituations.length)) {
      await supabase.from('compare_cache').upsert({ game_ids: gameIds, situation_scores: scores });
    }
    return scores;
  } catch (err) {
    console.error('상황별 추천도 생성 실패:', err);
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

  const gameCount = games.length;

  return (
    <main className="page" style={{ paddingBottom: 32 }}>
      <nav className="topnav"><span className="logo">게임정보허브</span></nav>

      <Link href="/" className="back-link">← 돌아가기</Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>
        게임 비교
      </h1>

      {/* 게임 헤더 */}
      <div className="compare-header" style={{
        display: 'grid',
        gridTemplateColumns: `180px repeat(${gameCount}, 1fr)`,
        gap: 12, marginBottom: 24,
      }}>
        <div />
        {games.map((g: any) => (
          <Link href={`/games/${g.id}`} key={g.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              overflow: 'hidden', border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <img src={g.cover_image_url} alt={g.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{g.name}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 상황별 추천도 */}
      {activeSituations.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>상황별 추천도</h2>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)', marginBottom: 28, overflow: 'hidden',
          }}>
            {/* PC: 테이블 형태 */}
            <div className="compare-desktop">
              {activeSituations.map((situation, si) => (
                <div key={situation} style={{
                  display: 'grid',
                  gridTemplateColumns: `180px repeat(${gameCount}, 1fr)`,
                  borderBottom: si < activeSituations.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{ padding: '14px 16px', fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, background: 'var(--bg)' }}>
                    {situation}
                  </div>
                  {games.map((g: any) => {
                    const gameScore = situationScores.find((s: any) => s.game === g.name);
                    const score = gameScore?.scores?.[si] ?? 0;
                    return (
                      <div key={g.id} style={{ padding: '14px 16px', borderLeft: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {[1,2,3,4,5].map(n => (
                          <span key={n} style={{ fontSize: 17, color: n <= score ? '#f59e0b' : 'var(--border)' }}>★</span>
                        ))}
                        <span style={{ fontSize: 14, color: 'var(--text-dimmer)', marginLeft: 4 }}>{score}/5</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 모바일: 세로 형태 */}
            <div className="compare-mobile">
              {activeSituations.map((situation, si) => (
                <div key={situation} style={{
                  borderBottom: si < activeSituations.length - 1 ? '1px solid var(--border-light)' : 'none',
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
                    {situation}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {games.map((g: any) => {
                      const gameScore = situationScores.find((s: any) => s.game === g.name);
                      const score = gameScore?.scores?.[si] ?? 0;
                      return (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: 'var(--text-dimmer)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.name}
                          </span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(n => (
                              <span key={n} style={{ fontSize: 16, color: n <= score ? '#f59e0b' : 'var(--border)' }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontSize: 14, color: 'var(--text-dimmer)' }}>{score}/5</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 스펙 비교 */}
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>스펙 비교</h2>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        {/* PC: 테이블 형태 */}
        <div className="compare-desktop">
          {ROWS.map((row, i) => (
            <div key={row.label} style={{
              display: 'grid',
              gridTemplateColumns: `180px repeat(${gameCount}, 1fr)`,
              borderBottom: i < ROWS.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{ padding: '14px 16px', fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, background: 'var(--bg)' }}>
                {row.label}
              </div>
              {games.map((g: any) => (
                <div key={g.id} style={{ padding: '14px 16px', fontSize: 15, color: 'var(--text)', fontWeight: 500, borderLeft: '1px solid var(--border-light)' }}>
                  {row.render ? row.render(g) : (g[row.key!] || '-')}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 모바일: 세로 형태 */}
        <div className="compare-mobile">
          {ROWS.map((row, i) => (
            <div key={row.label} style={{
              borderBottom: i < ROWS.length - 1 ? '1px solid var(--border-light)' : 'none',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 14, color: 'var(--text-dimmer)', fontWeight: 600, marginBottom: 8 }}>
                {row.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {games.map((g: any) => (
                  <div key={g.id} style={{
                    flex: 1, minWidth: 100,
                    background: 'var(--bg)', borderRadius: 8,
                    padding: '8px 10px', fontSize: 15, color: 'var(--text)', fontWeight: 500,
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--text-dimmer)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </div>
                    {row.render ? row.render(g) : (g[row.key!] || '-')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
            {/* AI 분석 채팅 */}
      <CompareChat games={games} />
    </main>
  );
}