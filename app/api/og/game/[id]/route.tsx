import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../../../../lib/site';
import { getPriceInfo } from '../../../../lib/price';
import { loadOgFonts, fetchOgImage, OG_SIZE, OG_CACHE, OG_SAFE, OG_COLOR, playersText } from '../../../../lib/og';
import { selectGames } from '../../../../lib/visibleGames';

// 게임 상세 공유 미리보기
// 메시지 앱이 가운데만 잘라 보여줘도 다 보이게, 썸네일·이름·인원·난이도·가격·평가는 가운데 600x600 안에만 둔다
// 바깥은 어두운 단색 (흐림·반투명 없음)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: game } = await selectGames('name, fun_description, description, min_players, max_players, difficulty, review_summary, review_positive_percent, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) return new Response('게임을 찾을 수 없어요', { status: 404 });
  const [fonts, image] = await Promise.all([loadOgFonts(), fetchOgImage(game.card_image_url || game.cover_image_url)]);

  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? price.formattedFinal : '';
  const discount = !game.is_free && price && price.discount > 0 ? price.discount : 0;
  const meta = [playersText(game), game.difficulty].filter(Boolean).join(' · ');
  // 스팀 평가 — 등급과 퍼센트가 둘 다 있을 때만
  const review = game.review_summary && game.review_positive_percent != null ? `${game.review_summary} ${game.review_positive_percent}%` : '';
  const intro = (game.fun_description || game.description || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: OG_COLOR.bg, color: OG_COLOR.text, fontFamily: 'Pretendard' }}>
        {/* 가운데 안전 구역 600x600 */}
        <div style={{ width: OG_SAFE, height: OG_SAFE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', borderRadius: 28, background: OG_COLOR.card }}>
          {image ? (
            <img src={image} width={400} height={225} style={{ objectFit: 'cover', borderRadius: 16 }} />
          ) : (
            <div style={{ width: 400, height: 225, borderRadius: 16, background: OG_COLOR.inset }} />
          )}
          <div style={{ display: 'block', marginTop: 20, fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', textAlign: 'center', lineClamp: 2, overflow: 'hidden', wordBreak: 'keep-all' }}>{game.name}</div>
          {(priceText || discount > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, fontSize: 44, fontWeight: 800 }}>
              {discount > 0 && (
                <span style={{ marginRight: 14, padding: '0 12px', borderRadius: 3, background: OG_COLOR.discountBg, color: OG_COLOR.discountText }}>-{discount}%</span>
              )}
              {priceText && <span>{priceText}</span>}
            </div>
          )}
          {meta && <div style={{ display: 'flex', marginTop: 8, fontSize: 30, fontWeight: 800, color: OG_COLOR.accent }}>{meta}</div>}
          {review && <div style={{ display: 'flex', marginTop: 8, fontSize: 26, fontWeight: 400, color: OG_COLOR.review }}>스팀 평가 {review}</div>}
          {intro && (
            <div style={{ display: 'block', marginTop: 10, fontSize: 24, fontWeight: 400, lineHeight: 1.35, color: OG_COLOR.textMuted, textAlign: 'center', lineClamp: 1, overflow: 'hidden' }}>{intro}</div>
          )}
          <div style={{ display: 'flex', marginTop: 14, fontSize: 22, fontWeight: 400, color: OG_COLOR.textMuted }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
