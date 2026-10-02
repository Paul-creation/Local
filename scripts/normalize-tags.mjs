// scripts/normalize-tags.mjs — 영어 태그를 tag_map 번역표대로 한국어로 정리
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.rpc('normalize_tags');
if (error) { console.error('태그 정리 실패:', error.message); process.exit(1); }
console.log(`✅ 태그 정리 완료 — ${data}개 게임`);
