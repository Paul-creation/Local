// 스팀 상점 공식 트레일러(HLS .m3u8) 주소인지. scripts/enrich-videos.mjs가 video_url에 저장
export const isSteamVideo = (url: string | null | undefined) => Boolean(url && /^https:\/\/video\.[a-z.]*steamstatic\.com\/.+\.m3u8$/.test(url));
