/**
 * LLM-assisted response parser.
 * Takes a raw AI engine response and extracts structured observations
 * matching the canonical ParserOutputSchema.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ParserOutputSchema,
  type ParserOutput,
  type BrandVisibility,
  type CompetitionAndCitations,
  type RecommendationInputs,
} from "../validation/schemas";

export const PARSER_VERSION = "1.0.0";

interface ParseInput {
  projectId: string;
  promptId: string;
  promptText: string;
  clusterKey: string;
  engine: string;
  runId: string;
  runTimestamp: string;
  region: string;
  language: string;
  rawResponseText: string;
  brandName: string;
  brandDomain: string;
  knownCompetitors: string[];
}

interface ParseResult {
  success: boolean;
  data: ParserOutput | null;
  error: string | null;
  parserVersion: string;
}

const EXTRACTION_PROMPT = `You are a structured data extraction system. Your job is to analyze an AI assistant's response to a prompt and extract visibility data about a specific brand.

## Brand Information
- Brand name: {{BRAND_NAME}}
- Brand domain: {{BRAND_DOMAIN}}
- Brand aliases to detect: {{BRAND_NAME}}

## Known Competitors
{{KNOWN_COMPETITORS}}

## The Original Prompt
{{PROMPT_TEXT}}

## The AI Response to Analyze
{{RAW_RESPONSE}}

## Extraction Instructions

Analyze the response above and extract the following as a JSON object. Be precise and evidence-based.

### brand_visibility
- brand_mentioned: Was {{BRAND_NAME}} mentioned? (boolean)
- brand_display_name: Exact name used in the response, or null if not mentioned
- brand_position: If tools/products are listed or ranked, what position is the brand? (1-indexed, null if not in a list)
- brand_mention_count: How many times is the brand mentioned? (integer)
- brand_is_primary_recommendation: Is the brand the #1 or primary recommendation? (boolean)
- brand_mention_strength: "none" | "weak" (passing mention) | "moderate" (discussed with some detail) | "strong" (featured prominently)
- brand_sentiment: "positive" | "neutral" | "mixed" | "negative" | "not_applicable"
- brand_summary: One sentence summary of how the brand appears in the response, or null

### competition_and_citations
- competitors_mentioned: Array of {name, position (nullable int), mention_strength, sentiment} for each competitor/tool mentioned
- competitor_count: Total number of competitors/tools mentioned (integer)
- citations_present: Are any URLs or sources cited? (boolean)
- cited_domains: Array of domains cited (e.g. ["docs.langchain.com", "pinecone.io"])
- cited_urls: Array of full URLs cited
- cited_page_types: Array of page types for cited URLs: "homepage" | "docs" | "blog" | "comparison" | "landing_page" | "pricing" | "api_reference" | "case_study" | "faq" | "glossary" | "unknown"
- third_party_roundup_present: Does the response cite a third-party comparison/roundup article? (boolean)
- comparison_style_answer: Is the response structured as a comparison of multiple tools? (boolean)
- answer_format: "tool_list" | "comparison" | "narrative" | "step_by_step" | "definition" | "mixed" | "unknown"
- brand_url_cited: Is a URL from {{BRAND_DOMAIN}} cited? (boolean)
- brand_page_cited: The specific brand URL cited, or null

### recommendation_inputs
- brand_positioning_detected: Array of positioning themes detected for the brand (e.g. ["knowledge layer", "agent alignment"])
- missing_capabilities_or_themes: Array of themes/capabilities present in competitor descriptions but absent from brand description
- dominant_themes_in_answer: Array of major themes in the overall response
- reason_brand_not_included: If brand not mentioned, why? "brand_unknown" | "competitors_better_match" | "insufficient_category_association" | "lack_of_cited_content" | "prompt_too_broad" | "unclear" | null
- reason_brand_included: If brand mentioned, why? "strong_category_match" | "clear_positioning" | "relevant_cited_content" | "brand_awareness" | "prompt_alignment" | "unclear" | null
- content_opportunity_type: Suggested content type, or null
- content_opportunity_summary: One sentence describing the content opportunity, or null
- recommended_page_type: "homepage" | "docs" | "blog" | "comparison" | "landing_page" | "pricing" | "api_reference" | "case_study" | "faq" | "glossary" | "unknown" | null
- recommended_topic_title: Suggested title for the content opportunity, or null
- confidence_score: Your confidence in this extraction (0.0-1.0)

Respond with ONLY valid JSON matching this structure. No markdown, no explanation.`;

export async function parseResponse(input: ParseInput): Promise<ParseResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openRouterKey && !anthropicKey) {
    return {
      success: false,
      data: null,
      error: "No API key set for parsing — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY",
      parserVersion: PARSER_VERSION,
    };
  }

  const prompt = EXTRACTION_PROMPT
    .replaceAll("{{BRAND_NAME}}", input.brandName)
    .replaceAll("{{BRAND_DOMAIN}}", input.brandDomain)
    .replace("{{KNOWN_COMPETITORS}}", input.knownCompetitors.join(", "))
    .replace("{{PROMPT_TEXT}}", input.promptText)
    .replace("{{RAW_RESPONSE}}", input.rawResponseText);

  try {
    let text: string;

    if (openRouterKey) {
      // Use OpenRouter (OpenAI-compatible API)
      const client = new OpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      const response = await client.chat.completions.create({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      text = response.choices[0]?.message?.content ?? "";
    } else {
      // Use direct Anthropic API
      const client = new Anthropic({ apiKey: anthropicKey! });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    // Strip markdown code fences if present (LLMs often wrap JSON in ```json ... ```)
    let jsonText = text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    // Parse the JSON response
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Parser returned invalid JSON:", jsonText.slice(0, 500));
      return {
        success: false,
        data: null,
        error: `Invalid JSON from parser: ${jsonText.slice(0, 200)}`,
        parserVersion: PARSER_VERSION,
      };
    }

    // Assemble full parser output
    const fullOutput = {
      project_id: input.projectId,
      prompt_id: input.promptId,
      prompt_text: input.promptText,
      prompt_cluster: input.clusterKey,
      engine: input.engine,
      run_id: input.runId,
      run_timestamp: input.runTimestamp,
      region: input.region,
      language: input.language,
      raw_response: input.rawResponseText,
      brand_visibility: parsed.brand_visibility as BrandVisibility,
      competition_and_citations:
        parsed.competition_and_citations as CompetitionAndCitations,
      recommendation_inputs:
        parsed.recommendation_inputs as RecommendationInputs,
    };

    // Validate with Zod
    const validated = ParserOutputSchema.safeParse(fullOutput);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.error("Parser output validation failed:", issues);
      return {
        success: false,
        data: null,
        error: `Validation failed: ${issues}`,
        parserVersion: PARSER_VERSION,
      };
    }

    return {
      success: true,
      data: validated.data,
      error: null,
      parserVersion: PARSER_VERSION,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parser error";
    console.error("Parser execution failed:", message);
    return {
      success: false,
      data: null,
      error: message,
      parserVersion: PARSER_VERSION,
    };
  }
}
