// scripts/export-meta.mjs — Claude Code 작업용 게임 원본 데이터를 data/meta/에 내보냄
// 실행: node --env-file=.env.local scripts/export-meta.mjs
// - source.json: 전체 게임의 id, 영문 이름, 한국어 이름, steam_appid, 출시 연도, 태그, heat_rank
// - tags.json: 사이트에서 쓰는 태그 전체 목록과 게임 수 (많은 순)
// - games 표만 읽음. 회원·신고·의견함 같은 개인정보 표는 읽지 않음 (공개 anon 키 사용)
// - DB는 읽기만 하고, 파일은 매번 새로 씀 (id 순 정렬이라 바뀐 부분만 diff에 보임)
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const PAGE = 1000;

const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, search_name_ko, steam_appid, release_date, tags, heat_rank')
    .order('id')
    .range(from, from + PAGE - 1);
  if (error) { console.error('게임 불러오기 실패:', error.message); process.exit(1); }
  rows.push(...data);
  if (data.length < PAGE) break;
}

const year = (d) => {
  const m = String(d || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
};

const games = rows.map((g) => ({
  id: g.id,
  name: g.name,
  name_ko: String(g.search_name_ko || '').split(',')[0].trim() || null,
  steam_appid: g.steam_appid ?? null,
  release_year: year(g.release_date),
  tags: g.tags || [],
  heat_rank: g.heat_rank ?? null,
}));

const counts = new Map();
for (const g of games) for (const t of new Set(g.tags)) counts.set(t, (counts.get(t) || 0) + 1);
const tags = [...counts]
  .map(([tag, game_count]) => ({ tag, game_count }))
  .sort((a, b) => b.game_count - a.game_count || a.tag.localeCompare(b.tag, 'ko'));

mkdirSync('data/meta', { recursive: true });
writeFileSync('data/meta/source.json', JSON.stringify({ exported_at: new Date().toISOString().slice(0, 10), count: games.length, games }, null, 2) + '\n');
writeFileSync('data/meta/tags.json', JSON.stringify({ exported_at: new Date().toISOString().slice(0, 10), count: tags.length, tags }, null, 2) + '\n');
console.log(`✅ 게임 ${games.length}개, 태그 ${tags.length}개 → data/meta/`);
