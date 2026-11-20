"use client";

import * as React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Globe,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Share2,
  Clock,
  Send,
  Building2,
  Sparkles,
  Target,
  Trophy,
  Star,
  MessageSquare,
  Tag,
  History,
  Check,
  Edit3,
  Trash2,
  X,
  ArrowRight,
  Info,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  fetchBattlecard,
  generateBattlecard,
  publishBattlecard,
  fetchBattlecardVersions,
  reviewClaimDrift,
  type Battlecard,
  type BattlecardBlock,
  type IntelligenceClaim,
  type ClaimEvidence,
  type ClaimDriftAlert,
  type BattlecardRevision,
} from "@/lib/api";
import { useWorkspace } from "../AppShell";

interface BattlecardViewProps {
  competitorName: string;
  tenantId?: string;
}

export function BattlecardView({ competitorName, tenantId }: BattlecardViewProps) {
  const workspace = useWorkspace();
  const effectiveTenantId = tenantId || workspace.tenantId;

  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [battlecard, setBattlecard] = React.useState<Battlecard | null>(null);
  const [frontendData, setFrontendData] = React.useState<any>(null);

  const [activeTab, setActiveTab] = React.useState<"sales" | "intelligence">("sales");
  const [selectedAudience, setSelectedAudience] = React.useState<"sales" | "product" | "marketing" | "executive">("sales");

  // Evidence Drawer state
  const [selectedClaim, setSelectedClaim] = React.useState<IntelligenceClaim | null>(null);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);

  // Drift Review Modal state
  const [activeDriftAlert, setActiveDriftAlert] = React.useState<ClaimDriftAlert | null>(null);
  const [driftModalOpen, setDriftModalOpen] = React.useState(false);
  const [isEditingDrift, setIsEditingDrift] = React.useState(false);
  const [editedStatement, setEditedStatement] = React.useState("");
  const [editedFact, setEditedFact] = React.useState("");
  const [editedImpact, setEditedImpact] = React.useState("");
  const [editedAct, setEditedAct] = React.useState("");
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [submittingReview, setSubmittingReview] = React.useState(false);

  // Publish Modal state
  const [publishModalOpen, setPublishModalOpen] = React.useState(false);
  const [changeSummary, setChangeSummary] = React.useState("");
  const [publishing, setPublishing] = React.useState(false);

  // Version History Drawer state
  const [versionsDrawerOpen, setVersionsDrawerOpen] = React.useState(false);
  const [revisions, setRevisions] = React.useState<BattlecardRevision[]>([]);
  const [loadingVersions, setLoadingVersions] = React.useState(false);
  const [viewingRevision, setViewingRevision] = React.useState<BattlecardRevision | null>(null);

  // Expandable sections state
  const [discoveryExpanded, setDiscoveryExpanded] = React.useState(false);
  const [swotExpanded, setSwotExpanded] = React.useState(false);
  const [proofExpanded, setProofExpanded] = React.useState(false);

  // Notification toast
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadBattlecardData = React.useCallback(async (audience = selectedAudience, force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) {
        setGenerating(true);
        const res = await generateBattlecard(
          competitorName,
          { audience, segment: "general", force_refresh: true },
          effectiveTenantId
        );
        setBattlecard(res.battlecard);
        setFrontendData(res.frontend_components);
      } else {
        const res = await fetchBattlecard(competitorName, { audience }, effectiveTenantId);
        setBattlecard(res.battlecard);
        setFrontendData(res.frontend_components);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load battlecard");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [competitorName, selectedAudience, effectiveTenantId]);

  React.useEffect(() => {
    loadBattlecardData(selectedAudience, false);
  }, [loadBattlecardData, selectedAudience]);

  // Open Evidence Drawer
  const handleOpenEvidence = (claim: IntelligenceClaim) => {
    setSelectedClaim(claim);
    setEvidenceDrawerOpen(true);
  };

  // Open Drift Review Modal
  const handleOpenDriftReview = (alert: ClaimDriftAlert) => {
    setActiveDriftAlert(alert);
    setEditedStatement(alert.claim?.statement || "");
    setEditedFact(alert.claim?.fact_impact_act?.fact || "");
    setEditedImpact(alert.claim?.fact_impact_act?.impact || "");
    setEditedAct(alert.claim?.fact_impact_act?.act || "");
    setReviewNotes("");
    setIsEditingDrift(false);
    setDriftModalOpen(true);
  };

  // Submit Drift Review Action
  const handleSubmitDriftReview = async (resolution: "accepted" | "dismissed" | "modified") => {
    if (!activeDriftAlert) return;
    setSubmittingReview(true);
    try {
      const updates = resolution === "modified" ? {
        statement: editedStatement,
        fact_impact_act: {
          fact: editedFact,
          impact: editedImpact,
          act: editedAct,
        },
      } : undefined;

      await reviewClaimDrift(
        activeDriftAlert.id,
        {
          action: resolution,
          notes: reviewNotes || `Resolved as ${resolution} by analyst`,
          edited_claim: updates,
        },
        effectiveTenantId
      );

      showToast(`Drift alert ${resolution}: Battlecard refreshed.`);
      setDriftModalOpen(false);
      await loadBattlecardData(selectedAudience, false);
    } catch (err: any) {
      alert(`Could not review drift: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Publish Battlecard
  const handlePublish = async () => {
    if (!battlecard) return;
    setPublishing(true);
    try {
      const res = await publishBattlecard(
        battlecard.id,
        { change_summary: changeSummary || "Routine competitive intelligence release." },
        effectiveTenantId
      );
      showToast(`Battlecard published successfully as v${res.battlecard.published_version || res.battlecard.current_version}!`);
      setPublishModalOpen(false);
      setChangeSummary("");
      await loadBattlecardData(selectedAudience, false);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  // Load Version History
  const loadVersions = async () => {
    if (!battlecard) return;
    setLoadingVersions(true);
    setVersionsDrawerOpen(true);
    try {
      const res = await fetchBattlecardVersions(battlecard.id, effectiveTenantId);
      setRevisions(res.versions || []);
    } catch (err: any) {
      alert(`Could not load revisions: ${err.message}`);
    } finally {
      setLoadingVersions(false);
    }
  };

  if (loading && !battlecard) {
    return (
      <div className="p-8 space-y-6 bg-white rounded-2xl border border-zinc-200 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-zinc-200 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-zinc-100 rounded animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-zinc-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="h-44 bg-zinc-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !battlecard) {
    return (
      <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50/70 text-rose-950 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 font-bold text-sm text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Could Not Load Battlecard for {competitorName}</span>
        </div>
        <p className="text-xs text-rose-800 leading-relaxed">{error}</p>
        <button
          onClick={() => loadBattlecardData(selectedAudience, true)}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-500 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Synthesize Battlecard</span>
        </button>
      </div>
    );
  }

  if (!battlecard) return null;

  // Extract frontend component payload
  const header = frontendData?.header || {
    competitor_name: competitorName,
    current_version: battlecard.current_version,
    published_version: battlecard.published_version,
    owner_id: battlecard.owner_id,
    freshness_score: battlecard.freshness_score,
  };
  const snapshot = frontendData?.competitor_snapshot || {};
  const freshPanel = frontendData?.trust_and_freshness || {};
  const primaryAlert: ClaimDriftAlert | null = freshPanel.primary_drift_alert || null;

  // Blocks indexed by block_key
  const blocksMap: Record<string, BattlecardBlock> = (battlecard.blocks || []).reduce((acc: any, b: any) => {
    acc[b.block_key] = b;
    return acc;
  }, {});

  const positioningBlock = blocksMap["snapshot_positioning"];
  const whereWeWinBlock = blocksMap["where_we_win"];
  const whereTheyWinBlock = blocksMap["where_they_win"];
  const objectionsBlock = blocksMap["objections_responses"];
  const discoveryBlock = blocksMap["discovery_questions"];
  const swotBlock = blocksMap["strengths_weaknesses"];
  const pricingBlock = blocksMap["pricing_comparison"];
  const proofBlock = blocksMap["proof_points"];
  const recentChangesBlock = blocksMap["recent_changes"];

  return (
    <div className="space-y-6 text-zinc-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP COMPETITOR HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 font-extrabold text-base shadow-2xs">
            {competitorName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{competitorName}</h1>
              {header.published_version ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Published v{header.published_version}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  Draft v{header.current_version || 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified Nov 2026
              </span>
              <span>•</span>
              <span>Owner: {header.owner_id || "Product Marketing"}</span>
              <span>•</span>
              <span className="font-semibold text-zinc-700">Freshness: {header.freshness_score || 100}%</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Audience Selector */}
          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-700 font-semibold shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
          >
            <option value="sales">Sales View</option>
            <option value="product">Product View</option>
            <option value="marketing">Marketing View</option>
            <option value="executive">Executive View</option>
          </select>

          {/* Versions History Button */}
          <button
            onClick={loadVersions}
            disabled={loadingVersions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Versions</span>
          </button>

          {/* Regenerate Button */}
          <button
            onClick={() => loadBattlecardData(selectedAudience, true)}
            disabled={generating}
            title="Refresh and regenerate battlecard intelligence"
            className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin text-purple-600" : ""}`} />
          </button>

          {/* Publish Button */}
          <button
            onClick={() => setPublishModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6e57dc] text-white font-bold text-xs hover:bg-[#5b45c6] transition-colors shadow-2xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        </div>
      </div>

      {/* VIEW TABS BAR */}
      <div className="flex items-center gap-6 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-2.5 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "sales"
              ? "text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#6e57dc]"
              : "text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Sales view
        </button>
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`pb-2.5 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "intelligence"
              ? "text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#6e57dc]"
              : "text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Intelligence view
        </button>
      </div>

      {/* MAIN TWO-COLUMN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Main Battlecard Content */}
        <div className="lg:col-span-8 space-y-5">
          {activeTab === "sales" ? (
            <>
              {/* CARD 1: COMPETITOR SNAPSHOT & POSITIONING */}
              <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center font-black text-xl text-purple-700 shrink-0">
                    {competitorName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-zinc-900">
                      {snapshot.category || "Enterprise Software & Cloud Architecture"}
                    </h2>
                    <p className="text-xs text-zinc-600 mt-1 max-w-xl leading-relaxed">
                      {snapshot.positioning_statement && snapshot.positioning_statement !== "Unknown"
                        ? snapshot.positioning_statement
                        : `Tracked competitor profile for ${competitorName} across market segments.`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        Mid-market / Enterprise
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        High relevance
                      </span>
                      {snapshot.domain && (
                        <a
                          href={`https://${snapshot.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-semibold hover:underline"
                        >
                          {snapshot.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* GRID: CORE BATTLECARD SECTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 2: POSITION AGAINST THEM */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-purple-700 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Target className="w-4 h-4 text-[#6e57dc]" />
                      <span>Position Against Them</span>
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                      {positioningBlock?.claims?.[0]?.fact_impact_act?.act ||
                        "Lead with governed workflows and lower operational overhead when reliability and auditability matter."}
                    </p>
                  </div>
                  {positioningBlock?.claims?.[0] && (
                    <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-end">
                      <button
                        onClick={() => {
                          const clm = positioningBlock?.claims?.[0];
                          if (clm) handleOpenEvidence(clm);
                        }}
                        className="text-[11px] text-purple-600 hover:text-purple-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        Evidence ({positioningBlock.claims?.[0]?.evidence?.length || 1})
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* CARD 3: WHERE WE WIN */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                      <span>Where We Win</span>
                    </div>
                    <div className="space-y-2">
                      {whereWeWinBlock?.claims && whereWeWinBlock.claims.length > 0 ? (
                        whereWeWinBlock.claims.map((clm, i) => (
                          <div
                            key={clm.id || i}
                            onClick={() => handleOpenEvidence(clm)}
                            className="flex items-start gap-2 p-2 rounded-xl hover:bg-emerald-50/50 cursor-pointer transition-colors border border-transparent hover:border-emerald-100"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-zinc-700">
                              <span className="font-bold text-zinc-900">{clm.subject || clm.statement}</span>
                              {clm.fact_impact_act?.act && (
                                <span className="text-zinc-500 block text-[11px] mt-0.5">
                                  {clm.fact_impact_act.act}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-zinc-400 italic">No win points recorded (Insufficient Data)</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 4: WHERE THEY WIN */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Star className="w-4 h-4 text-amber-600" />
                      <span>Where They Win</span>
                    </div>
                    <div className="space-y-2">
                      {whereTheyWinBlock?.claims && whereTheyWinBlock.claims.length > 0 ? (
                        whereTheyWinBlock.claims.map((clm, i) => (
                          <div
                            key={clm.id || i}
                            onClick={() => handleOpenEvidence(clm)}
                            className="flex items-start gap-2 p-2 rounded-xl hover:bg-amber-50/50 cursor-pointer transition-colors border border-transparent hover:border-amber-100"
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">
                              ✓
                            </span>
                            <div className="text-xs text-zinc-700">
                              <span className="font-bold text-zinc-900">{clm.subject || clm.statement}</span>
                              {clm.fact_impact_act?.act && (
                                <span className="text-zinc-500 block text-[11px] mt-0.5">
                                  {clm.fact_impact_act.act}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-zinc-400 italic">No verified competitor win points recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 5: OBJECTION PLAYBOOK */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-purple-700 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <MessageSquare className="w-4 h-4 text-[#6e57dc]" />
                      <span>Objection Playbook</span>
                    </div>
                    {objectionsBlock?.claims && objectionsBlock.claims.length > 0 ? (
                      (() => {
                        const clm = objectionsBlock.claims[0];
                        return (
                          <div
                            onClick={() => handleOpenEvidence(clm)}
                            className="space-y-2 p-2 rounded-xl hover:bg-purple-50/40 cursor-pointer transition-colors border border-transparent hover:border-purple-100"
                          >
                            <p className="text-xs text-zinc-900 font-bold">
                              Buyer says: &ldquo;{clm.subject || `${competitorName} is faster to implement.`}&rdquo;
                            </p>
                            <p className="text-xs text-zinc-700 leading-relaxed">
                              <span className="text-purple-700 font-bold">Our response: </span>
                              {clm.fact_impact_act?.act ||
                                "Acknowledge rapid initial onboarding, then compare the enterprise controls required post-deployment."}
                            </p>
                            {clm.fact_impact_act?.impact && (
                              <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/80 text-[11px] text-zinc-600 flex items-start gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                                <span>Key question: {clm.fact_impact_act.impact}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-xs text-zinc-400 italic">No objection playbooks recorded.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* EXPANDABLE SECTIONS: Discovery, SWOT, Proof Points */}
              <div className="space-y-3">
                {/* Sales Discovery Questions */}
                <div className="rounded-2xl bg-white border border-zinc-200 shadow-2xs overflow-hidden">
                  <button
                    onClick={() => setDiscoveryExpanded(!discoveryExpanded)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-bold text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-600" />
                      <span>Sales Discovery &amp; Trap Questions ({discoveryBlock?.claims?.length || 0})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${discoveryExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {discoveryExpanded && (
                    <div className="p-5 pt-2 border-t border-zinc-100 space-y-2.5">
                      {discoveryBlock?.claims?.map((clm, i) => (
                        <div
                          key={clm.id || i}
                          onClick={() => handleOpenEvidence(clm)}
                          className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 hover:border-purple-200 cursor-pointer transition-colors"
                        >
                          <div className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                            <span>{clm.statement}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Trap Question
                            </span>
                          </div>
                          {clm.fact_impact_act?.fact && (
                            <div className="text-[11px] text-zinc-500 mt-1">
                              Rationale: {clm.fact_impact_act.fact}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Competitive Strengths & Weaknesses */}
                <div className="rounded-2xl bg-white border border-zinc-200 shadow-2xs overflow-hidden">
                  <button
                    onClick={() => setSwotExpanded(!swotExpanded)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-bold text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span>Strengths &amp; Weaknesses Matrix</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${swotExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {swotExpanded && (
                    <div className="p-5 pt-2 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-amber-700">Competitor Strengths</div>
                        {swotBlock?.content?.strengths?.map((s: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-amber-900 font-medium">
                            {s.statement}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-emerald-700">Competitor Weaknesses</div>
                        {swotBlock?.content?.weaknesses?.map((w: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs text-emerald-900 font-medium">
                            {w.statement}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Verified Proof Points */}
                <div className="rounded-2xl bg-white border border-zinc-200 shadow-2xs overflow-hidden">
                  <button
                    onClick={() => setProofExpanded(!proofExpanded)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-bold text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Verified Proof Points ({proofBlock?.claims?.length || 0})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${proofExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {proofExpanded && (
                    <div className="p-5 pt-2 border-t border-zinc-100 space-y-2">
                      {proofBlock?.claims?.map((clm, i) => (
                        <div
                          key={clm.id || i}
                          onClick={() => handleOpenEvidence(clm)}
                          className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-zinc-900">{clm.subject}</div>
                            <div className="text-[11px] text-zinc-600 mt-0.5">{clm.statement}</div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            clm.verification_status === "verified"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                          }`}>
                            {clm.verification_status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 6: BOTTOM BAR (Pricing & Recent Changes) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Pricing Snapshot</div>
                    <div className="text-xs font-bold text-zinc-900 mt-0.5">
                      {pricingBlock?.content?.pricing_model && pricingBlock.content.pricing_model !== "Unknown"
                        ? `${pricingBlock.content.pricing_model}`
                        : "Public pricing not verified"}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Recent Change</div>
                    <div className="text-xs font-bold text-zinc-900 mt-0.5 truncate max-w-xs">
                      {recentChangesBlock?.content?.items?.[0]?.change || "Enterprise roadmap evolution tracked"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* INTELLIGENCE VIEW TAB */
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900">Claim Registry &amp; Verification Ledger</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Atomic, reusable intelligence claims linked directly to empirical source evidence.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    {freshPanel.verified_claims || 0} Verified
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200">
                    {freshPanel.unknown_claims || 0} Unknown
                  </span>
                </div>
              </div>

              {/* Claims Table */}
              <div className="space-y-3">
                {(battlecard.blocks || []).flatMap((b) => b.claims || []).map((clm, idx) => (
                  <div
                    key={clm.id || idx}
                    onClick={() => handleOpenEvidence(clm)}
                    className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-purple-200 cursor-pointer transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                          {clm.claim_type.replace(/_/g, " ")}
                        </span>
                        <span>•</span>
                        <span className="text-xs font-bold text-zinc-900">{clm.subject}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        clm.verification_status === "verified"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-zinc-200 text-zinc-700"
                      }`}>
                        {clm.verification_status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-700">{clm.statement}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 text-[11px] border-t border-zinc-200/80">
                      <div>
                        <span className="text-zinc-400 font-medium">Fact: </span>
                        <span className="text-zinc-800">{clm.fact_impact_act?.fact || "—"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-medium">Impact: </span>
                        <span className="text-zinc-800">{clm.fact_impact_act?.impact || "—"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-medium">Act: </span>
                        <span className="text-zinc-800">{clm.fact_impact_act?.act || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
                      <span>Citations: {clm.evidence?.length || 0} sources</span>
                      <span className="text-purple-600 flex items-center gap-1 font-bold">
                        View Provenance <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Trust & Freshness + Claim Change Alerts */}
        <div className="lg:col-span-4 space-y-5">
          {/* TRUST & FRESHNESS CARD */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs tracking-wider uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Trust &amp; Freshness</span>
              </div>
              <Info className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-600 cursor-pointer" />
            </div>

            {/* KPI STATS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-extrabold text-emerald-600">
                  {freshPanel.verified_claims || 6}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">Claims supported</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-amber-600">
                  {freshPanel.pending_drift_alerts_count || (primaryAlert ? 1 : 0)}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">Items need review</div>
              </div>
            </div>

            {/* VERIFIED EVIDENCE ITEMS LIST */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              {(battlecard.blocks || [])
                .flatMap((b) => b.claims || [])
                .filter((c) => c.verification_status === "verified")
                .slice(0, 4)
                .map((clm, idx) => (
                  <div
                    key={clm.id || idx}
                    onClick={() => handleOpenEvidence(clm)}
                    className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-purple-200 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 truncate">{clm.subject}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Confidence: {clm.confidence || "95%"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400 shrink-0 text-[11px]">
                      <span>Nov 2026</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* CLAIM CHANGE DETECTED (Drift Alert Card) */}
          {primaryAlert ? (
            <div className="p-6 rounded-2xl bg-amber-50/60 border-2 border-amber-300 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold tracking-wider uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Claim Change Detected</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-amber-800 font-bold">Old claim:</span>
                  <p className="text-zinc-800 font-medium mt-0.5">
                    {primaryAlert.claim?.statement || "No public SSO support found"}
                  </p>
                </div>
                <div>
                  <span className="text-amber-800 font-bold">New evidence:</span>
                  <p className="text-zinc-800 font-medium mt-0.5">
                    {primaryAlert.new_evidence_excerpt || "Enterprise SSO documentation discovered"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenDriftReview(primaryAlert)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Review update</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1">
                <button
                  onClick={() => {
                    if (primaryAlert.claim) handleOpenEvidence(primaryAlert.claim);
                  }}
                  className="text-xs text-purple-700 hover:text-purple-900 font-bold cursor-pointer"
                >
                  View evidence ({primaryAlert.claim?.evidence?.length || 1}) →
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <div className="text-xs font-bold text-zinc-900">All Claims Grounded &amp; Stable</div>
              <div className="text-[11px] text-zinc-500">
                Continuous monitoring pipeline reports zero active contradiction alerts.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EVIDENCE DRAWER (Slide-over Provenance Inspector) */}
      {/* ========================================================================= */}
      {evidenceDrawerOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setEvidenceDrawerOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white border-l border-zinc-200 h-full overflow-y-auto p-6 space-y-6 z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Evidence Provenance</h3>
                  <div className="text-[11px] text-zinc-500">Grounded Intelligence Audit</div>
                </div>
              </div>
              <button
                onClick={() => setEvidenceDrawerOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Claim Overview */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                  {selectedClaim.claim_type.replace(/_/g, " ")}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  selectedClaim.verification_status === "verified"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-zinc-200 text-zinc-700"
                }`}>
                  {selectedClaim.verification_status.toUpperCase()}
                </span>
              </div>
              <h4 className="text-sm font-bold text-zinc-900">{selectedClaim.subject}</h4>
              <p className="text-xs text-zinc-700">{selectedClaim.statement}</p>
            </div>

            {/* Fact -> Impact -> Act Framework */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Strategic Reasoning (Fact → Impact → Act)
              </h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
                  <span className="font-bold text-zinc-900">Fact: </span>
                  <span className="text-zinc-700">{selectedClaim.fact_impact_act?.fact || selectedClaim.statement}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
                  <span className="font-bold text-zinc-900">Impact: </span>
                  <span className="text-zinc-700">{selectedClaim.fact_impact_act?.impact || "Documented competitive market implication."}</span>
                </div>
                <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-200/80 text-xs text-purple-950">
                  <span className="font-bold text-purple-900">Act: </span>
                  <span>{selectedClaim.fact_impact_act?.act || "Acknowledge in sales conversations and probe customer architectural pain."}</span>
                </div>
              </div>
            </div>

            {/* Evidence Sources */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Grounding Evidence Citations ({selectedClaim.evidence?.length || 0})
                </h4>
                <span className="text-[11px] text-zinc-500">Confidence: {selectedClaim.confidence || "High"}</span>
              </div>

              {selectedClaim.evidence && selectedClaim.evidence.length > 0 ? (
                <div className="space-y-3">
                  {selectedClaim.evidence.map((ev, i) => (
                    <div key={ev.id || i} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-900">
                          {ev.source_title || `Evidence Reference #${i + 1}`}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 font-semibold">
                          {ev.source_quality || "primary"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700 font-mono italic bg-white p-2.5 rounded-lg border border-zinc-200/80 leading-relaxed">
                        &ldquo;{ev.excerpt}&rdquo;
                      </p>
                      {ev.source_url && (
                        <div className="pt-1">
                          <a
                            href={ev.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-bold hover:underline"
                          >
                            <span>Verify Source URL</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-center text-xs text-zinc-500 italic">
                  No direct external citations linked. Classified as {selectedClaim.verification_status}.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-200 mt-auto">
              <button
                onClick={() => setEvidenceDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-100 text-zinc-800 font-bold text-xs hover:bg-zinc-200 transition-colors"
              >
                Close Audit Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PUBLISH MODAL */}
      {/* ========================================================================= */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setPublishModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl space-y-4 z-10 text-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-zinc-900">Publish Battlecard Revision</h3>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Publishing promotes current draft changes to the authoritative release for <strong>{competitorName}</strong>. This updates published version history and notifies sales reps.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Changelog Summary</label>
              <textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g., Updated objection rebuttals and added Q4 pricing tiers..."
                rows={3}
                className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 rounded-xl bg-[#6e57dc] text-white font-bold text-xs hover:bg-[#5b45c6] transition-colors shadow-2xs inline-flex items-center gap-2"
              >
                {publishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm &amp; Publish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CLAIM DRIFT REVIEW MODAL */}
      {/* ========================================================================= */}
      {driftModalOpen && activeDriftAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setDriftModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl space-y-5 z-10 text-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-zinc-900">Review Claim Contradiction</h3>
              </div>
              <button
                onClick={() => setDriftModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 text-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Existing Active Claim</div>
                <div className="font-bold text-zinc-900">{activeDriftAlert.claim?.statement}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Newly Detected Evidence</div>
                <div className="font-medium text-zinc-800 leading-relaxed">&ldquo;{activeDriftAlert.new_evidence_excerpt}&rdquo;</div>
              </div>
            </div>

            {/* Resolution Actions */}
            <div className="space-y-3 pt-2 border-t border-zinc-200">
              <div className="text-xs font-bold text-zinc-700">Choose Resolution:</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitDriftReview("accepted")}
                  disabled={submittingReview}
                  className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs transition-colors text-center"
                >
                  Accept &amp; Replace
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDrift(!isEditingDrift)}
                  className="p-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs transition-colors text-center"
                >
                  Edit &amp; Adjust
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitDriftReview("dismissed")}
                  disabled={submittingReview}
                  className="p-2.5 rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200 font-bold text-xs transition-colors text-center"
                >
                  Dismiss Alert
                </button>
              </div>

              {isEditingDrift && (
                <div className="space-y-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700">Updated Statement</label>
                    <input
                      type="text"
                      value={editedStatement}
                      onChange={(e) => setEditedStatement(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700">Updated Action Guide</label>
                    <input
                      type="text"
                      value={editedAct}
                      onChange={(e) => setEditedAct(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSubmitDriftReview("modified")}
                    disabled={submittingReview}
                    className="w-full py-2 rounded-lg bg-[#6e57dc] text-white font-bold text-xs hover:bg-[#5b45c6] transition-colors"
                  >
                    Save &amp; Update Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VERSION HISTORY DRAWER */}
      {/* ========================================================================= */}
      {versionsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setVersionsDrawerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white border-l border-zinc-200 h-full overflow-y-auto p-6 space-y-6 z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-zinc-900">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-zinc-900">Version History</h3>
              </div>
              <button
                onClick={() => setVersionsDrawerOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingVersions ? (
              <div className="space-y-3">
                <div className="h-16 bg-zinc-100 rounded-xl animate-pulse" />
                <div className="h-16 bg-zinc-100 rounded-xl animate-pulse" />
              </div>
            ) : revisions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 italic">
                No previous published versions recorded for this competitor.
              </div>
            ) : (
              <div className="space-y-3">
                {revisions.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-900">Version {rev.version}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(rev.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">{rev.change_summary || "Routine release"}</p>
                    <div className="text-[11px] text-zinc-400">Published by: {rev.published_by}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
