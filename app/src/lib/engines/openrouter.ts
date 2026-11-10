/**
 * OpenRouter engine adapter — routes to multiple models via OpenAI-compatible API.
 */

import OpenAI from "openai";
import type {
  EngineAdapter,
  EnginePromptInput,
  EngineRawResponse,
} from "./types";

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer the user's question thoroughly and accurately. If you mention specific tools, platforms, or services, explain why they are relevant. If you cite sources, include URLs where possible.`;

export class OpenRouterAdapter implements EngineAdapter {
  name: string;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, engineName: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = model;
    this.name = engineName;
  }

  async runPrompt(input: EnginePromptInput): Promise<EngineRawResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.promptText },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const choice = response.choices[0];
    const text = choice?.message?.content ?? "";

    return {
      text,
      payloadJson: JSON.stringify(response),
      citations: [],
      metadata: {
        model: response.model,
        tokensUsed: response.usage?.total_tokens ?? null,
        finishReason: choice?.finish_reason ?? null,
      },
    };
  }
}
