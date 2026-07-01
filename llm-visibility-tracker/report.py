"""
Summary dashboard — generates latest_report.md after each run.
"""

from collections import Counter, defaultdict
from datetime import date

from results_logger import load_all_results
from content_recommender import aggregate_recommendations, generate_content_brief, summarize_by_model

REPORT_FILE = "latest_report.md"


def generate_report(
    diagnostics: list[dict] | None = None,
    audit_results: dict | None = None,
):
    """Generate a markdown summary report from all historical results."""
    rows = load_all_results()
    if not rows:
        _write("# LLM Visibility Report\n\nNo results yet. Run the tracker first.\n")
        return

    today = date.today().isoformat()

    # Split into current run vs previous runs
    current = [r for r in rows if r["date"] == today]
    previous = [r for r in rows if r["date"] != today]

    brands = sorted(set(r["brand"] for r in rows))
    models = sorted(set(r["llm_model"] for r in rows))

    lines = []
    lines.append(f"# LLM Visibility Report — {today}\n")

    # ---- Overall mention rate ----
    lines.append("## Mention Rate by Brand & LLM\n")
    for brand in brands:
        lines.append(f"### {brand}\n")
        lines.append("| Model | Mentioned | Total | Rate | Trend |")
        lines.append("|-------|-----------|-------|------|-------|")
        for model in models:
            cur = [r for r in current if r["brand"] == brand and r["llm_model"] == model]
            prev = [r for r in previous if r["brand"] == brand and r["llm_model"] == model]

            cur_mentioned = sum(1 for r in cur if r["brand_mentioned"] == "True")
            cur_total = len(cur)
            cur_rate = (cur_mentioned / cur_total * 100) if cur_total else 0

            prev_mentioned = sum(1 for r in prev if r["brand_mentioned"] == "True")
            prev_total = len(prev)
            prev_rate = (prev_mentioned / prev_total * 100) if prev_total else 0

            if prev_total == 0:
                trend = "—"
            elif cur_rate > prev_rate:
                trend = f"↑ +{cur_rate - prev_rate:.0f}pp"
            elif cur_rate < prev_rate:
                trend = f"↓ {cur_rate - prev_rate:.0f}pp"
            else:
                trend = "→ flat"

            lines.append(
                f"| {model} | {cur_mentioned} | {cur_total} | "
                f"{cur_rate:.0f}% | {trend} |"
            )
        lines.append("")

    # ---- Sentiment breakdown ----
    lines.append("## Sentiment Breakdown (Current Run)\n")
    for brand in brands:
        mentioned = [r for r in current if r["brand"] == brand and r["brand_mentioned"] == "True"]
        if not mentioned:
            lines.append(f"**{brand}**: No mentions to analyse.\n")
            continue
        sentiments = Counter(r["sentiment"] for r in mentioned)
        total = len(mentioned)
        parts = []
        for s in ["positive", "neutral", "negative"]:
            count = sentiments.get(s, 0)
            parts.append(f"{s}: {count}/{total} ({count/total*100:.0f}%)")
        lines.append(f"**{brand}**: {' · '.join(parts)}\n")

    # ---- Top competitor mentions ----
    lines.append("## Top Competitor Mentions (Current Run)\n")
    comp_counter = Counter()
    for r in current:
        comps = r["competitors_mentioned"]
        if comps:
            for c in comps.split(", "):
                c = c.strip()
                if c:
                    comp_counter[c] += 1

    if comp_counter:
        lines.append("| Competitor | Mentions |")
        lines.append("|------------|----------|")
        for comp, count in comp_counter.most_common(15):
            lines.append(f"| {comp} | {count} |")
        lines.append("")
    else:
        lines.append("No competitor mentions found.\n")

    # ---- Gaps: where competitors win and we don't show up ----
    lines.append("## Gaps — Prompts Where Competitors Win\n")
    lines.append(
        "These are prompts where your brand was **not** mentioned "
        "but competitors **were**.\n"
    )
    gap_found = False
    for brand in brands:
        gaps = [
            r for r in current
            if r["brand"] == brand
            and r["brand_mentioned"] == "False"
            and r["competitors_mentioned"]
        ]
        if gaps:
            gap_found = True
            lines.append(f"### {brand}\n")
            for r in gaps:
                lines.append(
                    f"- **[{r['llm_model']}]** \"{r['prompt']}\"\n"
                    f"  Competitors mentioned: {r['competitors_mentioned']}"
                )
            lines.append("")

    if not gap_found:
        lines.append("No gaps found — your brand appeared in all responses!\n")

    # ---- Priority actions ----
    lines.append("## Priority Actions\n")
    if diagnostics:
        recs = aggregate_recommendations(diagnostics)
        for i, rec in enumerate(recs, 1):
            lines.append(generate_content_brief(f"{i}. {rec['title']}", rec))
    else:
        actions = _generate_actions(brands, current, comp_counter)
        for i, action in enumerate(actions, 1):
            lines.append(f"{i}. {action}")
    lines.append("")

    # ---- Why We Missed (diagnostic analysis) ----
    if diagnostics:
        lines.append("## Why We Missed\n")
        lines.append(
            "Diagnostic analysis of prompts where competitors were cited but Oiya was not.\n"
        )

        # Per-model summary
        model_summaries = summarize_by_model(diagnostics)
        if model_summaries:
            lines.append("### Model-Specific Patterns\n")
            for model, summary in model_summaries.items():
                lines.append(f"**{model}:** {summary}\n")

        # Per-gap detail
        lines.append("### Gap Details\n")
        for d in diagnostics:
            comps = ", ".join(d["competitors_mentioned"])
            lines.append(
                f"**[{d['model']}] \"{d['prompt'][:80]}\"**\n\n"
                f"- Competitors cited: {comps}\n"
                f"- Why they won: {d['diagnosis']}\n"
                f"- Content gap: {d['content_gap']}\n"
                f"- Recommended action: {d['recommended_action']}\n"
                f"- Priority: {d['priority'].upper()} · Confidence: {d['confidence']:.0%}\n"
            )
            if d.get("model_bias"):
                lines.append(f"- Model bias: {d['model_bias']}\n")
            lines.append("")

    # ---- Site Audit ----
    if audit_results and "error" not in audit_results:
        lines.append("## Site Audit\n")
        overall = audit_results.get("overall_audit_score", 0)
        lines.append(f"**Overall AEO Score: {overall:.0%}**\n")

        checks = {
            "entity_clarity": "Entity Clarity",
            "comparison_pages": "Comparison Pages",
            "citation_signals": "Citation Signals",
            "competitor_naming": "Competitor Naming",
            "social_signals": "Social Signals",
        }

        lines.append("| Check | Score | Finding |")
        lines.append("|-------|-------|---------|")
        for key, label in checks.items():
            check = audit_results.get(key, {})
            score = check.get("score", 0)
            finding = check.get("finding", "—")
            bar = "🟢" if score >= 0.6 else ("🟡" if score >= 0.3 else "🔴")
            lines.append(f"| {label} | {bar} {score:.0%} | {finding} |")
        lines.append("")

        recs = audit_results.get("recommendations", [])
        if recs:
            lines.append("### Audit Recommendations\n")
            for i, rec in enumerate(recs, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")

    # ---- Run stats ----
    lines.append("---\n")
    lines.append(
        f"*Generated from {len(current)} prompt/model pairs "
        f"(today) and {len(previous)} historical results.*\n"
    )

    _write("\n".join(lines))
    print(f"\n📊 Report written to {REPORT_FILE}")


def _generate_actions(brands, current, comp_counter) -> list[str]:
    """Generate a short list of priority content actions."""
    actions = []

    for brand in brands:
        brand_rows = [r for r in current if r["brand"] == brand]
        mentioned = sum(1 for r in brand_rows if r["brand_mentioned"] == "True")
        total = len(brand_rows)
        rate = (mentioned / total * 100) if total else 0

        if rate < 30:
            actions.append(
                f"**Critical visibility gap for {brand}** — mentioned in only "
                f"{rate:.0f}% of prompts. Prioritise creating SEO content, "
                f"comparison pages, and integration guides that LLMs can index."
            )
        elif rate < 60:
            actions.append(
                f"**Moderate visibility for {brand}** ({rate:.0f}%). "
                f"Create more \"best X for Y\" and comparison content to "
                f"increase mention rate."
            )

        # Category-level gaps
        cat_gaps = defaultdict(int)
        cat_totals = defaultdict(int)
        for r in brand_rows:
            cat_totals[r["category"]] += 1
            if r["brand_mentioned"] == "False":
                cat_gaps[r["category"]] += 1

        for cat, gap_count in cat_gaps.items():
            total_cat = cat_totals[cat]
            if gap_count == total_cat:  # zero mentions in this category
                actions.append(
                    f"**Zero visibility in '{cat}' prompts for {brand}** — "
                    f"create targeted content for this query category."
                )

    # Top competitor to target
    if comp_counter:
        top_comp = comp_counter.most_common(1)[0]
        actions.append(
            f"**Top competitor: {top_comp[0]}** (mentioned {top_comp[1]} times). "
            f"Create direct comparison content: \"{brands[0]} vs {top_comp[0]}\"."
        )

    if not actions:
        actions.append("Looking good! Keep monitoring and iterating on content.")

    return actions


def _write(content: str):
    with open(REPORT_FILE, "w") as f:
        f.write(content)
