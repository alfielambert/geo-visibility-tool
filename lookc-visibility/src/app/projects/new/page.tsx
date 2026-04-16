"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Loader2,
  Briefcase,
  Users,
  MessageSquare,
  Sparkles,
  Check,
} from "lucide-react";

// ─── Prompt templates by category ──────────────────────────────────

const PROMPT_TEMPLATES: Record<
  string,
  { label: string; description: string; clusters: ClusterTemplate[] }
> = {
  b2b_saas: {
    label: "B2B SaaS",
    description: "For software products competing in business markets",
    clusters: [
      {
        key: "product_comparison",
        label: "Product Comparison",
        description: "How your product compares to alternatives",
        prompts: [
          { text: "What are the best {CATEGORY} tools in 2025?", weight: 1.25 },
          { text: "Compare the top {CATEGORY} platforms", weight: 1.0 },
          { text: "{BRAND} vs {COMPETITOR_1} — which is better?", weight: 1.25 },
          { text: "What are the best alternatives to {COMPETITOR_1}?", weight: 1.0 },
        ],
      },
      {
        key: "use_case",
        label: "Use Cases",
        description: "Specific problems your product solves",
        prompts: [
          { text: "How do I solve {USE_CASE_1} for my business?", weight: 1.0 },
          { text: "What tools help with {USE_CASE_2}?", weight: 1.0 },
          { text: "Best software for {USE_CASE_1}", weight: 1.25 },
        ],
      },
      {
        key: "brand_awareness",
        label: "Brand Awareness",
        description: "Direct brand queries and reputation",
        prompts: [
          { text: "What is {BRAND} and what does it do?", weight: 1.25 },
          { text: "Is {BRAND} good for {CATEGORY}?", weight: 1.0 },
          { text: "What do people say about {BRAND}?", weight: 0.75 },
        ],
      },
      {
        key: "buyer_intent",
        label: "Buyer Intent",
        description: "High-intent purchase queries",
        prompts: [
          { text: "What {CATEGORY} should I use for a small business?", weight: 1.25 },
          { text: "Best {CATEGORY} with good pricing?", weight: 1.0 },
          { text: "Which {CATEGORY} is easiest to set up?", weight: 1.0 },
        ],
      },
    ],
  },
  local_services: {
    label: "Local Services",
    description: "For local businesses competing with directories and .gov sites",
    clusters: [
      {
        key: "service_discovery",
        label: "Service Discovery",
        description: "How people find services like yours",
        prompts: [
          { text: "How do I find a good {SERVICE_TYPE} near me?", weight: 1.25 },
          { text: "What's the best way to get {SERVICE_TYPE}?", weight: 1.0 },
          { text: "Best {SERVICE_TYPE} services in the UK", weight: 1.25 },
        ],
      },
      {
        key: "alternatives",
        label: "Alternatives to Official Channels",
        description: "Private alternatives to government/official services",
        prompts: [
          { text: "Are there private alternatives to {GOV_SERVICE}?", weight: 1.25 },
          { text: "Is it faster to use a private {SERVICE_TYPE} instead of {GOV_SERVICE}?", weight: 1.0 },
          { text: "What's the difference between using {GOV_SERVICE} and a private service?", weight: 1.0 },
        ],
      },
      {
        key: "cost_and_value",
        label: "Cost & Value",
        description: "Price and value comparison queries",
        prompts: [
          { text: "How much does {SERVICE_TYPE} cost in 2025?", weight: 1.0 },
          { text: "Is it worth paying for private {SERVICE_TYPE}?", weight: 1.25 },
          { text: "{BRAND} pricing — is it good value?", weight: 1.0 },
        ],
      },
      {
        key: "brand_awareness",
        label: "Brand Awareness",
        description: "Direct brand queries",
        prompts: [
          { text: "What is {BRAND} and what do they offer?", weight: 1.25 },
          { text: "Reviews of {BRAND} for {SERVICE_TYPE}", weight: 1.0 },
          { text: "Is {BRAND} legit?", weight: 0.75 },
        ],
      },
    ],
  },
  ecommerce: {
    label: "E-commerce",
    description: "For online retailers and product brands",
    clusters: [
      {
        key: "product_discovery",
        label: "Product Discovery",
        description: "How people find products like yours",
        prompts: [
          { text: "What are the best {PRODUCT_CATEGORY} to buy in 2025?", weight: 1.25 },
          { text: "Best {PRODUCT_CATEGORY} under {PRICE_POINT}?", weight: 1.0 },
          { text: "Where can I buy good quality {PRODUCT_CATEGORY}?", weight: 1.0 },
        ],
      },
      {
        key: "brand_comparison",
        label: "Brand Comparison",
        description: "Head-to-head brand comparisons",
        prompts: [
          { text: "{BRAND} vs {COMPETITOR_1} — which is better?", weight: 1.25 },
          { text: "Best alternatives to {COMPETITOR_1} for {PRODUCT_CATEGORY}", weight: 1.0 },
          { text: "Is {BRAND} better than {COMPETITOR_2}?", weight: 1.0 },
        ],
      },
      {
        key: "brand_awareness",
        label: "Brand Awareness",
        description: "Direct brand queries",
        prompts: [
          { text: "Is {BRAND} a good brand for {PRODUCT_CATEGORY}?", weight: 1.25 },
          { text: "What do people think of {BRAND}?", weight: 1.0 },
          { text: "{BRAND} reviews — are they worth it?", weight: 1.0 },
        ],
      },
    ],
  },
  custom: {
    label: "Custom",
    description: "Start from scratch with your own prompts",
    clusters: [],
  },
};

