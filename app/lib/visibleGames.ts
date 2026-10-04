// 앱에서 games를 읽을 땐 이 파일의 함수만 쓴다 — 숨긴 게임(games.hidden, 중복 정리 등)이 자동으로 빠진다
// eslint.config.mjs가 app/ 안의 .from('games') 직접 호출을 막는다 (예외: 이 파일, 관리자 API)
// 다른 표에서 games를 함께 읽는(embed) 곳은 따로 거른다: lib/weeklyFeatured.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SelectOptions = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };

// 사용: selectGames('id, name').in('id', ids) / selectGames('id', { count: 'exact', head: true }, db)
// 열 목록은 타입으로 해석하지 않음 (DB 타입을 안 쓰는 프로젝트라 결과는 원래도 any. 해석하면 타입 검사가 매우 느려짐)
export function selectGames(columns = '*', options?: SelectOptions, db: SupabaseClient = supabase) {
  return db.from('games').select(columns as '*', options).eq('hidden', false);
}

// 숨긴 게임이면 남긴 게임 id(merged_into)를, 아니면 null — 상세 주소 이동용
export async function mergedTargetOf(id: string, db: SupabaseClient = supabase): Promise<string | null> {
  const { data } = await db.from('games').select('merged_into').eq('id', id).eq('hidden', true).maybeSingle();
  return (data?.merged_into as string | null) ?? null;
}
