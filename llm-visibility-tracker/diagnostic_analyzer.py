"""
Diagnostic analyzer — explains why Oiya was missed in LLM responses.
"""

import json
import os
import time

from openai import OpenAI
from anthropic import Anthropic


DIAGNOSTIC_PROMPT = """\
You are an AI search visibility analyst. A prompt was asked of {model}, and Oiya (oiya.ai) was NOT mentioned, but competitors were.

Prompt: {prompt}
LLM Response: {response}
Model used: {model}
Competitors mentioned: {competitors}
Oiya's value proposition: {value_prop}

Analyze WHY Oiya was not mentioned. Consider:
1. What specifically did the competitors have that made them citable?
2. What would Oiya need to be mentioned in this context?
3. Is this model-specific? Does {model} have known biases toward certain types of sources or brands?

Respond in JSON only, no other text:
{{
  "why_competitors_won": "What made them citable",
  "what_oiya_is_missing": "Specific gap in Oiya's content/presence",
  "recommended_content": "Specific page/article that would fix this",
  "model_bias": "Any model-specific behaviour that explains the gap, or null",
  "confidence": 0.0
}}"""


def _call_diagnostic_llm(prompt_text: str) -> str | None:
    """Call an LLM for diagnostic analysis. Uses gpt-4o-mini if available, else claude-haiku."""
    if os.environ.get("OPENAI_API_KEY"):
        try:
            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt_text}],
                max_tokens=512,
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"  [diagnostic/openai error] {e}")

    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt_text}],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            print(f"  [diagnostic/anthropic error] {e}")

    return None


def analyze_gaps(
    gap_items: list[dict],
    value_prop: str = "A living, self-updating knowledge layer for AI agents. Structured content that compounds over time.",
) -> list[dict]:
    """
    Analyze each gap (prompt where Oiya was missed but competitors won).

    Args:
        gap_items: list of {prompt, category, model, competitors_mentioned, response}
        value_prop: Oiya's value proposition string

    Returns:
        list of diagnosis dicts with keys:
        prompt, category, model, competitors_mentioned, diagnosis,
        content_gap, recommended_action, priority, confidence, model_bias
    """
    diagnostics = []
    print(f"\n🔬 Analyzing {len(gap_items)} visibility gap(s)...")

    for item in gap_items:
        competitors_str = ", ".join(item["competitors_mentioned"])
        prompt_text = DIAGNOSTIC_PROMPT.format(
            prompt=item["prompt"],
            response=item["response"][:1500],
            model=item["model"],
            competitors=competitors_str,
            value_prop=value_prop,
        )

        print(f"  → [{item['model']}] \"{item['prompt'][:60]}...\"")
        raw = _call_diagnostic_llm(prompt_text)
        time.sleep(0.5)

        if not raw:
            print("    ⚠️  Skipped — no LLM response")
            continue

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            print("    ⚠️  Skipped — invalid JSON response")
            continue

        diagnostics.append({
            "prompt": item["prompt"],
            "category": item["category"],
            "model": item["model"],
            "competitors_mentioned": item["competitors_mentioned"],
            "diagnosis": parsed.get("why_competitors_won", ""),
            "content_gap": parsed.get("what_oiya_is_missing", ""),
            "recommended_action": parsed.get("recommended_content", ""),
            "priority": _infer_priority(item["category"]),
            "confidence": float(parsed.get("confidence", 0.0)),
            "model_bias": parsed.get("model_bias") or "",
        })

    print(f"  ✅ {len(diagnostics)}/{len(gap_items)} diagnoses complete")
    return diagnostics


def _infer_priority(category: str) -> str:
    if category.lower() in {"comparison", "buyer-intent"}:
        return "high"
    return "medium"
