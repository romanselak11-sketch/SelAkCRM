from urllib.parse import urlparse


def mask_url_for_audit(url: str | None) -> str | None:
    if not url:
        return None
    try:
        u = urlparse(url)
        path = u.path if len(u.path) <= 80 else u.path[:80] + "…"
        return f"{u.scheme}//{u.netloc}{path}"
    except Exception:
        return url[:80] + "…" if len(url) > 80 else url