interface ClusterTemplate {
  key: string;
  label: string;
  description: string;
  prompts: Array<{ text: string; weight: number }>;
}

interface CompetitorInput {
  name: string;
  domain: string;
}

interface ClusterInput {
  key: string;
  label: string;
  description: string;
  prompts: Array<{ text: string; weight: number }>;
}

// ─── Main component ────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter();
  const { refreshProjects, setActiveProjectId } = useProject();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Brand info
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");

  // Step 2: Competitors
  const [competitors, setCompetitors] = useState<CompetitorInput[]>([
    { name: "", domain: "" },
  ]);

  // Step 3: Template + prompts
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterInput[]>([]);

  // Step 3 placeholder substitution values
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  // ─── Helpers ───────────────────────────────────────────────────

  const addCompetitor = () =>
    setCompetitors([...competitors, { name: "", domain: "" }]);

  const removeCompetitor = (i: number) =>
    setCompetitors(competitors.filter((_, idx) => idx !== i));

  const updateCompetitor = (
    i: number,
    field: "name" | "domain",
    value: string
  ) => {
    const updated = [...competitors];
    updated[i][field] = value;
    setCompetitors(updated);
  };

  const addCluster = () =>
    setClusters([
      ...clusters,
      { key: "", label: "", description: "", prompts: [{ text: "", weight: 1.0 }] },
    ]);

  const removeCluster = (i: number) =>
    setClusters(clusters.filter((_, idx) => idx !== i));

  const addPromptToCluster = (clusterIdx: number) => {
    const updated = [...clusters];
    updated[clusterIdx].prompts.push({ text: "", weight: 1.0 });
    setClusters(updated);
  };

  const removePromptFromCluster = (clusterIdx: number, promptIdx: number) => {
    const updated = [...clusters];
    updated[clusterIdx].prompts = updated[clusterIdx].prompts.filter(
      (_, i) => i !== promptIdx
    );
    setClusters(updated);
  };

  // Detect placeholders in template prompts
  const detectPlaceholders = (templateClusters: ClusterTemplate[]) => {
    const allText = templateClusters
      .flatMap((c) => c.prompts.map((p) => p.text))
      .join(" ");
    const matches = allText.match(/\{([A-Z_0-9]+)\}/g) ?? [];
    const unique = [...new Set(matches.map((m) => m.slice(1, -1)))];
    // Pre-fill BRAND
    const initial: Record<string, string> = {};
    for (const key of unique) {
      if (key === "BRAND") initial[key] = brandName;
      else if (key === "COMPETITOR_1" && competitors[0]?.name)
        initial[key] = competitors[0].name;
      else if (key === "COMPETITOR_2" && competitors[1]?.name)
        initial[key] = competitors[1].name;
      else initial[key] = "";
    }
    return initial;
  };

  const selectTemplate = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = PROMPT_TEMPLATES[templateKey];
    if (templateKey === "custom") {
      setClusters([
        {
          key: "general",
          label: "General",
          description: "",
          prompts: [{ text: "", weight: 1.0 }],
        },
      ]);
      setPlaceholders({});
    } else {
      setClusters(
        template.clusters.map((c) => ({
          key: c.key,
          label: c.label,
          description: c.description,
          prompts: c.prompts.map((p) => ({ ...p })),
        }))
      );
      setPlaceholders(detectPlaceholders(template.clusters));
    }
  };

  // Apply placeholder substitutions to all prompt text
  const resolvedClusters = (): ClusterInput[] => {
    return clusters.map((c) => ({
      ...c,
      prompts: c.prompts.map((p) => {
        let text = p.text;
        for (const [key, value] of Object.entries(placeholders)) {
          if (value) {
            text = text.replaceAll(`{${key}}`, value);
          }
        }
        return { ...p, text };
      }),
    }));
  };

  // ─── Submit ────────────────────────────────────────────────────

  const submit = async () => {
    setSaving(true);
    setError(null);

    const resolved = resolvedClusters();
    const validCompetitors = competitors.filter((c) => c.name.trim());
    const validClusters = resolved.filter(
      (c) => c.label.trim() && c.prompts.some((p) => p.text.trim())
    );

    if (validClusters.length === 0) {
      setError("Add at least one cluster with prompts");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brandName,
          domain,
          brandName,
          competitors: validCompetitors.map((c) => ({
            name: c.name.trim(),
            domain: c.domain.trim() || undefined,
          })),
          clusters: validClusters.map((c) => ({
            key:
              c.key.trim() ||
              c.label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_|_$/g, ""),
            label: c.label.trim(),
            description: c.description.trim() || undefined,
            prompts: c.prompts
              .filter((p) => p.text.trim())
              .map((p) => ({
                text: p.text.trim(),
                weight: p.weight,
              })),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create project");
        setSaving(false);
        return;
      }

      // Switch to the new project and go to overview
      await refreshProjects();
      setActiveProjectId(data.projectId);
      router.push("/");
    } catch {
      setError("Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  // ─── Step validation ───────────────────────────────────────────

  const canProceedStep1 = brandName.trim().length > 0 && domain.trim().length > 0;
  const canProceedStep2 = true; // competitors are optional
  const canProceedStep3 = selectedTemplate !== null;

  const totalPrompts = clusters.reduce(
    (acc, c) => acc + c.prompts.filter((p) => p.text.trim()).length,
    0
  );

  // ─── Render ────────────────────────────────────────────────────

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s < step
                ? "bg-green-600 text-white"
                : s === step
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-500"
            }`}
          >
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 4 && (
            <div
              className={`w-12 h-0.5 ${s < step ? "bg-green-600" : "bg-slate-800"}`}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {step > 1 ? "Back" : "Cancel"}
      </button>

      <h1 className="heading-1 mb-2">New Project</h1>
      <p className="text-muted mb-6">
        Set up a brand to track its visibility across AI models
      </p>

      {stepIndicator}

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ─── Step 1: Brand Info ──────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">Brand details</h2>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">
              Brand name
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="input-field w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              The name AI models should mention when recommending your product
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">
              Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. acmecorp.com"
              className="input-field w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Used to detect when AI models cite your website
            </p>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="button-primary flex items-center gap-2 disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Step 2: Competitors ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">Competitors</h2>
          </div>
          <p className="text-sm text-slate-400 -mt-2">
            Who are you competing with for AI visibility? The parser will track
            when these brands are mentioned instead of yours.
          </p>

          <div className="space-y-3">
            {competitors.map((comp, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={comp.name}
                    onChange={(e) => updateCompetitor(i, "name", e.target.value)}
                    placeholder="Competitor name"
                    className="input-field w-full"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={comp.domain}
                    onChange={(e) => updateCompetitor(i, "domain", e.target.value)}
                    placeholder="domain.com (optional)"
                    className="input-field w-full"
                  />
                </div>
                {competitors.length > 1 && (
                  <button
                    onClick={() => removeCompetitor(i)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors mt-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addCompetitor}
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add competitor
          </button>

          <button
            onClick={() => setStep(3)}
            disabled={!canProceedStep2}
            className="button-primary flex items-center gap-2 disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Step 3: Template selection + prompts ────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              Choose a template
            </h2>
          </div>
          <p className="text-sm text-slate-400 -mt-2">
            Templates give you a head start with prompts tuned for your business type.
            You can edit everything.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(PROMPT_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => selectTemplate(key)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedTemplate === key
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                <p className="text-sm font-medium text-slate-200">{tpl.label}</p>
                <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>
              </button>
            ))}
          </div>

          {/* Placeholder substitution */}
          {selectedTemplate &&
            selectedTemplate !== "custom" &&
            Object.keys(placeholders).length > 0 && (
              <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-slate-300">
                  Fill in the blanks
                </p>
                <p className="text-xs text-slate-500">
                  These values will be substituted into your prompts
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(placeholders).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-400 mb-1">
                        {key.replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setPlaceholders({ ...placeholders, [key]: e.target.value })
                        }
                        placeholder={key === "BRAND" ? brandName : `e.g. ${key.toLowerCase().replace(/_/g, " ")}`}
                        className="input-field w-full text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          <button
            onClick={() => setStep(4)}
            disabled={!canProceedStep3}
            className="button-primary flex items-center gap-2 disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Step 4: Review & edit prompts ────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              Review prompts
            </h2>
          </div>
          <p className="text-sm text-slate-400 -mt-2">
            These are the queries that will be sent to AI models. Edit, add, or
            remove as needed. ({totalPrompts} prompts across {clusters.length}{" "}
            clusters)
          </p>

          <div className="space-y-6">
            {clusters.map((cluster, ci) => {
              const resolved = resolvedClusters();
              const resolvedCluster = resolved[ci];

              return (
                <div
                  key={ci}
                  className="border border-slate-800 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50">
                    <input
                      type="text"
                      value={cluster.label}
                      onChange={(e) => {
                        const updated = [...clusters];
                        updated[ci].label = e.target.value;
                        updated[ci].key = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "_")
                          .replace(/^_|_$/g, "");
                        setClusters(updated);
                      }}
                      placeholder="Cluster name"
                      className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none flex-1"
                    />
                    {clusters.length > 1 && (
                      <button
                        onClick={() => removeCluster(ci)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    {cluster.prompts.map((prompt, pi) => (
                      <div key={pi} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={prompt.text}
                          onChange={(e) => {
                            const updated = [...clusters];
                            updated[ci].prompts[pi].text = e.target.value;
                            setClusters(updated);
                          }}
                          placeholder="Enter a prompt..."
                          className="input-field flex-1 text-sm"
                        />
                        {/* Show resolved preview if different */}
                        {resolvedCluster?.prompts[pi]?.text !== prompt.text &&
                          prompt.text.includes("{") && (
                            <div className="text-xs text-slate-500 mt-2 max-w-[200px] truncate" title={resolvedCluster?.prompts[pi]?.text}>
                              → {resolvedCluster?.prompts[pi]?.text}
                            </div>
                          )}
                        {cluster.prompts.length > 1 && (
                          <button
                            onClick={() => removePromptFromCluster(ci, pi)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addPromptToCluster(ci)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                    >
                      <Plus className="w-3 h-3" /> Add prompt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addCluster}
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add cluster
          </button>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={submit}
              disabled={saving || totalPrompts === 0}
              className="button-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? "Creating..." : `Create project (${totalPrompts} prompts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
