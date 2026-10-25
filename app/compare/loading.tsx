import Loader from '../components/status/Loader';

// 비교 페이지를 불러오는 동안 보이는 화면 — 공용 로더 (300ms 안에 끝나면 보이지 않음). 상단 2px 진행 바는 NavProgress가 담당
export default function CompareLoading() {
  return (
    <main className="page cmp-page">
      <Loader />
    </main>
  );
}
