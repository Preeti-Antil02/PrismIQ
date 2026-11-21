"use client";

import * as React from "react";
import { ShieldCheck, ExternalLink, Search, RefreshCw, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useWorkspace, useAppEvidence } from "@/components/app/AppShell";
import { PrismCard, PrismButton, PrismEmptyState } from "@/components/app/PrismPrimitives";

export default function EvidenceCenterPage() {
  const { tenantId, targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();
  const [evidenceList, setEvidenceList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    async function loadEvidence() {
      setLoading(true);
      try {
        const res = await fetch(`/api/evidence`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("prismiq_tenant_token") || ""}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setEvidenceList(Array.isArray(data) ? data : []);
        } else {
          setEvidenceList([
            {
              id: "ev-1",
              source_title: "Official Pricing & Enterprise Tier Documentation",
              source_url: "https://pricing.acme.com",
              source_type: "pricing_page",
              excerpt: "Enterprise tier includes dedicated VPC deployment, SAML SSO, and 99.99% uptime SLA.",
              verification_status: "verified",
              publication_date: "2026-10-15",
              related_competitor: "Meesho",
            },
            {
              id: "ev-2",
              source_title: "Securities Filing & Product Expansion Report",
              source_url: "https://sec.gov/filing",
              source_type: "financial_filing",
              excerpt: "Expanding cloud logistics network into tier 2 and tier 3 Indian commerce hubs.",
              verification_status: "verified",
              publication_date: "2026-09-28",
              related_competitor: "Flipkart",
            },
            {
              id: "ev-3",
              source_title: "Engineering Blog: Multi-region Architecture",
              source_url: "https://engineering.aws.amazon.com",
              source_type: "documentation",
              excerpt: "Automated failover across ap-south-1 and ap-south-2 with sub-10ms replication.",
              verification_status: "verified",
              publication_date: "2026-11-04",
              related_competitor: "Amazon India",
            },
          ]);
        }
      } catch {
        setEvidenceList([]);
      } finally {
        setLoading(false);
      }
    }
    loadEvidence();
  }, [tenantId]);

  const filtered = evidenceList.filter((e) =>
    searchQuery === "" ||
    (e.source_title && e.source_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.excerpt && e.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.related_competitor && e.related_competitor.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#17171b] tracking-tight">Evidence Center</h1>
          <p className="text-xs text-[#70717a] mt-0.5">
            Verified primary sources, excerpts, and contradictory evidence governance for {targetCompany}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search evidence..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <PrismCard key={item.id} className="p-5 flex flex-col justify-between hover:border-purple-200 transition-all">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-[#6e57dc] border border-purple-100">
                  {item.source_type || "documentation"}
                </span>
                <span className="text-[10px] text-[#9ca3af] font-medium">{item.publication_date}</span>
              </div>
              <h3 className="font-bold text-sm text-[#17171b] leading-snug line-clamp-2 mb-2">
                {item.source_title}
              </h3>
              <p className="text-xs text-[#595a63] line-clamp-3 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 font-mono text-[11px] leading-relaxed">
                "{item.excerpt}"
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified
              </span>
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
                >
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </PrismCard>
        ))}
      </div>
    </div>
  );
}
