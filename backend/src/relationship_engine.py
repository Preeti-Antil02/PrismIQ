"""
Competitive Relationship Engine for PrismIQ Batch 4.
Creates and queries structured typed relationships between:
- Competitors
- Products
- Features
- Events
- Signals
- Partnerships
- Hiring activity
- Strategic patterns
Maintains source provenance or clearly identified inferences on every relationship,
with chronological change history and graph traversal.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from . import batch4_storage

logger = logging.getLogger(__name__)

PREDICATE_DEFINITIONS = {
    "competes_with": "Direct market rivalry between companies or products",
    "has_product": "Company owns and operates product line",
    "offers_feature": "Product implements specific capability or feature",
    "triggered_event": "Entity caused or is subject of consolidated event",
    "evidenced_by": "Claim or relationship is grounded in specific evidence citation",
    "partnered_with": "Commercial, distribution, or technology partnership",
    "recruits_for": "Hiring activity or headcount expansion in specific capability",
    "exhibits_pattern": "Observed strategic pattern demonstrated by competitor",
    "neutralizes": "Our feature or claim overcomes competitor feature/objection",
    "contradicts": "Evidence or claim actively disputes another assertion",
    "supports": "Evidence confirms claim validity",
}


class RelationshipEngine:
    """
    Manages typed relationship graph across competitive intelligence entities.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def create_relationship(
        self,
        subject_id: str,
        subject_type: str,
        subject_name: str,
        predicate: str,
        object_id: str,
        object_type: str,
        object_name: str,
        relationship_source: str = "verified_fact",
        source_reference: Optional[str] = None,
        is_inferred: bool = False,
        inference_reason: Optional[str] = None,
        confidence: str = "High",
        metadata: Optional[Dict[str, Any]] = None,
        actor_id: str = "system",
    ) -> Dict[str, Any]:
        """
        Create a new typed relationship.
        Enforces: Every relationship must have a verified source or a clearly identified inference reason.
        """
        sub_type = subject_type.strip().lower()
        obj_type = object_type.strip().lower()
        pred = predicate.strip().lower()

        if is_inferred and not inference_reason:
            raise ValueError("Inferred relationships must clearly identify an inference reason.")

        if not relationship_source and not is_inferred:
            raise ValueError("Every relationship must specify a source (e.g. verified_fact, news_citation) or identify an inference.")

        rel_data = {
            "subject_id": str(subject_id).strip(),
            "subject_type": sub_type,
            "subject_name": str(subject_name).strip(),
            "predicate": pred,
            "object_id": str(object_id).strip(),
            "object_type": obj_type,
            "object_name": str(object_name).strip(),
            "relationship_source": relationship_source,
            "source_reference": source_reference,
            "is_inferred": is_inferred,
            "inference_reason": inference_reason if is_inferred else None,
            "confidence": confidence,
            "metadata": metadata or {},
        }

        return batch4_storage.save_relationship(rel_data, self.tenant_id, actor_id=actor_id)

    def get_relationship(self, relationship_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve relationship by ID."""
        return batch4_storage.get_relationship(relationship_id, self.tenant_id)

    def update_relationship(
        self,
        relationship_id: str,
        updates: Dict[str, Any],
        actor_id: str = "analyst",
        notes: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update relationship attributes and record historical mutation."""
        rel = self.get_relationship(relationship_id)
        if not rel:
            return None

        # If updated to inferred, ensure inference reason provided
        is_inf = updates.get("is_inferred", rel.get("is_inferred", False))
        inf_reason = updates.get("inference_reason", rel.get("inference_reason"))
        if is_inf and not inf_reason:
            raise ValueError("Inferred relationships must clearly identify an inference reason.")

        for k, v in updates.items():
            if v is not None:
                rel[k] = v

        return batch4_storage.save_relationship(rel, self.tenant_id, actor_id=actor_id)

    def get_relationship_history(self, relationship_id: str) -> List[Dict[str, Any]]:
        """Retrieve chronological audit trail of mutations for a relationship."""
        return batch4_storage.get_relationship_history(relationship_id, self.tenant_id)

    def list_relationships(
        self,
        subject_id: Optional[str] = None,
        subject_type: Optional[str] = None,
        predicate: Optional[str] = None,
        object_id: Optional[str] = None,
        object_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        status: Optional[str] = "active",
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Query relationships matching specific edge filters."""
        return batch4_storage.list_relationships(
            tenant_id=self.tenant_id,
            subject_id=subject_id,
            subject_type=subject_type,
            predicate=predicate,
            object_id=object_id,
            object_type=object_type,
            entity_id=entity_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    def synthesize_from_workspace(self) -> List[Dict[str, Any]]:
        """
        Synthesize real tenant-scoped relationships from this tenant's tracked companies,
        swept events, and signal correlations when no explicit edges exist yet.
        """
        existing = self.list_relationships(limit=10)
        if existing:
            return existing

        from . import storage

        cfg = storage.get_tenant_workspace_config(self.tenant_id) or {}
        target = str(cfg.get("target_company") or "").strip()
        comps = [str(c).strip() for c in (cfg.get("competitors") or []) if str(c).strip()]
        events = storage.load_events(tenant_id=self.tenant_id) or []
        correlations = storage.get_signal_correlations(tenant_id=self.tenant_id) or []

        if not target and not comps and not events:
            return []

        created: List[Dict[str, Any]] = []
        target_slug = (target or "target").lower().replace(" ", "_")

        # 1. Tracked competitor rivalry edges
        for comp in comps[:8]:
            comp_slug = comp.lower().replace(" ", "_")
            created.append(
                self.create_relationship(
                    subject_id=target_slug,
                    subject_type="competitor",
                    subject_name=target or "Workspace Target",
                    predicate="competes_with",
                    object_id=comp_slug,
                    object_type="competitor",
                    object_name=comp,
                    relationship_source="verified_fact",
                    source_reference="Tenant Confirmed Competitive Watchlist",
                    confidence="High",
                )
            )

        # 2. Event-grounded product/feature/partnership/hiring edges
        seen_titles = set()
        for idx, ev in enumerate(events[:25]):
            comp = str(ev.get("company_name") or ev.get("company") or "").strip()
            title = str(ev.get("title") or "").strip()
            if not comp or not title or title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())
            t_low = title.lower()
            if any(w in t_low for w in ("partner", "alliance", "integration")):
                pred, obj_type = "partnered_with", "partnership"
            elif any(w in t_low for w in ("hiring", "recruit", "director", "engineer")):
                pred, obj_type = "recruits_for", "hiring"
            elif any(w in t_low for w in ("launch", "release", "feature", "sdk", "api", "v1", "v2")):
                pred, obj_type = "offers_feature", "feature"
            else:
                pred, obj_type = "triggered_event", "event"
            created.append(
                self.create_relationship(
                    subject_id=comp.lower().replace(" ", "_"),
                    subject_type="competitor",
                    subject_name=comp,
                    predicate=pred,
                    object_id=str(ev.get("event_id") or f"evt_{idx}"),
                    object_type=obj_type,
                    object_name=title[:140],
                    relationship_source="verified_fact",
                    source_reference=str(ev.get("url") or "Verified Competitive Event"),
                    confidence=str(ev.get("fact_confidence") or ev.get("confidence") or "High"),
                )
            )
            if len(created) >= 18:
                break

        # 3. Correlated strategic pattern edges
        for corr in correlations[:6]:
            comp = str(corr.get("company_name") or "").strip()
            pname = str(corr.get("pattern_name") or "").strip()
            if not comp or not pname:
                continue
            created.append(
                self.create_relationship(
                    subject_id=comp.lower().replace(" ", "_"),
                    subject_type="competitor",
                    subject_name=comp,
                    predicate="exhibits_pattern",
                    object_id=str(corr.get("id") or f"pat_{len(created)}"),
                    object_type="strategic_pattern",
                    object_name=pname[:140],
                    relationship_source="inferred",
                    source_reference="PrismIQ Multi-Channel Signal Correlation Engine",
                    is_inferred=True,
                    inference_reason=str(corr.get("pattern_summary") or "Correlated across multi-channel signals."),
                    confidence="High",
                )
            )

        return created

    def get_entity_graph(
        self,
        entity_id: str,
        depth: int = 1,
        max_depth: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Traverse graph around an entity to return connected nodes and edges.
        """
        effective_depth = max_depth if max_depth is not None else depth
        visited_nodes: Dict[str, Dict[str, str]] = {}
        visited_edges: List[Dict[str, Any]] = []
        edge_ids: Set[str] = set()

        def _traverse(current_id: str, current_depth: int):
            if current_depth > effective_depth:
                return


            # Find edges where current_id is subject or object
            rels = batch4_storage.list_relationships(
                tenant_id=self.tenant_id,
                entity_id=current_id,
                limit=100,
            )

            for r in rels:
                if r["id"] not in edge_ids:
                    edge_ids.add(r["id"])
                    visited_edges.append(r)

                    s_key = f"{r['subject_type']}:{r['subject_id']}"
                    if s_key not in visited_nodes:
                        visited_nodes[s_key] = {
                            "id": r["subject_id"],
                            "type": r["subject_type"],
                            "name": r["subject_name"],
                        }

                    o_key = f"{r['object_type']}:{r['object_id']}"
                    if o_key not in visited_nodes:
                        visited_nodes[o_key] = {
                            "id": r["object_id"],
                            "type": r["object_type"],
                            "name": r["object_name"],
                        }

                    # Next hop
                    next_id = r["object_id"] if r["subject_id"] == current_id else r["subject_id"]
                    if current_depth + 1 <= depth:
                        _traverse(next_id, current_depth + 1)

        _traverse(str(entity_id).strip(), 1)

        return {
            "root_entity_id": entity_id,
            "depth": depth,
            "nodes_count": len(visited_nodes),
            "edges_count": len(visited_edges),
            "nodes": list(visited_nodes.values()),
            "edges": visited_edges,
        }
