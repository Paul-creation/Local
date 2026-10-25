// 메인 3단 리스트 — 인기 차트 / 출시 예정 / 다시 뜨는 중. 각 5개: 큰 순위 숫자 + 작은 세로 표지 + 이름 + 한 줄 정보 (헤더 "더 보기"는 같은 조건의 검색 결과)
// 서버 컴포넌트. 줄이 하나도 없는 열은 숨긴다
import Link from 'next/link';
import PosterImage from './PosterImage';
import type { HomeLists, ListRow } from '../../../lib/homeMain';

// 더 보기 주소 — 필터는 주소에서 읽으므로 새로 불러오는 a를 쓴다 (인기순 전체 / 데모 있는(출시 예정) 게임 / 인기 급상승)
const COLUMNS: { key: keyof HomeLists; title: string; href: string }[] = [
  { key: 'popular', title: '인기 차트', href: '/?r=1' },
  { key: 'upcoming', title: '출시 예정', href: '/?demo=1' },
  { key: 'rising', title: '다시 뜨는 중', href: '/?trend=rising' },
];

function Row({ row, rank }: { row: ListRow; rank: number }) {
  return (
    <li>
      <Link href={`/games/${row.id}`} className="mn-rank-row">
        <span className="mn-rank-n">{rank}</span>
        <span className="mn-mini"><PosterImage cover={row.cover} /></span>
        <span className="mn-rank-text">
          <span className="mn-rank-name">{row.name}</span>
          {row.sub.length > 0 && <span className="mn-rank-sub">{row.sub.join(' · ')}</span>}
        </span>
      </Link>
    </li>
  );
}

export default function RankLists({ lists }: { lists: HomeLists }) {
  const cols = COLUMNS.filter((c) => lists[c.key].length > 0);
  if (!cols.length) return null;
  return (
    <div className="mn-cols">
      {cols.map((c) => (
        <section key={c.key} className="mn-col" aria-labelledby={`mn-col-${c.key}`}>
          <div className="mn-sec-head">
            <h2 id={`mn-col-${c.key}`}>{c.title}</h2>
            <a href={c.href} className="mn-more">더 보기</a>
          </div>
          <ol className="mn-rank-list">
            {lists[c.key].map((row, i) => <Row key={row.id} row={row} rank={i + 1} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}
