/**
 * Seed script — populates the database with a demo project.
 * Replace BRAND_NAME, BRAND_DOMAIN, and the prompt clusters with your own.
 * Run: node scripts/seed.mjs
 */

import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const client = createClient({ url: "file:./dev.db" });
const now = new Date().toISOString();

// ── Configure your brand here ──────────────────────────────────────────────
const BRAND_NAME = "Acme AI";
const BRAND_SLUG = "acme-ai";
const BRAND_DOMAIN = "acme.ai";
// ──────────────────────────────────────────────────────────────────────────

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
    name: BRAND_NAME,
    slug: BRAND_SLUG,
    domain: BRAND_DOMAIN,
    brand_name: BRAND_NAME,
    status: "active",
    created_at: now,
    updated_at: now,
  });
  console.log(`  ✅ Project: ${BRAND_NAME} (${BRAND_DOMAIN})`);

  // ─── Competitors ──────────────────────────────────────────────────
  // Replace with the competitors relevant to your market.
  const competitorData = [
    { name: "Competitor A", domain: "competitor-a.com", notes: "Direct competitor" },
    { name: "Competitor B", domain: "competitor-b.com", notes: "Direct competitor" },
    { name: "Competitor C", domain: "competitor-c.com", notes: "Adjacent tool" },
    { name: "Competitor D", domain: "competitor-d.com", notes: "Adjacent tool" },
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
  // Clusters group related prompts by buyer intent or topic area.
  const clusters = [
    {
      key: "product_discovery",
      label: "Product Discovery",
      description: "Queries buyers use when first discovering tools in this category.",
    },
    {
      key: "comparison",
      label: "Comparison Queries",
      description: "Head-to-head comparisons between your brand and competitors.",
    },
    {
      key: "use_cases",
      label: "Use Cases",
      description: "Specific problem-solution queries your product addresses.",
    },
    {
      key: "brand_awareness",
      label: "Brand Awareness",
      description: "Direct brand queries and general awareness of your brand in the market.",
    },
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
  // Replace these with the actual questions your buyers ask LLMs.
  // weight > 1.0 = more strategically important; < 1.0 = lower priority.
  const promptData = [
    // Product Discovery
    { cluster: "product_discovery", text: "What are the best tools for [your category]?", weight: 1.25 },
    { cluster: "product_discovery", text: "How do I solve [core problem your product solves]?", weight: 1.25 },
    { cluster: "product_discovery", text: "What tools do [your target customer] use for [use case]?", weight: 1.0 },

    // Comparison
    { cluster: "comparison", text: `${BRAND_NAME} vs Competitor A — which is better?`, weight: 1.25 },
    { cluster: "comparison", text: `Compare the top tools for [your category] in 2025`, weight: 1.0 },
    { cluster: "comparison", text: `What are the alternatives to Competitor A?`, weight: 1.0 },

    // Use Cases
    { cluster: "use_cases", text: "How do I [core use case your product enables]?", weight: 1.0 },
    { cluster: "use_cases", text: "What's the best way to [secondary use case]?", weight: 1.0 },

    // Brand Awareness
    { cluster: "brand_awareness", text: `What is ${BRAND_NAME} and what does it do?`, weight: 1.25 },
    { cluster: "brand_awareness", text: `Is ${BRAND_NAME} a good tool for [use case]?`, weight: 1.25 },
    { cluster: "brand_awareness", text: `What do people say about ${BRAND_NAME}?`, weight: 0.75 },
  ];

  for (const p of promptData) {
    await insert("prompts", {
      id: randomUUID(),
      project_id: projectId,
      cluster_id: clusterIds[p.cluster],
      prompt_text: p.text,
      strategic_weight: p.weight,
      language: "en",
      region: "global",
      enabled: 1,
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }
  console.log(`  ✅ Prompts: ${promptData.length} added`);

  console.log("\n🎉 Seed complete!");
  console.log(`\nEdit scripts/seed.mjs to configure your brand, competitors, and prompts.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
