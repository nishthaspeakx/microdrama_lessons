"""Face identity check with OpenCV YuNet (detection) and SFace (recognition).

Models: OpenCV Zoo face_detection_yunet_2023mar.onnx and
face_recognition_sface_2021dec.onnx, stored in data/models.
SFace's published cosine threshold is 0.363; the series threshold is
calibrated on Madhopur Episode 1 below.
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path

import cv2
import numpy as np

from .. import DATA, POC_ROOT, REPO_ROOT

MODELS = DATA / "models"
EP1 = REPO_ROOT / "madhopur" / "episode-1"
SFACE_DEFAULT = 0.363
MIN_FACE_PX = 48


class FaceID:
    def __init__(self):
        self.det = cv2.FaceDetectorYN.create(str(MODELS / "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.8)
        self.rec = cv2.FaceRecognizerSF.create(str(MODELS / "face_recognition_sface_2021dec.onnx"), "")

    def faces(self, img: np.ndarray, sides: tuple[int, ...] = (960, 640)) -> list[tuple[np.ndarray, np.ndarray]]:
        """(face_row, embedding) for each face of at least MIN_FACE_PX.

        YuNet misses faces that fill most of a large image, so detection is
        tried at several sizes and the first size that finds faces is used.
        """
        found = None
        for side in sides:
            scale = min(1.0, side / max(img.shape[:2]))
            im = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1.0 else img
            self.det.setInputSize((im.shape[1], im.shape[0]))
            _, found = self.det.detect(im)
            if found is not None and len(found):
                img = im
                break
        out = []
        for f in (found if found is not None else []):
            if min(f[2], f[3]) < MIN_FACE_PX:
                continue
            emb = self.rec.feature(self.rec.alignCrop(img, f))
            out.append((f, emb))
        return out

    def sim(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(self.rec.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def _frames(video: Path, every_s: float = 0.5):
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    step, i = max(1, int(round(fps * every_s))), 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            yield i / fps, frame
        i += 1
    cap.release()


def calibrate_episode1() -> dict:
    fid = FaceID()
    bible = json.loads((EP1 / "revised" / "plan" / "ep1-revised-continuity-bible.json").read_text())
    names = [c["id"] for c in bible["characters"]]
    refs, genuine, impostor = {}, [], []
    for n in names:
        face_img = cv2.imread(str(EP1 / "references" / "characters" / f"{n}-face.png"))
        fs = fid.faces(face_img)
        if not fs:
            continue
        refs[n] = max(fs, key=lambda x: x[0][2] * x[0][3])[1]  # largest face
    # Genuine: the face reference against faces in the same character's sheet and outfit images.
    for n in refs:
        for kind in ("sheet", "outfit"):
            img = cv2.imread(str(EP1 / "references" / "characters" / f"{n}-{kind}.png"))
            for _, emb in fid.faces(img):
                genuine.append({"who": n, "src": kind, "sim": round(fid.sim(refs[n], emb), 3)})
    # Impostor: every pair of different characters' face references.
    keys = list(refs)
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            impostor.append({"a": a, "b": b, "sim": round(fid.sim(refs[a], refs[b]), 3)})

    # Clips used in the final cut: revised 1, 2, 3, 6, 7 and original 4, 5.
    clip_files = {1: EP1 / "revised/clips/01-bazaar-fireball.mp4", 2: EP1 / "revised/clips/02-bazaar-meera-line.mp4",
                  3: EP1 / "revised/clips/03-villagers-and-landing.mp4", 4: EP1 / "clips/04-pickup-crash.mp4",
                  5: EP1 / "clips/05-suman-and-the-boy.mp4", 6: EP1 / "revised/clips/06-craft-reveal.mp4",
                  7: EP1 / "revised/clips/07-final-child.mp4"}
    expected = {c["n"]: [r for r in c["references"] if r in refs] for c in bible["clips"]}
    clips = []
    for n, path in clip_files.items():
        rows = []
        for t, frame in _frames(path):
            for f, emb in fid.faces(frame):
                scores = {k: fid.sim(refs[k], emb) for k in refs}
                best = max(scores, key=scores.get)
                rows.append({"t": round(t, 2), "w": int(f[2]), "best": best, "sim": round(scores[best], 3),
                             "expected": best in expected[n],
                             "expected_best": max((scores[k] for k in expected[n]), default=None)})
        on_cast = [r["sim"] for r in rows if r["expected"]]
        clips.append({"clip": n, "expected": expected[n], "faces": len(rows),
                      "best_is_expected": sum(r["expected"] for r in rows),
                      "median_sim_expected": round(statistics.median(on_cast), 3) if on_cast else None,
                      "rows": rows})
    g = sorted(x["sim"] for x in genuine)
    imp = sorted(x["sim"] for x in impostor)
    report = {
        "model": "YuNet 2023mar + SFace 2021dec", "sface_published_threshold": SFACE_DEFAULT,
        "references": sorted(refs), "genuine": genuine, "impostor": impostor,
        "genuine_summary": {"n": len(g), "min": g[0] if g else None, "median": statistics.median(g) if g else None},
        "impostor_summary": {"n": len(imp), "max": imp[-1] if imp else None, "median": statistics.median(imp) if imp else None},
        "clips": clips,
    }
    out = POC_ROOT / "calibration" / "faces-episode1.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=1))
    return {k: v for k, v in report.items() if k not in ("genuine", "impostor", "clips")} | {
        "clips": [{k: v for k, v in c.items() if k != "rows"} for c in clips], "written": str(out.relative_to(POC_ROOT))}
