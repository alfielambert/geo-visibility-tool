# GEOYA Enhancement: CrowdReply-Style Diagnostic & Remediation Layer

## Goal

GEOYA currently measures LLM visibility (the "what") but doesn't explain "why" or "what to do about it." This enhancement adds a **diagnostic analysis layer** inspired by CrowdReply's features — but focused specifically on AI/LLM visibility, not traditional SEO.

**Target:** When GEOYA runs, it should produce actionable diagnostic insights about *why* Oiya was or wasn't mentioned, what competitors said that made them more citable, and what specific content changes would improve visibility.

---

## Architecture Overview

Add three new modules to `GEOYA/llm-visibility-tracker/`:

### 1. `diagnostic_analyzer.py` — Why Did We Miss?

For each prompt where Oiya was **not** mentioned but competitors were, use an LLM to analyze:

- **What the competitors' responses actually contained** that made them citable (specific facts, URLs, structured data, comparison tables)
- **What was missing from Oiya's web presence** that caused the gap (e.g., no comparison page, no "best X" listicle, no definitive guide)
- **The specific content gap** — what page/article would have made Oiya mentionable here

**Input:** The prompt, the LLM's response, the competitors mentioned, and a summary of Oiya's known web assets (passed from a config).

**Output per gap:**
```python
{
    "prompt": "...",
    "category": "comparison",
    "competitors_mentioned": ["Mem0", "Zep"],
    "diagnosis": "LLM cited Mem0 and Zep because both have dedicated 'agent memory vs X' comparison pages. Oiya has no comparison page covering these competitors.",
    "content_gap": "Missing 'Oiya vs Mem0' and 'Oiya vs Zep' comparison pages",
    "recommended_action": "Create comparison pages: 'Oiya vs Mem0: Agent Knowledge Layers Compared', 'Oiya vs Zep: Persistent Memory for AI Agents'",
    "priority": "high",  # based on category and frequency
    "confidence": 0.85
}
```

**LLM prompt for diagnosis:**
```
You are an AI search visibility analyst. Below is a prompt that was asked of an LLM, and the LLM's response. Oiya (oiya.ai) was NOT mentioned, but competitors were.

Prompt: {prompt}
LLM Response: {response}
Competitors mentioned: {competitors}
Oiya's value proposition: A living, self-updating knowledge layer for AI agents. Structured content that compounds over time.

Analyze WHY Oiya was not mentioned. What specifically did the competitors have that made them citable? What would Oiya need to be mentioned in this context?

Respond in JSON:
{
  "why_competitors_won": "What made them citable",
  "what_oyia_is_missing": "Specific gap in Oiya's content/presence",
  "recommended_content": "Specific page/article that would fix this",
  "confidence": 0-1
}
```

### 2. `content_recommender.py` — What Should We Build?

Aggregates diagnostic findings into prioritized content recommendations. This replaces the current static content suggestions in `geoya-weekly-email.sh` with dynamic, data-driven recommendations.

**Functions:**
- `aggregate_recommendations()` — Takes all diagnostics from a run and produces ranked content bets
- `prioritize()` — Scores recommendations by: category visibility gap severity, competitor dominance, strategic alignment with Oiya positioning
- `generate_content_brief(title, gap_analysis)` — Generates a content brief for each recommended piece

**Output:** A ranked list of content recommendations with briefs, replacing the current hardcoded suggestions in the email script.

### 3. `site_audit.py` — What's Wrong With Our Site?

Lightweight version of CrowdReply's site audit. Checks Oiya's web presence for AEO-specific issues:

**Checks:**
1. **Entity clarity** — Does oiya.ai clearly state what it is in the first 200 words? (scrapes homepage)
2. **Comparison pages** — Does oiya.ai have pages comparing itself to each tracked competitor?
3. **"Best X" listicle presence** — Are there pages where Oiya could be the answer to "best tools for..." queries?
4. **Category coverage** — Does oiya.ai have content that would make it mentionable for each prompt category?
5. **Citation signals** — Does the site have clear, definitive statements that LLMs would cite? (e.g., "Oiya is the leading knowledge layer for AI agents")
6. **Competitor naming** — Does oiya.ai mention its own competitors by name? (LLMs cite brands that appear in comparison contexts)

