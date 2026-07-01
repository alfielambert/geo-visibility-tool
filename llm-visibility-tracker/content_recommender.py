"""
Content recommender — aggregates diagnostic findings into ranked content bets.
"""

from collections import defaultdict


def aggregate_recommendations(diagnostics: list[dict]) -> list[dict]:
    """
    Aggregate diagnostic findings into ranked content recommendations.

    Returns list of recommendations sorted by priority then frequency.
    """
    # Group similar recommended actions together
    action_groups: dict[str, list[dict]] = defaultdict(list)
    for d in diagnostics:
        key = d["recommended_action"].strip().lower()[:80]
        action_groups[key].append(d)

    recommendations = []
    for _, items in action_groups.items():
        best = max(items, key=lambda x: x["confidence"])
        has_high = any(i["priority"] == "high" for i in items)

        recommendations.append({
            "title": best["recommended_action"],
            "frequency": len(items),
            "priority": "high" if has_high else "medium",
            "categories": sorted(set(i["category"] for i in items)),
            "models_affected": sorted(set(i["model"] for i in items)),
            "gap_summary": best["content_gap"],
            "confidence": best["confidence"],
        })

    recommendations.sort(
        key=lambda r: (0 if r["priority"] == "high" else 1, -r["frequency"])
    )
    return recommendations


def generate_content_brief(title: str, rec: dict) -> str:
    """
    Generate a short markdown content brief for a recommendation.

    Args:
        title: The content title/recommendation
        rec: A recommendation dict from aggregate_recommendations

    Returns:
        Markdown string
    """
    models = ", ".join(rec.get("models_affected", []))
    categories = ", ".join(rec.get("categories", []))
    freq = rec.get("frequency", 1)

    return (
        f"**{title}**\n\n"
        f"- **Why:** {rec.get('gap_summary', 'Content gap identified')}\n"
        f"- **Impact:** Gap seen {freq} time(s) across [{categories}] queries\n"
        f"- **Models affected:** {models}\n"
        f"- **Priority:** {rec.get('priority', 'medium').upper()}\n"
    )


def summarize_by_model(diagnostics: list[dict]) -> dict[str, str]:
    """
    Summarize model-specific biases from diagnostics.

    Returns dict: {model: summary_string}
    """
    by_model: dict[str, list[str]] = defaultdict(list)
    for d in diagnostics:
        if d.get("model_bias"):
            by_model[d["model"]].append(d["model_bias"])

    return {
        model: " | ".join(list(dict.fromkeys(biases))[:3])
        for model, biases in by_model.items()
    }
