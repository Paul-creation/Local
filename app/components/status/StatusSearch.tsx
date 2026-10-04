// 404·에러 화면의 게임 검색창 — 메인 검색 결과(/?r=1&q=…)로 이동 (JS 없이도 동작)
export default function StatusSearch() {
  return (
    <form className="status-search" action="/" method="get" role="search">
      <input type="hidden" name="r" value="1" />
      <input type="search" name="q" placeholder="게임 이름으로 검색" aria-label="게임 검색" enterKeyHint="search" />
      <button type="submit" className="status-btn is-primary">검색</button>
    </form>
  );
}
