# scripts/insta/pitch-end.py — 문장 끝 억양 검사(--reel-trend 내레이션)
# 사용: python3 scripts/insta/pitch-end.py <오디오> <문장 시작초> <문장 끝초> <마지막 어절 시작초> <마지막 어절 끝초>
# 출력(JSON 한 줄): rise_st(문장 평균 대비 끝 음높이, 반음), f0_end_hz, f0_mean_hz, voiced(유성음 프레임 수)
# 문장 평균 = 문장 전체 유성음 프레임의 음높이(반음) 평균, 끝 = 마지막 어절의 마지막 0.15초 유성음 프레임 중앙값(너무 적으면 0.3초까지 넓힘). librosa.pyin 사용(pip install librosa)
import json, sys
import numpy as np
import librosa

path, s0, s1, w0, w1 = sys.argv[1], *map(float, sys.argv[2:6])
y, sr = librosa.load(path, sr=22050, offset=max(0.0, s0), duration=max(0.1, s1 - s0))
hop = 256
f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=500, sr=sr, frame_length=2048, hop_length=hop)
t = librosa.times_like(f0, sr=sr, hop_length=hop) + max(0.0, s0)  # 파일 기준 시각
ok = voiced & np.isfinite(f0)
if ok.sum() < 5:
    print(json.dumps({"rise_st": None, "voiced": int(ok.sum())})); sys.exit(0)
st = 12 * np.log2(f0 / 440.0)
mean_st = float(np.mean(st[ok]))
end = None
for span in (0.15, 0.30):
    sel = ok & (t >= max(w0, w1 - span)) & (t <= w1)
    if sel.sum() >= 3:
        end = float(np.median(st[sel])); break
if end is None:
    print(json.dumps({"rise_st": None, "voiced": int(ok.sum())})); sys.exit(0)
print(json.dumps({"rise_st": round(end - mean_st, 2), "f0_end_hz": round(440 * 2 ** (end / 12), 1), "f0_mean_hz": round(440 * 2 ** (mean_st / 12), 1), "voiced": int(ok.sum())}))
