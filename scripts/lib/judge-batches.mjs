// scripts/lib/judge-batches.mjs
// judge-new-games의 AI 묶음 호출 보조 — 응답 읽기, 실패 시 재시도, 반으로 나눠 다시
// - 같은 묶음을 최대 2번 시도, 그래도 실패하면 반으로 나눠 각각 최대 2번 시도 (그 아래로는 더 안 쪼갬)
// - 최종 실패한 호출의 원문 응답 앞 RAW_LOG_CHARS자를 로그에 남김

export const RAW_LOG_CHARS = 2000;

// 판정 결과를 받는 도구 (tool use) — 응답이 항상 이 스키마의 JSON 객체로 옴
export const JUDGE_TOOL = {
  name: 'record_judgments',
  description: '게임별 진입장벽과 혼자 플레이 단계 판정을 기록한다',
  input_schema: {
    type: 'object',
    properties: {
      games: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer' },
            barrier: { enum: ['낮음', '보통', '높음', null] },
            reason: { type: ['string', 'null'] },
            solo: { enum: ['story', 'possible', 'none', null] },
            solo_reason: { type: ['string', 'null'] },
          },
          required: ['index'],
        },
      },
    },
    required: ['games'],
  },
};

// Messages API 응답 → 판정 행 배열. 못 읽으면 원문 앞부분을 붙인 오류
export function extractRows(json) {
  const raw = () => JSON.stringify(json.content ?? json).slice(0, RAW_LOG_CHARS);
  const block = (json.content || []).find((c) => c.type === 'tool_use' && c.name === JUDGE_TOOL.name);
  if (!block) throw Object.assign(new Error('도구 호출 응답이 아님'), { raw: raw() });
  if (!block.input || !Array.isArray(block.input.games)) throw Object.assign(new Error('games 배열이 없음'), { raw: raw() });
  return block.input.games;
}

// ask(batch) → { rows, cost, usage }. 성공하면 { ok: true, parts: [{ batch, result }] }, 실패하면 { ok: false, errors }
export async function runWithRetry(batch, ask, log = () => {}) {
  const errors = [];
  const attempt = async (items, label) => {
    for (let n = 1; n <= 2; n++) {
      try { return await ask(items); } catch (e) {
        errors.push({ label: `${label} ${n}번째 시도`, items, message: e.message, raw: e.raw });
        log(`⚠️ ${label} ${n}번째 시도 실패 (${e.message})`);
      }
    }
    return null;
  };
  const whole = await attempt(batch, `묶음(${batch.length}개)`);
  if (whole) return { ok: true, parts: [{ batch, result: whole }], errors };
  if (batch.length < 2) return { ok: false, parts: [], errors };
  const mid = Math.ceil(batch.length / 2);
  const parts = [], lost = [];
  for (const [i, half] of [batch.slice(0, mid), batch.slice(mid)].entries()) {
    const result = await attempt(half, `${i === 0 ? '앞' : '뒤'} 절반(${half.length}개)`);
    if (result) parts.push({ batch: half, result }); else lost.push(...half);
  }
  return { ok: !lost.length, parts, lost, errors };
}
