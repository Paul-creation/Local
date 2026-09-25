import { supabase } from '../lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ComparePage({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = searchParams.ids?.split(',').slice(0, 3) || [];

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

  if (!games || games.length < 2) return null;

  const ROWS = [
    { label: '카테고리', key: 'category' },
    { label: '인원수', render: (g: any) => g.min_players && g.max_players ? `${g.min_players}-${g.max_players}인` : '정보 없음' },
    { label: '추천 인원', key: 'recommended_players' },
    { label: '솔로 플레이', render: (g: any) => g.solo_playable === true ? '✅ 가능' : g.solo_playable === false ? '❌ 불가' : '-' },
    { label: '난이도', key: 'difficulty' },
    { label: '한국어', key: 'korean_support' },
    { label: '필요 용량', render: (g: any) => g.storage_gb ? `${g.storage_gb}GB` : '-' },
    { label: '출시일', render: (g: any) => g.release_date ? new Date(g.release_date).toLocaleDateString('ko-KR') : '-' },
    { label: '가족 공유', render: (g: any) => g.family_sharing ? '✅' : '❌' },
    { label: '도전과제', render: (g: any) => g.achievement_count ? `${g.achievement_count}개` : '-' },
    { label: 'DLC', render: (g: any) => g.has_dlc ? '있음' : '없음' },
    { label: 'Workshop', render: (g: any) => g.has_workshop ? '✅' : '❌' },
    { label: 'e스포츠', render: (g: any) => g.is_esports ? '✅' : '❌' },
    { label: 'Steam 평점', render: (g: any) => g.review_positive_percent ? `${g.review_positive_percent}% (${g.review_total?.toLocaleString('ko-KR')}개)` : '-' },
    { label: '현재 접속자', render: (g: any) => g.current_players ? `${g.current_players.toLocaleString('ko-KR')}명` : '-' },
    { label: '역대 최저가', render: (g: any) => g.lowest_price ? `₩${g.lowest_price.toLocaleString('ko-KR')}` : '-' },
  ];

  return (
    <main className="page">
      <nav className="topnav"><span className="logo">게임정보허브</span></nav>

      <Link href="/" className="back-link">← 돌아가기</Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32, letterSpacing: '-0.02em' }}>
        게임 비교
      </h1>

      {/* 게임 헤더 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `200px repeat(${games.length}, 1fr)`,
        gap: 16, marginBottom: 8,
      }}>
        <div />
        {games.map(g => (
          <Link href={`/games/${g.id}`} key={g.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              overflow: 'hidden', border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <img src={g.cover_image_url} alt={g.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{g.name}</div>
                {g.tags?.slice(0, 2).map((t: string) => (
                  <span key={t} style={{
                    display: 'inline-block', fontSize: 11, color: 'var(--teal)',
                    background: 'rgba(15,155,142,0.08)', padding: '2px 8px',
                    borderRadius: 100, marginRight: 4, marginTop: 6,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 비교 테이블 */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)', overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {ROWS.map((row, i) => (
          <div key={row.label} style={{
            display: 'grid',
            gridTemplateColumns: `200px repeat(${games.length}, 1fr)`,
            borderBottom: i < ROWS.length - 1 ? '1px solid var(--border-light)' : 'none',
          }}>
            <div style={{
              padding: '14px 16px', fontSize: 13,
              color: 'var(--text-dim)', fontWeight: 600,
              background: 'var(--bg)',
            }}>
              {row.label}
            </div>
            {games.map(g => (
              <div key={g.id} style={{
                padding: '14px 16px', fontSize: 14,
                color: 'var(--text)', fontWeight: 500,
                borderLeft: '1px solid var(--border-light)',
              }}>
                {'render' in row ? row.render(g) : (g[row.key as string] || '-')}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}