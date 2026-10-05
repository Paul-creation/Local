// 스트리머 영상 수집(fetch-streamer-videos)의 하루 YouTube 상한 + daily-summary용 작은 결과 파일
// - 상한은 fetch-highlight-videos가 하루 몫을 계산할 때도 빼 둔다 (17:10 하이라이트 → 새벽 3시 매일 단계 순서라 같은 한도일)
import fs from 'fs';

export const STREAMER_UNITS_PER_DAY = 200;

const FILE = 'scripts/.cache/streamer-videos.json';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// 오늘 기록만 돌려준다 (어제 파일이 남아 있어도 무시)
export function readStreamerVideos() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

// values: { linked, unlinked, units }
export function recordStreamerVideos(values) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ ...values, date: today() }));
  } catch (e) {
    console.log(`스트리머 영상 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}
