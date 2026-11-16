import Link from 'next/link';
import { SITUATIONS, queryHref } from '../../../lib/abSearch';
import './ab.css';

// 검색창 아래 "이런 판 어때요?" — 누르면 그 조건이 채워진 결과(/find)로 이동. 서버에서 그려도 되는 링크 묶음
export default function Situations() {
  return (
    <section className="ab-sit" aria-labelledby="ab-sit-h">
      <h2 id="ab-sit-h" className="ab-sit-h">이런 판 어때요?</h2>
      <ul className="ab-sit-grid">
        {SITUATIONS.map((s) => (
          <li key={s.key}>
            <Link href={queryHref(s.query)} className="ab-sit-card">
              <strong>{s.title}</strong>
              <span>{s.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
