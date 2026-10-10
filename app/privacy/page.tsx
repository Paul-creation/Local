import type { Metadata } from 'next';
import Link from 'next/link';
import BackLink from '../components/BackLink';
import { SITE_NAME, OPERATOR_NAME, CONTACT_EMAIL, CONTACT_TEXT } from '../lib/site';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: `${SITE_NAME}가 수집하는 정보, 보유 기간, 처리 위탁·국외 이전 안내`,
  alternates: { canonical: '/privacy' },
};

// 코드 기준 실제 수집 항목으로 작성 (2026-10-10 Steam 로그인 항목 추가). 수집 항목이 바뀌면 이 문서도 같이 고친다.
// 근거: app/lib/community.ts(ipHash·hashPassword), app/api/**(insert), app/lib/aiGuard.ts(ai_calls), scripts/purge-ip-hash.mjs(90일 파기), app/layout.tsx(Vercel Analytics),
//       app/lib/user/*(users·user_owned_games·used_openid_nonces, user_session 30일), supabase/migrations/2026101*_users·owned_games
// 이번 개정(삭제 버튼·1년 자동 파기)은 이미 제공 중인 기능의 처리 내용을 적은 것이라 공지와 동시에 즉시 시행 (일반 변경은 시행 7일 전 공지)
// 1년 자동 파기는 Supabase pg_cron(매일 04:30 KST)로 하므로 SQL이 등록돼 있어야 방침과 맞는다. 전용 이메일이 생기면 6번의 로그인 불가 안내를 바꾼다
const NOTICE_DATE = '2026년 10월 10일';
const EFFECTIVE_DATE = '2026년 10월 10일';

