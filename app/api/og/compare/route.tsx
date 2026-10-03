import { ImageResponse } from 'next/og';
import { supabase } from '../../../lib/supabase';
import { SITE_NAME } from '../../../lib/site';
import { loadOgFonts, OG_SIZE, OG_CACHE, OG_SAFE } from '../../../lib/og';

// 비교 링크 공유 미리보기
// 메시지 앱이 가운데만 잘라 보여줘도 다 보이게, 제목·썸네일·이름은 가운데 600x600 안에만 둔다
// 바깥 양옆은 첫 번째 게임 이미지를 흐리고 어둡게 깐 장식
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3);
  const { data } = ids.length
    ? await supabase.from('games').select('id, name, card_image_url, cover_image_url').in('id', ids)
    : { data: [] };
  const games = ids.map((id) => (data || []).find((g) => g.id === id)).filter(Boolean) as any[];
  const fonts = await loadOgFonts();

  const gap = 12;
  const thumb = games.length >= 3 ? Math.floor((OG_SAFE - 24 - gap * 2) / 3) : 260; // 3개면 184, 2개면 260
  const thumbHeight = Math.round(thumb * 0.9); // 정사각형에 가깝게
  const bg = games[0]?.card_image_url || games[0]?.cover_image_url;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14141f', color: '#fff', fontFamily: 'Pretendard', position: 'relative' }}>
        {bg && (
          <img src={bg} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover', filter: 'blur(28px)', transform: 'scale(1.15)' }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, background: 'rgba(10,10,20,0.4)' }} />

        {/* 가운데 안전 구역 600x600 */}
        <div style={{ width: OG_SAFE, height: OG_SAFE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 28, background: 'rgba(14,14,24,0.82)' }}>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 36 }}>우리 이 중에 뭐 할래?</div>
          <div style={{ display: 'flex', gap }}>
            {games.map((g) => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: thumb }}>
                {g.card_image_url || g.cover_image_url ? (
                  <img src={g.card_image_url || g.cover_image_url} width={thumb} height={thumbHeight} style={{ objectFit: 'cover', borderRadius: 16 }} />
                ) : (
                  <div style={{ width: thumb, height: thumbHeight, borderRadius: 16, background: '#3a3550' }} />
                )}
                <div style={{ display: 'block', width: thumb, marginTop: 12, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.name}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36, fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
