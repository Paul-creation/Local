-- PC 사양 체커 1단계: 게임별 파싱된 사양(CPU·GPU 등급, RAM, 저장 공간)을 담을 칸 두 개
-- ※ 만들기만 한 파일 — 검수(docs/pc-spec-review.csv)가 끝나기 전에는 적용하지 않는다
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 채우기: node --env-file=.env.local scripts/parse-specs.mjs (미리보기) → --apply
-- 기존 min_spec·recommended_spec·storage_gb는 그대로 둔다 (spec_parsed는 그 텍스트를 풀어 둔 결과)

-- spec_parsed 모양: {"v":1, "min":{cpu_tier,gpu_tier,ram_gb,storage_gb,matched,low_spec,confidence,detail}, "rec":{…} | null}
alter table public.games add column if not exists spec_parsed jsonb;
-- spec_hash: 파싱에 쓴 사양 텍스트(min_spec + recommended_spec)의 SHA-1 앞 16자 — 같으면 다시 처리하지 않고, 텍스트가 바뀌면 다시 처리
alter table public.games add column if not exists spec_hash text;

-- API가 새 칸을 바로 알아보게 스키마 캐시 새로고침
notify pgrst, 'reload schema';
