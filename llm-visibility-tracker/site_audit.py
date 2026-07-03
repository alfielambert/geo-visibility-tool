"""
Site audit — lightweight AEO readiness check for oiya.ai.
"""

import json
import os
import re
import time
import urllib.parse
from pathlib import Path

try:
    import httpx
    _HTTPX = True
except ImportError:
    _HTTPX = False

ASSETS_FILE = Path(__file__).parent / "oiya_assets.json"
_TIMEOUT = 10

# Category → signals indicating content coverage
_CATEGORY_SIGNALS = {
    "buyer-intent": {
        "keywords": ["pricing", "plans", "why choose", "roi", "get started", "sign up", "free trial"],
        "paths": ["/pricing", "/plans"],
    },
    "how-to": {
        "keywords": ["documentation", "docs", "tutorial", "guide", "how to", "getting started", "quickstart"],
        "paths": ["/docs", "/documentation", "/guides", "/quickstart"],
    },
    "comparison": {
        "keywords": ["vs ", "versus", "compare", "alternative", "compared to"],
        "paths": ["/vs/", "/compare", "/alternatives"],
    },
    "discovery": {
        "keywords": ["what is", "overview", "introduction", "learn", "about oiya"],
        "paths": ["/about", "/what-is", "/overview", "/learn"],
    },
}


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


def _fetch(url: str, extra_headers: dict | None = None) -> str | None:
    if not _HTTPX:
        return None
    try:
        headers = {"User-Agent": "GEOYA-Audit/1.0"}
        if extra_headers:
            headers.update(extra_headers)
        resp = httpx.get(url, timeout=_TIMEOUT, follow_redirects=True, headers=headers)
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
        "finding": (
            f"{found}/{len(competitors)} comparison pages found"
            if found
            else f"No comparison pages found — missing: {', '.join(missing)}"
        ),
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


def _check_bestx_listicles(assets: dict, homepage_html: str | None) -> dict:
    """Check if oiya.ai has 'best X' listicle-type content LLMs would cite for discovery queries."""
    homepage = assets.get("homepage", "https://oiya.ai").rstrip("/")
    bestx_pattern = re.compile(
        r"(best|top\s+\d+|top\s+\w+)\s+\w+(\s+for\s+\w+)?", re.IGNORECASE
    )

    found_on = []

    # Check homepage
    if homepage_html:
        text = _strip_html(homepage_html)
        if bestx_pattern.search(text):
            found_on.append("homepage")

    # Check sitemap for "best" URLs
    sitemap = _fetch(f"{homepage}/sitemap.xml")
    if sitemap:
        best_urls = re.findall(r"<loc>[^<]*best[^<]*</loc>", sitemap, re.IGNORECASE)
        if best_urls:
            found_on.append(f"sitemap ({len(best_urls)} 'best' URL(s))")

    # Check common blog/resource paths
    for path in ["/blog", "/resources", "/guides", "/learn"]:
        html = _fetch(f"{homepage}{path}")
        if html and len(html) > 500 and bestx_pattern.search(_strip_html(html)):
            found_on.append(path)
        time.sleep(0.3)

    score = min(len(found_on) / 2, 1.0)  # 2+ locations = full score

    if found_on:
        finding = f"'Best X' content found on: {', '.join(found_on)}"
    else:
        finding = (
            "No 'best X for Y' or 'top N tools' content found — "
            "missing from LLM training data for discovery and how-to queries"
        )

    return {"score": round(score, 2), "found_on": found_on, "finding": finding}


def _check_category_coverage(assets: dict, homepage_html: str | None) -> dict:
    """Check if oiya.ai has content covering each prompt category."""
    homepage = assets.get("homepage", "https://oiya.ai").rstrip("/")
    homepage_text = _strip_html(homepage_html).lower() if homepage_html else ""

    covered = []
    missing = []

    for category, signals in _CATEGORY_SIGNALS.items():
        keyword_hit = any(kw in homepage_text for kw in signals["keywords"])

        path_hit = False
        for path in signals["paths"]:
            # For comparison, just check a concrete vs page exists (reuses comparison check result)
            if path == "/vs/":
                continue
            html = _fetch(f"{homepage}{path}")
            if html and len(html) > 500:
                path_hit = True
                break
            time.sleep(0.2)

        if keyword_hit or path_hit:
            covered.append(category)
        else:
            missing.append(category)

    score = len(covered) / len(_CATEGORY_SIGNALS)

    parts = []
    if covered:
        parts.append(f"Covered: {', '.join(covered)}")
    if missing:
        parts.append(f"Missing: {', '.join(missing)}")

    return {
        "score": round(score, 2),
        "covered": covered,
        "missing": missing,
        "finding": " | ".join(parts) if parts else "No categories assessed",
    }


