import { BriefSummary } from "@/types/brief";

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
      throw new Error(`Failed to load brief ${id} (HTTP ${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error(`Error fetching brief ${id}:`, error);
    return null;
  }
}
