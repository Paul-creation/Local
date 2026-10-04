import { NextResponse } from 'next/server';
import { getGameIndex } from '../../../lib/gameIndex';

// 메인 검색·필터용 전체 게임 목록 (읽기 전용, 공개 정보만)
// 5분마다 새로 만들고 그 사이에는 만들어 둔 응답을 그대로 준다 → 응답 헤더 s-maxage=300, stale-while-revalidate
// 조회가 실패하면 예외를 던져서 직전 캐시를 계속 쓰게 한다
export const dynamic = 'force-static';
export const revalidate = 300;

export async function GET() {
  return NextResponse.json(await getGameIndex());
}
