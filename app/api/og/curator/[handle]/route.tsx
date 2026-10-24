import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../../../../lib/site';
import { loadOgFonts, fetchOgImage, clip, OG_SIZE, OG_CACHE, OG_COLOR } from '../../../../lib/og';
import { getCurator, getCuratorGameCount } from '../../../../lib/curators';
import { withSubjectJosa } from '../../../../lib/josa';

// 계정 프로필 공유 미리보기 — 아바타 + "@이름이 소개한 게임" + 게임 수 + 사이트 이름. 핵심은 가운데에 모은다
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const curator = await getCurator(decodeURIComponent(handle));
  if (!curator) return new Response('계정을 찾을 수 없어요', { status: 404 });
  const [fonts, avatar, count] = await Promise.all([loadOgFonts(), fetchOgImage(curator.avatar_url), getCuratorGameCount(curator.id).catch(() => null)]);

  const name = clip(curator.display_name, 24);
  const title = `@${withSubjectJosa(name)} 소개한 게임`;
  const bio = clip(curator.bio || '', 60);
  const titleSize = title.length <= 14 ? 72 : title.length <= 22 ? 60 : 48;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: OG_COLOR.bg, color: OG_COLOR.text, fontFamily: 'Pretendard', padding: 48 }}>
        {/* 아바타가 없거나 못 받은 계정(webp 등 ImageResponse가 못 그리는 형식 포함)은 원 없이 글자만 */}
        {avatar && <img src={avatar} width={176} height={176} style={{ objectFit: 'cover', borderRadius: 88, border: `2px solid ${OG_COLOR.textMuted}`, marginBottom: 32 }} />}
        <div style={{ display: 'flex', maxWidth: 1000, justifyContent: 'center', textAlign: 'center', fontSize: titleSize, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em' }}>{title}</div>
        {bio && <div style={{ display: 'flex', maxWidth: 900, marginTop: 18, justifyContent: 'center', textAlign: 'center', fontSize: 30, fontWeight: 400, lineHeight: 1.35, color: OG_COLOR.textMuted }}>{bio}</div>}
        {count != null && count > 0 && (
          <div style={{ display: 'flex', marginTop: 20, fontSize: 40, fontWeight: 800, color: OG_COLOR.accent }}>게임 {count}개</div>
        )}
        <div style={{ display: 'flex', marginTop: 28, fontSize: 28, fontWeight: 400, color: OG_COLOR.textMuted }}>{SITE_NAME}</div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { 'Cache-Control': OG_CACHE } },
  );
}
