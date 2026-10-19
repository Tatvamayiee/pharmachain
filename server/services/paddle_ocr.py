# ---------------------------------------------------------------------------
# PaddleOCR sidecar — called by server/services/multiAiAnalysis.cjs
#
#   Usage: python paddle_ocr.py <image-path>
#   Output: single JSON line on stdout:
#     {"success": true, "text": "...", "device": "cpu"|"gpu"}
#     {"success": false, "error": "..."}
#
# Supports both PaddleOCR 3.x (predict()) and 2.x (ocr()) APIs.
# Device is auto-detected; PADDLE_DEVICE=cpu|gpu overrides.
# All logging goes to stderr — stdout carries ONLY the JSON line.
# ---------------------------------------------------------------------------
import os
import sys
import json

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("GLOG_minloglevel", "3")
# Paddle 3.x CPU: the oneDNN/MKLDNN executor crashes on Windows
# (ConvertPirAttribute2RuntimeAttribute ...) — keep it OFF before import.
os.environ.setdefault("FLAGS_use_mkldnn", "0")


def detect_device():
    forced = os.environ.get("PADDLE_DEVICE", "").strip().lower()
    if forced in ("cpu", "gpu"):
        return forced
    try:
        import paddle
        if paddle.device.is_compiled_with_cuda():
            try:
                if paddle.device.cuda.device_count() > 0:
                    return "gpu"
            except Exception:
                pass
    except Exception:
        pass
    return "cpu"


def run_ocr_3x(img_path, device):
    from paddleocr import PaddleOCR

    kwargs = {
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False,
        "use_textline_orientation": True,
        "lang": "en",
        "device": device,
        "enable_mkldnn": False,
    }
    try:
        engine = PaddleOCR(**kwargs)
        result = engine.predict(img_path)
    except TypeError:
        # Older 3.0.x without some kwargs
        engine = PaddleOCR(lang="en", device=device, enable_mkldnn=False)
        result = engine.predict(img_path)

    lines = []
    for res in result or []:
        texts = res.get("rec_texts") or []
        scores = res.get("rec_scores") or []
        for i, t in enumerate(texts):
            t = (t or "").strip()
            if not t:
                continue
            score = float(scores[i]) if i < len(scores) else 1.0
            lines.append((score, t))

    lines.sort(key=lambda x: -x[0])
    text = "\n".join(t for _, t in lines)
    return text


def run_ocr_2x(img_path, device):
    from paddleocr import PaddleOCR

    try:
        engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False, use_gpu=(device == "gpu"))
    except TypeError:
        engine = PaddleOCR(use_angle_cls=True, lang="en")
    result = engine.ocr(img_path, cls=True)

    lines = []
    for page in result or []:
        for line in page or []:
            if line and len(line) >= 2 and line[1]:
                txt = str(line[1][0]).strip()
                score = float(line[1][1]) if len(line[1]) > 1 else 1.0
                if txt:
                    lines.append((score, txt))

    lines.sort(key=lambda x: -x[0])
    text = "\n".join(t for _, t in lines)
    return text


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)

    img_path = sys.argv[1]
    if not os.path.isfile(img_path):
        print(json.dumps({"success": False, "error": f"Image not found: {img_path}"}))
        sys.exit(1)

    device = detect_device()
    try:
        try:
            text = run_ocr_3x(img_path, device)
        except ImportError:
            text = run_ocr_2x(img_path, device)
        except TypeError:
            text = run_ocr_2x(img_path, device)

        print(json.dumps({
            "success": True,
            "text": text,
            "device": device,
        }))
    except Exception as e:  # noqa: BLE001 — sidecar reports honestly
        print(json.dumps({"success": False, "error": f"{type(e).__name__}: {e}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
