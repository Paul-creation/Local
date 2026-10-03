// 개인정보 정리 결과(오늘 비운·지운 행 수)를 daily-summary에 넘기는 작은 파일
// run-steps daily는 한 작업 안에서 순서대로 돌기 때문에 같은 파일을 이어서 읽고 쓸 수 있다
import fs from 'fs';

const FILE = 'scripts/.cache/privacy-purge.json';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// 오늘 기록만 돌려준다 (어제 파일이 남아 있어도 무시)
export function readPurge() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

export function recordPurge(values) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ ...(readPurge() || {}), ...values, date: today() }));
  } catch (e) {
    console.log(`정리 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}
