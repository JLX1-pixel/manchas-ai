import { apiClient } from "./client";

export async function getDashboardSummary(signal) {
  const response = await apiClient.get("/dashboard/summary", { signal });
  return response.data;
}
