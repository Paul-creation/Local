import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../../../lib/site';
import { getPriceInfo } from '../../../lib/price';
import { loadOgFonts, fetchOgImage, clip, OG_SIZE, OG_CACHE, OG_COLOR, playersText } from '../../../lib/og';
import { selectGames } from '../../../lib/visibleGames';

// 비교 링크 공유 미리보기 — 게임 2~4개의 카드 이미지·이름·인원·가격, 캔버스 가로 전체 사용
// 이미지를 못 받은 게임은 이름만 (그림 전체가 깨지지 않게 fetchOgImage로 미리 받음)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OG_GAMES = 4;
const PAD = 48;

type Item = { id: string; name: string; image: string | null; players: string; price: string; discount: number };

function Meta({ g, size }: { g: Item; size: number }) {
  if (!g.players && !g.price) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, fontSize: size, fontWeight: 400, color: OG_COLOR.textMuted }}>
      {g.players && <span>{g.players}</span>}
      {g.players && g.price && <span style={{ margin: '0 8px' }}>·</span>}
      {g.discount > 0 && <span style={{ display: 'flex', marginRight: 8, padding: '0 8px', borderRadius: 3, background: OG_COLOR.discountBg, color: OG_COLOR.discountText, fontWeight: 800 }}>-{g.discount}%</span>}
      {g.price && <span style={{ color: OG_COLOR.text, fontWeight: 800 }}>{g.price}</span>}
    </div>
  );
}

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter((x) => UUID.test(x)))].slice(0, MAX_OG_GAMES);
  const { data } = ids.length
    ? await selectGames('id, name, min_players, max_players, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at, original_price)').in('id', ids)
    : { data: [] };
  const found = ids.map((id) => (data || []).find((g: any) => g.id === id)).filter(Boolean) as any[];
  const [fonts, images] = await Promise.all([
    loadOgFonts(),
    Promise.all(found.map((g) => fetchOgImage(g.card_image_url || g.cover_image_url))),
  ]);
  const games: Item[] = found.map((g, i) => {
    const price = getPriceInfo(g);
    return {
      id: g.id,
      name: g.name,
      image: images[i],
      players: playersText(g),
      price: g.is_free ? '무료' : price ? price.formattedFinal : '',
      discount: !g.is_free && price && price.discount > 0 ? price.discount : 0,
    };
  });

  const innerW = OG_SIZE.width - PAD * 2;
  const gap = 24;
  const four = games.length === 4;
  // 2~3개는 한 줄 세로 카드, 4개는 2x2 가로 카드
  const cols = four ? 2 : Math.max(games.length, 1);
  const cellW = Math.floor((innerW - gap * (cols - 1)) / cols);
  const rows: Item[][] = [];
  for (let i = 0; i < games.length; i += cols) rows.push(games.slice(i, i + cols));
  const nameMax = four ? 30 : 36;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: PAD, background: OG_COLOR.bg, color: OG_COLOR.text, fontFamily: 'Pretendard' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>우리 이 중에 뭐 할래?</div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 400, color: OG_COLOR.textMuted }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap }}>
              {row.map((g) =>
                four ? (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', width: cellW, padding: 14, borderRadius: 16, background: OG_COLOR.card }}>
                    {g.image && <img src={g.image} width={240} height={135} style={{ objectFit: 'cover', borderRadius: 10, marginRight: 16 }} />}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'block', fontSize: 30, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{clip(g.name, nameMax)}</div>
                      <Meta g={g} size={24} />
                    </div>
                  </div>
                ) : (
                  <div key={g.id} style={{ display: 'flex', flexDirection: 'column', width: cellW, padding: 16, borderRadius: 16, background: OG_COLOR.card }}>
                    {g.image && <img src={g.image} width={cellW - 32} height={Math.round((cellW - 32) * (games.length === 2 ? 0.5726 : 0.72))} style={{ objectFit: 'cover', borderRadius: 10 }} />}
                    <div style={{ display: 'block', marginTop: g.image ? 14 : 0, fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{clip(g.name, nameMax)}</div>
                    <Meta g={g} size={28} />
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
