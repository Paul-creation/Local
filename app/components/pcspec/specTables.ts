'use client';

import type { MyPart } from '../../lib/myPc';
import type { SpecTables } from '../../lib/specParse';

// 등급표(큰 JSON)는 필요할 때만 한 번 불러온다 — 입력 패널을 열 때, 또는 저장된 값의 등급표 버전이 달라 다시 계산할 때
// 판정 줄은 저장된 값(제조사·등급)만 쓰므로 평소에는 이 파일을 받지 않는다
export type SpecOptions = { gpu: MyPart[]; cpu: MyPart[]; spec: SpecTables };

let promise: Promise<SpecOptions> | null = null;
export function loadSpecTables(): Promise<SpecOptions> {
  promise ??= Promise.all([import('../../../data/pc-spec/gpu-tiers.json'), import('../../../data/pc-spec/cpu-tiers.json')]).then(([g, c]) => {
    const spec = { gpu: g.default, cpu: c.default } as unknown as SpecTables;
    const slim = (e: { key: string; name: string; vendor: string; tier: number }) => ({ key: e.key, name: e.name, vendor: e.vendor as MyPart['vendor'], tier: e.tier });
    return { gpu: spec.gpu.entries.map(slim), cpu: spec.cpu.entries.map(slim), spec };
  });
  promise.catch(() => { promise = null; }); // 실패하면 다음에 다시 시도
  return promise;
}
