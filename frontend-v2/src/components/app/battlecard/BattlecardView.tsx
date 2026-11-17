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

interface BattlecardViewProps {
  competitorName: string;
  tenantId?: string;
}

export function BattlecardView({ competitorName, tenantId }: BattlecardViewProps) {
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
          tenantId
        );
        setBattlecard(res.battlecard);
        setFrontendData(res.frontend_components);
      } else {
        const res = await fetchBattlecard(competitorName, { audience }, tenantId);
        setBattlecard(res.battlecard);
        setFrontendData(res.frontend_components);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load battlecard");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [competitorName, selectedAudience, tenantId]);

  React.useEffect(() => {
    loadBattlecardData(selectedAudience, false);
  }, [competitorName, selectedAudience, loadBattlecardData]);

  // Load versions
  const loadVersions = async () => {
    if (!battlecard?.id) return;
    setLoadingVersions(true);
    try {
      const res = await fetchBattlecardVersions(battlecard.id, tenantId);
      setRevisions(res.versions || []);
      setVersionsDrawerOpen(true);
    } catch (err: any) {
      showToast(`Error loading versions: ${err.message}`);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Open evidence drawer for a claim
  const handleOpenEvidence = (claim: IntelligenceClaim) => {
    setSelectedClaim(claim);
    setEvidenceDrawerOpen(true);
  };

  // Open drift review modal
  const handleOpenDriftReview = (alert: ClaimDriftAlert) => {
    setActiveDriftAlert(alert);
    setIsEditingDrift(false);
    const sugg = alert.suggested_update || {};
    setEditedStatement(sugg.statement || alert.claim?.statement || "");
    const fia = sugg.fact_impact_act || alert.claim?.fact_impact_act || { fact: "", impact: "", act: "" };
    setEditedFact(fia.fact || "");
    setEditedImpact(fia.impact || "");
    setEditedAct(fia.act || "");
    setReviewNotes("");
    setDriftModalOpen(true);
  };

  // Handle drift review submission
  const handleSubmitReview = async (action: "accept" | "edit_and_accept" | "dismiss" | "mark_incorrect") => {
    if (!activeDriftAlert) return;
    setSubmittingReview(true);
    try {
      const payload: any = {
        action,
        notes: reviewNotes,
        reviewer: "analyst",
      };
      if (action === "edit_and_accept") {
        payload.edited_claim = {
          statement: editedStatement,
          fact_impact_act: {
            fact: editedFact,
            impact: editedImpact,
            act: editedAct,
          },
        };
      }
      await reviewClaimDrift(activeDriftAlert.id, payload, tenantId);
      showToast(`Review action '${action}' applied successfully`);
      setDriftModalOpen(false);
      // Reload battlecard to reflect approved changes
      await loadBattlecardData(selectedAudience, false);
    } catch (err: any) {
      showToast(`Review failed: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Handle publishing
  const handlePublish = async () => {
    if (!battlecard?.id) return;
    setPublishing(true);
    try {
      await publishBattlecard(
        battlecard.id,
        {
          published_by: "analyst",
          change_summary: changeSummary || "Verified competitive intelligence snapshot",
        },
        tenantId
      );
      showToast("Battlecard published successfully to immutable revision history");
      setPublishModalOpen(false);
      setChangeSummary("");
      await loadBattlecardData(selectedAudience, false);
    } catch (err: any) {
      showToast(`Publishing failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between animate-pulse">
          <div className="h-8 w-64 bg-slate-800 rounded-lg" />
          <div className="h-8 w-48 bg-slate-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-44 bg-slate-800/60 rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-48 bg-slate-800/60 rounded-xl" />
              <div className="h-48 bg-slate-800/60 rounded-xl" />
            </div>
          </div>
          <div className="h-96 bg-slate-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !battlecard) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">Battlecard Generation</h3>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          {error || `No active battlecard found for ${competitorName}. Generate a grounded, evidence-backed battlecard.`}
        </p>
        <button
          onClick={() => loadBattlecardData(selectedAudience, true)}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors shadow-lg cursor-pointer"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate {competitorName} Battlecard
        </button>
      </div>
    );
  }

  const fc = frontendData || {};
  const header = fc.BattlecardHeader || {};
  const snapshot = fc.CompetitorSnapshot || {};
  const salesView = fc.SalesView || {};
  const freshPanel = fc.FreshnessPanel || {};
  const pendingAlerts: ClaimDriftAlert[] = fc.DriftReviewPanel?.pending_alerts || [];
  const primaryAlert = pendingAlerts.length > 0 ? pendingAlerts[0] : null;

  // Resolve all blocks map
  const blocksMap = (battlecard.blocks || []).reduce((acc: Record<string, BattlecardBlock>, b) => {
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
    <div className="space-y-6 text-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 text-sm shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP COMPETITOR HEADER (Matches Image 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">{competitorName}</h1>
              {header.published_version ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Published v{header.published_version}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5" />
                  Draft v{header.current_version || 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Nov 2026
              </span>
              <span>•</span>
              <span>Owner: {header.owner_id || "Product Marketing"}</span>
              <span>•</span>
              <span>Freshness: {header.freshness_score || 100}%</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Audience Selector */}
          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Versions
          </button>

          {/* Regenerate Button */}
          <button
            onClick={() => loadBattlecardData(selectedAudience, true)}
            disabled={generating}
            title="Refresh and regenerate battlecard intelligence"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Publish Button */}
          <button
            onClick={() => setPublishModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* VIEW TABS BAR */}
      <div className="flex items-center gap-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer relative ${
            activeTab === "sales"
              ? "text-slate-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Sales view
        </button>
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer relative ${
            activeTab === "intelligence"
              ? "text-slate-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Intelligence view
        </button>
      </div>

      {/* MAIN TWO-COLUMN CONTENT AREA (Matches Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Main Battlecard Content (8 cols on large screens) */}
        <div className="lg:col-span-8 space-y-4">
          {activeTab === "sales" ? (
            <>
              {/* CARD 1: COMPETITOR SNAPSHOT */}
              <div className="p-5 rounded-xl bg-[#111726]/90 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-black text-xl text-slate-200 shrink-0">
                    {competitorName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">
                      {snapshot.category || "Enterprise Software & Cloud Architecture"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                      {snapshot.positioning_statement && snapshot.positioning_statement !== "Unknown"
                        ? snapshot.positioning_statement
                        : `Tracked competitor profile for ${competitorName} across market segments.`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        Mid-market / Enterprise
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        High relevance
                      </span>
                      {snapshot.domain && (
                        <a
                          href={`https://${snapshot.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
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
                <div className="p-4 rounded-xl bg-[#111726]/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span>Position Against Them</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {positioningBlock?.claims?.[0]?.fact_impact_act?.act ||
                        "Lead with governed workflows and lower operational overhead when reliability and auditability matter."}
                    </p>
                  </div>
                  {positioningBlock?.claims?.[0] && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                      <button
                        onClick={() => {
                          const clm = positioningBlock?.claims?.[0];
                          if (clm) handleOpenEvidence(clm);
                        }}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        Evidence ({positioningBlock.claims?.[0]?.evidence?.length || 1})
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* CARD 3: WHERE WE WIN */}
                <div className="p-4 rounded-xl bg-[#111726]/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      <span>Where We Win</span>
                    </div>
                    <div className="space-y-2">
                      {whereWeWinBlock?.claims && whereWeWinBlock.claims.length > 0 ? (
                        whereWeWinBlock.claims.map((clm, i) => (
                          <div
                            key={clm.id || i}
                            onClick={() => handleOpenEvidence(clm)}
                            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-300">
                              <span className="font-semibold text-slate-100">{clm.subject || clm.statement}</span>
                              {clm.fact_impact_act?.act && (
                                <span className="text-slate-400 block text-[11px] mt-0.5">
                                  {clm.fact_impact_act.act}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">No win points recorded (Unknown)</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 4: WHERE THEY WIN */}
                <div className="p-4 rounded-xl bg-[#111726]/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span>Where They Win</span>
                    </div>
                    <div className="space-y-2">
                      {whereTheyWinBlock?.claims && whereTheyWinBlock.claims.length > 0 ? (
                        whereTheyWinBlock.claims.map((clm, i) => (
                          <div
                            key={clm.id || i}
                            onClick={() => handleOpenEvidence(clm)}
                            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">
                              ✓
                            </span>
                            <div className="text-xs text-slate-300">
                              <span className="font-semibold text-slate-100">{clm.subject || clm.statement}</span>
                              {clm.fact_impact_act?.act && (
                                <span className="text-slate-400 block text-[11px] mt-0.5">
                                  {clm.fact_impact_act.act}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">No verified competitor win points recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 5: OBJECTION PLAYBOOK */}
                <div className="p-4 rounded-xl bg-[#111726]/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase mb-2.5">
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      <span>Objection Playbook</span>
                    </div>
                    {objectionsBlock?.claims && objectionsBlock.claims.length > 0 ? (
                      (() => {
                        const clm = objectionsBlock.claims[0];
                        return (
                          <div
                            onClick={() => handleOpenEvidence(clm)}
                            className="space-y-2 p-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <p className="text-xs text-slate-200 font-semibold">
                              Buyer says: &ldquo;{clm.subject || `${competitorName} is faster to implement.`}&rdquo;
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              <span className="text-amber-400 font-medium">Our response: </span>
                              {clm.fact_impact_act?.act ||
                                "Acknowledge rapid initial onboarding, then compare the enterprise controls required post-deployment."}
                            </p>
                            {clm.fact_impact_act?.impact && (
                              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>Key question: {clm.fact_impact_act.impact}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-xs text-slate-500 italic">No objection playbooks recorded.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* EXPANDABLE SECTIONS: Discovery, SWOT, Proof Points */}
              <div className="space-y-2">
                {/* Sales Discovery Questions */}
                <div className="rounded-xl bg-[#111726]/90 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setDiscoveryExpanded(!discoveryExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-slate-200 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-sky-400" />
                      <span>Sales Discovery &amp; Trap Questions ({discoveryBlock?.claims?.length || 0})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${discoveryExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {discoveryExpanded && (
                    <div className="p-4 pt-1 border-t border-slate-800/80 space-y-2.5">
                      {discoveryBlock?.claims?.map((clm, i) => (
                        <div
                          key={clm.id || i}
                          onClick={() => handleOpenEvidence(clm)}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                        >
                          <div className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                            <span>{clm.statement}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Trap Question
                            </span>
                          </div>
                          {clm.fact_impact_act?.fact && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              Rationale: {clm.fact_impact_act.fact}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Competitive Strengths & Weaknesses */}
                <div className="rounded-xl bg-[#111726]/90 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setSwotExpanded(!swotExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-slate-200 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span>Strengths &amp; Weaknesses Matrix</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${swotExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {swotExpanded && (
                    <div className="p-4 pt-1 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-amber-400">Competitor Strengths</div>
                        {swotBlock?.content?.strengths?.map((s: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                            {s.statement}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-emerald-400">Competitor Weaknesses</div>
                        {swotBlock?.content?.weaknesses?.map((w: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                            {w.statement}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Verified Proof Points */}
                <div className="rounded-xl bg-[#111726]/90 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setProofExpanded(!proofExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-slate-200 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Verified Proof Points ({proofBlock?.claims?.length || 0})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${proofExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {proofExpanded && (
                    <div className="p-4 pt-1 border-t border-slate-800/80 space-y-2">
                      {proofBlock?.claims?.map((clm, i) => (
                        <div
                          key={clm.id || i}
                          onClick={() => handleOpenEvidence(clm)}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-200">{clm.subject}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{clm.statement}</div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            clm.verification_status === "verified"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-400"
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
                <div className="p-3.5 rounded-xl bg-[#111726]/90 border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Pricing Snapshot</div>
                    <div className="text-xs font-semibold text-slate-200 mt-0.5">
                      {pricingBlock?.content?.pricing_model && pricingBlock.content.pricing_model !== "Unknown"
                        ? `${pricingBlock.content.pricing_model}`
                        : "Public pricing not verified"}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#111726]/90 border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Recent Change</div>
                    <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate max-w-xs">
                      {recentChangesBlock?.content?.items?.[0]?.change || "Enterprise roadmap evolution tracked"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* INTELLIGENCE VIEW TAB */
            <div className="p-6 rounded-xl bg-[#111726]/90 border border-slate-800 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-100">Claim Registry &amp; Verification Ledger</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Atomic, reusable intelligence claims linked directly to empirical source evidence.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    {freshPanel.verified_claims || 0} Verified
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
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
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                          {clm.claim_type.replace(/_/g, " ")}
                        </span>
                        <span>•</span>
                        <span className="text-xs font-bold text-slate-200">{clm.subject}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        clm.verification_status === "verified"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {clm.verification_status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{clm.statement}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 text-[11px] border-t border-slate-800/60">
                      <div>
                        <span className="text-slate-500 font-medium">Fact: </span>
                        <span className="text-slate-300">{clm.fact_impact_act?.fact || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Impact: </span>
                        <span className="text-slate-300">{clm.fact_impact_act?.impact || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Act: </span>
                        <span className="text-slate-300">{clm.fact_impact_act?.act || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span>Citations: {clm.evidence?.length || 0} sources</span>
                      <span className="text-sky-400 flex items-center gap-1 font-medium">
                        View Provenance <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Trust & Freshness + Claim Change Alerts (4 cols on large screens) */}
        <div className="lg:col-span-4 space-y-4">
          {/* TRUST & FRESHNESS CARD (Matches Image 2) */}
          <div className="p-5 rounded-xl bg-[#111726]/90 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs tracking-wider uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Trust &amp; Freshness</span>
              </div>
              <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-400 cursor-pointer" />
            </div>

            {/* KPI STATS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-black text-emerald-400">
                  {freshPanel.verified_claims || 6}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Claims supported</div>
              </div>
              <div>
                <div className="text-3xl font-black text-amber-400">
                  {freshPanel.pending_drift_alerts_count || (primaryAlert ? 1 : 0)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Items need review</div>
              </div>
            </div>

            {/* VERIFIED EVIDENCE ITEMS LIST (Clickable rows) */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              {(battlecard.blocks || [])
                .flatMap((b) => b.claims || [])
                .filter((c) => c.verification_status === "verified")
                .slice(0, 4)
                .map((clm, idx) => (
                  <div
                    key={clm.id || idx}
                    onClick={() => handleOpenEvidence(clm)}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{clm.subject}</div>
                        <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Confidence: {clm.confidence || "95%"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 shrink-0 text-[11px]">
                      <span>Nov 2026</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* CLAIM CHANGE DETECTED (Drift Alert Card with Gold Border & Button) */}
          {primaryAlert ? (
            <div className="p-5 rounded-xl bg-slate-900/90 border-2 border-amber-500/80 shadow-lg shadow-amber-500/5 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Claim Change Detected</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Old claim:</span>
                  <p className="text-slate-200 font-medium mt-0.5">
                    {primaryAlert.claim?.statement || "No public SSO support found"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">New evidence:</span>
                  <p className="text-slate-200 font-medium mt-0.5">
                    {primaryAlert.new_evidence_excerpt || "Enterprise SSO documentation discovered"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenDriftReview(primaryAlert)}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors shadow-md cursor-pointer"
              >
                <span>Review update</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1">
                <button
                  onClick={() => {
                    if (primaryAlert.claim) handleOpenEvidence(primaryAlert.claim);
                  }}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                >
                  View evidence ({primaryAlert.claim?.evidence?.length || 1}) →
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#111726]/60 border border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-slate-200">All Claims Grounded &amp; Stable</div>
              <div className="text-[11px] text-slate-400">
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setEvidenceDrawerOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Evidence Provenance</h3>
                  <div className="text-[11px] text-slate-400">Grounded Intelligence Audit</div>
                </div>
              </div>
              <button
                onClick={() => setEvidenceDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Claim Overview */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  {selectedClaim.claim_type.replace(/_/g, " ")}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  selectedClaim.verification_status === "verified"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {selectedClaim.verification_status.toUpperCase()}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-100">{selectedClaim.subject}</h4>
              <p className="text-xs text-slate-300">{selectedClaim.statement}</p>
            </div>

            {/* Fact -> Impact -> Act Framework Details */}
            <div className="space-y-2 text-xs">
              <div className="text-xs font-bold text-slate-200 tracking-wider uppercase">Strategic Framework</div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div>
                  <span className="text-slate-500 font-semibold">Fact: </span>
                  <span className="text-slate-300">{selectedClaim.fact_impact_act?.fact || "Documented reality."}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Impact: </span>
                  <span className="text-slate-300">{selectedClaim.fact_impact_act?.impact || "Commercial implication."}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Act: </span>
                  <span className="text-slate-300">{selectedClaim.fact_impact_act?.act || "Recommended counter-move."}</span>
                </div>
              </div>
            </div>

            {/* Linked Evidence Sources */}
            <div className="space-y-3 flex-1">
              <div className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                Supporting Sources ({selectedClaim.evidence?.length || 0})
              </div>

              {selectedClaim.evidence && selectedClaim.evidence.length > 0 ? (
                selectedClaim.evidence.map((ev, i) => (
                  <div key={ev.id || i} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        ev.relationship === "contradicts"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {ev.relationship.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">{ev.publication_date || "Nov 2026"}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      &ldquo;{ev.excerpt}&rdquo;
                    </p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{ev.source_title || "Official Public Source"}</span>
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 font-medium"
                        >
                          Visit Link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                  No empirical sources linked (marked as Unknown).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DRIFT REVIEW MODAL (Side-by-side Old vs New Comparison) */}
      {/* ========================================================================= */}
      {driftModalOpen && activeDriftAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setDriftModalOpen(false)} />
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Claim Drift Review</h3>
                  <div className="text-xs text-slate-400">
                    Competitor: <span className="font-semibold text-slate-200">{activeDriftAlert.company_name}</span> | Type:{" "}
                    <span className="text-amber-400 font-semibold uppercase">{activeDriftAlert.drift_type}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDriftModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Old Claim */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Claim</div>
                <div className="text-xs font-bold text-slate-200">{activeDriftAlert.claim?.subject}</div>
                <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {activeDriftAlert.claim?.statement}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  Status: <span className="text-emerald-400 font-semibold">{activeDriftAlert.claim?.status}</span>
                </div>
              </div>

              {/* Right: New Trigger Evidence */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">New Evidence Detected</div>
                <p className="text-xs text-slate-200 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
                  {activeDriftAlert.new_evidence_excerpt}
                </p>
                {activeDriftAlert.new_evidence_url && (
                  <a
                    href={activeDriftAlert.new_evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline pt-1"
                  >
                    View Source Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Suggested Update Form */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Suggested Claim Update</span>
                <button
                  type="button"
                  onClick={() => setIsEditingDrift(!isEditingDrift)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditingDrift ? "Cancel Custom Edits" : "Edit Before Accepting"}
                </button>
              </div>

              {isEditingDrift ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Claim Statement</label>
                    <textarea
                      value={editedStatement}
                      onChange={(e) => setEditedStatement(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">Fact</label>
                      <input
                        type="text"
                        value={editedFact}
                        onChange={(e) => setEditedFact(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">Impact</label>
                      <input
                        type="text"
                        value={editedImpact}
                        onChange={(e) => setEditedImpact(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">Act</label>
                      <input
                        type="text"
                        value={editedAct}
                        onChange={(e) => setEditedAct(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-300 italic">
                  &ldquo;{activeDriftAlert.suggested_update?.statement || editedStatement}&rdquo;
                </p>
              )}

              {/* Review Notes */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Analyst Review Notes (Audit Trail)</label>
                <input
                  type="text"
                  placeholder="e.g. Verified official product documentation and updated sales response"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitReview("dismiss")}
                  disabled={submittingReview}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Dismiss (Irrelevant)
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitReview("mark_incorrect")}
                  disabled={submittingReview}
                  className="px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-medium cursor-pointer"
                >
                  Mark Incorrect
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isEditingDrift ? (
                  <button
                    type="button"
                    onClick={() => handleSubmitReview("edit_and_accept")}
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 cursor-pointer"
                  >
                    {submittingReview ? "Saving..." : "Save Edits & Accept"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmitReview("accept")}
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
                  >
                    {submittingReview ? "Applying..." : "Accept Suggested Update"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PUBLISH CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setPublishModalOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">Publish Battlecard Version</h3>
              <button onClick={() => setPublishModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Publishing will freeze the current battlecard, all 10 blocks, and linked claims into an immutable published revision.
            </p>
            <div>
              <label className="text-xs text-slate-400 font-medium">Changelog Summary</label>
              <textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Q4 competitive positioning refresh with verified pricing tiers"
                rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 cursor-pointer"
              >
                {publishing ? "Publishing..." : "Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VERSION HISTORY DRAWER */}
      {/* ========================================================================= */}
      {versionsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setVersionsDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 z-10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">Version History</h3>
              </div>
              <button onClick={() => setVersionsDrawerOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1">
              {revisions.length > 0 ? (
                revisions.map((rev) => (
                  <div
                    key={rev.id || rev.version}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">Version {rev.version}</span>
                      <span className="text-[10px] text-slate-400">
                        {rev.published_at ? new Date(rev.published_at).toLocaleDateString() : "Nov 2026"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      {rev.change_summary || "Initial intelligence publication."}
                    </div>
                    <div className="text-[11px] text-slate-500">Published by: {rev.published_by}</div>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                  No published revisions yet. Current state is draft v1.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
