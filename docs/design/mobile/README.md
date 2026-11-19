# 모바일 시안 (390px, 768px 이하 기준)

읽는 법은 상위 docs/design/README.md와 같다. 모바일에서는 이 폴더가 정답이고, 데스크톱 시안보다 우선한다.

| 파일 | 라우트 / 상태 |
|---|---|
| MobMain.dc.html | `/` |
| MobMenu.dc.html | 햄버거 드로어 열린 상태 |
| MobSearchSheet.dc.html | 검색 알약 눌렀을 때 하단 시트 |
| MobFind.dc.html | `/find` |
| MobGame.dc.html | `/games/[id]` |
| MobCompare.dc.html | `/compare` |
| MobMyPC.dc.html | `/my-pc` |
| MobWishlist.dc.html | `/wishlist` |
| MobCommunity.dc.html | `/community` |
| MobFeedback.dc.html | `/feedback` |
| MobCurator.dc.html | `/c/[handle]` |

## 모바일 공통 규칙
- 헤더 56px, 로고 112px, 오른쪽 햄버거(44×44). 메뉴는 오른쪽 드로어(320px).
- 좌우 padding 16px, 섹션 간격 36~40px, 섹션 제목 20px/900.
- 터치 대상 최소 40px(칩·스테퍼·버튼).
- 가로로 넘칠 수 있는 줄(인원 탭, 필터 칩, 가로 카드 목록)은 줄바꿈 대신 가로 스크롤(좌우 -16px 블리드).
- 포스터 그리드는 3열 gap 12/10.
- 게임 상세: 오른쪽 칸 없음. 가격 박스는 히어로 바로 아래, 구매 버튼은 화면 하단 고정 바(가격 + 비교 담기 + Steam에서 구매).
- 메인 순위 3개는 탭 하나로 합침(인기 차트/출시 예정/다시 뜨는 중).
- 비교 표: 첫 열(항목명 92px) sticky, 게임 열 132px 가로 스크롤.
- 커뮤니티 글쓰기: 오른쪽 아래 떠 있는 버튼.
- 큐레이터 게시물 카드: 1열, 포스터 64px 스택(-26px 겹침).
- 괄호는 한 화면에 하나만(메인 추천 첫 포스터, 검색 1등, 비교 추천 열, 시리즈의 지금 보는 게임).
