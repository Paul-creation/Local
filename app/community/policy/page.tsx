import type { Metadata } from 'next';
import { DAILY_COMMENTS_PER_IP, DAILY_POSTS_PER_IP, HIDE_AT_REPORTS, MAX_LINKS } from '../../lib/community';

export const metadata: Metadata = { title: '커뮤니티 운영정책', description: '게시판 이용 규칙, 신고·삭제 요청 방법, 저장하는 정보 안내' };

export default function PolicyPage() {
  return (
    <article className="cm-card cm-policy">
      <h1 className="cm-h1">커뮤니티 운영정책</h1>
      <p className="cm-sub">로그인 없이 누구나 쓰는 게시판이라, 모두가 편하게 쓸 수 있도록 아래 규칙을 지켜주세요.</p>

      <h2 className="cm-h2">이런 글은 올릴 수 없어요</h2>
      <ul>
        <li>욕설·비방·혐오 표현, 특정인을 괴롭히거나 저격하는 글</li>
        <li>광고·홍보, 도박·불법 사이트 안내, 같은 내용 반복(도배)</li>
        <li>음란물·불법 촬영물, 불법 프로그램(핵·매크로) 거래</li>
        <li>다른 사람의 개인정보(실명, 전화번호, 주소 등)를 허락 없이 올리는 글</li>
        <li>계정·아이템 현금 거래, 사기 의심 글</li>
      </ul>

      <h2 className="cm-h2">자동으로 막는 것</h2>
      <ul>
        <li>한 사람(같은 IP)당 하루 글 {DAILY_POSTS_PER_IP}개, 댓글 {DAILY_COMMENTS_PER_IP}개까지</li>
        <li>글 하나에 링크는 {MAX_LINKS}개까지</li>
        <li>기본 금지어(욕설·광고)가 들어간 글·댓글</li>
        <li>신고가 {HIDE_AT_REPORTS}번 쌓이면 자동으로 숨겨지고, 운영자가 확인한 뒤 복구하거나 삭제해요</li>
      </ul>

      <h2 className="cm-h2">신고·삭제 요청</h2>
      <ul>
        <li>문제가 있는 글·댓글은 아래쪽 <strong>신고</strong> 버튼으로 알려주세요. 같은 글은 한 번만 신고할 수 있어요.</li>
        <li>내가 쓴 글·댓글은 쓸 때 정한 비밀번호로 언제든 수정·삭제할 수 있어요.</li>
        <li>비밀번호를 잊었거나 내 정보가 담긴 다른 사람의 글을 지우고 싶다면, 그 글의 신고 버튼에서 <strong>개인정보 노출</strong> 또는 <strong>기타</strong>를 골라주세요. 운영자가 신고 내역을 확인한 뒤 삭제해요.</li>
      </ul>

      <h2 className="cm-h2">저장하는 정보</h2>
      <ul>
        <li><strong>닉네임</strong> — 글·댓글과 함께 공개돼요.</li>
        <li><strong>비밀번호 해시</strong> — 비밀번호는 원래 글자로 저장하지 않고, 되돌릴 수 없는 해시 값으로만 저장해요. 운영자도 비밀번호를 알 수 없어요.</li>
        <li><strong>IP 해시</strong> — 도배 제한·중복 추천·중복 신고를 막기 위해 IP 주소를 되돌릴 수 없는 해시 값으로만 저장해요. IP 주소 자체는 저장하지 않아요.</li>
        <li>글에 적은 연락처(디스코드 ID 등)는 모두에게 공개되니 주의해주세요.</li>
      </ul>
    </article>
  );
}
