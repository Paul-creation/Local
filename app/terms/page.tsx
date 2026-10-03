import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, OPERATOR_NAME, CONTACT_EMAIL, CONTACT_TEXT } from '../lib/site';

export const metadata: Metadata = {
  title: '이용약관',
  description: `${SITE_NAME} 이용 조건과 게시물·정보 이용에 대한 안내`,
  alternates: { canonical: '/terms' },
};

const EFFECTIVE_DATE = '2026년 10월 5일';

export default function TermsPage() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : CONTACT_TEXT;
  return (
    <main className="page cm-page">
      <article className="cm-card cm-policy legal">
        <h1 className="cm-h1">이용약관</h1>
        <p className="cm-sub">{SITE_NAME}(이하 &lsquo;사이트&rsquo;)를 이용하면 아래 약관에 동의한 것으로 봐요.</p>

        <h2 className="cm-h2">제1조 (서비스)</h2>
        <p>사이트는 PC 게임의 인원·난이도·가격·할인 정보를 모아 비교하는 정보 서비스와, 로그인 없이 쓰는 게시판·게임 의견·투표·AI 추천 기능을 무료로 제공해요. 운영자는 {OPERATOR_NAME}입니다.</p>

        <h2 className="cm-h2">제2조 (정보의 정확성)</h2>
        <ul>
          <li>가격·할인·인원·사양 등은 각 스토어와 공개 자료에서 자동으로 모은 정보라 실제와 다르거나 늦게 반영될 수 있어요. 구매 전에는 반드시 각 스토어에서 확인해주세요.</li>
          <li>일부 게임 소개 문구와 AI 추천·비교 답변은 AI가 작성해 틀린 내용이 있을 수 있어요.</li>
          <li>사이트는 게임을 직접 판매하지 않으며, 스토어 링크를 눌러 이동한 뒤의 거래는 해당 스토어와 이용자 사이의 일이에요.</li>
        </ul>

        <h2 className="cm-h2">제3조 (게시물)</h2>
        <ul>
          <li>게시글·댓글·게임 의견의 권리와 책임은 작성자에게 있어요. 작성자는 사이트가 해당 게시물을 사이트 안에서 보여주는 데 동의한 것으로 봐요.</li>
          <li>게시물은 작성할 때 정한 비밀번호로 수정·삭제할 수 있어요.</li>
          <li><Link href="/community/policy">커뮤니티 운영정책</Link>을 어기거나 법령·타인의 권리를 침해하는 게시물은 사전 통지 없이 숨기거나 삭제할 수 있어요.</li>
          <li>&lsquo;운영자&rsquo; 표시가 붙은 글만 운영자가 쓴 글이에요. 운영자를 사칭하는 닉네임은 쓸 수 없어요.</li>
        </ul>

        <h2 className="cm-h2">제4조 (금지 행위)</h2>
        <ul>
          <li>자동화 프로그램으로 대량 요청을 보내거나 사이트 운영을 방해하는 행위</li>
          <li>보안 장치(이용 횟수 제한 등)를 우회하려는 행위</li>
          <li>타인을 사칭하거나 타인의 개인정보를 허락 없이 올리는 행위</li>
          <li>그 밖에 커뮤니티 운영정책에서 금지하는 행위</li>
        </ul>
        <p>이를 어기면 해당 게시물 삭제나 이용 제한을 할 수 있어요.</p>

        <h2 className="cm-h2">제5조 (권리 표시)</h2>
        <p>사이트는 Valve 및 각 게임사와 무관한 비공식 사이트예요. 게임 이름·이미지·상표·영상의 권리는 각 권리자에게 있으며, 정보 제공 목적으로만 사용해요. 권리자가 삭제를 요청하면 확인 후 빠르게 조치할게요.</p>

        <h2 className="cm-h2">제6조 (서비스 변경·중단)</h2>
        <p>사이트는 무료 서비스로, 기능을 바꾸거나 점검·운영상 이유로 일부 또는 전부를 중단할 수 있어요. 중요한 변경은 사이트에 미리 알려요.</p>

        <h2 className="cm-h2">제7조 (책임의 한계)</h2>
        <p>사이트는 무료로 제공되는 정보 서비스로, 정보의 오류나 외부 사이트 이용으로 생긴 손해에 대해 책임지지 않아요. 다만 운영자의 고의 또는 중대한 과실로 생긴 손해는 관련 법령에 따라 책임져요.</p>

        <h2 className="cm-h2">제8조 (약관 변경·준거법)</h2>
        <ul>
          <li>약관을 바꾸면 시행 7일 전부터 사이트에 알려요(이용자에게 불리한 변경은 30일 전).</li>
          <li>이 약관은 대한민국 법을 따르며, 분쟁은 민사소송법상 관할 법원에서 해결해요.</li>
        </ul>

        <h2 className="cm-h2">문의</h2>
        <p>연락처: {contact} · 개인정보 처리에 관한 내용은 <Link href="/privacy">개인정보처리방침</Link>을 확인해주세요.</p>
        <p className="legal-date">시행일: {EFFECTIVE_DATE}</p>
      </article>
    </main>
  );
}