**Implementation:**
- Use `httpx` to fetch pages from oiya.ai
- Apply regex/text analysis to check for signals
- No external API needed — this is lightweight content analysis

**Output:**
```python
{
    "entity_clarity": {"score": 0.7, "finding": "Homepage mentions 'knowledge layer' but doesn't explicitly define it in the first paragraph"},
    "comparison_pages": {"score": 0.2, "missing": ["Mem0", "Zep", "Hyperspell", "LangChain"]},
    "citation_signals": {"score": 0.5, "finding": "No superlative or definitive statements found on homepage"},
    "competitor_naming": {"score": 0.3, "finding": "Only Mem0 mentioned on site; Zep, Hyperspell, Egregore not referenced"},
    "overall_audit_score": 0.42,
    "recommendations": ["...", "..."]
}
```

---

## Per-LLM Diagnosis (Fred's Insight #1)

**Key insight:** "Each LLM is different." GPT-4o, Claude Sonnet, Gemini, etc. each have different training data cutoffs, citation behaviours, and source preferences. We should diagnose per-LLM, not just per-prompt.

**What to add to `diagnostic_analyzer.py`:**
- The diagnostic prompt should include the **model name** so the analyzer can factor in model-specific behaviours (e.g., Claude is more likely to cite docs, GPT-4o more likely to cite well-known brands)
- Output should include a `model_bias` field: "This model tends to cite X type of sources" 
- The `content_recommender.py` should aggregate diagnostics by model: "Claude misses us because Y, GPT-4o misses us because Z"
- This helps target content per-LLM: if GPT-4o misses us because it prefers blog posts, while Claude misses us because it prefers docs, we build both

**Updated diagnostic prompt:**
```
You are an AI search visibility analyst. Below is a prompt that was asked of an LLM, and the LLM's response. Oiya (oiya.ai) was NOT mentioned, but competitors were.

Prompt: {prompt}
LLM Response: {response}
Model used: {model} (e.g., GPT-4o, Claude Sonnet)
Competitors mentioned: {competitors}
Oiya's value proposition: A living, self-updating knowledge layer for AI agents. Structured content that compounds over time.

Analyze WHY Oiya was not mentioned. Consider:
1. What specifically did the competitors have that made them citable?
2. What would Oiya need to be mentioned in this context?
3. Is this model-specific? Does {model} have known biases toward certain types of sources or brands?

Respond in JSON:
{
  "why_competitors_won": "What made them citable",
  "what_oyia_is_missing": "Specific gap in Oiya's content/presence",
  "recommended_content": "Specific page/article that would fix this",
  "model_bias": "Is this specific to how this model behaves?",
  "confidence": 0-1
}
```

---

## Social Signal Analysis (Fred's Insight #2)

**Key insight:** "AI search is SEO + social signals." LLMs don't just crawl websites — they cite information from Reddit threads, LinkedIn posts, Medium articles, GitHub discussions, Hacker News, etc. Competitors who are active on social platforms get cited more because the LLM's training data includes those signals.

**What to add to `site_audit.py`:**
New check: **Social signal presence** — for the top prompt categories where Oiya is missing, check if competitors have visible social content:

```
6. **Social signals** — For each gap category, check:
   - Does Oiya have Reddit posts in r/MachineLearning, r/LocalLLaMA, r/artificial answering these topics?
   - Does Oiya have LinkedIn posts about these topics?
   - Does Oiya have Medium/Hacker News/GitHub discussions on these topics?
   - Compare to competitors' social presence on the same topics
```

**Implementation for social signal check:**
- Use `httpx` to search Reddit (`reddit.com/search?q=site:oiya.ai+"knowledge+layer"`), LinkedIn (`linkedin.com/search/all?keywords=oiya+knowledge+layer`), andHN (`hn.algolia.com/api/v1/search?query=oiya`)
- Count results per topic vs competitors
- Flag gaps: "Competitor X has 15 Reddit posts about agent memory; Oiya has 0"
- This is lightweight — just searching, not crawling full content

