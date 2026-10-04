import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_DESCRIPTION, OPERATOR_NAME, CONTACT_EMAIL, CONTACT_TEXT, BASE_OG } from '../lib/site';

export const metadata: Metadata = {
  title: '사이트 소개',
  description: `${SITE_NAME}는 친구랑 같이 할 게임을 인원·난이도·가격·할인으로 비교해 주는 비공식 게임 정보 사이트예요.`,
  alternates: { canonical: '/about' },
  openGraph: { ...BASE_OG, title: `사이트 소개 · ${SITE_NAME}`, description: SITE_DESCRIPTION, url: '/about' },
};

// 데이터 출처·갱신 주기는 scripts/run-steps.mjs(daily·weekly)와 .github/workflows 기준. 바뀌면 같이 고친다
export default function AboutPage() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : CONTACT_TEXT;
  return (
    <main className="page cm-page">
      <article className="cm-card legal">
        <h1 className="cm-h1">{SITE_NAME} 소개</h1>
        <p className="cm-sub">{SITE_DESCRIPTION}</p>

        <h2 className="cm-h2">무엇을 해 주나요</h2>
        <ul>
          <li><strong>인원으로 찾기</strong> — 지금 모인 친구 수로 같이 할 수 있는 게임만 골라 봐요.</li>
          <li><strong>난이도·분위기 비교</strong> — 협동인지 대전인지, 처음 하는 친구도 할 만한지 한눈에 봐요.</li>
          <li><strong>가격·할인 확인</strong> — 지금 가격, 할인율, 역대 최저가와 비교해 살 때인지 알려줘요.</li>
          <li><strong>게임 비교</strong> — 후보 게임 2~3개를 나란히 놓고 인원·가격·상황별 추천을 비교해요.</li>
          <li><strong>커뮤니티</strong> — 회원가입 없이 같이 할 사람을 찾거나 게임 이야기를 나눠요.</li>
        </ul>

        <h2 className="cm-h2">데이터는 어디서 오나요</h2>
        <ul>
          <li>스팀 상점·리뷰·동시 접속자 수 등 <strong>공개된 정보</strong>를 모아 보여줘요. 에픽·배틀넷·라이엇 게임은 각 공식 페이지를 참고해요.</li>
          <li>할인 기록은 IsThereAnyDeal의 스팀 한국 원화 가격 기록과 이 사이트가 매일 모은 기록을 함께 써요.</li>
          <li>가격·할인·접속자 수는 <strong>매일</strong>, 새 게임과 게임 정보는 <strong>매주</strong> 갱신해요.</li>
          <li>게임 한 줄 소개와 일부 빈 정보(태그 설명 등)는 <strong>AI로 작성</strong>한 뒤 필요한 것은 사람이 확인해요. 틀린 내용이 보이면 알려주세요.</li>
          <li>최대 인원은 &ldquo;친구끼리 한 판에 같이 할 수 있는 최대 인원&rdquo; 기준으로 따로 확인해요. 자세한 기준은 <Link href="/faq">자주 묻는 질문</Link>에 있어요.</li>
        </ul>

        <h2 className="cm-h2">비공식 사이트 안내</h2>
        <p>
          {SITE_NAME}는 Valve(스팀)와 각 게임사·스토어와 관계없는 <strong>비공식 사이트</strong>예요.
          게임 이미지·상표·영상의 권리는 각 권리자에게 있어요. 가격과 할인 정보는 실제와 다를 수 있으니 구매 전 각 스토어에서 꼭 확인해주세요.
        </p>

        <h2 className="cm-h2">연락처</h2>
        <p>
          잘못된 정보나 버그는 <Link href="/feedback">의견 보내기</Link>로 알려주시면 가장 빨라요. 그 밖의 문의: {contact}
        </p>
        <p className="cm-hint">운영: {OPERATOR_NAME}</p>
      </article>
    </main>
  );
}
