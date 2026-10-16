// 1,000행(Supabase Max rows 기본값) 넘는 표를 끝까지 읽는 공통 함수 — 서버 설정(Max rows)이 얼마든 같게 동작한다
// - 정렬이 고정돼야 페이지가 겹치거나 빠지지 않는다: 호출하는 쪽이 .order(...)를 고유한 키(id 등)까지 붙인다
// - 서버가 요청보다 적게 줘도(설정이 size보다 낮아도) 받은 만큼만 다음 시작점을 옮기고, 빈 페이지가 올 때까지 읽는다 (마지막에 빈 읽기 1번 더)
// - 오류가 나면 그때까지 모은 행은 버리고 { data: null, error }로 돌려준다 (일부만 보여주는 것보다 직전 캐시를 쓰게)
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export const PAGE_SIZE = 1000;
const MAX_ROWS = 200000; // 무한 반복 방지

export async function readAllPages<T>(page: (from: number, to: number) => Page<T>, size = PAGE_SIZE): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; ) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    from += data.length;
  }
  return { data: rows, error: null };
}
