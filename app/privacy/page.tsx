import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, OPERATOR_NAME, CONTACT_EMAIL, CONTACT_TEXT } from '../lib/site';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: `${SITE_NAME}가 수집하는 정보, 보유 기간, 처리 위탁·국외 이전 안내`,
  alternates: { canonical: '/privacy' },
};

// 코드 기준 실제 수집 항목으로 작성 (2026-10-05). 수집 항목이 바뀌면 이 문서도 같이 고친다.
// 근거: app/lib/community.ts(ipHash·hashPassword), app/api/**(insert), app/lib/aiGuard.ts(ai_calls), scripts/purge-ip-hash.mjs(90일 파기)
const EFFECTIVE_DATE = '2026년 10월 5일';

export default function PrivacyPage() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : CONTACT_TEXT;
  return (
    <main className="page cm-page">
      <article className="cm-card cm-policy legal">
        <h1 className="cm-h1">개인정보처리방침</h1>
        <p className="cm-sub">
          {SITE_NAME}(이하 &lsquo;사이트&rsquo;)는 회원가입 없이 이용하는 서비스로, 이름·전화번호·이메일 같은 신원 정보를 받지 않아요.
          게시판·투표·의견 보내기·AI 기능을 쓸 때 꼭 필요한 최소한의 정보만 아래처럼 처리해요. 「개인정보 보호법」에 따라 이 방침을 공개합니다.
        </p>

        <h2 className="cm-h2">1. 처리하는 정보와 목적</h2>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr><th>언제</th><th>처리하는 정보</th><th>목적</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>게시글·댓글·게임 의견 작성</td>
                <td>닉네임, 제목·본문, 비밀번호 해시, IP 해시, 작성·수정 시각</td>
                <td>글 게시, 작성자 본인 확인(수정·삭제), 도배 제한</td>
              </tr>
              <tr>
                <td>게시글 추천</td>
                <td>IP 해시, 추천 시각</td>
                <td>같은 글 중복 추천 방지</td>
              </tr>
              <tr>
                <td>신고</td>
                <td>IP 해시, 신고 대상·사유, 신고·처리 시각</td>
                <td>중복 신고 방지, 신고 처리</td>
              </tr>
              <tr>
                <td>의견 보내기</td>
                <td>의견 종류·내용, 보낸 페이지 주소, IP 해시, 보낸 시각 / (선택) 답변받을 연락처</td>
                <td>버그·정보 오류 확인과 개선, 도배 제한 / 답변 연락</td>
              </tr>
              <tr>
                <td>게임 상황 투표</td>
                <td>IP 해시, 투표 항목, 투표 시각</td>
                <td>중복 투표·하루 횟수 제한</td>
              </tr>
              <tr>
                <td>AI 추천·비교 질문</td>
                <td>IP 해시, 기능 종류, 이용 시각 / 입력한 질문·선택한 답</td>
                <td>하루 이용 횟수 제한 / AI 답변 생성(질문 내용은 사이트에 저장하지 않음)</td>
              </tr>
              <tr>
                <td>사이트 접속</td>
                <td>IP 주소, 브라우저 정보, 접속 시각, 요청 주소(서버 접속 기록)</td>
                <td>사이트 제공, 오류 확인, 보안</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li><strong>IP 해시</strong>는 IP 주소 원문 대신 사이트만 아는 비밀 값을 섞어 변환한 값이에요. IP 주소 원문은 데이터베이스에 저장하지 않아요.</li>
          <li><strong>비밀번호</strong>는 되돌릴 수 없는 방식(scrypt)으로 변환해 저장해요. 운영자도 원래 비밀번호를 알 수 없어요.</li>
          <li><strong>닉네임과 글 내용</strong>은 모두에게 공개돼요. 글에 연락처 등 개인정보를 적지 않도록 주의해주세요.</li>
          <li>사이트는 이름·생년월일 같은 정보를 요구하지 않으며(의견 보내기의 연락처는 선택), 만 14세 미만인지 확인하지 않아요.</li>
        </ul>

        <h2 className="cm-h2">2. 보유 기간과 파기</h2>
        <ul>
          <li><strong>IP 해시</strong>: 기록한 날부터 <strong>90일</strong>이 지나면 매일 자동으로 지워요(글·투표 같은 기록은 남고 IP 해시 칸만 비워요).</li>
          <li><strong>게시글·댓글·게임 의견</strong>(닉네임·내용·비밀번호 해시 포함): 작성자가 삭제하거나 운영자가 삭제할 때까지. 삭제하면 바로 데이터베이스에서 지워요.</li>
          <li><strong>신고 내역</strong>(대상·사유·처리 시각): 분쟁 대응을 위해 신고일부터 <strong>1년</strong> 보관한 뒤 지워요. 신고자 IP 해시는 위와 같이 90일 뒤 지워요.</li>
          <li><strong>의견 보내기</strong>(내용·연락처): 보낸 날부터 <strong>1년</strong> 보관한 뒤 지워요. IP 해시는 위와 같이 90일 뒤 지워요.</li>
          <li><strong>서버 접속 기록</strong>: 호스팅 업체(Vercel)의 보관 정책에 따라 자동으로 지워져요.</li>
          <li>파기는 데이터베이스에서 다시 살릴 수 없게 지우는 방식으로 해요. 종이 문서로는 개인정보를 보관하지 않아요.</li>
        </ul>

        <h2 className="cm-h2">3. 처리 위탁과 국외 이전</h2>
        <p>사이트 운영을 위해 아래 업체의 서비스를 써요. 이 업체들은 모두 해외에 있어, 이용하는 순간 네트워크를 통해 정보가 국외로 전송돼요.</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr><th>받는 곳(국가)</th><th>전송되는 정보</th><th>목적</th><th>보유 기간</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase Inc.(미국)</td>
                <td>1번 표의 저장 정보 전체</td>
                <td>데이터베이스 보관</td>
                <td>2번의 보유 기간과 같음</td>
              </tr>
              <tr>
                <td>Vercel Inc.(미국)</td>
                <td>서버 접속 기록, 요청 내용</td>
                <td>웹사이트 호스팅</td>
                <td>Vercel 정책에 따름</td>
              </tr>
              <tr>
                <td>Anthropic PBC(미국)</td>
                <td>AI 기능에 입력한 질문·선택한 답 (IP는 보내지 않음)</td>
                <td>AI 답변 생성</td>
                <td>Anthropic API 정책에 따름</td>
              </tr>
              <tr>
                <td>Discord Inc.(미국)</td>
                <td>신고·의견 알림(종류, 내용 앞 50자). IP 해시·연락처는 보내지 않음</td>
                <td>운영자에게 처리할 일 알림</td>
                <td>운영자가 알림을 지울 때까지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          AI 기능을 쓰지 않으면 Anthropic으로는 아무것도 전송되지 않아요. 국외 전송을 원하지 않으면 해당 기능(게시판·투표·AI)을 이용하지 않으면 돼요.
          다만 Supabase·Vercel 없이는 사이트를 제공할 수 없어요.
        </p>

        <h2 className="cm-h2">4. 외부 콘텐츠</h2>
        <ul>
          <li>게임 영상 썸네일은 YouTube(Google LLC, 미국)에서 불러와요. 이때 브라우저가 Google 서버에 직접 접속하므로 Google이 IP 주소 등을 받을 수 있어요.</li>
          <li>영상 재생 버튼을 누르면 YouTube 개인정보 보호 강화 모드(youtube-nocookie.com) 플레이어가 열려요. 재생 이후에는 Google의 정책이 적용돼요.</li>
          <li>게임 이미지는 Steam 등 각 스토어 서버에서 불러오며, 이때도 해당 서버가 접속 정보를 받을 수 있어요.</li>
        </ul>

        <h2 className="cm-h2">5. 쿠키와 브라우저 저장소</h2>
        <ul>
          <li>사이트는 광고·방문 분석용 쿠키나 분석 도구를 쓰지 않아요.</li>
          <li>운영자 로그인용 쿠키 1개(<code>admin_session</code>)만 있고, 일반 이용자에게는 저장되지 않아요.</li>
          <li>편의를 위해 내 기기의 브라우저 저장소에 마지막으로 쓴 닉네임, 내가 누른 투표, 목록 위치·비교 목록을 저장해요. 이 값은 사이트 서버로 전송되지 않으며, 브라우저 설정에서 사이트 데이터를 지우면 삭제돼요.</li>
        </ul>

        <h2 className="cm-h2">6. 이용자의 권리</h2>
        <ul>
          <li>내가 쓴 글·댓글·의견은 작성할 때 정한 비밀번호로 언제든 수정·삭제할 수 있어요.</li>
          <li>비밀번호를 잊었거나 내 개인정보가 담긴 글의 삭제를 원하면 해당 글의 <strong>신고</strong> 버튼(개인정보 노출)이나 아래 연락처로 요청해주세요.</li>
          <li>개인정보 열람·정정·삭제·처리정지를 요청할 수 있어요. 다만 사이트는 이름 등 신원 정보를 갖고 있지 않아, 요청한 분이 해당 글의 작성자인지 확인할 수 있는 범위에서 처리해요.</li>
          <li>요청은 받은 날부터 10일 안에 처리 결과를 알려드려요.</li>
        </ul>

        <h2 className="cm-h2">7. 안전성 확보 조치</h2>
        <ul>
          <li>비밀번호는 scrypt, IP는 비밀 값을 섞은 해시로만 저장해요.</li>
          <li>데이터베이스는 서버만 접근할 수 있게 막아두었고(접근 권한 제한), 비밀 키는 코드와 분리해 보관해요.</li>
          <li>모든 접속은 HTTPS로 암호화돼요.</li>
        </ul>

        <h2 className="cm-h2">8. 개인정보 보호책임자·연락처</h2>
        <ul>
          <li>보호책임자: {OPERATOR_NAME} (사이트 운영자)</li>
          <li>연락처: {contact}</li>
        </ul>
        <p>개인정보 침해에 대한 상담·신고는 아래 기관에도 할 수 있어요.</p>
        <ul>
          <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.go.kr)</li>
          <li>대검찰청 사이버수사과: 1301 (www.spo.go.kr)</li>
          <li>경찰청 사이버수사국: 182 (ecrm.police.go.kr)</li>
        </ul>

        <h2 className="cm-h2">9. 방침 변경</h2>
        <p>이 방침을 바꾸면 시행 7일 전부터 사이트에 알려요. 함께 보기: <Link href="/terms">이용약관</Link> · <Link href="/community/policy">커뮤니티 운영정책</Link></p>
        <p className="legal-date">시행일: {EFFECTIVE_DATE}</p>
      </article>
    </main>
  );
}
