// 렌더 캐시·결과 폴더 — worktree가 아니라 메인 체크아웃의 scripts/insta/{cache,out}을 쓴다(worktree를 지워도 내레이션 캐시·클립 원본이 남게).
// 메인 체크아웃 = git 공통 디렉터리(.git)의 부모. git을 못 읽으면 이 파일이 있는 폴더(기존 동작).
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
function mainInsta() {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (path.basename(common) === '.git') return path.join(path.dirname(common), 'scripts/insta');
  } catch { /* git 없음 */ }
  return DIR;
}
export const MAIN_INSTA = mainInsta();
export const CACHE_DIR = path.join(MAIN_INSTA, 'cache');
export const OUT_DIR = path.join(MAIN_INSTA, 'out');
