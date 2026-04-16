"""
Prompt runner module — sends prompts to OpenAI and Anthropic APIs.
"""

import os
import time
from openai import OpenAI
from anthropic import Anthropic


SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the user's question thoroughly. "
    "When recommending tools, APIs, or products, be specific — name actual "
    "companies and products, include URLs where possible, and explain the "
    "trade-offs between options."
)


def run_openai(prompt: str, model: str = "gpt-4o") -> str:
    """Run a prompt against OpenAI and return the response text."""
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1024,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"  [OpenAI error] {e}")
        return ""


def run_anthropic(prompt: str, model: str = "claude-sonnet-4-20250514") -> str:
    """Run a prompt against Anthropic and return the response text."""
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        print(f"  [Anthropic error] {e}")
        return ""


def run_prompt(prompt: str) -> list[dict]:
    """
    Run a single prompt against all configured LLMs.
    Returns a list of dicts: [{model, response}, ...]
    """
    results = []

    # OpenAI
    if os.environ.get("OPENAI_API_KEY"):
        print(f"  → GPT-4o ...")
        text = run_openai(prompt)
        if text:
            results.append({"model": "gpt-4o", "response": text})
        time.sleep(0.5)  # gentle rate limiting

    # Anthropic
    if os.environ.get("ANTHROPIC_API_KEY"):
        print(f"  → Claude Sonnet ...")
        text = run_anthropic(prompt)
        if text:
            results.append({"model": "claude-sonnet", "response": text})
        time.sleep(0.5)

    return results
