#!/usr/bin/env python3
"""
OpenAI Image Probe - Verify enso.png for OpenAI Responses API compatibility.
Tests both URL and base64 data URL inputs, identifies "Could not process image" root cause.
No curl dependency - uses Python stdlib urllib with macOS SSL compatibility.
"""
import os, json, time, base64, hashlib, ssl, urllib.request, urllib.error
from pathlib import Path
import subprocess

PNG_SIG = bytes.fromhex("89504e470d0a1a0a")
API_URL = "https://api.openai.com/v1/responses"


def _ssl_ctx() -> ssl.SSLContext:
    """Build SSL context that works on macOS without certifi."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    # Fallback: unverified context (acceptable for probe script)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


SSL_CTX = _ssl_ctx()


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sig8(b: bytes) -> str:
    return b[:8].hex()


def add_ts(url: str, ts: int) -> str:
    return url + ("&" if "?" in url else "?") + f"ts={ts}"


def fetch(url: str, timeout: int = 20):
    req = urllib.request.Request(
        url,
        headers={
            "Cache-Control": "no-cache",
            "User-Agent": "enso-probe/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            body = resp.read()
            return {
                "ok": True,
                "code": getattr(resp, "status", 200),
                "headers": dict(resp.headers.items()),
                "body": body,
            }
    except urllib.error.HTTPError as e:
        body = e.read() if hasattr(e, "read") else b""
        headers = dict(e.headers.items()) if getattr(e, "headers", None) else {}
        return {"ok": True, "code": e.code, "headers": headers, "body": body}
    except Exception as e:
        return {"ok": False, "code": None, "headers": {}, "body": b"", "error": str(e)}


def try_sips_normalize(in_path: Path, out_path: Path) -> bool:
    """Optional PNG normalization using macOS sips (strips odd chunks)."""
    try:
        subprocess.run(
            ["sips", "-s", "format", "png", str(in_path), "--out", str(out_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def openai_call(payload: dict, api_key: str, out_json: Path):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
            body = resp.read()
            out_json.write_bytes(body)
            return getattr(resp, "status", 200), body
    except urllib.error.HTTPError as e:
        body = e.read() if hasattr(e, "read") else b""
        out_json.write_bytes(body or b"")
        return e.code, body
    except Exception as e:
        out_json.write_text(json.dumps({"error": {"message": str(e)}}), encoding="utf-8")
        return 0, out_json.read_bytes()


def extract_errmsg(body_bytes: bytes) -> str:
    try:
        d = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        return ""
    if isinstance(d, dict):
        err = d.get("error")
        if isinstance(err, dict):
            return err.get("message", "") or ""
    return ""


def main():
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    local_png = Path(os.environ.get("LOCAL_PNG") or (root / "public" / "enso.png"))
    img_url = os.environ.get("IMG_URL") or "https://stillframe-phase0.vercel.app/enso.png"
    model = os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"
    ts = int(time.time())

    out_dir = root / "reports" / "triad"
    out_dir.mkdir(parents=True, exist_ok=True)

    report = out_dir / f"openai_image_probe_{ts}.md"
    payload_url_p = out_dir / f"openai_payload_url_{ts}.json"
    payload_b64_p = out_dir / f"openai_payload_b64_{ts}.json"
    resp_url_p = out_dir / f"openai_resp_url_{ts}.json"
    resp_b64_p = out_dir / f"openai_resp_b64_{ts}.json"

    if not local_png.exists():
        raise SystemExit(f"ERROR: missing local PNG: {local_png}")

    local_bytes = local_png.read_bytes()
    local_sig = sig8(local_bytes)
    local_ok = local_bytes[:8] == PNG_SIG

    # Normalize (optional, strips metadata)
    norm_path = out_dir / f"enso_norm_{ts}.png"
    norm_bytes = local_bytes
    norm_used = False
    if os.environ.get("ENSO_DISABLE_SIPS") != "1":
        if try_sips_normalize(local_png, norm_path) and norm_path.exists():
            norm_bytes = norm_path.read_bytes()
            norm_used = True

    norm_sig = sig8(norm_bytes)
    norm_ok = norm_bytes[:8] == PNG_SIG

    # URL fetch (what OpenAI would download)
    url_fetch = add_ts(img_url, ts)
    got = fetch(url_fetch)
    url_code = got.get("code")
    url_ct = (got.get("headers") or {}).get("Content-Type", "")
    url_body = got.get("body") or b""
    url_sig = sig8(url_body) if url_body else ""
    url_ok = (url_body[:8] == PNG_SIG) if url_body else False

    # Base64 data URL
    b64 = base64.b64encode(norm_bytes).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"

    # Payloads (OpenAI Responses API format)
    payload_url = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "ping"},
                    {"type": "input_image", "image_url": img_url},
                ],
            }
        ],
    }
    payload_b64 = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "ping"},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
    }
    payload_url_p.write_text(json.dumps(payload_url, indent=2), encoding="utf-8")
    payload_b64_p.write_text(json.dumps(payload_b64, indent=2), encoding="utf-8")

    # OpenAI calls (skip if SKIP_OPENAI=1 or no API key)
    code_url = code_b64 = None
    msg_url = msg_b64 = ""
    api_key = os.environ.get("OPENAI_API_KEY")

    if os.environ.get("SKIP_OPENAI") == "1":
        code_url = code_b64 = -1
        msg_url = msg_b64 = "SKIPPED (SKIP_OPENAI=1)"
    elif not api_key:
        code_url = code_b64 = -2
        msg_url = msg_b64 = "SKIPPED (OPENAI_API_KEY not set)"
    else:
        code_url, body_url = openai_call(payload_url, api_key, resp_url_p)
        code_b64, body_b64 = openai_call(payload_b64, api_key, resp_b64_p)
        msg_url = extract_errmsg(body_url)
        msg_b64 = extract_errmsg(body_b64)

    # Generate report
    report.write_text(
        "\n".join(
            [
                f"# OpenAI Image Probe ({ts})",
                "",
                "## Local PNG",
                f"- path: {local_png}",
                f"- png_signature_ok: {'YES' if local_ok else 'NO'} ({local_sig})",
                f"- sha256: {sha256(local_bytes)}",
                f"- bytes: {len(local_bytes)}",
                "",
                "## Local Normalized (sips)",
                f"- used_sips: {'YES' if norm_used else 'NO'}",
                f"- png_signature_ok: {'YES' if norm_ok else 'NO'} ({norm_sig})",
                f"- sha256: {sha256(norm_bytes)}",
                f"- bytes: {len(norm_bytes)}",
                f"- base64_len: {len(b64)}",
                "",
                "## URL Fetch (cache-busted)",
                f"- url: {url_fetch}",
                f"- http_code: {url_code}",
                f"- content_type: {url_ct}",
                f"- png_signature_ok: {'YES' if url_ok else 'NO'} ({url_sig})",
                f"- sha256: {sha256(url_body) if url_body else 'N/A'}",
                f"- bytes: {len(url_body)}",
                f"- **local_vs_url_match**: {'YES' if url_body and sha256(url_body) == sha256(local_bytes) else 'NO'}",
                "",
                "## OpenAI /v1/responses",
                f"- model: {model}",
                f"- URL input http_code: {code_url}",
                f"- URL input error: {msg_url}",
                f"- B64 input http_code: {code_b64}",
                f"- B64 input error: {msg_b64}",
                "",
                "## Artifacts",
                f"- payload_url: {payload_url_p}",
                f"- payload_b64: {payload_b64_p}",
                f"- resp_url: {resp_url_p}",
                f"- resp_b64: {resp_b64_p}",
                "",
                "## Summary",
                f"- Local PNG: {'✅ Valid' if local_ok else '❌ Invalid signature'}",
                f"- URL fetch: {'✅ 200 PNG' if url_code == 200 and url_ok else f'❌ {url_code} or invalid'}",
                f"- OpenAI URL: {_status_icon(code_url)} ({code_url})",
                f"- OpenAI B64: {_status_icon(code_b64)} ({code_b64})",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Report: {report}")
    print(f"RESULT url={code_url} b64={code_b64}")

    # Exit 0 even without API key (evidence collected)
    if code_url == -2:
        print("SKIP: OPENAI_API_KEY not set. Re-run with key for full probe.")
        sys.exit(0)

    # Exit nonzero only if both API calls failed (when actually called)
    if code_url not in (200, -1, -2) and code_b64 not in (200, -1, -2):
        raise SystemExit(2)


def _status_icon(code):
    if code == 200:
        return "✅"
    elif code in (-1, -2):
        return "⏭️"
    else:
        return "❌"


if __name__ == "__main__":
    import sys
    main()
