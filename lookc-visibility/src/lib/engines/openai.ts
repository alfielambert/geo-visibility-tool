/**
 * OpenAI engine adapter — GPT-4o.
 */

import OpenAI from "openai";
import type {
  EngineAdapter,
  EnginePromptInput,
  EngineRawResponse,
} from "./types";
import { EngineName } from "./types";

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer the user's question thoroughly and accurately. If you mention specific tools, platforms, or services, explain why they are relevant. If you cite sources, include URLs where possible.`;

export class OpenAIAdapter implements EngineAdapter {
  name = EngineName.OPENAI;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
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
