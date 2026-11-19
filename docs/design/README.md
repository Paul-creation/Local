# Select Screen 디자인 시안 (기준 파일)

이 폴더의 `.dc.html`이 화면의 정답이다. 구현은 이 파일의 값을 그대로 따른다.
색 기준은 `app/brand-tokens.css`다.

## 읽는 법
- 인라인 `style`의 값(간격·크기·폰트·색·반경·그림자·z-index)이 정답이다. 추측하지 말고 옮긴다.
- `<sc-for list="{{x}}" as="y">` = 반복, `<sc-if value="{{x}}">` = 조건부 표시.
- `{{...}}` 값은 파일 맨 아래 `<script type="text/x-dc">`의 `renderVals()`에 있다. 예시 데이터일 뿐이고 실제 데이터는 기존 코드의 것을 쓴다.
- `[포스터]`, `[게임]`, `[N]` 같은 대괄호는 자리표시. 실제 이미지·데이터로 바꾼다.
- "첫 화면 끝" 점선, "(시안 표시용)" 문구는 구현하지 않는다.
- 시안의 header는 1단계 공통 헤더(로고 이미지 파일 사용)로 대체한다.

## 파일 ↔ 라우트
| 파일 | 라우트 |
|---|---|
| MainFinal.dc.html | `/`, `/home-member` |
| SearchPopovers.dc.html | 메인·/find 공통 검색 팝오버 + 규칙 |
| PageSearch.dc.html | `/find` |
| PageGame.dc.html | `/games/[id]` |
| PageCompare.dc.html | `/compare` |
| PageMyPC.dc.html | `/my-pc` |
| PageWishlist.dc.html | `/wishlist` |
| PageCommunity.dc.html | `/community` |
| PageFeedback.dc.html | `/feedback` |
| PageCurator.dc.html | `/c/[handle]` |

## 시안 이후 확정된 변경 (시안보다 우선)
- 헤더: sticky 없음. 메인·게임 상세는 히어로 위 투명 오버레이(absolute), 다른 페이지는 배경 없음.
- 메인: 히어로+N인 추천 섹션 래퍼 min-height min(100svh, 1100px), 추천 섹션이 첫 화면 하단에 걸침.
- 게임 상세: 오른쪽 칸은 Steam 가격 박스만 sticky(top 16px). 게임 정보·PC 사양·바로가기는 왼쪽 본문(가격·할인 다음).
- 괄호(<SelectBrackets>)는 로고 제외 한 화면에 최대 하나.
- 섹션 포인트 색 없음. 예외: Steam 가격 박스 초록, 할인 배지 초록, 뜨는 중 배지 하늘색.
- 파티 합산 가격 숨김. 투어 꺼짐. 투표 섹션 숨김.
