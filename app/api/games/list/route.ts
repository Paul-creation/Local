import { NextResponse } from 'next/server';
import { getGameIndex } from '../../../lib/gameIndex';

// 메인 검색·필터용 전체 게임 목록 (읽기 전용, 공개 정보만)
// ISR 캐시(Vercel ISR Writes 한도)를 쓰지 않고 CDN 캐시만 쓴다: 1시간 동안은 CDN이 만들어 둔 응답을 그대로 주고, 그 뒤 하루까지는 옛 응답을 주면서 뒤에서 새로 만든다
// 조회가 실패하면 예외를 던져 500이 나가는데, 오류 응답은 CDN이 캐시하지 않아 직전에 캐시된 응답이 계속 쓰인다
// revalidatePath로는 무효화할 수 없다 → 신작 반영은 최대 1시간 늦음
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getGameIndex(), {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
