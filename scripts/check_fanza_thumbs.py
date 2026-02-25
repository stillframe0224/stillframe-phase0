import json
from pathlib import Path

dl = Path.home() / "Downloads"
bundles = sorted(dl.glob("shinen-export-bundle-*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
if not bundles:
    raise SystemExit("No bundle found")
p = bundles[0]

rows = {}
for ln in p.read_text(errors="ignore").splitlines():
    try:
        o = json.loads(ln)
    except Exception:
        continue
    if o.get("kind") != "card":
        continue
    source = o.get("source") or {}
    media = o.get("media") or {}
    url = source.get("url", "")
    domain = source.get("site", "")
    thumb = media.get("url") or media.get("thumbnail") or ""
    if not url:
        continue
    if ("dmm.co.jp" not in url) and ("fanza" not in url) and ("dmm.co.jp" not in domain) and ("fanza" not in domain):
        continue
    rows[url] = thumb

print("bundle:", p.name)
print("FANZA/DMM cards:", len(rows))

thumbs = list(rows.values())
unique = set(t for t in thumbs if t)
print("unique thumbnails:", len(unique))
if len(unique) == 1:
    print("WARNING: all cards share the SAME thumbnail (age-gate image?)")
elif len(unique) == 0:
    print("WARNING: no thumbnails at all")
else:
    print("OK: different thumbnails per card")

for i, (link, thumb) in enumerate(rows.items(), 1):
    print(f"\n{i}. {link[:80]}")
    print(f"   thumb: {thumb or '(none)'}")
