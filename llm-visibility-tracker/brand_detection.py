"""
Brand detection module — analyses LLM responses for brand mentions,
competitor references, positioning, and sentiment.
"""

import re

# Known competitors across four categories:
# 1. Agent memory/context: Mem0, Zep, Letta, LangMem, Hyperspell
# 2. Agent frameworks: LangChain, LlamaIndex, CrewAI, AutoGen
# 3. Vector DBs / RAG infra: Pinecone, Weaviate, Chroma, Qdrant
# 4. Knowledge management: Notion AI, Guru, Glean, Tettra
# 5. Direct competitors: Egregore, Hyperspell, Edra
KNOWN_COMPETITORS = [
    # Agent memory & context
    "Mem0", "Zep", "Letta", "LangMem", "Hyperspell",
    # Agent frameworks
    "LangChain", "LlamaIndex", "CrewAI", "AutoGen",
    # Vector DBs / RAG infra
    "Pinecone", "Weaviate", "Chroma", "Qdrant",
    # Knowledge management
    "Notion AI", "Guru", "Glean", "Tettra",
    # Direct competitors
    "Egregore", "Edra",
    # Additional adjacent tools
    "Guardrails AI", "Cognism", "Clearbit", "Apollo", "Apollo.io",
]

# Brand aliases — map each tracked brand to all the strings that count
# as a mention (case-insensitive).
BRAND_ALIASES = {
    "Oiya": ["oiya", "oiya.ai", "oiya ai"],
}


def _normalise(text: str) -> str:
    return text.lower()


def detect_brand(brand: str, response: str) -> dict:
    """
    Analyse a single LLM response for a given brand.

    Returns:
        {
            "brand_mentioned": bool,
            "mention_position": int | None,   # 1-indexed rank among all products mentioned
            "competitors_mentioned": [str],
            "sentiment": "positive" | "neutral" | "negative",
        }
    """
    norm = _normalise(response)
    aliases = BRAND_ALIASES.get(brand, [brand.lower()])

    # --- Brand mentioned? ---
    brand_mentioned = any(alias in norm for alias in aliases)

    # --- Competitors mentioned ---
    competitors_found = []
    for comp in KNOWN_COMPETITORS:
        if _normalise(comp) in norm:
            competitors_found.append(comp)
    # De-duplicate near-duplicates (e.g. "Apollo" and "Apollo.io")
    competitors_found = _dedup_competitors(competitors_found)

    # --- Mention position ---
    # Find the order in which products (brand + competitors) first appear.
    mention_position = None
    if brand_mentioned:
        positions = []
        # Find brand position
        brand_pos = len(norm)
        for alias in aliases:
            idx = norm.find(alias)
            if idx != -1:
                brand_pos = min(brand_pos, idx)
        positions.append(("__brand__", brand_pos))

        # Find competitor positions
        for comp in competitors_found:
            idx = norm.find(_normalise(comp))
            if idx != -1:
                positions.append((comp, idx))

        positions.sort(key=lambda x: x[1])
        for rank, (name, _) in enumerate(positions, start=1):
            if name == "__brand__":
                mention_position = rank
                break

    # --- Sentiment ---
    sentiment = _assess_sentiment(brand, aliases, response)

    return {
        "brand_mentioned": brand_mentioned,
        "mention_position": mention_position,
        "competitors_mentioned": competitors_found,
        "sentiment": sentiment,
    }


def _dedup_competitors(comps: list[str]) -> list[str]:
    """Remove near-duplicate competitor names (keep the longer form)."""
    seen_lower = {}
    for c in comps:
        # Strip common suffixes like .io, .ai, .com to group variants
        key = re.sub(r"\.(io|ai|com)$", "", c.lower())
        key = re.sub(r"[.\-\s]", "", key)
        if key not in seen_lower or len(c) > len(seen_lower[key]):
            seen_lower[key] = c
    return list(seen_lower.values())


def _assess_sentiment(brand: str, aliases: list[str], response: str) -> str:
    """
    Simple keyword-based sentiment assessment for the brand mention.
    Looks at the sentence(s) surrounding the brand mention.
    """
    norm = _normalise(response)

    # Find the sentence containing the brand
    brand_sentences = []
    sentences = re.split(r'[.!?\n]', response)
    for sent in sentences:
        if any(alias in _normalise(sent) for alias in aliases):
            brand_sentences.append(sent.lower())

    if not brand_sentences:
        return "neutral"

    context = " ".join(brand_sentences)

    positive_signals = [
        "best", "excellent", "powerful", "recommend", "top", "leading",
        "great", "strong", "ideal", "popular", "well-regarded", "standout",
        "impressive", "robust", "comprehensive", "innovative", "unique",
        "specifically designed", "purpose-built", "tailored",
    ]
    negative_signals = [
        "limited", "lacking", "weak", "poor", "not recommend", "avoid",
        "expensive", "overpriced", "unreliable", "outdated", "downside",
        "drawback", "however", "but", "although", "caveat", "less known",
        "smaller", "newer and less established",
    ]

    pos_count = sum(1 for w in positive_signals if w in context)
    neg_count = sum(1 for w in negative_signals if w in context)

    if pos_count > neg_count:
        return "positive"
    elif neg_count > pos_count:
        return "negative"
    return "neutral"
