# Claude Code Prompt: GEOYA CrowdReply-Style Diagnostic Layer

---

## Context

I'm enhancing an existing Python project called GEOYA (an LLM visibility tracker) with diagnostic and site-audit features inspired by CrowdReply. There's a detailed spec at `geoya-crowdreply-enhancement.md` in this directory.

The existing codebase lives in `GEOYA/llm-visibility-tracker/` and already works for measuring visibility. I need you to build on top of it without breaking the existing weekly cron flow.

## Task

Read `geoya-crowdreply-enhancement.md` for the full spec, then implement the following:

### 1. New module: `diagnostic_analyzer.py`
- For each prompt where the target brand was NOT mentioned but competitors WERE, call an LLM to analyze why
- **Per-LLM diagnosis:** Include the model name (GPT-4o, Claude Sonnet) in the diagnostic prompt so the analyzer can flag model-specific biases
- Use the diagnostic prompt from the spec (updated with per-LLM analysis) to get structured JSON back
- Return a list of diagnosis objects with: prompt, category, model, competitors_mentioned, diagnosis, content_gap, recommended_action, priority, confidence, model_bias
- Use the existing `llm_runner.py` infrastructure (OpenRouter) for the diagnostic LLM calls
- Keep it efficient — one diagnostic call per gap, not per prompt
- Aggregate findings by model: "Claude misses us because X, GPT-4o misses us because Y"

### 2. New module: `content_recommender.py`
- Aggregates diagnostic findings into ranked content recommendations
- `aggregate_recommendations(diagnostics)` → ranked list of content bets
- `generate_content_brief(title, gap_analysis)` → generates a short content brief per recommendation
- Should be callable from both CLI and the weekly email script

### 3. New module: `site_audit.py`
- Lightweight audit of oiya.ai for AEO-specific signals
- Check: entity clarity, comparison pages, citation signals, competitor naming, category coverage
- **Social signal analysis (NEW):** For each gap category, search Reddit (r/MachineLearning, r/LocalLLaMA), LinkedIn, HN, GitHub for Oiya vs competitor presence on relevant topics. Use `httpx` to search:
  - Reddit: `reddit.com/search?q=oiya+"knowledge+layer"`
  - HN: `hn.algolia.com/api/v1/search?query=oiya`
  - LinkedIn: `linkedin.com/search/all?keywords=oiya`
  - Compare results to competitors' social presence on same topics
- Use `httpx` to fetch and analyze pages
- Return scored results with specific findings per check
- No external API needed — just text analysis of fetched HTML and social search results

### 4. New config: `oyia_assets.json`
- List Oiya's known web pages, value prop, and target competitors
- Used by both the diagnostic analyzer and site audit

### 5. Modify `run.py`
- Add `--diagnose` flag: after running prompts, analyze gaps
- Add `--audit` flag: run site audit
- Both opt-in, not part of default run

### 6. Modify `report.py`
- Accept diagnostic results as optional input
- Add "Why We Missed" section to the report when diagnostics are available
- Add "Site Audit" section when audit results are available
- Keep existing sections working

### 7. Update `requirements.txt`
- Add `httpx`

### 8. Update `README.md`
- Document the new features and CLI flags

## Constraints

- Don't break the existing weekly cron flow (`python run.py` without flags must work exactly as before)
- Follow the existing code style (Python 3.14, type hints, docstrings)
- The existing modules (`llm_runner.py`, `brand_detection.py`, `results_logger.py`) should NOT be modified unless absolutely necessary
- Site audit should handle failures gracefully (if oiya.ai is down, log it, don't crash)
- Diagnostic LLM calls should handle failures too (log and skip, don't crash the run)

## Working Directory

`/home/jared/.openclaw/workspace-miles/GEOYA/llm-visibility-tracker/`

The spec file is at `/home/jared/.openclaw/workspace-miles/GEOYA/geoya-crowdreply-enhancement.md`

---

Start by reading the spec, then read each existing file to understand the codebase. Then implement the changes one module at a time, testing as you go.
