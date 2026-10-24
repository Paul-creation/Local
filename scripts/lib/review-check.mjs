// 매일 리뷰 단계(enrich-players)에서 appreviews 조회에 실패한 게임 수 — daily-summary용 작은 파일
import fs from 'fs';

const FILE = 'scripts/.cache/review-check.json';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// 오늘 기록만 돌려준다 (어제 파일이 남아 있어도 무시)
export function readReviewCheck() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

export function recordReviewCheck({ checked, failed, viaStore = 0 }) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ checked, failed, viaStore, date: today() }));
  } catch (e) {
    console.log(`리뷰 점검 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}

// 일일 요약 한 줄
export function reviewCheckLine(check) {
  if (!check) return '⭐ 리뷰 수집: 오늘 기록 없음 (리뷰 단계가 안 돌았거나 실패)';
  return `⭐ 리뷰 조회 실패: ${check.failed}/${check.checked}개${check.viaStore ? ` (appreviews 실패를 상점 페이지로 ${check.viaStore}개 대체)` : ''}${check.failed ? ' ⚠️ 스팀 appreviews 막힘 가능성 (Actions 로그 확인)' : ''}`;
}
