'use client';

import MyPcLink from '../../pcspec/MyPcLink';
import { useMyPc } from '../../pcspec/useMyPc';
import { usePeople, type ChipKey } from '../PeopleContext';

// "N인 추천 게임" 머리의 필터 칩 — 켜면 아래 카드를 실제로 거른다 (PeopleSection이 chips를 읽는다). 켜진 칩은 --ink 배경 + 어두운 글씨 (괄호 없음)
// - 내 PC로 돌아가는 게임: 사양을 저장해 뒀으면 인원별 추천을 거르는 토글, 없으면 /my-pc(사양 등록)로 가는 링크
// - 무료 / 출시 전 데모 / 지금 할인 중: 카드의 값(무료 여부·데모 있는 출시 예정·할인율)으로 거른다
const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'free', label: '무료' },
  { key: 'demo', label: '데모' },
  { key: 'sale', label: '할인 중' },
];

export default function PeopleChips() {
  const { myPcOn, setMyPcOn, chips, toggleChip } = usePeople();
  const { pc, ready } = useMyPc();
  return (
    <div className="mn-chips" role="group" aria-label="추천 게임 거르기">
      {/* 사양은 이 브라우저(localStorage)에만 있어서 서버는 토글인지 등록 링크인지 모른다 — 읽기 전에는 같은 글자의 보이지 않는 칩으로 자리를 잡아 칩 줄이 다시 정렬되지 않게 */}
      {!ready ? (
        <span className="mn-chip" style={{ visibility: 'hidden' }} aria-hidden="true">내 PC OK</span>
      ) : pc ? (
        <button type="button" className="mn-chip" aria-pressed={myPcOn} onClick={() => setMyPcOn(!myPcOn)}>내 PC OK</button>
      ) : (
        <MyPcLink className="mn-chip">내 PC OK</MyPcLink>
      )}
      {CHIPS.map((c) => (
        <button key={c.key} type="button" className="mn-chip" aria-pressed={chips[c.key]} onClick={() => toggleChip(c.key)}>{c.label}</button>
      ))}
    </div>
  );
}
