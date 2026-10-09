'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeBackPath } from '../../lib/backPath';
import PcSpecPanel from './PcSpecPanel';
import { useMyPc } from './useMyPc';

// /my-pc — 내 PC 사양을 등록·수정·삭제하는 유일한 화면 (다른 화면은 판정만 하고 이 화면으로 보냄)
// 저장된 값을 읽기 전(ready 거짓)에는 같은 높이의 빈 자리만 두고, 읽은 뒤에 폼을 그린다 (폼 초기값이 저장된 값을 놓치지 않게)
// 미등록: 입력 폼 / 등록됨: 요약 + 수정 + 삭제(한 번 확인). 저장하면 "저장했어요"(aria-live)와, ?back=이 같은 사이트 경로면 "돌아가기 →"
export default function MyPcView() {
  const { pc, ready, clear } = useMyPc();
  const back = safeBackPath(useSearchParams().get('back'));
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'cleared' | ''>('');

  let body;
  if (!ready) {
    body = <div className="my-pc-placeholder" aria-hidden="true" />;
  } else if (!pc || editing) {
    body = (
      <div className="my-pc-form">
        <PcSpecPanel
          onDone={() => { setEditing(false); setNotice('saved'); }}
          onCancel={pc ? () => setEditing(false) : undefined}
        />
      </div>
    );
  } else {
    body = (
      <section className="pcs-panel my-pc-summary" aria-label="등록된 내 PC">
        <dl className="my-pc-rows">
          <div><dt>그래픽카드</dt><dd>{pc.gpu.name}</dd></div>
          <div><dt>프로세서</dt><dd>{pc.cpu.name}</dd></div>
          <div><dt>메모리(RAM)</dt><dd>{pc.ram}GB</dd></div>
        </dl>
        <p className="pcs-note">입력한 사양은 이 브라우저에만 저장되고 서버로 보내지 않아요.</p>
        {confirming ? (
          <div className="pcs-actions">
            <span className="my-pc-confirm">정말 지울까요?</span>
            <button type="button" className="btn btn-outline" onClick={() => { clear(); setConfirming(false); setNotice('cleared'); }}>지우기</button>
            <button type="button" className="share-text-btn" onClick={() => setConfirming(false)}>취소</button>
          </div>
        ) : (
          <div className="pcs-actions">
            <button type="button" className="btn btn-outline" onClick={() => { setNotice(''); setEditing(true); }}>수정</button>
            <button type="button" className="share-text-btn" onClick={() => setConfirming(true)}>삭제</button>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="my-pc">
      <h1 className="my-pc-title">내 PC</h1>
      <p className="my-pc-sub">등록하면 게임 페이지에서 이 게임이 돌아가는지 알려줘요.</p>
      <p className="my-pc-status" role="status" aria-live="polite">
        {notice === 'saved' && pc ? '저장했어요' : notice === 'cleared' && !pc ? '지웠어요' : ''}
      </p>
      {body}
      {notice === 'saved' && pc && !editing && back && <a href={back} className="pcs-link my-pc-back">돌아가기 →</a>}
      {ready && (
        <ul className="my-pc-uses">
          <li>게임 페이지: 이 게임이 내 PC에서 돌아가는지 충족 여부로 보여줘요</li>
          <li>메인: &ldquo;내 PC로 돌아가는 게임만&rdquo; 필터를 켤 수 있어요</li>
          <li>검색: 필터에서 &ldquo;내 PC로 돌아가는 게임만&rdquo;을 고를 수 있어요</li>
        </ul>
      )}
    </div>
  );
}