**Updated `oyia_assets.json` should include social profiles:**
```json
{
  "homepage": "https://oiya.ai",
  "pages": [...],
  "social": {
    "linkedin": "https://linkedin.com/company/oiya",
    "reddit": null,
    "medium": null,
    "github": "https://github.com/lookc/oiya",
    "twitter": null
  },
  "value_prop": "A living, self-updating knowledge layer for AI agents",
  "target_competitors": ["Mem0", "Zep", "Hyperspell", "Egregore", "LangChain"]
}
```

**Output addition to site audit:**
```python
"social_signals": {
    "score": 0.1,
    "finding": "Oiya has minimal social presence on topics where competitors are active. Zep has 12 Reddit posts about agent memory; Mem0 has 8 LinkedIn posts about knowledge layers. Oiya has 0 social posts on these topics.",
    "recommendation": "Create Reddit posts in r/LocalLLaMA and r/MachineLearning about knowledge layers. Post LinkedIn content comparing Oiya to Mem0/Zep."
}
```

---

## Integration Points

### Modified `run.py`
- Add `--diagnose` flag: after running prompts, run diagnostic analysis on gaps
- Add `--audit` flag: run site audit against oiya.ai (includes social signal check)
- Both are opt-in (not part of the weekly cron) to keep cost low

### Modified `report.py`
- Accept diagnostic results and include them in the report
- New section: "Diagnostic Analysis" — why we missed, with specific recommendations
- New section: "Site Audit" — overall health score and fixes
- The existing "Priority Actions" section should be fed from diagnostic results, not hardcoded rules

### Modified `geoya-weekly-email.sh`
- Replace the inline Python content suggestions with a call to the new `content_recommender.py`
- Keep the Ahrefs data context as background intelligence (it's good)
- The email structure stays the same, but content suggestions become dynamic

### New Config: `oyia_assets.json`
A simple file listing Oiya's known web pages and their topics, so the diagnostic analyzer knows what exists:
```json
{
  "homepage": "https://oiya.ai",
  "pages": [
    {"url": "https://oiya.ai/docs", "topic": "documentation"},
    {"url": "https://oiya.ai/pricing", "topic": "pricing"}
  ],
  "value_prop": "A living, self-updating knowledge layer for AI agents",
  "target_competitors": ["Mem0", "Zep", "Hyperspell", "Egregore", "LangChain"]
}
```

---

## Technical Details

**Language:** Python 3.14 (existing)
**Dependencies:** Add `httpx` for site scraping. Keep using existing `openai` for diagnostic LLM calls.
**Cost:** Diagnostic analysis uses ~1 LLM call per gap (not per prompt), so maybe 5-15 calls per run vs 40 for visibility tracking. Budget: ~$0.05-0.15 extra per run.
**Performance:** Site audit takes ~3-5 seconds (fetching 5-10 pages).

**File structure after:**
```
GEOYA/llm-visibility-tracker/
├── run.py                  (modified: --diagnose, --audit flags)
├── llm_runner.py           (unchanged)
├── brand_detection.py      (unchanged)
├── results_logger.py       (unchanged)
├── report.py               (modified: includes diagnostics + audit)
├── diagnostic_analyzer.py  (NEW)
├── content_recommender.py  (NEW)
├── site_audit.py           (NEW)
├── oyia_assets.json        (NEW)
├── prompts.csv             (unchanged)
├── requirements.txt        (modified: add httpx)
└── README.md               (modified: document new features)
```

---

## What NOT to Build

- **Auto-remediation** — CrowdReply fixes sites automatically. We don't need this. Oiya's content team will act on recommendations.
- **Full crawl/crawler** — The site audit is lightweight (check key pages), not a full Spider. We're not building Screaming Frog.
- **Schema markup analysis** — Ahrefs data shows zero impact on AI citations. Skip it.
- **Traditional SEO metrics** — This is about AI/LLM visibility specifically, not Google rankings.

---

## Success Criteria

1. Running `python run.py --diagnose` produces specific, actionable reasons why Oiya was missed in each gap prompt
2. Running `python run.py --audit` produces a scored audit of oiya.ai's AEO readiness
3. The weekly report includes a "Why We Missed" section with diagnostic findings
4. Content suggestions in the email are now data-driven, not hardcoded
5. No breaking changes to existing weekly cron flow (diagnostics are opt-in)
