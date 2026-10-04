import { ImageResponse } from 'next/og';
import { supabase } from '../../../../lib/supabase';
import { SITE_NAME } from '../../../../lib/site';
import { getPriceInfo } from '../../../../lib/price';
import { loadOgFonts, OG_SIZE, OG_CACHE, OG_SAFE, playersText } from '../../../../lib/og';
import { selectGames } from '../../../../lib/visibleGames';

// 게임 상세 공유 미리보기
// 메시지 앱이 가운데만 잘라 보여줘도 다 보이게, 썸네일·이름·인원·난이도·가격은 가운데 600x600 안에만 둔다
// 바깥 양옆은 게임 이미지를 흐리고 어둡게 깐 장식
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: game } = await selectGames('name, fun_description, description, min_players, max_players, difficulty, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) return new Response('게임을 찾을 수 없어요', { status: 404 });
  const fonts = await loadOgFonts();

  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? price.formattedFinal : '';
  const discount = !game.is_free && price && price.discount > 0 ? price.discount : 0;
  const meta = [playersText(game), game.difficulty].filter(Boolean).join(' · ');
  const intro = (game.fun_description || game.description || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const image = game.card_image_url || game.cover_image_url;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14141f', color: '#fff', fontFamily: 'Pretendard', position: 'relative' }}>
        {image && (
          <img src={image} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover', filter: 'blur(28px)', transform: 'scale(1.15)' }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, background: 'rgba(10,10,20,0.4)' }} />

        {/* 가운데 안전 구역 600x600 */}
        <div style={{ width: OG_SAFE, height: OG_SAFE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', borderRadius: 28, background: 'rgba(14,14,24,0.82)' }}>
          {image ? (
            <img src={image} width={400} height={225} style={{ objectFit: 'cover', borderRadius: 16 }} />
          ) : (
            <div style={{ width: 400, height: 225, borderRadius: 16, background: '#3a3550' }} />
          )}
          <div style={{ display: 'block', marginTop: 20, fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', textAlign: 'center', lineClamp: 2, overflow: 'hidden', wordBreak: 'keep-all' }}>{game.name}</div>
          {(priceText || discount > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, fontSize: 44, fontWeight: 800 }}>
              {discount > 0 && (
                <span style={{ marginRight: 14, padding: '0 14px', borderRadius: 12, background: '#ff3b30' }}>-{discount}%</span>
              )}
              {priceText && <span>{priceText}</span>}
            </div>
          )}
          {meta && <div style={{ display: 'flex', marginTop: 8, fontSize: 30, fontWeight: 800, color: '#ffb199' }}>{meta}</div>}
          {intro && (
            <div style={{ display: 'block', marginTop: 10, fontSize: 24, fontWeight: 400, lineHeight: 1.35, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineClamp: 1, overflow: 'hidden' }}>{intro}</div>
          )}
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 400, color: 'rgba(255,255,255,0.55)' }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
