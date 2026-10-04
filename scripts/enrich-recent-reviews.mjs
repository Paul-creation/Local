// scripts/enrich-recent-reviews.mjs
// 스팀 "최근 평가"(지난 30일) 긍정 비율·리뷰 수·등급 문구를 한국 상점 페이지에서 받아 저장 (무료, AI 안 씀)
// - appreviews API는 day_range를 줘도 query_summary가 전체 기간 숫자라서 상점 페이지의 "최근 평가" 줄을 읽음
//   (지난 30일, 모든 언어 — 상점 페이지에 보이는 숫자와 같음)
// - 최근 평가 줄이 없으면(스팀은 30일 리뷰 10개 미만이면 안 보여줌) 세 칸을 비우고 확인 시각만 기록
// - 숨긴 게임은 건너뛰고, 20시간 안에 확인한 게임은 다시 받지 않음 (중간에 멈춰도 다음 실행 때 이어서)
// - 표시 규칙은 docs/recent-reviews.md
// 실행: node --env-file=.env.local scripts/enrich-recent-reviews.mjs   (--dry: 저장 없이 출력만, 최대 5개)
import { createClient } from '@supabase/supabase-js';
import { steamGet, SteamLimitError } from './lib/steam.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY = process.argv.includes('--dry');
const RECHECK_HOURS = 20;
// 나이 확인 페이지를 건너뛰는 쿠키
const HEADERS = { Cookie: 'birthtime=0; lastagecheckage=1-0-1990; wants_mature_content=1; Steam_Language=koreana' };

// 상점 페이지 HTML에서 "최근 평가" 줄 읽기. 줄이 없으면 null
function parseRecent(html) {
  const at = html.indexOf('최근 평가:');
  if (at < 0) return null;
  const before = html.slice(Math.max(0, at - 1500), at);
  const tip = [...before.matchAll(/data-tooltip-html="([^"]*)"/g)].pop()?.[1] || '';
  const m = tip.match(/평가 ([\d,]+)개 중 (\d+)%가 긍정적/);
  const label = html.slice(at, at + 1500).match(/class="game_review_summary[^"]*"[^>]*>([^<]+)</)?.[1]?.trim();
  if (!m || !label) return null;
  return { pct: Number(m[2]), count: Number(m[1].replace(/,/g, '')), label };
}

async function main() {
  const cols = DRY ? 'id, name, steam_appid' : 'id, name, steam_appid, recent_reviews_at';
  let q = supabase.from('games').select(cols).eq('hidden', false).not('steam_appid', 'is', null);
  if (!DRY) {
    const since = new Date(Date.now() - RECHECK_HOURS * 3600 * 1000).toISOString();
    q = q.or(`recent_reviews_at.is.null,recent_reviews_at.lt.${since}`).order('recent_reviews_at', { ascending: true, nullsFirst: true });
  }
  const { data, error } = await q;
  if (error) {
    console.error(`게임 목록을 못 불러옴: ${error.message}`);
    if (/recent_review/.test(error.message)) console.error('→ supabase/migrations/20261012090000_recent_reviews.sql 을 먼저 실행해 주세요');
    process.exit(1);
  }
  const games = DRY ? data.slice(0, 5) : data;
  console.log(`최근 평가 확인할 스팀 게임 ${games.length}개 (요청 간격 2초, 약 ${Math.ceil(games.length * 2.5 / 60)}분)\n`);

  const count = { saved: 0, none: 0, failed: 0 };
  for (const [i, g] of games.entries()) {
    let html;
    try {
      html = await steamGet(`https://store.steampowered.com/app/${g.steam_appid}/?l=koreana&cc=kr`, { text: true, headers: HEADERS });
    } catch (e) {
      if (e instanceof SteamLimitError) { console.log(`⛔ ${e.message} — 여기서 멈춤 (다음 실행 때 이어서)`); break; }
      console.log(`❌ ${g.name}: ${e.message}`); count.failed++; continue;
    }
    // 상점 페이지가 아니면(지역 제한·삭제로 메인으로 이동 등) 기록하지 않고 넘어감
    if (!html.includes('user_reviews_summary_row') && !html.includes('game_area_purchase')) {
      console.log(`⚪ ${g.name}: 상점 페이지 없음`); count.failed++; continue;
    }
    const r = parseRecent(html);
    const tag = `[${i + 1}/${games.length}] ${g.name}`;
    if (r) { count.saved++; console.log(`✅ ${tag}: ${r.label} ${r.pct}% (${r.count.toLocaleString()}개)`); }
    else { count.none++; console.log(`➖ ${tag}: 최근 평가 없음 (30일 리뷰 10개 미만)`); }
    if (DRY) continue;

    const { error: e } = await supabase.from('games').update({
      recent_review_pct: r?.pct ?? null,
      recent_review_count: r?.count ?? null,
      recent_review_label: r?.label ?? null,
      recent_reviews_at: new Date().toISOString(),
    }).eq('id', g.id);
    if (e) { console.log(`   ❌ 저장 실패: ${e.message}`); count.failed++; }
  }
  console.log(`\n완료 — 최근 평가 ${count.saved}개 · 없음 ${count.none}개 · 실패 ${count.failed}개${DRY ? ' (--dry: 저장 안 함)' : ''}`);
}

main();
