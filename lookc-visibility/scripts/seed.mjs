/**
 * Seed script — populates the database with initial Oiya project data.
 * Run: node scripts/seed.mjs
 */

import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const client = createClient({ url: "file:./dev.db" });
const now = new Date().toISOString();

async function insert(table, values) {
  const cols = Object.keys(values);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  await client.execute({ sql, args: Object.values(values) });
}

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ─── Project ──────────────────────────────────────────────────────
  const projectId = randomUUID();
  await insert("projects", {
    id: projectId,
    name: "Oiya",
    slug: "oiya",
    domain: "oiya.ai",
    brand_name: "Oiya",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  console.log("  ✅ Project: Oiya (oiya.ai)");

  // ─── Competitors ──────────────────────────────────────────────────
  // Grouped by category for clarity. All tracked as flat list.
  const competitorData = [
    // Direct competitors — shared knowledge / context layers for agents
    { name: "Egregore", domain: "egregore.xyz", notes: "Direct competitor — shared cognition for teams and agents, persistent context" },
    { name: "Hyperspell", domain: "hyperspell.com", notes: "Direct competitor — memory & context layer for AI agents (YC F25)" },
    { name: "Edra", domain: "edra.ai", notes: "Direct competitor — converts operational data into executable knowledge for AI agents (Sequoia-backed)" },
    // Agent memory & context
    { name: "Mem0", domain: "mem0.ai", notes: "Agent memory/context" },
    { name: "Zep", domain: "getzep.com", notes: "Agent memory/context" },
    { name: "Letta", domain: "letta.com", notes: "Agent memory/context" },
    { name: "LangMem", domain: "langchain.com", notes: "Agent memory/context (LangChain project)" },
    // Agent frameworks
    { name: "LangChain", domain: "langchain.com", notes: "Agent framework" },
    { name: "LlamaIndex", domain: "llamaindex.ai", notes: "Agent framework" },
    { name: "CrewAI", domain: "crewai.com", notes: "Agent framework" },
    { name: "AutoGen", domain: "microsoft.github.io/autogen", notes: "Agent framework (Microsoft)" },
    // Vector DBs / RAG infrastructure
    { name: "Pinecone", domain: "pinecone.io", notes: "Vector DB / RAG infra" },
    { name: "Weaviate", domain: "weaviate.io", notes: "Vector DB / RAG infra" },
    { name: "Chroma", domain: "trychroma.com", notes: "Vector DB / RAG infra" },
    { name: "Qdrant", domain: "qdrant.tech", notes: "Vector DB / RAG infra" },
    // Knowledge management
    { name: "Notion AI", domain: "notion.so", notes: "Knowledge management" },
    { name: "Guru", domain: "getguru.com", notes: "Knowledge management" },
    { name: "Glean", domain: "glean.com", notes: "Knowledge management" },
    { name: "Tettra", domain: "tettra.com", notes: "Knowledge management" },
  ];

  for (const c of competitorData) {
    await insert("competitors", {
      id: randomUUID(),
      project_id: projectId,
      name: c.name,
      domain: c.domain,
      notes: c.notes || null,
      created_at: now,
      updated_at: now,
    });
  }
  console.log(`  ✅ Competitors: ${competitorData.length} added`);

  // ─── Prompt Clusters ──────────────────────────────────────────────
  const clusters = [
    { key: "agent_knowledge_layers", label: "Agent Knowledge Layers", description: "How AI agents access, structure, and use shared organisational knowledge." },
    { key: "agent_memory_systems", label: "Agent Memory Systems", description: "How AI agents remember context across sessions and interactions." },
    { key: "alignment_with_company_context", label: "Alignment with Company Context", description: "How AI agents stay aligned with internal company knowledge, policies, and context." },
    { key: "data_connectors_for_agents", label: "Data Connectors for Agents", description: "How agents connect to and stay in sync with internal data sources and knowledge bases." },
    { key: "agent_governance_and_safety", label: "Agent Governance and Safety", description: "Oversight, guardrails, and safety mechanisms for AI agents accessing company knowledge." },
    { key: "agent_learning_systems", label: "Agent Learning Systems", description: "How AI agents learn from and adapt to evolving company knowledge over time." },
    { key: "general_agent_infrastructure", label: "General Agent Infrastructure", description: "Core infrastructure, orchestration, and tooling for building AI agents." },
    { key: "brand_awareness", label: "Brand Awareness", description: "Direct brand queries and general awareness of Oiya in the market." },
  ];

  const clusterIds = {};
  for (const c of clusters) {
    const id = randomUUID();
    clusterIds[c.key] = id;
    await insert("prompt_clusters", {
      id,
      project_id: projectId,
      key: c.key,
      label: c.label,
      description: c.description,
      created_at: now,
      updated_at: now,
    });
  }
  console.log(`  ✅ Prompt clusters: ${clusters.length} added`);

  // ─── Prompts ──────────────────────────────────────────────────────
  // Oiya positioning: "A shared knowledge layer that keeps AI agents aligned with company context."
  // Prompts reflect buyer-intent, how-to, comparison, and discovery queries
  // that a potential customer would ask an LLM.
  const promptData = [
    // Agent Knowledge Layers
    { cluster: "agent_knowledge_layers", text: "What tools provide a shared knowledge layer for AI agents?", weight: 1.25 },
    { cluster: "agent_knowledge_layers", text: "How do I give multiple AI agents access to the same company knowledge base?", weight: 1.25 },
    { cluster: "agent_knowledge_layers", text: "What products let AI agents share a unified knowledge layer instead of each having their own?", weight: 1.25 },
    { cluster: "agent_knowledge_layers", text: "How do enterprises manage knowledge that AI agents need to access in real time?", weight: 1.0 },

    // Agent Memory Systems
    { cluster: "agent_memory_systems", text: "What tools help AI agents maintain persistent memory across conversations?", weight: 1.0 },
    { cluster: "agent_memory_systems", text: "How can I give my AI agent long-term memory that stays aligned with what our company actually knows?", weight: 1.25 },
    { cluster: "agent_memory_systems", text: "Compare approaches to agent memory: vector databases vs shared knowledge layers vs conversation history", weight: 1.0 },
    { cluster: "agent_memory_systems", text: "What's the difference between agent memory and a knowledge layer for AI agents?", weight: 1.0 },

    // Alignment with Company Context
    { cluster: "alignment_with_company_context", text: "How do companies keep AI agents aligned with internal knowledge?", weight: 1.25 },
    { cluster: "alignment_with_company_context", text: "What tools ensure AI agents always reflect our company's latest information?", weight: 1.25 },
    { cluster: "alignment_with_company_context", text: "How do I prevent my AI agent from hallucinating about company data?", weight: 1.0 },
    { cluster: "alignment_with_company_context", text: "What's the best way to ground AI agents in company-specific context?", weight: 1.0 },

    // Data Connectors for Agents
    { cluster: "data_connectors_for_agents", text: "How can I connect my AI agents to internal company knowledge bases and keep them in sync?", weight: 1.0 },
    { cluster: "data_connectors_for_agents", text: "What tools let AI agents pull from a shared knowledge layer that updates automatically?", weight: 1.25 },
    { cluster: "data_connectors_for_agents", text: "How do I feed internal company data into AI agents without rebuilding RAG pipelines for each one?", weight: 1.0 },

    // Agent Governance and Safety
    { cluster: "agent_governance_and_safety", text: "How do I add guardrails to AI agents that access company knowledge?", weight: 0.75 },
    { cluster: "agent_governance_and_safety", text: "What tools help ensure AI agents only use approved company information?", weight: 0.75 },
    { cluster: "agent_governance_and_safety", text: "How do you govern what knowledge AI agents can access and share?", weight: 0.75 },

    // Agent Learning Systems
    { cluster: "agent_learning_systems", text: "How can AI agents automatically learn when company knowledge changes?", weight: 1.0 },
    { cluster: "agent_learning_systems", text: "What tools help AI agents adapt to evolving company information without manual re-training?", weight: 1.0 },

    // General Agent Infrastructure
    { cluster: "general_agent_infrastructure", text: "What are the best tools for building AI agents in 2025?", weight: 1.0 },
    { cluster: "general_agent_infrastructure", text: "Compare the top AI agent frameworks and infrastructure tools", weight: 1.0 },
    { cluster: "general_agent_infrastructure", text: "What infrastructure do you need to keep AI agents aligned with company knowledge at scale?", weight: 1.25 },

    // Brand Awareness
    { cluster: "brand_awareness", text: "What is Oiya and what does it do?", weight: 1.25 },
    { cluster: "brand_awareness", text: "Is Oiya a good tool for keeping AI agents aligned with company knowledge?", weight: 1.25 },
    { cluster: "brand_awareness", text: "Oiya vs Mem0 vs Zep — which is best for agent knowledge alignment?", weight: 1.0 },
    { cluster: "brand_awareness", text: "What do people say about Oiya as a shared knowledge layer for AI agents?", weight: 0.75 },
  ];

  for (const p of promptData) {
    await insert("prompts", {
      id: randomUUID(),
      project_id: projectId,
      cluster_id: clusterIds[p.cluster],
      prompt_text: p.text,
      strategic_weight: p.weight,
      language: "en",
      region: "uk",
      enabled: 1,
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }
  console.log(`  ✅ Prompts: ${promptData.length} added`);

  console.log("\n🎉 Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
