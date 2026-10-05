// 스트리머 배지 — 글자만. 카드: 최대 2명 "A·B 플레이"(더 있으면 "A·B 외 N명"), 줄: 1명 + "외 N명". 없으면 안 그림
export default function StreamerBadge({ names, max, suffix }: { names?: string[]; max: number; suffix: string }) {
  if (!names?.length) return null;
  const rest = names.length - max;
  const text = names.slice(0, max).join('·') + (rest > 0 ? ` 외 ${rest}명` : suffix);
  return <span className="hc-streamer" title={`${names.join('·')} 플레이`}>{text}</span>;
}

