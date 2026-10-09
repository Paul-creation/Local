import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../../../../lib/site';
import { getPriceInfo } from '../../../../lib/price';
import { loadOgFonts, fetchOgImage, clip, OG_SIZE, OG_CACHE, OG_COLOR, playersText } from '../../../../lib/og';
import { selectGames } from '../../../../lib/visibleGames';

// 게임 상세 공유 미리보기 — 캔버스 전체를 쓰는 가로 배치 (왼쪽 대표 이미지, 오른쪽 정보)
// 카톡·디스코드 썸네일처럼 작게 보여도 제목·가격이 읽히게 큰 글자로, 값이 없는 칸은 통째로 숨긴다
const PAD = 48;
const IMG_W = 540;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: game } = await selectGames('name, fun_description, description, min_players, max_players, difficulty, entry_barrier, review_summary, review_positive_percent, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) return new Response('게임을 찾을 수 없어요', { status: 404 });
  const [fonts, image] = await Promise.all([loadOgFonts(), fetchOgImage(game.card_image_url || game.cover_image_url)]);

  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? price.formattedFinal : '';
  const discount = !game.is_free && price && price.discount > 0 ? price.discount : 0;
  const originalText = discount > 0 && price ? price.formattedOriginal : ''; // 취소선은 할인 중일 때 원가에만
  const players = playersText(game);
  const barrier = game.entry_barrier || game.difficulty; // 사이트 비교표와 같은 기준
  // 스팀 평가 — 등급과 퍼센트가 둘 다 있을 때만
  const review = game.review_summary && game.review_positive_percent != null ? `${game.review_summary} ${game.review_positive_percent}%` : '';
  const name = clip(game.name, 40);
  const titleSize = name.length <= 14 ? 68 : name.length <= 26 ? 56 : 46;
  const intro = clip(game.fun_description || game.description || '', 60);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: PAD, background: OG_COLOR.bg, color: OG_COLOR.text, fontFamily: 'Pretendard' }}>
        {image ? (
          <img src={image} width={IMG_W} height={Math.round(IMG_W * 0.5726)} style={{ objectFit: 'cover', borderRadius: 16 }} />
        ) : (
          <div style={{ display: 'flex', width: IMG_W, height: Math.round(IMG_W * 0.5726), borderRadius: 16, background: OG_COLOR.inset }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, height: '100%', marginLeft: 44 }}>
          <div style={{ display: 'block', fontSize: titleSize, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', wordBreak: 'keep-all' }}>{name}</div>
          {(priceText || discount > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 20, fontSize: discount > 0 ? 50 : 56, fontWeight: 800 }}>
              {discount > 0 && (
                <span style={{ display: 'flex', marginRight: 14, padding: '0 12px', borderRadius: 3, background: OG_COLOR.discountBg, color: OG_COLOR.discountText }}>-{discount}%</span>
              )}
              {priceText && <span>{priceText}</span>}
              {originalText && <span style={{ marginLeft: 20, fontSize: 28, fontWeight: 400, color: OG_COLOR.textMuted, textDecoration: 'line-through' }}>{originalText}</span>}
            </div>
          )}
          {(players || barrier) && (
            <div style={{ display: 'flex', marginTop: 16, fontSize: 32, fontWeight: 800, color: OG_COLOR.accent }}>
              {[players, barrier ? `진입장벽 ${barrier}` : ''].filter(Boolean).join(' · ')}
            </div>
          )}
          {review && <div style={{ display: 'flex', marginTop: 10, fontSize: 28, fontWeight: 400, color: OG_COLOR.review }}>스팀 평가 {review}</div>}
          {intro && <div style={{ display: 'block', marginTop: 14, fontSize: 26, fontWeight: 400, lineHeight: 1.35, color: OG_COLOR.textMuted, wordBreak: 'keep-all' }}>{intro}</div>}
          <div style={{ display: 'flex', marginTop: 24, fontSize: 24, fontWeight: 400, color: OG_COLOR.textMuted }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
