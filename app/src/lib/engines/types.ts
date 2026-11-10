/**
 * Engine adapter interface and shared types.
 * Each AI engine (OpenAI, Anthropic, Perplexity, etc.) implements EngineAdapter.
 */

export interface EnginePromptInput {
  promptText: string;
  promptId: string;
  projectId: string;
  brandName: string;
  brandDomain: string;
}

export interface EngineRawResponse {
  text: string;
  payloadJson: string | null;
  citations: string[];
  metadata: EngineResponseMetadata;
}

export interface EngineResponseMetadata {
  model: string;
  tokensUsed: number | null;
  finishReason: string | null;
}

export interface EngineAdapter {
  /** Unique engine identifier, e.g. "openai", "anthropic", "perplexity" */
  name: string;

  /** Execute a prompt and return the raw response */
  runPrompt(input: EnginePromptInput): Promise<EngineRawResponse>;
}

/** Engine names as constants */
export const EngineName = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  PERPLEXITY: "perplexity",
} as const;
export type EngineName = (typeof EngineName)[keyof typeof EngineName];
