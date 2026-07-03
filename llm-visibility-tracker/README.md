# LLM Visibility Tracker

Track how Oiya shows up across AI search engines (GPT-4o, Claude Sonnet). A DIY alternative to paid LLM visibility tools.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up your API keys
cp .env.example .env
# Edit .env with your actual keys

# 3. Preview what will run
python run.py --dry-run

# 4. Run the tracker
python run.py

# 5. Check results
# → results.csv    (raw data, appends each run)
# → latest_report.md  (summary dashboard)
```

## How It Works

1. Reads prompts from `prompts.csv` (realistic customer queries)
2. Sends each prompt to GPT-4o and Claude Sonnet
3. Analyses each response for: brand mentions, position vs competitors, sentiment
4. Appends results to `results.csv`
5. Generates `latest_report.md` with mention rates, trends, gaps, and action items

## CLI Options

```bash
python run.py                     # Run all prompts
python run.py --dry-run           # Preview prompts, no API calls
python run.py --report            # Regenerate report from existing data
python run.py --brand Oiya        # Only run prompts for a specific brand
python run.py --category comparison  # Only run a specific category

# Diagnostic layer (opt-in, adds LLM calls ~$0.05–0.15 extra)
python run.py --diagnose          # After prompts, analyze each gap with LLM
python run.py --audit             # Run AEO site audit against oiya.ai
python run.py --diagnose --audit  # Both together
```

## Customising Prompts

Edit `prompts.csv` — columns are: `brand`, `prompt`, `category`.

Categories help you see which types of queries you're winning or losing. Suggested categories: `buyer-intent`, `how-to`, `comparison`, `discovery`.

## Adding More Brands

1. Add prompts to `prompts.csv` with the new brand name
2. Add brand aliases in `brand_detection.py` → `BRAND_ALIASES`
3. Add relevant competitors to `KNOWN_COMPETITORS` if needed

## Automating (Cron / n8n)

The script is a single CLI command with exit code 0 on success:

```bash
# Cron — run daily at 8am
0 8 * * * cd /path/to/llm-visibility-tracker && python run.py

# n8n — use an "Execute Command" node with:
#   Command: cd /path/to/llm-visibility-tracker && python run.py
```

## Diagnostic Layer

When you run `--diagnose`, GEOYA identifies every prompt where Oiya was missed but competitors were cited, then calls an LLM to explain why — per model. The report gains two new sections:

- **Why We Missed** — per-gap analysis with competitor advantage, content gap, and recommended action
- **Model-Specific Patterns** — how GPT-4o vs Claude Sonnet differ in citation behaviour towards Oiya

When you run `--audit`, GEOYA fetches oiya.ai and checks five AEO signals:

| Check | What it looks for |
|-------|-------------------|
| Entity clarity | Does the homepage define Oiya's category in the first 200 words? |
| Comparison pages | Does `/vs/<competitor>` exist for each tracked competitor? |
| Citation signals | Are there authority statements LLMs would cite? |
| Competitor naming | Are competitor names used on the site? |
| 'Best X' listicles | Are there "best X for Y" pages LLMs cite for discovery queries? |
| Category coverage | Does the site have content for each prompt category (buyer-intent, how-to, comparison, discovery)? |
| Social signals | HN + Reddit + LinkedIn post counts for Oiya vs top competitor |

LinkedIn social signals require a Lix API key — add `LIX_API_KEY=your_key` to `.env`. Without it, HN and Reddit are still checked. Get a key at [lix-it.com](https://lix-it.com).

## Configuring Oiya's Assets

Edit `oiya_assets.json` to update known pages, social profiles, and tracked competitors. The site audit and diagnostic analyzer both read this file.

## Files

| File | Purpose |
|------|---------|
| `run.py` | CLI entry point |
| `llm_runner.py` | Sends prompts to OpenAI & Anthropic |
| `brand_detection.py` | Analyses responses for mentions & sentiment |
| `results_logger.py` | Appends results to CSV |
| `report.py` | Generates markdown dashboard |
| `diagnostic_analyzer.py` | Explains why Oiya was missed (per LLM) |
| `content_recommender.py` | Aggregates diagnostics into ranked content bets |
| `site_audit.py` | Lightweight AEO audit of oiya.ai |
| `oiya_assets.json` | Oiya's pages, competitors, value prop config |
| `prompts.csv` | Your prompt library (edit this) |
| `results.csv` | Raw results (auto-generated, append-only) |
| `latest_report.md` | Summary dashboard (auto-generated) |

## Cost Estimate

| Mode | API calls | Estimated cost |
|------|-----------|----------------|
| Default run (20 prompts × 2 models) | 40 | $0.10–0.20 |
| `--diagnose` (per gap, uses gpt-4o-mini) | 5–15 extra | $0.05–0.15 extra |
| `--audit` | 0 (scraping only) | Free |
