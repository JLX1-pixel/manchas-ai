import { apiClient } from "./client";

export async function listServices({ includeInactive } = {}) {
  const response = await apiClient.get("/services", {
    params: {
      include_inactive: includeInactive || undefined,
    },
  });

  return response.data;
}

export async function createService(payload) {
  const response = await apiClient.post("/services", payload);
  return response.data;
}

export async function updateService(serviceId, payload) {
  const response = await apiClient.put(`/services/${serviceId}`, payload);
  return response.data;
}

export async function setServiceActive(serviceId, isActive) {
  const action = isActive ? "activate" : "deactivate";
  const response = await apiClient.patch(`/services/${serviceId}/${action}`);
  return response.data;
}
