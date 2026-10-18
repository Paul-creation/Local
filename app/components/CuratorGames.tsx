'use client';

import ResultCard from './search/ResultCard';
import { buildTree, type TagDict } from '../lib/tagTree';
import tagDict from '../lib/tag-search-dict.json';

const TREE = buildTree(tagDict as unknown as TagDict);

type Entry = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
  game: any;
  posts: { id: string; url: string; collection: boolean }[];
};

// 계정 페이지 게임 목록 — 기존 게임 카드(ResultCard) 아래에 원본 게시물 링크
export default function CuratorGames({ entries }: { entries: Entry[] }) {
  return (
    <ul className="curator-games">
      {entries.map(({ game, posts }) => (
        <li key={game.id} className="curator-game">
          <ResultCard game={game} tree={TREE} />
          <div className="curator-game-posts">
            {posts.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="curator-link">
                원본 게시물 보기 ↗
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
