import type { Metadata } from 'next';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

// compare_cache는 RLS로 막혀 있어서 서버 전용 키로 접근 (이 파일은 서버에서만 실행됨)
const cacheDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
import { headers } from 'next/headers';
import { guardedClaudeFetch } from '../lib/aiGuard';
import Link from 'next/link';
import { getPriceInfo } from '../lib/price';
import { formatDate } from '../lib/date';
import CompareChat from '../components/CompareChat';
import ScrollToTop from '../components/ScrollToTop';
import BackToList from '../components/BackToList';
import ShareButton from '../components/ShareButton';
import CompareBuilder from '../components/CompareBuilder';
import { BUILDER_FIELDS } from '../lib/compareRule';
import { playersText } from '../lib/players';
import GameImage from '../components/GameImage';
import { selectGames } from '../lib/visibleGames';

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

  const { data: cached } = await cacheDb
    .from('compare_cache')
    .select('situation_scores')
    .eq('game_ids', gameIds)
    .maybeSingle();

  if (cached && isValidScores(cached.situation_scores, games, activeSituations.length)) {
    return cached.situation_scores;
  }

  const gameList = games
    .map((g, i) =>
      `${i + 1}번. ${g.name} | 태그: ${(g.tags || []).join(', ')} | 난이도: ${g.difficulty} | 인원: ${g.min_players ?? '?'}-${g.max_players ?? '?'} | 카테고리: ${g.category} | 솔로: ${g.solo_playable}`
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
    const res = await guardedClaudeFetch(await headers(), 'compare-scores', {
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
      await cacheDb.from('compare_cache').upsert({ game_ids: gameIds, situation_scores: scores });
    }
    return scores;
  } catch (err) {
    console.error('상황별 추천도 생성 실패:', err);
    return [];
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ ids?: string }> }): Promise<Metadata> {
  const { ids: idsParam } = await searchParams;
  const ids = idsParam?.split(',').slice(0, 3) || [];
  if (ids.length < 2) return { title: '게임 비교 만들기' };
  const { data } = await selectGames('id, name').in('id', ids);
  const games = ids.map((id) => (data || []).find((g) => g.id === id)).filter(Boolean) as any[];
  const names = games.map((g) => g.name).join(' vs ');
  const ogTitle = `게임 ${games.length}개 비교 — 우리 뭐 할래?`;
  const desc = `${names} — 상황별 추천도·인원·가격을 한눈에 비교해보세요`;
  const image = `/api/og/compare?ids=${games.map((g) => g.id).join(',')}`;
  return {
    title: `${names} 비교`,
    description: desc,
    robots: { index: false }, // 조합이 무한해서 검색 결과에는 안 올림 (공유 미리보기만)
    openGraph: { title: ogTitle, description: desc, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: ogTitle, description: desc, images: [image] },
  };
}

