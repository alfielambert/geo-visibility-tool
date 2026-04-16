/**
 * Anthropic engine adapter — Claude Sonnet.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  EngineAdapter,
  EnginePromptInput,
  EngineRawResponse,
} from "./types";
import { EngineName } from "./types";

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer the user's question thoroughly and accurately. If you mention specific tools, platforms, or services, explain why they are relevant. If you cite sources, include URLs where possible.`;

export class AnthropicAdapter implements EngineAdapter {
  name = EngineName.ANTHROPIC;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async runPrompt(input: EnginePromptInput): Promise<EngineRawResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: input.promptText }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    return {
      text,
      payloadJson: JSON.stringify(response),
      citations: [],
      metadata: {
        model: response.model,
        tokensUsed:
          (response.usage?.input_tokens ?? 0) +
          (response.usage?.output_tokens ?? 0),
        finishReason: response.stop_reason ?? null,
      },
    };
  }
}
