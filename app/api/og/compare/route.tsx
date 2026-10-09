import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../../../lib/site';
import { getPriceInfo } from '../../../lib/price';
import { loadOgFonts, fetchOgImage, OG_SIZE, OG_CACHE, OG_SAFE, OG_COLOR, playersText } from '../../../lib/og';
import { selectGames } from '../../../lib/visibleGames';

// 비교 링크 공유 미리보기 — 게임 2~4개의 카드 이미지·이름·인원·가격
// 메시지 앱이 가운데만 잘라 보여줘도 다 보이게, 내용은 가운데 600x600 안에만 둔다
// 이미지를 못 받은 게임은 이름만 (그림 전체가 깨지지 않게 fetchOgImage로 미리 받음)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OG_GAMES = 4;

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter((x) => UUID.test(x)))].slice(0, MAX_OG_GAMES);
  const { data } = ids.length
    ? await selectGames('id, name, min_players, max_players, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)').in('id', ids)
    : { data: [] };
  const found = ids.map((id) => (data || []).find((g: any) => g.id === id)).filter(Boolean) as any[];
  const [fonts, images] = await Promise.all([
    loadOgFonts(),
    Promise.all(found.map((g) => fetchOgImage(g.card_image_url || g.cover_image_url))),
  ]);
  const games = found.map((g, i) => {
    const price = getPriceInfo(g);
    return {
      id: g.id as string,
      name: g.name as string,
      image: images[i],
      players: playersText(g),
      price: g.is_free ? '무료' : price ? (price.formattedFinal as string) : '',
      discount: !g.is_free && price && price.discount > 0 ? (price.discount as number) : 0,
    };
  });

  // 4개면 2x2, 2~3개면 한 줄
  const cols = games.length === 4 ? 2 : Math.max(games.length, 1);
  const gap = 14;
  const inner = OG_SAFE - 48;
  const cellW = Math.floor((inner - gap * (cols - 1)) / cols);
  const imgH = games.length === 4 ? 112 : Math.round(cellW * 0.56);
  const nameSize = games.length === 4 ? 24 : 26;
  const rows: (typeof games)[] = [];
  for (let i = 0; i < games.length; i += cols) rows.push(games.slice(i, i + cols));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: OG_COLOR.bg, color: OG_COLOR.text, fontFamily: 'Pretendard' }}>
        <div style={{ width: OG_SAFE, height: OG_SAFE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 28, background: OG_COLOR.card }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 28 }}>우리 이 중에 뭐 할래?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap, justifyContent: 'center' }}>
                {row.map((g) => (
                  <div key={g.id} style={{ display: 'flex', flexDirection: 'column', width: cellW }}>
                    {g.image ? (
                      <img src={g.image} width={cellW} height={imgH} style={{ objectFit: 'cover', borderRadius: 12 }} />
                    ) : null}
                    <div style={{ display: 'block', width: cellW, marginTop: g.image ? 10 : 0, fontSize: nameSize, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                    {(g.players || g.price) && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, fontSize: 20, fontWeight: 400, color: OG_COLOR.textMuted }}>
                        {g.players && <span>{g.players}</span>}
                        {g.players && g.price && <span style={{ margin: '0 6px' }}>·</span>}
                        {g.discount > 0 && <span style={{ marginRight: 6, padding: '0 6px', borderRadius: 3, background: OG_COLOR.discountBg, color: OG_COLOR.discountText, fontWeight: 800 }}>-{g.discount}%</span>}
                        {g.price && <span style={{ color: OG_COLOR.text }}>{g.price}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 22, fontWeight: 400, color: OG_COLOR.textMuted }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