// 상황별 추천도 — 5칸 막대(장식) + "N/5"
function Meter({ score }: { score: number }) {
  return (
    <span className="cmp-meter">
      <span className="cmp-meter-bar" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= score ? 'on' : ''} />)}
      </span>
      <span className="cmp-meter-num">{score}/5</span>
    </span>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: idsParam } = await searchParams;
  const ids = idsParam?.split(',').slice(0, 3) || [];

  // ids가 없거나 1개면 비교 만들기 화면 (1개면 그 게임을 첫 칸에)
  if (ids.length < 2) {
    const [{ data: popular }, { data: initial }] = await Promise.all([
      selectGames(BUILDER_FIELDS).not('heat_rank', 'is', null).order('heat_rank', { ascending: true }).limit(8),
      ids.length ? selectGames(BUILDER_FIELDS).in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    return (
      <main className="page">
        <BackToList />
        <CompareBuilder initial={initial || []} popular={popular || []} />
      </main>
    );
  }

  const { data: games } = await selectGames('*, price_history(price, discount_percent, checked_at, currency)')
    .in('id', ids);

  if (!games || games.length < 2) {
    return (
      <main className="page">
        <p className="cmp-empty">게임을 불러오지 못했어요. 다시 시도해 주세요.</p>
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

  // STEAM_ONLY — 스팀에서만 의미 있는 항목은 다른 스토어 게임에 "해당 없음"
  const steamOnly = (fn: (g: any) => any) => (g: any) => (g.steam_appid ? fn(g) : '해당 없음');

  const ROWS: Row[] = [
    { label: '카테고리', key: 'category' },
    { label: '인원수', render: (g: any) => {
      return playersText(g) || '인원 정보 확인 중';
    }},
    { label: '솔로 플레이', render: (g: any) =>
      g.solo_playable === true && g.max_players === 1
        ? '싱글 플레이 게임'
        : g.solo_playable === true
        ? '솔로 가능'
        : '멀티 필수'
    },
    { label: '진입장벽', render: (g: any) => g.entry_barrier || g.difficulty || '-' },
    { label: '한국어', key: 'korean_support' },
    { label: '필요 용량', render: (g: any) => g.storage_gb ? `${g.storage_gb}GB` : '-' },
    { label: '출시일', render: (g: any) => formatDate(g.release_date) || '-' },
    { label: '가족 공유', render: steamOnly((g: any) => g.family_sharing ? '가능' : '불가') },
    { label: '도전과제', render: steamOnly((g: any) => g.achievement_count ? `${g.achievement_count}개` : '-') },
    { label: 'DLC', render: steamOnly((g: any) => g.has_dlc ? '있음' : '없음') },
    { label: 'Steam 평점', render: steamOnly((g: any) => g.review_positive_percent ? `${g.review_positive_percent}% (${g.review_total?.toLocaleString('ko-KR')}개)` : '-') },
    { label: '현재 접속자', render: steamOnly((g: any) => g.current_players ? `${g.current_players.toLocaleString('ko-KR')}명` : '-') },
    { label: '역대 최저가', render: (g: any) => g.lowest_price ? `₩${g.lowest_price.toLocaleString('ko-KR')}` : '-' },
  ];

  const gameCount = games.length;

  const cols = { gridTemplateColumns: `180px repeat(${gameCount}, minmax(0, 1fr))` };

  return (
    <main className="page cmp-page">
      <ScrollToTop />

      <BackToList />
      <div className="cmp-head">
        <h1 className="cmp-title">게임 비교</h1>
        <ShareButton
          title={`게임 ${games.length}개 비교 — 우리 뭐 할래?`}
          text={`${games.map((g: any) => g.name).join(' vs ')} 중에 뭐 할래?`}
        />
      </div>

      {/* 포스터 카드 */}
      <div className="compare-header cmp-posters" style={cols}>
        <div />
        {games.map((g: any) => {
          const price = getPriceInfo(g);
          return (
            <Link href={`/games/${g.id}`} key={g.id} className="cmp-poster lift">
              <span className="cmp-poster-image">
                <GameImage src={g.cover_image_url || g.card_image_url} steamSize="header" alt="" />
              </span>
              <span className="cmp-poster-body">
                <span className="cmp-poster-name">{g.name}</span>
                <span className="cmp-poster-meta">
                  {[playersText(g), g.is_free ? '무료' : price?.formattedFinal].filter(Boolean).join(' · ')}
                  {price && price.discount > 0 && !g.is_free && <span className="discount-badge">-{price.discount}%</span>}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* 상황별 추천도 */}
      {activeSituations.length > 0 && situationScores.length === 0 && (
        <p className="cmp-note">상황별 추천도를 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>
      )}
      {activeSituations.length > 0 && situationScores.length > 0 && (
        <section className="cmp-section">
          <h2 className="cmp-h2">상황별 추천도</h2>
          <div className="cmp-table">
            {/* PC: 표 */}
            <div className="compare-desktop">
              {activeSituations.map((situation, si) => (
                <div key={situation} className="cmp-row" style={cols}>
                  <div className="cmp-row-label">{situation}</div>
                  {games.map((g: any) => {
                    const gameScore = situationScores.find((s: any) => s.game === g.name);
                    return <div key={g.id} className="cmp-cell"><Meter score={gameScore?.scores?.[si] ?? 0} /></div>;
                  })}
                </div>
              ))}
            </div>
            {/* 모바일: 세로 */}
            <div className="compare-mobile">
              {activeSituations.map((situation, si) => (
                <div key={situation} className="cmp-mrow">
                  <div className="cmp-row-label is-m">{situation}</div>
                  {games.map((g: any) => {
                    const gameScore = situationScores.find((s: any) => s.game === g.name);
                    return (
                      <div key={g.id} className="cmp-mitem">
                        <span className="cmp-mname">{g.name}</span>
                        <Meter score={gameScore?.scores?.[si] ?? 0} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 스펙 비교 */}
      <section className="cmp-section">
        <h2 className="cmp-h2">스펙 비교</h2>
        <div className="cmp-table">
          <div className="compare-desktop">
            {ROWS.map((row) => (
              <div key={row.label} className="cmp-row" style={cols}>
                <div className="cmp-row-label">{row.label}</div>
                {games.map((g: any) => (
                  <div key={g.id} className="cmp-cell num">{row.render ? row.render(g) : (g[row.key!] || '-')}</div>
                ))}
              </div>
            ))}
          </div>
          <div className="compare-mobile">
            {ROWS.map((row) => (
              <div key={row.label} className="cmp-mrow">
                <div className="cmp-row-label is-m">{row.label}</div>
                <div className="cmp-mgrid">
                  {games.map((g: any) => (
                    <div key={g.id} className="cmp-mbox">
                      <span className="cmp-mname">{g.name}</span>
                      <span className="num">{row.render ? row.render(g) : (g[row.key!] || '-')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI 질문 카드 */}
      <CompareChat games={games} />
    </main>
  );
}