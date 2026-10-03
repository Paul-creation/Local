import { ImageResponse } from 'next/og';
import { supabase } from '../../../../lib/supabase';
import { SITE_NAME } from '../../../../lib/site';
import { getPriceInfo } from '../../../../lib/price';
import { loadOgFonts, OG_SIZE, OG_CACHE, playersText } from '../../../../lib/og';

// 게임 상세 공유 미리보기 — 게임 이미지를 배경으로 깔고 그 위에 이름·인원·난이도·가격·한 줄 소개
// 카톡에서는 가로 300px 정도로 줄어 보여서 글씨를 크게 쓰고, 이미지 위 글씨는 어두운 배경으로 대비 확보
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: game } = await supabase
    .from('games')
    .select('name, fun_description, description, min_players, max_players, difficulty, is_free, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) return new Response('게임을 찾을 수 없어요', { status: 404 });
  const fonts = await loadOgFonts();

  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? price.formattedFinal : '';
  const discount = !game.is_free && price && price.discount > 0 ? price.discount : 0;
  const summary = [playersText(game), game.difficulty, priceText].filter(Boolean).join(' · ');
  // 2줄 안에 들어갈 만큼만 (넘치면 lineClamp가 말줄임)
  const intro = (game.fun_description || game.description || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const image = game.card_image_url || game.cover_image_url;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#1a1b26', color: '#fff', fontFamily: 'Pretendard', position: 'relative' }}>
        {image && (
          <img src={image} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }} />
        )}
        {/* 글씨 대비용 어두운 반투명 배경 (아래로 갈수록 진하게) */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, background: 'linear-gradient(180deg, rgba(10,10,20,0.45) 0%, rgba(10,10,20,0.85) 42%, rgba(10,10,20,0.95) 100%)' }} />
        <div style={{ position: 'absolute', top: 28, right: 32, display: 'flex', padding: '8px 20px', borderRadius: 100, background: 'rgba(0,0,0,0.55)', fontSize: 32, fontWeight: 800 }}>{SITE_NAME}</div>
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 48, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'block', fontSize: 80, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', lineClamp: 2, overflow: 'hidden', wordBreak: 'keep-all' }}>{game.name}</div>
          {(summary || discount > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 20, fontSize: 48, fontWeight: 800 }}>
              {summary && <span>{summary}</span>}
              {discount > 0 && (
                <span style={{ marginLeft: 18, padding: '2px 18px', borderRadius: 14, background: '#ff3b30', color: '#fff' }}>-{discount}%</span>
              )}
            </div>
          )}
          {intro && (
            <div style={{ display: 'block', marginTop: 18, fontSize: 40, fontWeight: 400, lineHeight: 1.35, color: 'rgba(255,255,255,0.9)', lineClamp: 2, overflow: 'hidden' }}>{intro}</div>
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
