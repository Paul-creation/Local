import { sortGoty, gotyLabel } from '../lib/goty';

// GOTY 배지 — 카드는 대표 1개(수상 우선), 상세는 전부
export default function GotyBadge({ awards, all = false }: { awards: unknown; all?: boolean }) {
  const list = sortGoty(awards);
  if (list.length === 0) return null;
  return (
    <>
      {(all ? list : list.slice(0, 1)).map((a) => (
        <span
          key={`${a.year}-${a.result}`}
          className={`goty-badge ${a.result === 'winner' ? 'is-winner' : 'is-nominee'}`}
          title={`The Game Awards ${a.year} 올해의 게임 ${a.result === 'winner' ? '수상' : '후보'}`}
        >
          {gotyLabel(a)}
        </span>
      ))}
    </>
  );
}
