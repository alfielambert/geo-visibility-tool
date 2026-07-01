"""
Site audit — lightweight AEO readiness check for oiya.ai.
"""

import json
import re
import time
from pathlib import Path

try:
    import httpx
    _HTTPX = True
except ImportError:
    _HTTPX = False

ASSETS_FILE = Path(__file__).parent / "oiya_assets.json"
_TIMEOUT = 10


def _load_assets() -> dict:
    if ASSETS_FILE.exists():
        with open(ASSETS_FILE) as f:
            return json.load(f)
    return {
        "homepage": "https://oiya.ai",
        "pages": [],
        "social": {},
        "value_prop": "A living, self-updating knowledge layer for AI agents",
        "target_competitors": ["Mem0", "Zep", "Hyperspell", "Egregore", "LangChain"],
    }


def _fetch(url: str) -> str | None:
    if not _HTTPX:
        return None
    try:
        resp = httpx.get(
            url,
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "GEOYA-Audit/1.0"},
        )
        return resp.text if resp.status_code == 200 else None
    except Exception as e:
        print(f"  [audit] {url}: {e}")
        return None


def _strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html)


def _check_entity_clarity(homepage_html: str | None) -> dict:
    if not homepage_html:
        return {"score": 0.0, "finding": "Could not fetch homepage"}

    text = _strip_html(homepage_html)
    first_200 = " ".join(text.split()[:200]).lower()

    signals = ["knowledge layer", "ai agents", "oiya", "living knowledge", "self-updating"]
    hits = [s for s in signals if s in first_200]
    score = len(hits) / len(signals)

    if score >= 0.6:
        finding = "Homepage clearly communicates Oiya's value proposition"
    elif score >= 0.3:
        finding = f"Homepage mentions some signals ({', '.join(hits)}) but could be clearer in the opening"
    else:
        finding = "Homepage does not clearly define Oiya's category in the first 200 words"

    return {"score": round(score, 2), "finding": finding}


def _check_comparison_pages(assets: dict) -> dict:
    competitors = assets.get("target_competitors", [])
    homepage = assets.get("homepage", "https://oiya.ai").rstrip("/")
    missing = []

    for comp in competitors:
        slug = comp.lower().replace(" ", "-")
        html = _fetch(f"{homepage}/vs/{slug}")
        # Treat 404 content or no response as missing
        if not html or len(html) < 200:
            missing.append(comp)
        time.sleep(0.3)

    found = len(competitors) - len(missing)
    score = found / len(competitors) if competitors else 0.0

    return {
        "score": round(score, 2),
        "found": found,
        "total": len(competitors),
        "missing": missing,
    }


def _check_citation_signals(homepage_html: str | None) -> dict:
    if not homepage_html:
        return {"score": 0.0, "finding": "Could not fetch homepage"}

    text = _strip_html(homepage_html).lower()
    superlatives = [
        "leading", "best", "only", "most", "first", "definitive",
        "purpose-built", "specifically designed", "trusted by",
    ]
    hits = [s for s in superlatives if s in text]
    score = min(len(hits) / 3, 1.0)

    if hits:
        finding = f"Found citation signals: {', '.join(hits[:5])}"
    else:
        finding = "No authority signals found — LLMs rarely cite pages without definitive statements"

    return {"score": round(score, 2), "finding": finding}


def _check_competitor_naming(homepage_html: str | None, competitors: list[str]) -> dict:
    if not homepage_html:
        return {"score": 0.0, "finding": "Could not fetch homepage", "named": []}

    text = _strip_html(homepage_html).lower()
    named = [c for c in competitors if c.lower() in text]
    score = len(named) / len(competitors) if competitors else 0.0

    finding = (
        f"Competitors named on site: {', '.join(named)}"
        if named
        else "No competitors named — LLMs cite brands that appear in comparison contexts"
    )

    return {"score": round(score, 2), "named": named, "finding": finding}


