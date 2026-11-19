import { existsSync } from 'node:fs';
import path from 'node:path';
import { SITE_NAME } from '../../lib/site';
import SelectBrackets from './SelectBrackets';

// 공식 워드마크 — public/logo-wordmark.svg가 있으면 그 파일을 쓰고, 없으면 글자 버전: 소문자 "select"를 파란 괄호가 감싸고 그 옆에 "screen" (Inter 900, --ink)
let hasFile: boolean | null = null;
function hasWordmarkFile() {
  if (hasFile === null) {
    try { hasFile = existsSync(path.join(process.cwd(), 'public', 'logo-wordmark.svg')); } catch { hasFile = false; }
  }
  return hasFile;
}

export default function Wordmark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  if (hasWordmarkFile()) {
    // eslint-disable-next-line @next/next/no-img-element -- 단색 로고 SVG라 최적화할 것이 없다
    return <img className={`wm-img wm-${size}`} src="/logo-wordmark.svg" alt={SITE_NAME} />;
  }
  return (
    <span className={`wm wm-${size}`} role="img" aria-label={SITE_NAME}>
      <SelectBrackets size="logo" on><span aria-hidden="true">select</span></SelectBrackets>
      <span aria-hidden="true">screen</span>
    </span>
  );
}
