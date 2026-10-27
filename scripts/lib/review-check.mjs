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

// checked: 대상 게임 수 · viaGetItems/viaAppreviews/viaStore: 출처별로 값을 받아 갱신한 게임 수 · 값을 못 받아 기존 값을 유지한 게임은 failed
export function recordReviewCheck({ checked, viaGetItems = 0, viaAppreviews = 0, viaStore = 0, krRetried = 0, linkedRetried = 0 }) {
  const updated = viaGetItems + viaAppreviews + viaStore;
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ checked, updated, failed: checked - updated, viaGetItems, viaAppreviews, viaStore, krRetried, linkedRetried, date: today() }));
  } catch (e) {
    console.log(`리뷰 점검 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}

// 일일 요약 한 줄
export function reviewCheckLine(check) {
  if (!check) return '⭐ 리뷰 수집: 오늘 기록 없음 (리뷰 단계가 안 돌았거나 실패)';
  const warn = check.failed > 0 && check.updated === 0 ? ' ⚠️ 모든 경로 막힘 (Actions 로그 확인)' : '';
  return `⭐ 리뷰 갱신 ${check.updated}/${check.checked}개 (GetItems ${check.viaGetItems ?? 0} · appreviews ${check.viaAppreviews ?? 0} · 상점 페이지 ${check.viaStore ?? 0}) · 갱신 실패 ${check.failed}개${typeof check.krRetried === 'number' ? ` · KR 재시도 ${check.krRetried}개` : ''}${check.linkedRetried > 0 ? ` · 연결 앱 재조회 ${check.linkedRetried}개` : ''}${warn}`;
}
