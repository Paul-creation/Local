# scripts/insta/stt-check.py — 내레이션 테이크 발음 검사(받아쓰기 + 글자 오류율 CER)
# 사용:
#   python3 stt-check.py <audio>              → faster-whisper(small, 한국어, CPU int8)로 받아쓰기 + 단어별 시작·끝(초), 마지막 줄에 {"text": "...", "words": [{"w","s","e"}]}
#   python3 stt-check.py --cer <대본> <받아쓰기> [대본표기=허용표기 …] → CER만 계산(모델 안 불러옴), 마지막 줄에 {"cer": 0.0, "ref": "...", "hyp": "..."}
# CER 규칙(기본값): 띄어쓰기·문장부호 제외, ㅐ/ㅔ 동음(데/대·게/개·세/새, ㅒ/ㅖ)은 같은 글자, 맞춤법만 다른 표기(되요/돼요: ㅙ·ㅞ→ㅚ)도 같은 글자로 본다.
# 허용 표기 목록(copy.narration.sttAllow)에 적은 표기는 그 문장에서만 같은 글자로 본다.
# 단어 삽입·누락 검사(--cer 출력의 ins·dels): 정렬에서 받아쓰기에 대본에 없는 글자가 끼어들었으면(한 글자도) ins, 대본의 연속 2글자 이상이 빠졌으면 dels에 나온다. 둘 중 하나라도 있으면 그 테이크는 탈락(허용 표기는 제외).
# 그 밖의 다른 글자(예: 해요/돼요)는 틀린 것으로 센다.
import json, re, sys

VOWEL_MAP = {1: 5, 3: 7, 10: 11, 15: 11}  # ㅐ→ㅔ, ㅒ→ㅖ, ㅙ→ㅚ, ㅞ→ㅚ


def norm(text):
    out = []
    for ch in text.lower():
        o = ord(ch)
        if 0xAC00 <= o <= 0xD7A3:
            i = o - 0xAC00
            lead, vowel, tail = i // 588, (i % 588) // 28, i % 28
            vowel = VOWEL_MAP.get(vowel, vowel)
            out.append(chr(0xAC00 + lead * 588 + vowel * 28 + tail))
        elif re.match(r"[0-9a-z]", ch):
            out.append(ch)
    return "".join(out)


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i]
        for j in range(1, len(b) + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1])))
        prev = cur
    return prev[-1]


def align(r, h):
    """r(대본)·h(받아쓰기) 글자 정렬. 최소 편집 비용 중 삽입이 가장 적은 정렬을 골라 (비용, 삽입 글자 목록, 누락 글자 목록, 치환 수)를 돌려준다."""
    n, m = len(r), len(h)
    INF = (10**9, 0)
    dp = [[INF] * (m + 1) for _ in range(n + 1)]  # (비용, 삽입 수) 사전식 최소
    dp[0][0] = (0, 0)
    for i in range(n + 1):
        for j in range(m + 1):
            if i == 0 and j == 0:
                continue
            best = INF
            if i > 0:  # 누락(대본 글자가 받아쓰기에 없음)
                c = dp[i - 1][j]; best = min(best, (c[0] + 1, c[1]))
            if j > 0:  # 삽입(대본에 없는 글자가 끼어듦)
                c = dp[i][j - 1]; best = min(best, (c[0] + 1, c[1] + 1))
            if i > 0 and j > 0:  # 일치·치환
                c = dp[i - 1][j - 1]; best = min(best, (c[0] + (r[i - 1] != h[j - 1]), c[1]))
            dp[i][j] = best
    total = dp[n][m][0]
    ins, dels, subs = [], [], 0
    i, j = n, m
    while i > 0 or j > 0:
        cur = dp[i][j]
        if i > 0 and j > 0 and dp[i - 1][j - 1][0] + (r[i - 1] != h[j - 1]) == cur[0] and dp[i - 1][j - 1][1] == cur[1]:
            subs += r[i - 1] != h[j - 1]; i -= 1; j -= 1
        elif j > 0 and dp[i][j - 1][0] + 1 == cur[0] and dp[i][j - 1][1] + 1 == cur[1]:
            ins.append((j - 1, h[j - 1])); j -= 1
        else:
            dels.append((i - 1, r[i - 1])); i -= 1
    return total, ins[::-1], dels[::-1], subs


def detail(ref, hyp, equal=()):
    # equal: ["대본 표기=받아쓰기에서 같은 소리로 인정할 표기", ...] — 예: "진흙에=진을게"(표준 발음 [진흘게]를 whisper가 다르게 적는 경우)
    r, h = norm(ref), norm(hyp)
    for pair in equal:
        canon, _, variant = pair.partition("=")
        if variant:
            h = h.replace(norm(variant), norm(canon))
    cost, ins, dels, subs = align(r, h)
    # 누락: 연속 2글자 이상 빠지면(단어가 통째로 빠진 것) 탈락 대상. 삽입: 한 글자라도 끼어들면 탈락 대상
    runs, cur = [], []
    for k, ch in dels:
        if cur and k == cur[-1][0] + 1: cur.append((k, ch))
        else:
            if cur: runs.append("".join(c for _, c in cur))
            cur = [(k, ch)]
    if cur: runs.append("".join(c for _, c in cur))
    # 단어가 통째로 빠진 경우(한 글자 단어 포함): 대본의 띄어쓰기 단위 단어(허용 표기 적용 뒤) 글자가 전부 누락으로 잡혔으면 dels에 그 단어를 추가
    gone, pos, whole = {k for k, _ in dels}, 0, []
    for wd in [norm(x) for x in ref.split() if norm(x)]:
        if all(k in gone for k in range(pos, pos + len(wd))): whole.append(wd)
        pos += len(wd)
    return {"cer": cost / len(r) if r else 0.0, "ins": ["".join(c for _, c in ins)] if ins else [], "ins_n": len(ins), "dels": [x for x in runs if len(x) >= 2 or x in whole], "ref": r, "hyp": h}


def cer(ref, hyp, equal=()):
    return detail(ref, hyp, equal)["cer"]


if __name__ == "__main__":
    if sys.argv[1] == "--cer":
        print(json.dumps(detail(sys.argv[2], sys.argv[3], sys.argv[4:]), ensure_ascii=False))
    else:
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(sys.argv[1], language="ko", beam_size=5, vad_filter=False, condition_on_previous_text=False, word_timestamps=True)
        segs = list(segs)
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for sg in segs for w in (sg.words or [])]
        print(json.dumps({"text": "".join(sg.text for sg in segs).strip(), "words": words}, ensure_ascii=False))
