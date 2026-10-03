import { ImageResponse } from 'next/og';
import { supabase } from '../../../../lib/supabase';
import { SITE_NAME } from '../../../../lib/site';
import { getPriceInfo } from '../../../../lib/price';
import { loadOgFonts, OG_SIZE, OG_CACHE, playersText } from '../../../../lib/og';

// 게임 상세 공유 미리보기 — 이미지 + 이름 + 인원·난이도·가격 + 한 줄 소개
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
  const priceText = game.is_free ? '무료' : price ? (price.discount > 0 ? `${price.formattedFinal} (-${price.discount}%)` : price.formattedFinal) : '';
  const summary = [playersText(game), game.difficulty, priceText].filter(Boolean).join(' · ');
  const intro = (game.fun_description || game.description || '').replace(/\s+/g, ' ').trim();
  const introShort = intro.length > 60 ? intro.slice(0, 60) + '…' : intro;
  const image = game.card_image_url || game.cover_image_url;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 60px', background: 'linear-gradient(135deg, #1a1b26 0%, #2b2140 100%)', color: '#fff', fontFamily: 'Pretendard', position: 'relative' }}>
        {image ? (
          <img src={image} width={520} height={293} style={{ objectFit: 'cover', borderRadius: 20, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 520, height: 293, borderRadius: 20, background: '#3a3550', flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 48, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'block', fontSize: 54, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', lineClamp: 2, overflow: 'hidden' }}>{game.name}</div>
          {summary && <div style={{ display: 'flex', marginTop: 22, fontSize: 30, fontWeight: 800, color: '#ffb199' }}>{summary}</div>}
          {introShort && <div style={{ display: 'block', marginTop: 20, fontSize: 26, fontWeight: 400, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', lineClamp: 3, overflow: 'hidden' }}>{introShort}</div>}
        </div>
        <div style={{ position: 'absolute', right: 40, bottom: 32, fontSize: 26, fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>{SITE_NAME}</div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