export default function PrivacyPage() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : CONTACT_TEXT;
  return (
    <main className="page cm-page">
      <BackLink fallbackHref="/" label="홈으로" />
      <article className="cm-card cm-policy legal">
        <h1 className="cm-h1">개인정보처리방침</h1>
        <p className="cm-sub">
          {SITE_NAME}(이하 &lsquo;사이트&rsquo;)는 회원가입 없이 이용하는 서비스로, 이름·전화번호·이메일 같은 신원 정보를 받지 않아요.
          게시판·투표·의견 보내기·AI 기능을 쓸 때, 그리고 원하는 분만 쓰는 Steam 로그인에 꼭 필요한 최소한의 정보만 아래처럼 처리해요. 「개인정보 보호법」에 따라 이 방침을 공개합니다.
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
                <td>추천 인원 투표</td>
                <td>투표 중복 방지용 익명 값(익명 쿠키 ID를 변환한 값), 고른 인원, 투표 시각</td>
                <td>한 게임에 한 표, 하루 횟수 제한</td>
              </tr>
              <tr>
                <td>AI 추천·비교 질문</td>
                <td>IP 해시, 익명 쿠키 ID 해시, 기능 종류, 이용 시각 / 입력한 질문·선택한 답</td>
                <td>하루 이용 횟수 제한 / AI 답변 생성(질문 내용은 사이트에 저장하지 않음)</td>
              </tr>
              <tr>
                <td>Steam 로그인(선택)</td>
                <td>Steam ID, Steam 닉네임, 프로필 사진 주소, 보유 게임 번호(이 사이트에 등록된 게임만), 가입·마지막 로그인·보유 목록 갱신 시각, 보유 목록 공개 여부</td>
                <td>로그인 유지, 내 닉네임·사진 표시, 게임 카드·상세의 &ldquo;보유 중&rdquo; 표시</td>
              </tr>
              <tr>
                <td>사이트 접속</td>
                <td>IP 주소, 브라우저 정보, 접속 시각, 요청 주소(서버 접속 기록)</td>
                <td>사이트 제공, 오류 확인, 보안</td>
              </tr>
              <tr>
                <td>방문 통계(쿠키 미사용, 개인 식별 불가)</td>
                <td>방문한 페이지 주소, 들어온 경로(리퍼러), 기기·운영체제·브라우저 종류, 국가</td>
                <td>많이 보는 페이지·유입 경로 파악, 사이트 개선</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li><strong>IP 해시</strong>는 IP 주소 원문 대신 사이트만 아는 비밀 값을 섞어 변환한 값이에요. IP 주소 원문은 데이터베이스에 저장하지 않아요.</li>
          <li><strong>익명 쿠키</strong>(<code>ai_cid</code>)는 AI 기능의 하루 이용 횟수를 브라우저별로 세고, 추천 인원 투표의 중복을 막기 위해 사이트가 발급하는 무작위 값이에요. 이름·연락처 같은 정보와 연결되지 않아 개인을 알아볼 수 없고, 1년 뒤 만료돼요. 브라우저에서 쿠키를 지우면 함께 사라지고, 쿠키를 막으면 AI 기능과 추천 인원 투표만 쓸 수 없어요.</li>
          <li><strong>비밀번호</strong>는 되돌릴 수 없는 방식(scrypt)으로 변환해 저장해요. 운영자도 원래 비밀번호를 알 수 없어요.</li>
          <li><strong>닉네임과 글 내용</strong>은 모두에게 공개돼요. 글에 연락처 등 개인정보를 적지 않도록 주의해주세요.</li>
          <li><strong>Steam 로그인</strong>은 원하는 분만 쓰는 선택 기능이에요. 로그인하지 않아도 사이트의 기능은 모두 쓸 수 있어요(&ldquo;보유 중&rdquo; 표시만 로그인해야 보여요).
            <ul>
              <li>로그인은 Steam 공식 로그인 화면에서 해요. Steam 비밀번호는 Steam에서만 입력하고 사이트는 받지 않아요.</li>
              <li>받아서 저장하는 정보는 위 표의 항목뿐이에요. Steam 보유 게임은 게임 번호만 저장하고, 플레이 시간은 저장하지 않아요. Steam ID는 내 브라우저로도 내려보내지 않아요.</li>
              <li><strong>받지 않는 정보</strong>: 이메일, 친구 목록, 플레이 시간, 위시리스트, 결제 정보, Steam 비밀번호.</li>
              <li>보유 게임은 Steam 프로필의 게임 세부 정보가 공개일 때만 가져와요. 비공개이면 가져오지 못하고 공개 여부만 기록해요.</li>
              <li>로그인 응답의 재사용을 막으려고 Steam이 준 일회용 확인값(nonce)을 잠깐 기록하고, 하루가 지나면 로그인 때 지워요.</li>
            </ul>
          </li>
          <li>이름·생년월일 같은 정보는 요구하지 않아요(의견 보내기 연락처는 선택). 만 14세 미만은 Steam 로그인을 이용할 수 없으며, 나이는 따로 확인하지 않아요.</li>
        </ul>

        <h2 className="cm-h2">2. 보유 기간과 파기</h2>
        <ul>
          <li><strong>IP 해시·익명 쿠키 ID 해시·투표 중복 방지용 익명 값</strong>: 기록한 날부터 <strong>90일</strong>이 지나면 매일 자동으로 지워요(글·투표 같은 기록은 남고 해시 칸만 비워요).</li>
          <li><strong>게시글·댓글·게임 의견</strong>(닉네임·내용·비밀번호 해시 포함): 작성자가 삭제하거나 운영자가 삭제할 때까지. 삭제하면 바로 데이터베이스에서 지워요.</li>
          <li><strong>신고 내역</strong>(대상·사유·처리 시각): 분쟁 대응을 위해 신고일부터 <strong>1년</strong> 보관한 뒤 지워요. 신고자 IP 해시는 위와 같이 90일 뒤 지워요.</li>
          <li><strong>의견 보내기</strong>(내용·연락처): 보낸 날부터 <strong>1년</strong> 보관한 뒤 지워요. IP 해시는 위와 같이 90일 뒤 지워요.</li>
          <li><strong>Steam 로그인 정보</strong>(Steam ID, 닉네임, 프로필 사진 주소, 보유 게임 번호, 시각들): <strong>마지막 로그인 후 1년이 지나면 자동으로 삭제</strong>해요. 그 전에도 로그인한 뒤 <strong>[내 정보 삭제] 버튼</strong>으로 바로 지울 수 있어요(6번 참고). 보유 게임 번호는 24시간이 지난 뒤 다시 가져올 때마다 통째로 새 목록으로 바뀌어요. 로그인 상태는 쿠키로 30일 유지돼요. 로그아웃은 이 쿠키만 지우고 저장된 정보는 지우지 않아요.</li>
          <li><strong>서버 접속 기록</strong>: 호스팅 업체(Vercel)의 보관 정책에 따라 자동으로 지워져요.</li>
          <li><strong>방문 통계</strong>: 개인을 알아볼 수 없는 집계 숫자로만 남아요. 같은 방문을 묶는 데 쓰는 임시 값은 하루가 지나면 버려져요.</li>
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
                <td>서버 접속 기록, 요청 내용, 방문 통계(1번 표)</td>
                <td>웹사이트 호스팅, 방문 통계(Vercel Web Analytics)</td>
                <td>Vercel 정책에 따름</td>
              </tr>
              <tr>
                <td>Anthropic PBC(미국)</td>
                <td>AI 기능에 입력한 질문·선택한 답 (IP는 보내지 않음)</td>
                <td>AI 답변 생성</td>
                <td>Anthropic API 정책에 따름</td>
              </tr>
              <tr>
                <td>Valve Corporation(미국)</td>
                <td>Steam 로그인 때 로그인 확인 요청, 사이트 서버가 Steam ID로 닉네임·프로필 사진·보유 게임을 조회하는 요청 (이용자가 로그인했을 때만)</td>
                <td>Steam 로그인, 닉네임·보유 게임 가져오기</td>
                <td>Valve 정책에 따름</td>
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
          AI 기능을 쓰지 않으면 Anthropic으로는, Steam 로그인을 쓰지 않으면 Valve로는 아무것도 전송되지 않아요. 국외 전송을 원하지 않으면 해당 기능(게시판·투표·AI·Steam 로그인)을 이용하지 않으면 돼요.
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
          <li>사이트는 광고·추적용 쿠키를 쓰지 않아요.</li>
          <li>방문 통계는 쿠키를 쓰지 않는 Vercel Web Analytics로 집계해요. 기기에 아무것도 저장하지 않고, 다른 사이트에서의 활동을 따라가지 않으며, 개인을 알아볼 수 없어요.</li>
          <li>꼭 필요한 쿠키만 써요. 아래 4개 중 <code>user_session</code>과 <code>logged_in</code>은 Steam으로 로그인할 때만 저장돼요.
            <ul>
              <li><code>ai_cid</code>: AI 기능 하루 이용 횟수 제한용 익명 쿠키. 무작위 값이라 개인을 알아볼 수 없고, 1년 뒤 만료돼요(위 1번 참고).</li>
              <li><code>user_session</code>: Steam 로그인 상태 유지용. 서명된 사용자 번호(사이트가 정한 무작위 번호)만 담고 Steam ID·닉네임은 담지 않아요. 30일 뒤 만료되고 로그아웃하면 지워져요.</li>
              <li><code>logged_in</code>: 로그인했는지 알려 주는 표시 쿠키. 값은 늘 1이고 개인정보가 없어요. 30일 뒤 만료되고 로그아웃하면 지워져요.</li>
              <li><code>admin_session</code>: 운영자 로그인용. 일반 이용자에게는 저장되지 않아요.</li>
            </ul>
          </li>
          <li>편의를 위해 내 기기의 브라우저 저장소에 마지막으로 쓴 닉네임, 내가 누른 투표, 목록 위치·비교 목록을 저장해요. 이 값은 사이트 서버로 전송되지 않으며, 브라우저 설정에서 사이트 데이터를 지우면 삭제돼요.</li>
          <li>Steam으로 로그인한 상태에서는 내 닉네임·프로필 사진 주소와 보유 게임 번호를 브라우저의 세션 저장소(sessionStorage)에 5분 동안 기억해 매 페이지에서 다시 묻지 않게 해요. 사이트 서버로 전송되지 않으며 탭을 닫거나 로그아웃하면 지워져요.</li>
          <li>게임 상세 페이지에서 내 PC 사양(그래픽카드·프로세서·메모리)을 입력하면 내 기기의 브라우저에만 저장되며 서버로 전송되지 않아요. 실행 가능 여부는 내 브라우저 안에서 계산하고, 입력을 지우거나 브라우저 설정에서 사이트 데이터를 지우면 삭제돼요.</li>
          <li>게임 상세·비교 페이지에서 &ldquo;찜목록에 담기&rdquo;를 누르면 담은 게임의 번호(ID)가 내 기기의 브라우저에만 저장되며 서버로 전송되지 않아요. &ldquo;공유 링크 복사&rdquo;로 만든 주소에는 게임 번호가 들어가고, 그 링크를 연 사람의 찜목록에는 &ldquo;내 찜목록에 합치기&rdquo;를 누르기 전까지 저장되지 않아요. 찜목록에서 빼거나 브라우저 설정에서 사이트 데이터를 지우면 삭제돼요.</li>
        </ul>

        <h2 className="cm-h2">6. 이용자의 권리</h2>
        <ul>
          <li><strong>Steam 로그인 정보 삭제</strong>: 로그인한 뒤 오른쪽 위 닉네임 메뉴의 <strong>[내 정보 삭제]</strong> 버튼을 누르면 저장된 Steam ID·닉네임·사진 주소·보유 게임 번호를 바로 한꺼번에 지워요. 로그인이 안 되는 경우에만 <Link href="/feedback">의견 보내기</Link>에서 &ldquo;기타&rdquo;를 골라 &ldquo;Steam 로그인 정보 삭제 요청&rdquo;과 Steam 닉네임을 적어 주세요. 처리 결과를 받고 싶으면 연락처도 남겨 주세요.</li>
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
        <p>이 방침을 바꾸면 시행 7일 전부터 사이트에 알려요. 다만 이용자에게 불리하지 않은 변경이나 이미 하고 있는 처리를 적는 변경은 공지와 함께 바로 시행할 수 있어요. 함께 보기: <Link href="/terms">이용약관</Link> · <Link href="/community/policy">커뮤니티 운영정책</Link></p>
        <p className="legal-date">시행일: {EFFECTIVE_DATE}</p>
        <p className="legal-date">변경 이력: {NOTICE_DATE} 공지·시행 — Steam 로그인 수집 항목·보관 기간(1년 자동 삭제)·삭제 방법([내 정보 삭제] 버튼)·만 14세 미만 이용 제한 추가. 이미 제공 중인 기능의 처리 내용을 적은 개정이라 즉시 시행 / 2026년 10월 5일 — 최초 시행</p>
      </article>
    </main>
  );
}
