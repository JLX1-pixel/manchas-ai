import { apiClient } from "./client";

export async function listClients({ search, includeInactive } = {}) {
  const response = await apiClient.get("/clients", {
    params: {
      search: search || undefined,
      include_inactive: includeInactive || undefined,
    },
  });

  return response.data;
}

export async function createClient(payload) {
  const response = await apiClient.post("/clients", payload);
  return response.data;
}

export async function updateClient(clientId, payload) {
  const response = await apiClient.put(`/clients/${clientId}`, payload);
  return response.data;
}

export async function setClientActive(clientId, isActive) {
  const action = isActive ? "activate" : "deactivate";
  const response = await apiClient.patch(`/clients/${clientId}/${action}`);
  return response.data;
}