def _check_social_signals(assets: dict) -> dict:
    """Check Oiya's social presence on HN and Reddit vs top competitor."""
    if not _HTTPX:
        return {"score": 0.0, "finding": "httpx not available", "recommendation": None}

    competitors = assets.get("target_competitors", [])
    brand = "oiya"

    # HN via Algolia API
    hn_html = _fetch(f"https://hn.algolia.com/api/v1/search?query={brand}&hitsPerPage=10")
    hn_count = 0
    if hn_html:
        try:
            hn_count = json.loads(hn_html).get("nbHits", 0)
        except Exception:
            pass

    # Reddit JSON API (no auth needed for search)
    time.sleep(0.5)
    reddit_html = _fetch(
        f"https://www.reddit.com/search.json?q={brand}+knowledge+layer&limit=10"
    )
    reddit_count = 0
    if reddit_html:
        try:
            reddit_count = json.loads(reddit_html).get("data", {}).get("dist", 0)
        except Exception:
            pass

    # Compare top competitor on HN
    comp_hn_count = 0
    top_comp = competitors[0] if competitors else None
    if top_comp:
        time.sleep(0.5)
        comp_html = _fetch(
            f"https://hn.algolia.com/api/v1/search?query={top_comp.lower()}&hitsPerPage=10"
        )
        if comp_html:
            try:
                comp_hn_count = json.loads(comp_html).get("nbHits", 0)
            except Exception:
                pass

    total_brand = hn_count + reddit_count
    score = min(total_brand / 10, 1.0)

    parts = [f"Oiya: {hn_count} HN results, {reddit_count} Reddit posts"]
    if top_comp:
        parts.append(f"{top_comp}: {comp_hn_count} HN results (for comparison)")

    recommendation = None
    if total_brand < 5:
        recommendation = (
            "Post in r/LocalLLaMA and r/MachineLearning about knowledge layers. "
            "Consider a Show HN post — HN discussions are heavily cited by LLMs."
        )

    return {
        "score": round(score, 2),
        "finding": " | ".join(parts),
        "recommendation": recommendation,
    }


def run_audit() -> dict:
    """Run full AEO site audit for oiya.ai. Returns scored results dict."""
    if not _HTTPX:
        print("  ⚠️  httpx not installed — run: pip install httpx")
        return {"error": "httpx not available — install it with: pip install httpx"}

    assets = _load_assets()
    homepage_url = assets.get("homepage", "https://oiya.ai")
    competitors = assets.get("target_competitors", [])

    print(f"\n🔍 Auditing {homepage_url}...")
    homepage_html = _fetch(homepage_url)

    print("  → Entity clarity...")
    entity = _check_entity_clarity(homepage_html)

    print("  → Comparison pages...")
    comparison = _check_comparison_pages(assets)

    print("  → Citation signals...")
    citation = _check_citation_signals(homepage_html)

    print("  → Competitor naming...")
    competitor_naming = _check_competitor_naming(homepage_html, competitors)

    print("  → Social signals (HN + Reddit)...")
    social = _check_social_signals(assets)

    scores = [entity["score"], comparison["score"], citation["score"],
              competitor_naming["score"], social["score"]]
    overall = round(sum(scores) / len(scores), 2)

    recommendations = []
    if entity["score"] < 0.5:
        recommendations.append(
            "Rewrite homepage intro to clearly define Oiya as a 'knowledge layer for AI agents' in the first sentence"
        )
    if comparison.get("missing"):
        recommendations.append(
            f"Create comparison pages for: {', '.join(comparison['missing'])}"
        )
    if citation["score"] < 0.5:
        recommendations.append(
            "Add authority statements to homepage (e.g., 'The leading knowledge layer for AI agents')"
        )
    if not competitor_naming.get("named"):
        recommendations.append(
            "Name competitors on the site — LLMs are more likely to cite pages that use competitor names in comparison context"
        )
    if social.get("recommendation"):
        recommendations.append(social["recommendation"])

    result = {
        "entity_clarity": entity,
        "comparison_pages": comparison,
        "citation_signals": citation,
        "competitor_naming": competitor_naming,
        "social_signals": social,
        "overall_audit_score": overall,
        "recommendations": recommendations,
    }

    print(f"\n  📊 Overall AEO score: {overall:.0%}")
    return result
