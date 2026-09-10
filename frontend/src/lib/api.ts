import { BriefSummary, HistoricalRadarRecord, ResearchTopic } from "@/types/brief";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export async function fetchBriefsList(): Promise<BriefSummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/briefs`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load briefs list (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.briefs || [];
  } catch (error) {
    console.error("Error fetching briefs list:", error);
    return [];
  }
}

export async function fetchBriefById(id: string = "latest"): Promise<{
  id: string;
  date: string;
  filename: string;
  content: string;
} | null> {
  try {
    const endpoint =
      id === "latest"
        ? `${API_BASE_URL}/briefs/latest`
        : `${API_BASE_URL}/briefs/${id}`;

    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch brief '${id}' (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.error(`Error fetching brief ${id}:`, error);
    return null;
  }
}

export async function fetchRadarTopics(): Promise<ResearchTopic[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-radar/topics`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.topics || [];
  } catch (err) {
    console.error("Error fetching radar topics:", err);
    return [];
  }
}

export async function createRadarTopic(topic_label: string, keywords: string[]): Promise<ResearchTopic | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-radar/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_label, keywords }),
    });
    if (!res.ok) throw new Error("Failed to create research topic");
    return await res.json();
  } catch (err) {
    console.error("Error creating radar topic:", err);
    return null;
  }
}

export async function deleteRadarTopic(topic_id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-radar/topics/${topic_id}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.error("Error deleting radar topic:", err);
    return false;
  }
}

export async function fetchLatestRadar(): Promise<HistoricalRadarRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-radar/latest`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.evaluations || [];
  } catch (err) {
    console.error("Error fetching latest radar:", err);
    return [];
  }
}

export async function fetchRadarHistory(topic_label?: string, competitor?: string): Promise<HistoricalRadarRecord[]> {
  try {
    const params = new URLSearchParams();
    if (topic_label) params.append("topic_label", topic_label);
    if (competitor) params.append("competitor", competitor);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/research-radar/history${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  } catch (err) {
    console.error("Error fetching radar history:", err);
    return [];
  }
}
