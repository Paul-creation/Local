import { ImageResponse } from 'next/og';
import { supabase } from '../../../lib/supabase';
import { SITE_NAME } from '../../../lib/site';
import { loadOgFonts, OG_SIZE, OG_CACHE } from '../../../lib/og';

// 비교 링크 공유 미리보기 — 게임 카드 이미지를 나란히 + 사이에 VS
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3);
  const { data } = ids.length
    ? await supabase.from('games').select('id, name, card_image_url, cover_image_url').in('id', ids)
    : { data: [] };
  const games = ids.map((id) => (data || []).find((g) => g.id === id)).filter(Boolean) as any[];
  const fonts = await loadOgFonts();

  const cardWidth = games.length >= 3 ? 310 : 440;
  const cardHeight = Math.round((cardWidth * 9) / 16);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1b26 0%, #2b2140 100%)', color: '#fff', fontFamily: 'Pretendard', position: 'relative' }}>
        <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 48 }}>우리 이 중에 뭐 할래?</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {games.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#ff6b4a', margin: '0 28px', paddingBottom: 56 }}>VS</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', width: cardWidth }}>
                {g.card_image_url || g.cover_image_url ? (
                  <img src={g.card_image_url || g.cover_image_url} width={cardWidth} height={cardHeight} style={{ objectFit: 'cover', borderRadius: 16 }} />
                ) : (
                  <div style={{ width: cardWidth, height: cardHeight, borderRadius: 16, background: '#3a3550' }} />
                )}
                <div style={{ display: 'block', marginTop: 16, fontSize: 30, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.name}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', right: 40, bottom: 32, fontSize: 26, fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>{SITE_NAME}</div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
