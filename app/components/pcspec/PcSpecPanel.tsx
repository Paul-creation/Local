'use client';

import { useEffect, useState } from 'react';
import { RAM_CHOICES, rendererToText, type MyPart } from '../../lib/myPc';
import { alternativesOf } from '../../lib/specParse';
import PartCombobox from './PartCombobox';
import { loadSpecTables, type SpecOptions } from './specTables';
import { useMyPc } from './useMyPc';

// 내 PC 사양 입력 패널 — GPU·CPU는 등급표 검색 콤보박스, RAM은 선택형. 저장은 브라우저(localStorage)에만
// GPU 자동 입력 보조: WebGL 렌더러 이름을 읽어 "감지됨: …, 맞으면 선택"으로 제안만 한다 (자동 확정 안 함, 못 읽거나 매칭이 안 되면 숨김)
// CPU·RAM은 브라우저에서 믿을 만하게 알 수 없어 자동 입력이 없다
// 상세 페이지 판정 줄(PcVerdictLine)에서 열고, 4단계 검색 필터에서도 그대로 쓸 수 있다
// WebGL 렌더러 이름 (못 읽으면 null). 컨텍스트는 읽자마자 반납한다
function readRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name || null;
  } catch {
    return null;
  }
}

export default function PcSpecPanel({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const { pc, save, clear } = useMyPc();
  const [tables, setTables] = useState<SpecOptions | null>(null);
  const [gpu, setGpu] = useState<MyPart | null>(pc?.gpu ?? null);
  const [cpu, setCpu] = useState<MyPart | null>(pc?.cpu ?? null);
  const [ram, setRam] = useState<number | null>(pc?.ram ?? null);
  const [detected, setDetected] = useState<MyPart | null>(null);

  useEffect(() => {
    let alive = true;
    loadSpecTables().then((t) => {
      if (!alive) return;
      setTables(t);
      // 감지 제안: 렌더러 이름 → 등급표 매칭. 어느 단계든 실패하면 아무것도 보이지 않는다
      const text = rendererToText(readRenderer());
      const hit = text ? alternativesOf('gpu', text, t.spec)[0] : null;
      const entry = hit ? t.gpu.find((e) => e.key === hit.key) : null;
      if (entry) setDetected({ key: entry.key, name: entry.name, vendor: entry.vendor, tier: entry.tier });
    }).catch(() => { /* 등급표를 못 불러오면 입력칸이 "불러오는 중"으로 남는다 — 패널을 다시 열면 재시도 */ });
    return () => { alive = false; };
  }, []);

  const ready = !!gpu && !!cpu && ram != null;
  const showDetected = detected && gpu?.key !== detected.key;

  return (
    <form className="pcs-panel" onSubmit={(e) => { e.preventDefault(); if (gpu && cpu && ram != null) { save({ gpu, cpu, ram }); onDone?.(); } }}>
      <PartCombobox label="그래픽카드" options={tables?.gpu ?? []} value={gpu} onChange={setGpu} placeholder="예: RTX 3060, RX 6600" loading={!tables} />
      {showDetected && (
        <p className="pcs-detect">
          감지됨: {detected.name}, 맞으면{' '}
          <button type="button" className="pcs-link" onClick={() => setGpu(detected)}>선택</button>
        </p>
      )}
      <PartCombobox label="프로세서" options={tables?.cpu ?? []} value={cpu} onChange={setCpu} placeholder="예: Core i5 12세대, Ryzen 5 5000번대" loading={!tables} />
      <div className="pcs-field">
        <label className="pcs-label" htmlFor="pcs-ram">메모리(RAM)</label>
        <select id="pcs-ram" className="input" value={ram ?? ''} onChange={(e) => setRam(e.target.value ? Number(e.target.value) : null)}>
          <option value="">선택해 주세요</option>
          {RAM_CHOICES.map((n) => <option key={n} value={n}>{n}GB</option>)}
        </select>
      </div>
      <p className="pcs-note">입력한 사양은 이 브라우저에만 저장되고 서버로 보내지 않아요.</p>
      <div className="pcs-actions">
        <button type="submit" className="btn btn-primary" disabled={!ready}>저장</button>
        {pc && <button type="button" className="btn btn-outline" onClick={() => { clear(); onDone?.(); }}>입력 지우기</button>}
        {onCancel && <button type="button" className="share-text-btn" onClick={onCancel}>닫기</button>}
      </div>
    </form>
  );
}
