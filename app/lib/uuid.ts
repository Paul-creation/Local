// 게임 id(uuid) 형식 검사 — 형식이 틀린 주소는 DB 오류(5xx)가 아니라 없는 페이지(404)로 처리하려고 씀
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
