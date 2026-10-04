// 매일 가격 단계에서 가격을 못 받은 게임 기록 — games.price_check_failed_since·price_check_note + daily-summary용 작은 파일
// 칸(price_check_*)이 아직 없으면(마이그레이션 전) DB 표시는 건너뛰고 개수만 넘긴다
import fs from 'fs';

const FILE = 'scripts/.cache/price-check.json';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// 오늘 기록만 돌려준다 (어제 파일이 남아 있어도 무시)
export function readPriceCheck() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

// step: 'steam' | 'other', values: { checked, failed }
export function recordPriceCheck(step, values) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ ...(readPriceCheck() || {}), [step]: values, date: today() }));
  } catch (e) {
    console.log(`가격 점검 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}

// 게임별 성공·실패를 DB에 표시. 실패가 이어지면 처음 실패한 시각을 유지한다
export async function markPriceStatus(supabase, { okIds, failed }) {
  const now = new Date().toISOString();
  const chunks = (arr) => Array.from({ length: Math.ceil(arr.length / 200) }, (_, i) => arr.slice(i * 200, i * 200 + 200));
  try {
    for (const ids of chunks(okIds)) {
      const { error } = await supabase.from('games')
        .update({ price_check_failed_since: null, price_check_note: null })
        .in('id', ids).not('price_check_failed_since', 'is', null);
      if (error) throw error;
    }
    for (const { id, note } of failed) {
      const { error } = await supabase.from('games').update({ price_check_note: note }).eq('id', id);
      if (error) throw error;
    }
    for (const ids of chunks(failed.map((f) => f.id))) {
      const { error } = await supabase.from('games')
        .update({ price_check_failed_since: now })
        .in('id', ids).is('price_check_failed_since', null);
      if (error) throw error;
    }
  } catch (e) {
    console.log(`⚠️ 가격 점검 표시 실패 (${e.message}) — 마이그레이션 20261010090000_price_check_status.sql 실행 필요할 수 있음`);
  }
}
