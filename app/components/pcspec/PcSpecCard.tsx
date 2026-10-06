'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { hasJudgeableSpec, judgePc, LEVEL_TITLE, PART_SHORT, verdictReason, verdictText, type PartLevel, type PcPart, type SpecLike } from '../../lib/specJudge';
import { toUserPc } from '../../lib/myPc';
import PcSpecPanel from './PcSpecPanel';
import { useMyPc } from './useMyPc';

type Row = { label: string; value: string };
type Parsed = { min?: SpecLike | null; rec?: SpecLike | null };

// 상세 페이지 "내 PC 사양 진단" 카드 하나 — 입력 유도 · 판정 요약 · 부품별 표 · 원문 사양이 모두 이 카드 안에 있다
// 미입력: 가운데 큰 안내 + "내 PC 사양 입력하기" 버튼(누르면 카드 안에서 입력 패널이 펼쳐짐) → 게임의 최소·권장 사양 (늘 보임)
// 입력됨 + 최소 사양을 하나라도 읽은 게임: 제목 오른쪽 "사양 변경" → 판정 요약 · 플래그 → 부품별 표 → 맨 아래 "원문 사양 보기" 접기
// 최소 사양을 전부 못 읽은 게임: 표·판정 없이 원문 사양과 "사양 정보를 읽지 못했어요"만
// 사양은 브라우저에만 저장돼 있어서 판정은 여기서 한다. 카드 목록에는 판정을 넣지 않는다

const PART_RE: Record<PcPart, RegExp> = { cpu: /프로세서|processor|cpu/i, gpu: /그래픽|graphics|gpu|video/i, ram: /메모리|memory|ram/i };
const PART_ORDER: PcPart[] = ['cpu', 'gpu', 'ram'];
const CELL_LEVEL: Record<PartLevel, { text: string; cls: string }> = {
  rec: { text: '충족', cls: 'is-rec' },
  min: { text: '충족', cls: 'is-min' },
  fail: { text: '미달', cls: 'is-fail' },
  unknown: { text: '정보 없음', cls: 'is-unknown' },
};

// 표의 최소·권장 칸 — RAM은 읽은 숫자, CPU·GPU는 원문 사양 줄(제품명이 길어도 그대로)
function requirement(part: PcPart, spec: SpecLike | null | undefined, rows: Row[] | null) {
  if (!spec) return '-';
  if (part === 'ram') return spec.ram_gb != null ? `${spec.ram_gb}GB` : '-';
  return rows?.find((r) => PART_RE[part].test(r.label))?.value ?? '-';
}

function RawColumns({ minRows, recRows }: { minRows: Row[] | null; recRows: Row[] | null }) {
  return (
    <div className="spec-columns">
      {[['최소 사양', minRows], ['권장 사양', recRows]].map(([title, rows]) => rows && (
        <div key={title as string}>
          <p className="spec-col-title">{title as string}</p>
          <dl className="more-list">
            {(rows as Row[]).map(({ label, value }) => (<Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export default function PcSpecCard({ parsed, minRows, recRows }: { parsed: Parsed | null; minRows: Row[] | null; recRows: Row[] | null }) {
  const { pc, ready } = useMyPc();
  const [open, setOpen] = useState(false);
  const judgeable = hasJudgeableSpec(parsed);
  const panel = open && <div className="pcs-panel-wrap"><PcSpecPanel onDone={() => setOpen(false)} onCancel={() => setOpen(false)} /></div>;
  const verdict = ready && judgeable && pc ? judgePc(toUserPc(pc), parsed) : null;
  const state = !judgeable ? 'hidden' : !ready ? 'loading' : verdict ? verdict.level : 'empty'; // 테두리: rec·fail만 색

  const title = (
    <div className="pcs-card-head">
      <h3 className="pcs-card-title">내 PC 사양 진단</h3>
      {verdict && <button type="button" className="pcs-change" aria-expanded={open} onClick={() => setOpen((o) => !o)}>사양 변경</button>}
    </div>
  );

  let content: ReactNode;
  if (!judgeable) {
    content = (
      <>
        <p className="pcs-flags">사양 정보를 읽지 못했어요</p>
        <RawColumns minRows={minRows} recRows={recRows} />
      </>
    );
  } else if (!ready) {
    // 저장된 값을 읽기 전: 안내 자리만 잡아 화면이 밀리지 않게
    content = (
      <>
        <div className="pcs-intro pcs-intro-placeholder" aria-hidden="true" />
        <RawColumns minRows={minRows} recRows={recRows} />
      </>
    );
  } else if (!verdict) {
    content = (
      <>
        <div className="pcs-intro">
          <p className="pcs-intro-text">내 PC 사양을 입력하면 이 게임이 돌아가는지 바로 알려드려요</p>
          {!open && <button type="button" className="btn btn-primary pcs-cta" aria-expanded={open} onClick={() => setOpen(true)}>내 PC 사양 입력하기</button>}
        </div>
        {panel}
        <div className="pcs-game-spec"><RawColumns minRows={minRows} recRows={recRows} /></div>
      </>
    );
  } else {
    const flags = verdictText(verdict).flags;
    const mine: Record<PcPart, string> = { cpu: pc!.cpu.name, gpu: pc!.gpu.name, ram: `${pc!.ram}GB` };
    content = (
      <>
        {panel}
        <p className={`pcs-verdict is-${verdict.level}`}>{LEVEL_TITLE[verdict.level]}</p>
        <p className={`pcs-reason is-${verdict.level}`}>{verdictReason(verdict)}</p>
        {flags.length > 0 && <p className="pcs-flags">{flags.join(' · ')}</p>}
        <table className="pcs-table" role="table">
          <thead role="rowgroup">
            <tr role="row"><th role="columnheader" scope="col">부품</th><th role="columnheader" scope="col">내 PC</th><th role="columnheader" scope="col">최소</th><th role="columnheader" scope="col">권장</th><th role="columnheader" scope="col">판정</th></tr>
          </thead>
          <tbody role="rowgroup">
            {PART_ORDER.map((part) => {
              const r = verdict.parts.find((p) => p.part === part)!;
              const lv = CELL_LEVEL[r.level];
              return (
                <tr key={part} role="row">
                  <th role="rowheader" scope="row" className="pcs-part">{PART_SHORT[part]}</th>
                  <td role="cell" data-label="내 PC" className="pcs-mine">{mine[part]}</td>
                  <td role="cell" data-label="최소">{requirement(part, parsed?.min, minRows)}</td>
                  <td role="cell" data-label="권장">{requirement(part, parsed?.rec, recRows)}</td>
                  <td role="cell" data-label="판정" className={`pcs-cell-verdict ${lv.cls}`}>{lv.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <details className="pcs-raw">
          <summary>원문 사양 보기</summary>
          <RawColumns minRows={minRows} recRows={recRows} />
        </details>
      </>
    );
  }

  return (
    <section className={`detail-card pcs-card is-${state}`} aria-label="내 PC 사양 진단">
      {title}
      {content}
    </section>
  );
}
