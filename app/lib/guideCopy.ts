// 사용 가이드(/guide)와 첫 방문 안내 띠의 화면 문구 — 문구만 고칠 때는 이 파일만 고친다.
// 화면에는 데이터·코드로 확인되는 사실만 쓴다. 근거: docs/STATUS.md, app/faq/page.tsx, app/lib/aiGuard.ts, app/lib/compareRule.ts, app/lib/user/*
// 서버·브라우저 어느 쪽에서든 import할 수 있게 비밀 값·서버 전용 코드를 넣지 않는다.

// Steam 섹션(⑧)과 목차 칩 공개 여부. 로그인 시험(10/11)과 개인정보처리방침 개정(fix/privacy-steam)이 끝나면 true로 바꾼다
export const GUIDE_SHOW_STEAM = false;

// 링크 주소 안의 {exampleGame}은 서버가 고른 예시 게임 상세 주소로 바뀐다 (lib/guideExample). 못 골랐으면 그 버튼은 숨긴다
export const EXAMPLE_GAME_TOKEN = '{exampleGame}';

export const GUIDE_STRIP = {
  text: '처음이세요? 1분 가이드 →',
  href: '/guide',
  closeLabel: '안내 닫기',
};

export const GUIDE_META = {
  title: '사용 가이드',
  description: 'JamiDuNow 사용법을 하고 싶은 일 순서로 정리했어요. 인원으로 게임 찾기, 내 PC 확인, 할인 보기, 비교, 영상, 커뮤니티까지.',
  ogTitle: '사용 가이드 · JamiDuNow',
};

export const GUIDE_HEAD = {
  title: '사용 가이드',
  intro: 'JamiDuNow를 처음 쓰는 분을 위한 안내예요. 하고 싶은 일부터 골라 읽어 주세요. 각 부분 끝의 버튼을 누르면 실제 화면이 그 상태로 열려요.',
  tocLabel: '가이드 목차',
};

