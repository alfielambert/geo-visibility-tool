#!/usr/bin/env python3
"""
LLM Visibility Tracker — CLI entry point.

Usage:
    python run.py              # Run all prompts
    python run.py --dry-run    # Parse prompts and show what would run (no API calls)
    python run.py --report     # Re-generate report from existing results.csv
"""

import argparse
import csv
import sys
import os

from dotenv import load_dotenv

load_dotenv()

from llm_runner import run_prompt
from brand_detection import detect_brand
from results_logger import log_result
from report import generate_report

PROMPTS_FILE = "prompts.csv"


def load_prompts() -> list[dict]:
    """Load prompts from prompts.csv."""
    if not os.path.exists(PROMPTS_FILE):
        print(f"❌ {PROMPTS_FILE} not found. Create it first.")
        sys.exit(1)
    with open(PROMPTS_FILE, "r") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main():
    parser = argparse.ArgumentParser(description="LLM Visibility Tracker")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show prompts without making API calls",
    )
    parser.add_argument(
        "--report", action="store_true",
        help="Re-generate report from existing results (no API calls)",
    )
    parser.add_argument(
        "--brand", type=str, default=None,
        help="Only run prompts for a specific brand",
    )
    parser.add_argument(
        "--category", type=str, default=None,
        help="Only run prompts for a specific category",
    )
    args = parser.parse_args()

    # Report-only mode
    if args.report:
        print("📊 Regenerating report from existing results...")
        generate_report()
        return

    prompts = load_prompts()

    # Filters
    if args.brand:
        prompts = [p for p in prompts if p["brand"].lower() == args.brand.lower()]
    if args.category:
        prompts = [p for p in prompts if p["category"].lower() == args.category.lower()]

    if not prompts:
        print("No prompts match your filters.")
        sys.exit(1)

    print(f"\n🔍 LLM Visibility Tracker")
    print(f"   {len(prompts)} prompts to run\n")

    if args.dry_run:
        for i, p in enumerate(prompts, 1):
            print(f"  {i:2d}. [{p['brand']}] [{p['category']}] {p['prompt']}")
        print(f"\n✅ Dry run complete. {len(prompts)} prompts loaded.")
        return

    # Check API keys
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    if not has_openai and not has_anthropic:
        print("❌ No API keys found. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY in .env")
        sys.exit(1)

    models_available = []
    if has_openai:
        models_available.append("GPT-4o")
    if has_anthropic:
        models_available.append("Claude Sonnet")
    print(f"   Models: {', '.join(models_available)}\n")

    # Run all prompts
    total = len(prompts) * len(models_available)
    done = 0

    for i, p in enumerate(prompts, 1):
        brand = p["brand"]
        prompt = p["prompt"]
        category = p["category"]

        print(f"[{i}/{len(prompts)}] {prompt[:80]}...")

        responses = run_prompt(prompt)

        for resp in responses:
            done += 1
            detection = detect_brand(brand, resp["response"])

            log_result(
                brand=brand,
                prompt=prompt,
                category=category,
                model=resp["model"],
                detection=detection,
                response=resp["response"],
            )

            status = "✅" if detection["brand_mentioned"] else "❌"
            pos = f" (pos #{detection['mention_position']})" if detection["mention_position"] else ""
            comps = f" | comps: {', '.join(detection['competitors_mentioned'][:3])}" if detection["competitors_mentioned"] else ""
            print(f"       {status} {resp['model']}{pos}{comps}")

    print(f"\n✅ Done — {done} results logged to results.csv")

    # Generate report
    generate_report()


if __name__ == "__main__":
    main()
