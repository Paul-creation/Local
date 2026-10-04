import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SITE_NAME, BASE_OG } from '../lib/site';
import { LARGE_LOBBY } from '../lib/players';

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: `${SITE_NAME}의 인원 기준, 가격 갱신 주기, 역대 최저가 뜻, 커뮤니티 비밀번호 분실, 정보 오류 제보 방법을 정리했어요.`,
  alternates: { canonical: '/faq' },
  openGraph: { ...BASE_OG, title: `자주 묻는 질문 · ${SITE_NAME}`, url: '/faq' },
};

// text: 구조화 데이터(FAQPage)에 들어가는 글자 그대로의 답 / body: 화면에 보이는 답 (링크 포함). 둘의 내용은 같게 유지
// 기준 근거: docs/verification-rules.md(인원), app/lib/players.ts(16명+), scripts/run-steps.mjs·daily.yml(갱신), app/lib/price.ts(역대 최저가)
type Faq = { q: string; text: string; body?: ReactNode };

const FAQS: Faq[] = [
  {
    q: '최대 인원은 어떤 기준인가요?',
    text: '친구끼리 한 판에 같이 할 수 있는 최대 인원이에요. 모드나 비공식 패치로 늘리는 인원은 빼고 공식 기능만 봐요. 침입·난입처럼 적으로 들어오는 인원도 세지 않아요.',
  },
  {
    q: '서버를 여는 게임은 인원을 어떻게 정하나요?',
    text: '직접 서버를 여는 게임은 설정을 바꾸지 않은 기본 설정으로 바로 함께할 수 있는 인원을 기준으로 해요. 설정 파일을 고쳐서 늘릴 수 있는 인원은 반영하지 않아요.',
  },
  {
    q: `"${LARGE_LOBBY}명+"는 무슨 뜻인가요?`,
    text: `한 판에 ${LARGE_LOBBY}명보다 많이 함께할 수 있는 게임이에요. 공개 서버나 대규모 로비 게임처럼 인원이 아주 많은 경우 정확한 숫자 대신 "${LARGE_LOBBY}명+"로 보여줘요. 친구가 아무리 많아도 같이 할 수 있다는 뜻으로 보면 돼요.`,
  },
  {
    q: '"인원 정보 확인 중"은 무슨 뜻인가요?',
    text: '공식 자료로 최대 인원을 확실히 정하지 못한 게임이에요. 틀린 숫자를 보여주는 대신 비워 두고, 확인되는 대로 채워요. 정확한 인원을 아시면 의견 보내기로 알려주세요.',
  },
  {
    q: '가격과 할인 정보는 얼마나 자주 바뀌나요?',
    text: '가격·할인·접속자 수는 매일 새벽(한국 시간 3시 무렵) 한 번 갱신해요. 그 사이에 시작하거나 끝난 할인은 바로 반영되지 않을 수 있으니 구매 전 스토어에서 꼭 확인해주세요.',
  },
  {
    q: '역대 최저가는 무슨 뜻인가요?',
    text: '스팀 한국 상점 원화 가격 기준으로, 지금까지 기록된 할인 가격 중 가장 낮았던 가격이에요. IsThereAnyDeal의 가격 기록과 이 사이트가 매일 모은 기록을 함께 봐요. 할인 중인 가격이 역대 최저가 이하면 "역대 최저가", 10% 안쪽으로 비싸면 "최저가 근접"으로 표시해요.',
  },
  {
    q: '커뮤니티 글 비밀번호를 잊어버렸어요.',
    text: '비밀번호는 되돌릴 수 없는 형태로만 저장해서 운영자도 알 수 없고, 찾아드릴 수 없어요. 글을 지워야 한다면 그 글의 신고 버튼에서 "개인정보 노출" 또는 "기타"를 골라 주세요. 운영자가 확인한 뒤 삭제해요.',
    body: (
      <>
        비밀번호는 되돌릴 수 없는 형태로만 저장해서 운영자도 알 수 없고, 찾아드릴 수 없어요.
        글을 지워야 한다면 그 글의 신고 버튼에서 &ldquo;개인정보 노출&rdquo; 또는 &ldquo;기타&rdquo;를 골라 주세요. 운영자가 확인한 뒤 삭제해요.
        (<Link href="/community/policy">커뮤니티 운영정책</Link>)
      </>
    ),
  },
  {
    q: '잘못된 정보를 발견했어요. 어디에 알리나요?',
    text: '의견 보내기 페이지에서 "인원·정보 오류"를 골라 어떤 게임의 어떤 정보가 다른지 적어 주세요. 로그인 없이 보낼 수 있고, 확인 후 고쳐요.',
    body: (
      <>
        <Link href="/feedback?kind=info">의견 보내기</Link>에서 &ldquo;인원·정보 오류&rdquo;를 골라 어떤 게임의 어떤 정보가 다른지 적어 주세요.
        로그인 없이 보낼 수 있고, 확인 후 고쳐요.
      </>
    ),
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.text } })),
};

export default function FaqPage() {
  return (
    <main className="page cm-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="cm-card legal">
        <h1 className="cm-h1">자주 묻는 질문</h1>
        <p className="cm-sub">찾는 답이 없으면 <Link href="/feedback">의견 보내기</Link>로 물어봐 주세요.</p>
        {FAQS.map((f) => (
          <section key={f.q}>
            <h2 className="cm-h2">{f.q}</h2>
            <p>{f.body ?? f.text}</p>
          </section>
        ))}
        <p className="cm-hint"><Link href="/about">{SITE_NAME} 소개</Link></p>
      </article>
    </main>
  );
}
