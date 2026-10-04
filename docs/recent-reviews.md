# 스팀 최근 평가 표시 규칙

화면은 디자인 개편 때 만든다. 데이터는 매일 `scripts/enrich-recent-reviews.mjs`가 채운다.

## 데이터

| 칸 | 내용 |
|---|---|
| `recent_review_pct` | 지난 30일 긍정 비율 (%) |
| `recent_review_count` | 지난 30일 리뷰 수 |
| `recent_review_label` | 스팀 등급 문구 그대로 (예: 매우 긍정적, 복합적) |
| `recent_reviews_at` | 마지막으로 확인한 시각 |

- 출처: 한국 스팀 상점 페이지의 "최근 평가" 줄 (지난 30일, 모든 언어). 상점 페이지 숫자와 같다.
  - appreviews API는 `day_range`를 줘도 요약(`query_summary`)이 전체 기간 숫자라서 쓰지 않는다.
- 스팀이 최근 평가를 안 보여주는 게임(30일 리뷰 10개 미만)은 pct·count·label이 null.
- 비교할 전체 평가는 `review_positive_percent` (`enrich-players.mjs`, 모든 언어·전체 기간).

## 표시 규칙

1. **표시 안 함**: `recent_review_count`가 null이거나 30개 미만. 숨긴 게임, 스팀이 아닌 게임도 표시하지 않음.
2. **표시**: "최근 30일 {label} {pct}% ({count}개)".
3. **변화 안내** (전체 평가 `review_positive_percent`가 있을 때만):
   - `recent_review_pct - review_positive_percent <= -15` → "최근 평가가 낮아졌어요"
   - `recent_review_pct - review_positive_percent >= 15` → "최근 평가가 좋아졌어요"
   - 그 사이면 안내 문구 없음.
4. `recent_reviews_at`이 3일 넘게 지났으면 오래된 값이므로 표시하지 않는다 (매일 갱신이 멈춘 경우).
