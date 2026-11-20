'use client';

import { useEffect } from 'react';
import { BracketCorners } from './SelectBrackets';

// 게임 이미지(포스터·썸네일)용 호버·포커스 괄호 — 이미지 칸(position: relative, .sb-host) 안에 넣는다. GameLink(.sb-group)에 마우스를 올리거나 키보드 포커스가 오면 나타난다.
// 크기는 이미지 짧은 변으로 자동: 120px 이상 poster(18px/3px), 60~119px thumb(14px/2px), 60px 미만 mini(10px/2px).
// 크기는 올린 순간에만 재므로(문서 전체 리스너 하나, 카드마다 observer 없음) 카드가 아무리 많아도 비용이 거의 없다. 처음 그릴 때는 poster 크기
// 이미지 칸 바깥으로 그려지므로 칸과 부모 카드에 overflow: hidden이 없어야 한다 (이미지 모서리는 img의 border-radius로 둥글게)
const fit = (e: Event) => {
  const group = (e.target as Element | null)?.closest?.('.sb-group');
  if (!group) return;
  group.querySelectorAll<HTMLElement>('.sb-set[data-auto]').forEach((set) => {
    const host = set.parentElement;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const short = Math.min(r.width, r.height);
    const size = short >= 120 ? 'poster' : short >= 60 ? 'thumb' : 'mini';
    if (set.dataset.size !== size) set.dataset.size = size;
  });
};
let installed = false;

export default function AutoBrackets() {
  useEffect(() => {
    if (installed) return;
    installed = true;
    document.addEventListener('pointerover', fit, { passive: true });
    document.addEventListener('focusin', fit);
  }, []);
  return <BracketCorners size="poster" hover auto />;
}
