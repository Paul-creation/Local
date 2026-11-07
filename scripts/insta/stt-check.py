# scripts/insta/stt-check.py — 내레이션 테이크 발음 검사(받아쓰기 + 글자 오류율 CER)
# 사용:
#   python3 stt-check.py <audio>              → faster-whisper(small, 한국어, CPU int8)로 받아쓰기 + 단어별 시작·끝(초), 마지막 줄에 {"text": "...", "words": [{"w","s","e"}]}
#   python3 stt-check.py --cer <대본> <받아쓰기> [대본표기=허용표기 …] → CER만 계산(모델 안 불러옴), 마지막 줄에 {"cer": 0.0, "ref": "...", "hyp": "..."}
# CER 규칙(기본값): 띄어쓰기·문장부호 제외, ㅐ/ㅔ 동음(데/대·게/개·세/새, ㅒ/ㅖ)은 같은 글자, 맞춤법만 다른 표기(되요/돼요: ㅙ·ㅞ→ㅚ)도 같은 글자로 본다.
# 허용 표기 목록(copy.narration.sttAllow)에 적은 표기는 그 문장에서만 같은 글자로 본다.
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


def cer(ref, hyp, equal=()):
    # equal: ["대본 표기=받아쓰기에서 같은 소리로 인정할 표기", ...] — 예: "진흙에=진을게"(표준 발음 [진흘게]를 whisper가 다르게 적는 경우)
    r, h = norm(ref), norm(hyp)
    for pair in equal:
        canon, _, variant = pair.partition("=")
        if variant:
            h = h.replace(norm(variant), norm(canon))
    return edit_distance(r, h) / len(r) if r else 0.0


if __name__ == "__main__":
    if sys.argv[1] == "--cer":
        print(json.dumps({"cer": cer(sys.argv[2], sys.argv[3], sys.argv[4:]), "ref": norm(sys.argv[2]), "hyp": norm(sys.argv[3])}, ensure_ascii=False))
    else:
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(sys.argv[1], language="ko", beam_size=5, vad_filter=False, condition_on_previous_text=False, word_timestamps=True)
        segs = list(segs)
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for sg in segs for w in (sg.words or [])]
        print(json.dumps({"text": "".join(sg.text for sg in segs).strip(), "words": words}, ensure_ascii=False))
