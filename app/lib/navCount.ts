// 이 문서(탭을 새로 불러온 뒤)에서 일어난 클라이언트 이동 횟수 — NavTracker가 올리고 BackLink가 읽는다
let count = 0;
export const clientNavCount = () => count;
export const bumpClientNav = () => { count += 1; };
