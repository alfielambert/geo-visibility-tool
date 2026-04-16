"""
Results logging — appends run results to results.csv.
"""

import csv
import os
from datetime import date

RESULTS_FILE = "results.csv"
FIELDNAMES = [
    "date", "brand", "prompt", "category", "llm_model",
    "brand_mentioned", "mention_position", "competitors_mentioned",
    "sentiment", "response_snippet",
]


def _ensure_file():
    if not os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
            writer.writeheader()


def log_result(
    brand: str,
    prompt: str,
    category: str,
    model: str,
    detection: dict,
    response: str,
):
    """Append a single result row to results.csv."""
    _ensure_file()
    with open(RESULTS_FILE, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writerow({
            "date": date.today().isoformat(),
            "brand": brand,
            "prompt": prompt,
            "category": category,
            "llm_model": model,
            "brand_mentioned": detection["brand_mentioned"],
            "mention_position": detection["mention_position"] or "",
            "competitors_mentioned": ", ".join(detection["competitors_mentioned"]),
            "sentiment": detection["sentiment"],
            "response_snippet": response[:200].replace("\n", " "),
        })


def load_all_results() -> list[dict]:
    """Load all historical results from results.csv."""
    if not os.path.exists(RESULTS_FILE):
        return []
    with open(RESULTS_FILE, "r") as f:
        reader = csv.DictReader(f)
        return list(reader)