export type GuideAction = { label: string; href: string };
export type GuideBlock = { heading?: string; paragraphs: string[]; actions: GuideAction[] };
export type GuideSection = { id: string; tocLabel: string; title: string; big?: boolean; steam?: boolean; blocks: GuideBlock[] };

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'summary',
    tocLabel: '요약',
    title: '30초 요약',
    blocks: [{
      paragraphs: [
        'JamiDuNow는 친구랑 같이 할 게임을 인원, 가격, 할인, 진입장벽으로 비교해 찾는 사이트예요.',
        '메인에서 인원을 고르면 그 인원이 함께할 수 있는 게임이 나와요. 마음에 드는 게임은 상세 페이지에서 내 PC 사양과 가격 기록을 확인할 수 있어요.',
        '찜목록, 내 PC, 비교는 로그인 없이 쓸 수 있어요.',
      ],
      actions: [{ label: '4명이서 할 게임 보기', href: '/?players=4' }],
    }],
  },
  {
    id: 'find',
    tocLabel: '게임 찾기',
    title: '같이 할 게임 찾기',
    big: true,
    blocks: [
      {
        heading: '인원 고르기',
        paragraphs: [
          '메인의 인원 버튼을 누르면 그 인원이 한 판에 함께할 수 있는 게임만 보여줘요.',
          '최대 인원은 모드나 비공식 패치를 빼고 공식 기능만 기준으로 해요. 숫자를 확실히 정하지 못한 게임은 "인원 정보 확인 중"으로 비워 둬요.',
        ],
        actions: [{ label: '4명으로 찾기', href: '/?players=4' }],
      },
      {
        heading: '필터로 좁히기',
        paragraphs: [
          '필터에서 같이 하는 방식, 가격 범위, 진입장벽(낮음·보통·높음), 크로스플레이·전용 서버·P2P, 지금 할인 중을 고를 수 있어요. 정렬은 인기순, 최근 추가순, 할인 큰 순, 낮은 가격순이에요.',
          '고른 조건은 주소에 담겨서, 그 주소를 친구에게 보내면 같은 결과가 열려요.',
        ],
        actions: [{ label: '진입장벽 낮고 크로스플레이 되는 4명 게임', href: '/?players=4&barrier=low&net=crossplay' }],
      },
      {
        heading: 'AI 추천',
        paragraphs: [
          '검색창 옆의 AI 추천 버튼을 누르면 AI가 몇 가지를 물어보고 게임을 골라줘요. 한 브라우저에서 하루 3번까지 쓸 수 있어요.',
          'AI가 고른 게임도 상세 페이지의 인원·가격 정보로 한 번 더 확인해 주세요.',
        ],
        actions: [{ label: 'AI 추천 열어 보기', href: '/?ai=1' }],
      },
    ],
  },
  {
    id: 'my-pc',
    tocLabel: '내 PC',
    title: '내 PC에서 돌아갈까',
    blocks: [{
      paragraphs: [
        '내 PC 페이지에서 그래픽카드, CPU, RAM을 등록하면 게임 상세의 "내 PC 사양 진단" 카드에서 최소 사양 기준으로 부품별 판정을 보여줘요.',
        '입력한 사양은 이 브라우저에만 저장되고 서버로 보내지 않아요. 프레임이나 쾌적함은 알려 주지 않아요.',
        '목록에서는 필터의 "내 PC로 돌아가는 게임만"으로 최소 사양에 못 미치는 게임을 뺄 수 있어요.',
      ],
      actions: [{ label: '내 PC 등록하기', href: '/my-pc' }],
    }],
  },
  {
    id: 'deals',
    tocLabel: '할인',
    title: '살까 말까',
    blocks: [
      {
        heading: '가격과 역대 최저가',
        paragraphs: [
          '가격은 매일 새벽(한국 시간 3시 무렵) 한 번 갱신해요. 구매 전에는 스토어에서 한 번 더 확인해 주세요.',
          '역대 최저가는 IsThereAnyDeal이 기록한 모든 상점의 한국 원화 가격 중 가장 낮았던 값이에요. 지금 Steam 가격이 그 이하면 "역대 최저가", 10% 안쪽으로 비싸면 "최저가 근접"으로 표시해요.',
        ],
        actions: [{ label: '지금 할인 중인 게임', href: '/?sale=1&sort=discount' }],
      },
      {
        heading: '할인 주기와 마감',
        paragraphs: [
          '할인 기록이 쌓인 게임은 상세 페이지에 "평균 N일마다 할인했어요" 같은 한 줄이 나와요.',
          '곧 끝나는 할인은 "이번 주 할인 마감"에서 날짜순으로 볼 수 있어요. 끝나는 날을 확인한 할인만 보여줘요.',
        ],
        actions: [{ label: '이번 주 할인 마감', href: '/this-week' }],
      },
      {
        heading: '찜',
        paragraphs: [
          '하트를 눌러 찜해 두면 찜목록에서 모아 볼 수 있어요. 찜목록은 이 브라우저에 저장되고, 공유 링크로 친구에게 보낼 수도 있어요.',
        ],
        actions: [{ label: '찜목록 열기', href: '/wishlist' }],
      },
    ],
  },
  {
    id: 'compare',
    tocLabel: '비교',
    title: '고민될 때 비교',
    blocks: [{
      paragraphs: [
        '카드의 "+ 비교"로 게임을 최대 3개 담아 나란히 볼 수 있어요.',
        '비교 화면에는 상황별 추천도와 스펙 비교가 있고, 게임에 대해 AI에게 물어볼 수도 있어요(횟수 제한이 있어요).',
        '혼자만 하는 게임과 같이 하는 게임은 함께 담을 수 없어요.',
      ],
      actions: [{ label: '비교 시작하기', href: '/compare' }],
    }],
  },
  {
    id: 'videos',
    tocLabel: '영상',
    title: '영상으로 미리 보기',
    blocks: [{
      paragraphs: [
        '게임 상세의 "영상으로 미리 보기"에서 큰 플레이어와 썸네일 목록으로 영상을 볼 수 있어요. 친구랑 플레이한 영상, 하이라이트, 스트리머 영상이 최대 8개까지 나오고, 영상마다 출처 칩이 붙어요.',
        '카드에서 스트리머 이름 칩을 누르면 그 스트리머의 영상으로 바로 가요. 재생은 YouTube 개인정보 보호 강화 모드로 열려요.',
      ],
      actions: [{ label: '영상 있는 게임 보기', href: `/games/${EXAMPLE_GAME_TOKEN}#streamer-videos` }],
    }],
  },
  {
    id: 'community',
    tocLabel: '커뮤니티',
    title: '같이 할 사람 구하기',
    blocks: [{
      paragraphs: [
        '커뮤니티의 "같이 할 사람" 게시판에서 같이 할 친구를 찾을 수 있어요. 가입 없이 닉네임(2~12자)과 비밀번호만 적어 글을 쓰고, 비밀번호는 수정·삭제에 써요.',
        '비밀번호는 운영자도 알 수 없어서 잊으면 찾아 드릴 수 없어요.',
        '게임 정보가 틀렸거나 바라는 점이 있으면 의견 보내기로 알려 주세요. 로그인 없이 보낼 수 있어요.',
      ],
      actions: [
        { label: '같이 할 사람 게시판', href: '/community/party' },
        { label: '의견 보내기', href: '/feedback' },
      ],
    }],
  },
  {
    id: 'steam',
    tocLabel: 'Steam',
    title: 'Steam 로그인하면 좋은 점',
    steam: true,
    blocks: [{
      paragraphs: [
        '로그인하면 내가 가진 게임에 "보유 중" 칩이 붙어요. 카드와 게임 상세에서 볼 수 있어요.',
        '가져오는 정보는 Steam ID, 닉네임, 프로필 사진, 보유 게임 목록(게임 번호만)과 마지막 로그인 시각이에요. 비밀번호는 Steam 로그인 화면에서만 입력해서 사이트는 알 수 없어요. 이메일, 친구 목록, 플레이 시간, 위시리스트, 결제 정보는 가져오지 않아요.',
        '보유 게임은 Steam 프로필의 게임 세부 정보가 공개일 때만 가져오고, 24시간이 지나면 다시 가져와요.',
      ],
      actions: [{ label: 'Steam으로 로그인', href: '/api/auth/steam/login?next=/guide' }],
    }],
  },
];

export const GUIDE_FOOT = {
  text: '더 궁금한 점은',
  links: [
    { label: '자주 묻는 질문', href: '/faq' },
    { label: '의견 보내기', href: '/feedback' },
  ],
};

export const GUIDE_ACTION_SUFFIX = ' →';
export const GUIDE_ACTION_PREFIX = '직접 해 보기 · ';

// /faq 맨 위 한 줄
export const FAQ_GUIDE_LINE = { text: '처음이라면 ', linkLabel: '사용 가이드', tail: '를 먼저 보세요.' };
// 푸터 링크 이름
export const FOOTER_GUIDE_LABEL = '사용 가이드';
