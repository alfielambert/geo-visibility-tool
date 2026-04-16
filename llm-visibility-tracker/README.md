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

## Files

| File | Purpose |
|------|---------|
| `run.py` | CLI entry point |
| `llm_runner.py` | Sends prompts to OpenAI & Anthropic |
| `brand_detection.py` | Analyses responses for mentions & sentiment |
| `results_logger.py` | Appends results to CSV |
| `report.py` | Generates markdown dashboard |
| `prompts.csv` | Your prompt library (edit this) |
| `results.csv` | Raw results (auto-generated, append-only) |
| `latest_report.md` | Summary dashboard (auto-generated) |

## Cost Estimate

Each full run with 20 prompts × 2 models = 40 API calls. At roughly ~800 tokens per response, that's about $0.10–0.20 per run depending on current pricing.
