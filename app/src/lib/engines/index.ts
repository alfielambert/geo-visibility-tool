/**
 * Engine registry — creates and returns enabled engine adapters.
 * Supports direct API keys (OpenAI, Anthropic) or OpenRouter for both.
 */

import type { EngineAdapter } from "./types";
import { EngineName } from "./types";
import { OpenAIAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";
import { OpenRouterAdapter } from "./openrouter";

export function getEnabledEngines(): EngineAdapter[] {
  const engines: EngineAdapter[] = [];

  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (openRouterKey) {
    // Use OpenRouter to access both GPT-4o and Claude via a single key
    engines.push(
      new OpenRouterAdapter(openRouterKey, "openai/gpt-4o", EngineName.OPENAI)
    );
    engines.push(
      new OpenRouterAdapter(
        openRouterKey,
        "anthropic/claude-sonnet-4",
        EngineName.ANTHROPIC
      )
    );
  } else {
    // Fall back to direct API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      engines.push(new OpenAIAdapter(openaiKey));
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      engines.push(new AnthropicAdapter(anthropicKey));
    }
  }

  return engines;
}

export { EngineName };
export type { EngineAdapter } from "./types";
export type { EnginePromptInput, EngineRawResponse } from "./types";