def _check_social_signals(assets: dict) -> dict:
    """Check Oiya's social presence on HN, Reddit, and LinkedIn (via Lix) vs top competitor."""
    if not _HTTPX:
        return {"score": 0.0, "finding": "httpx not available", "recommendation": None}

    competitors = assets.get("target_competitors", [])
    brand = "oiya"
    lix_key = os.environ.get("LIX_API_KEY")
    top_comp = competitors[0] if competitors else None

    # HN via Algolia API
    hn_html = _fetch(f"https://hn.algolia.com/api/v1/search?query={brand}&hitsPerPage=10")
    hn_count = 0
    if hn_html:
        try:
            hn_count = json.loads(hn_html).get("nbHits", 0)
        except Exception:
            pass

    # Reddit JSON API
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

    # HN: top competitor comparison
    comp_hn_count = 0
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

    # LinkedIn via Lix API
    li_brand_count = 0
    li_comp_count = 0
    li_status = "LIX_API_KEY not set — skipped"

    if lix_key:
        li_status = "checked"
        brand_li_url = urllib.parse.quote(
            f"https://www.linkedin.com/search/results/content/?keywords={brand}+knowledge+layer"
        )
        li_html = _fetch(
            f"https://api.lix-it.com/v1/li/linkedin/search/posts?url={brand_li_url}&start=0",
            extra_headers={"Authorization": lix_key},
        )
        if li_html:
            try:
                li_brand_count = json.loads(li_html).get("searchResponse", {}).get("paging", {}).get("total", 0)
            except Exception:
                pass

        if top_comp:
            time.sleep(3)  # Lix rate limit: 1 req/3s
            comp_li_url = urllib.parse.quote(
                f"https://www.linkedin.com/search/results/content/?keywords={top_comp.lower()}+knowledge+layer"
            )
            li_comp_html = _fetch(
                f"https://api.lix-it.com/v1/li/linkedin/search/posts?url={comp_li_url}&start=0",
                extra_headers={"Authorization": lix_key},
            )
            if li_comp_html:
                try:
                    li_comp_count = json.loads(li_comp_html).get("searchResponse", {}).get("paging", {}).get("total", 0)
                except Exception:
                    pass

    total_brand = hn_count + reddit_count + li_brand_count
    score = min(total_brand / 15, 1.0)  # 15+ combined = full score

    parts = [
        f"Oiya: {hn_count} HN, {reddit_count} Reddit, {li_brand_count} LinkedIn ({li_status})",
    ]
    if top_comp:
        parts.append(
            f"{top_comp}: {comp_hn_count} HN, {li_comp_count} LinkedIn"
        )

    recommendation = None
    if total_brand < 5:
        recommendation = (
            "Post in r/LocalLLaMA and r/MachineLearning about knowledge layers. "
            "Consider a Show HN post — HN discussions are heavily cited by LLMs. "
            "Share LinkedIn content comparing Oiya to Mem0/Zep."
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

    print("  → 'Best X' listicle content...")
    bestx = _check_bestx_listicles(assets, homepage_html)

    print("  → Category coverage...")
    category_coverage = _check_category_coverage(assets, homepage_html)

    print("  → Social signals (HN + Reddit + LinkedIn)...")
    social = _check_social_signals(assets)

    scores = [
        entity["score"], comparison["score"], citation["score"],
        competitor_naming["score"], bestx["score"],
        category_coverage["score"], social["score"],
    ]
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
            "Name competitors on the site — LLMs cite brands that appear in comparison contexts"
        )
    if bestx["score"] < 0.5:
        recommendations.append(
            "Create 'best X' listicle content (e.g., 'Best knowledge layers for AI agents') — "
            "these are heavily cited in discovery and how-to queries"
        )
    if category_coverage.get("missing"):
        recommendations.append(
            f"Create content targeting missing query categories: {', '.join(category_coverage['missing'])}"
        )
    if social.get("recommendation"):
        recommendations.append(social["recommendation"])

    result = {
        "entity_clarity": entity,
        "comparison_pages": comparison,
        "citation_signals": citation,
        "competitor_naming": competitor_naming,
        "bestx_listicles": bestx,
        "category_coverage": category_coverage,
        "social_signals": social,
        "overall_audit_score": overall,
        "recommendations": recommendations,
    }

    print(f"\n  📊 Overall AEO score: {overall:.0%}")
    return result
