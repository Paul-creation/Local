# 인스타 작업 가이드 (노아용)

Codespace를 처음 열고 릴스 하나를 뽑을 때까지의 순서입니다. 코드·문구는 `scripts/insta/`, 데이터는 `data/insta/`, 문서는 `docs/insta/`, 이미지는 `public/insta/` 안에서만 고칩니다(협업 규칙은 CLAUDE.md "인스타 담당").

## 1. 처음 한 번

1. 레포 페이지 → Code → Codespaces → 새 Codespace. `.devcontainer`가 Node 22, ffmpeg(ffprobe 포함), zip, Python 3.12, Playwright 크롬, `scripts/insta/requirements.txt`의 Python 패키지를 자동 설치합니다(몇 분 걸립니다).
2. 환경변수는 Paul이 Codespaces secrets에 넣어 둡니다. 이름은 `.env.example`의 "인스타 작업" 섹션을 보세요. 터미널에서 `echo ${ELEVENLABS_API_KEY:+있음}`처럼 값은 찍지 말고 있는지만 확인합니다. 값을 파일·커밋·답변에 적지 않습니다.
3. 자산 받기(아래 "자산" 참고): Google Drive 공유 폴더(`<드라이브 링크 — Paul이 채움>`)에서 받아 `scripts/insta/assets/`에 풉니다.
4. 확인: `ffmpeg -version`, `npx playwright --version`, `python3 -c "import librosa, faster_whisper"`, `npm test`.

## 2. 자산

git에 없는 파일입니다. 폴더 구조는 이렇게 맞춥니다.

```
scripts/insta/assets/
├─ jamidunow-original-bgm.mp3
├─ brand/
│  ├─ sfx-whoosh.mp3
│  ├─ sfx-pop.mp3                 (없으면 로고 팝 효과음 없이 만들어짐)
│  └─ outro-voice-take1~3.mp3/.json, outro-voice.mp3(선택)
└─ crack/
   ├─ art/
   └─ clips/                      (CRACK 원본 클립, 약 1.2GB)
```

`scripts/insta/cache/`와 `out/`은 만들어 쓰는 폴더라 받을 필요 없습니다. 내레이션 캐시가 지워지면 ElevenLabs를 다시 호출하니, 지우기 전에 CLAUDE.md "인스타" 규칙을 보세요.

`assets/brand/` 파일별 출처(레포 기록으로 확인한 것만 적었습니다):

| 파일 | 출처 | 공유 방법 |
|---|---|---|
| outro-voice-take1~3.mp3, .json | 우리가 만든 것(`outro-voice.mjs`가 ElevenLabs로 생성) | git 예외 처리(`.gitignore`). 파일 자체는 아직 커밋하지 않음 |
| outro-voice.mp3 | 위 테이크 중 고른 것(있을 때) | 위와 같음 |
| sfx-whoosh.mp3 | 레포에 출처 기록 없음 — 라이선스 불명 | 드라이브 |
| sfx-pop.mp3 | 레포에 출처 기록 없음, 현재 파일도 없음 — 라이선스 불명 | 드라이브 |
| ../jamidunow-original-bgm.mp3 | 레포에 출처 기록 없음 — 라이선스 불명 | 드라이브 |
| ../crack/ 클립 | CRACK(Rafoli) 원본, 개발사가 허락(2026-11-02, 인스타 숏폼 한정) | 드라이브(비공개) |

## 3. 릴스 하나 뽑기

1. 게임과 문구 파일을 정합니다. 기존 예시는 `scripts/insta/copy/*.json`(출시 예정 = `trash-island.json`, 출시작 = `crack-trend.json`).
2. Supabase 읽기가 되는지 확인: `node scripts/insta/pick.mjs`(조건에 맞는 후보 목록을 출력합니다).
3. 생성: `npm run insta -- <post-id> --reel-trend`(신작 릴스). 게임 하나 소개는 `--reel-single`, 여러 게임은 `--reel`.
4. 결과는 `scripts/insta/out/<post-id>/`에 나옵니다(`reel-ig.mp4`, `still-subtitle.png`, `still-card.png`). 영상을 열어 자막·정보 카드·마지막 멘트를 확인합니다.
5. 새 문구 파일·스크립트 변경은 커밋합니다. 이 폴더들 안에서만 바뀌었으면 main에 직접 머지, 밖의 파일이 바뀌었으면 `insta/<이름>` 브랜치로 푸시만 하고 Paul에게 알립니다.

ElevenLabs 음성은 새 문장일 때만 호출되고 `cache/`에 저장됩니다. 문구를 많이 바꿔 다시 뽑으면 호출이 늘어나니, 같은 문장은 그대로 두세요.

## 4. Claude Code에 보내는 지시문 예시

예시 1 — 새 릴스 만들기

```
CRACK 출시작 릴스를 만들어줘. scripts/insta/copy/crack-trend.json을 기준으로 --reel-trend를 돌리고,
out/crack-trend/ 결과의 자막이 잘리거나 겹치는 곳이 없는지 still 이미지로 확인해줘.
ElevenLabs를 새로 호출해야 하면 실행 전에 예상 호출 횟수를 먼저 알려줘.
```

예시 2 — 문구만 바꿔 다시 뽑기

```
scripts/insta/copy/trash-island.json의 훅 문구를 "친구랑 쓰레기 분쇄기에 서로 밀어 넣는 상황" 쪽으로 바꿔줘.
'아무도 모르는' 같은 인지도 단정 표현은 쓰지 말고, 바뀐 문장만 내레이션을 다시 만들어줘. 코드는 건드리지 마.
```

예시 3 — DB에 없는 데이터가 필요할 때

```
이 게임이 curator_game_queue에 들어 있어야 하는데 없어. 직접 쓰지 말고 내가 Supabase SQL 에디터에 넣을 SQL을
한 줄로 만들어줘(주석 없이). 넣은 뒤 pick.mjs로 조회되는지 확인하는 명령도 같이 알려줘.
```

## 5. 하지 않는 것

DB 쓰기·마이그레이션, Vercel 설정, 비밀값(secrets) 변경은 하지 않습니다. 필요하면 Paul에게 요청하세요. 이 가이드는 `docs/insta/` 안이라 노아가 직접 고쳐도 됩니다.
