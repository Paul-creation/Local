// scripts/lib/itad-limiter.mjs
// ITAD 요청 속도 제한기 — 최근 windowMs 안에 보낸 요청 시각을 파일에 남겨 단계(프로세스) 사이에서 공유
// - acquire(): 창 안에 max건이 차 있으면 가장 오래된 요청이 창 밖으로 나갈 때까지 기다린 뒤 한 칸을 차지
// - block(untilMs): 429를 받으면 그 시각까지 모든 요청을 막음 (다음 단계도 이어서 기다림)
// 파일을 못 읽거나 쓰면 이 프로세스 안의 기억만으로 동작 (제한기가 일을 막지 않음)
import fs from 'fs';
import path from 'path';

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

export function createLimiter({ file, windowMs, max, now = Date.now, sleep = sleepReal, log = console.log }) {
  let mem = { sent: [], blockedUntil: 0 };

  const load = () => {
    if (!file) return mem;
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        sent: Array.isArray(d.sent) ? d.sent.filter((t) => Number.isFinite(t)) : [],
        blockedUntil: Number.isFinite(d.blockedUntil) ? d.blockedUntil : 0,
      };
    } catch {
      return mem;
    }
  };
  const save = (state) => {
    mem = state;
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state));
    } catch {}
  };

  return {
    async acquire() {
      for (;;) {
        const t = now();
        const state = load();
        state.sent = state.sent.filter((s) => s > t - windowMs && s <= t);
        let wait = Math.max(0, state.blockedUntil - t);
        if (wait === 0 && state.sent.length >= max) wait = state.sent[0] + windowMs - t;
        if (wait <= 0) {
          state.sent.push(t);
          save(state);
          return;
        }
        if (wait >= 10000) log(`ITAD 속도 제한기: ${Math.ceil(wait / 1000)}초 대기 (최근 ${Math.round(windowMs / 1000)}초 ${state.sent.length}/${max}건)`);
        await sleep(wait + 50);
      }
    },
    // 테스트용: 기억 전부 비우기
    reset() {
      save({ sent: [], blockedUntil: 0 });
    },
    block(untilMs) {
      const state = load();
      state.blockedUntil = Math.max(state.blockedUntil, untilMs);
      save(state);
    },
  };
}
