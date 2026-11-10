/**
 * Seed script — populates the database with initial LookC project data.
 * Run: npx tsx src/lib/db/seed.ts
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({ url: "file:./dev.db" });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ─── Project ──────────────────────────────────────────────────────
  const projectId = crypto.randomUUID();
  await db.insert(schema.projects).values({
    id: projectId,
    name: "LookC",
    slug: "lookc",
    domain: "lookc.com",
    brandName: "LookC",
    status: "active",
  });
  console.log("  ✅ Project: LookC");

  // ─── Competitors ──────────────────────────────────────────────────
  const competitorData = [
    { name: "LangChain", domain: "langchain.com" },
    { name: "LlamaIndex", domain: "llamaindex.ai" },
    { name: "Clearbit", domain: "clearbit.com" },
    { name: "Apollo", domain: "apollo.io" },
    { name: "ZoomInfo", domain: "zoominfo.com" },
    { name: "Crunchbase", domain: "crunchbase.com" },
    { name: "PitchBook", domain: "pitchbook.com" },
    { name: "Diffbot", domain: "diffbot.com" },
    { name: "Clay", domain: "clay.com" },
    { name: "Cognism", domain: "cognism.com" },
    { name: "Lusha", domain: "lusha.com" },
    { name: "People Data Labs", domain: "peopledatalabs.com" },
    { name: "Bright Data", domain: "brightdata.com" },
    { name: "Proxycurl", domain: "proxycurl.com" },
    { name: "FullContact", domain: "fullcontact.com" },
    { name: "Harmonic", domain: "harmonic.ai" },
    { name: "Coresignal", domain: "coresignal.com" },
    { name: "Mem0", domain: "mem0.ai" },
    { name: "Zep", domain: "getzep.com" },
    { name: "Pinecone", domain: "pinecone.io" },
    { name: "Weaviate", domain: "weaviate.io" },
    { name: "Guardrails AI", domain: "guardrailsai.com" },
    { name: "Letta", domain: "letta.com" },
  ];

  for (const c of competitorData) {
    await db.insert(schema.competitors).values({
      projectId,
      name: c.name,
      domain: c.domain,
    });
  }
  console.log(`  ✅ Competitors: ${competitorData.length} added`);

  // ─── Prompt Clusters ──────────────────────────────────────────────
  const clusters = [
    {
      key: "agent_knowledge_layers",
      label: "Agent Knowledge Layers",
      description:
        "How AI agents access, structure, and use organisational knowledge.",
    },
    {
      key: "agent_memory_systems",
      label: "Agent Memory Systems",
      description:
        "How AI agents remember context across sessions and interactions.",
    },
    {
      key: "alignment_with_company_context",
      label: "Alignment with Company Context",
      description:
        "How AI agents stay aligned with internal company knowledge and policies.",
    },
    {
      key: "data_connectors_for_agents",
      label: "Data Connectors for Agents",
      description:
        "APIs and integrations that feed external data into AI agents.",
    },
    {
      key: "agent_governance_and_safety",
      label: "Agent Governance and Safety",
      description:
        "Oversight, guardrails, and safety mechanisms for AI agents.",
    },
    {
      key: "agent_learning_systems",
      label: "Agent Learning Systems",
      description:
        "How AI agents learn, adapt, and improve over time.",
    },
    {
      key: "general_agent_infrastructure",
      label: "General Agent Infrastructure",
      description:
        "Core infrastructure, orchestration, and tooling for building AI agents.",
    },
    {
      key: "brand_awareness",
      label: "Brand Awareness",
      description:
        "Direct brand queries and general awareness of LookC in the market.",
    },
  ];

  const clusterIds: Record<string, string> = {};
  for (const c of clusters) {
    const id = crypto.randomUUID();
    clusterIds[c.key] = id;
    await db.insert(schema.promptClusters).values({
      id,
      projectId,
      key: c.key,
      label: c.label,
      description: c.description,
    });
  }
  console.log(`  ✅ Prompt clusters: ${clusters.length} added`);

  // ─── Prompts ──────────────────────────────────────────────────────
  const promptData: Array<{
    cluster: string;
    text: string;
    weight: number;
  }> = [
    // Agent Knowledge Layers
    {
      cluster: "agent_knowledge_layers",
      text: "What tools help AI agents access company knowledge bases in real time?",
      weight: 1.25,
    },
    {
      cluster: "agent_knowledge_layers",
      text: "How do I give my AI agent access to structured company data?",
      weight: 1.0,
    },
    {
      cluster: "agent_knowledge_layers",
      text: "What is a knowledge layer for AI agents and which products offer this?",
      weight: 1.25,
    },
    {
      cluster: "agent_knowledge_layers",
      text: "Best APIs for feeding company intelligence into LLM-based agents",
      weight: 1.0,
    },

    // Agent Memory Systems
    {
      cluster: "agent_memory_systems",
      text: "What tools help AI agents maintain memory across conversations?",
      weight: 1.0,
    },
    {
      cluster: "agent_memory_systems",
      text: "How can I give my AI agent long-term memory about companies it has researched?",
      weight: 1.25,
    },
    {
      cluster: "agent_memory_systems",
      text: "Compare memory solutions for AI agents: vector databases vs knowledge APIs",
      weight: 1.0,
    },

    // Alignment with Company Context
    {
      cluster: "alignment_with_company_context",
      text: "How do companies keep AI agents aligned with internal knowledge?",
      weight: 1.25,
    },
    {
      cluster: "alignment_with_company_context",
      text: "What APIs help ensure an AI agent's responses reflect our company's data?",
      weight: 1.0,
    },
    {
      cluster: "alignment_with_company_context",
      text: "How do I prevent my AI agent from hallucinating about company data?",
      weight: 1.0,
    },

    // Data Connectors for Agents
    {
      cluster: "data_connectors_for_agents",
      text: "What are the best company data APIs for AI agent integrations?",
      weight: 1.25,
    },
    {
      cluster: "data_connectors_for_agents",
      text: "Which APIs can I use to enrich company data for my AI agent?",
      weight: 1.25,
    },
    {
      cluster: "data_connectors_for_agents",
      text: "How can I connect my AI agent to live company databases?",
      weight: 1.0,
    },
    {
      cluster: "data_connectors_for_agents",
      text: "What tools let AI agents pull real-time data about any company?",
      weight: 1.0,
    },

    // Agent Governance and Safety
    {
      cluster: "agent_governance_and_safety",
      text: "How do I add guardrails to an AI agent that accesses company data?",
      weight: 0.75,
    },
    {
      cluster: "agent_governance_and_safety",
      text: "What tools exist for AI agent governance and oversight?",
      weight: 0.75,
    },

    // Agent Learning Systems
    {
      cluster: "agent_learning_systems",
      text: "How can AI agents learn from new company data over time?",
      weight: 1.0,
    },
    {
      cluster: "agent_learning_systems",
      text: "What tools help AI agents adapt to changing company information?",
      weight: 1.0,
    },

    // General Agent Infrastructure
    {
      cluster: "general_agent_infrastructure",
      text: "What are the best tools for building AI agents in 2025?",
      weight: 1.0,
    },
    {
      cluster: "general_agent_infrastructure",
      text: "Compare the top AI agent frameworks and infrastructure tools",
      weight: 1.0,
    },
    {
      cluster: "general_agent_infrastructure",
      text: "What APIs do AI agent developers use most for company research?",
      weight: 1.25,
    },

    // Brand Awareness
    {
      cluster: "brand_awareness",
      text: "What is LookC and what does it do?",
      weight: 1.25,
    },
    {
      cluster: "brand_awareness",
      text: "Is LookC a good API for company intelligence?",
      weight: 1.25,
    },
    {
      cluster: "brand_awareness",
      text: "LookC vs Clearbit vs Apollo — which is best for AI agents?",
      weight: 1.0,
    },
    {
      cluster: "brand_awareness",
      text: "What do people say about LookC for company data enrichment?",
      weight: 0.75,
    },
  ];

  for (const p of promptData) {
    await db.insert(schema.prompts).values({
      projectId,
      clusterId: clusterIds[p.cluster],
      promptText: p.text,
      strategicWeight: p.weight,
      language: "en",
      region: "uk",
      enabled: true,
    });
  }
  console.log(`  ✅ Prompts: ${promptData.length} added`);

  console.log("\n🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
