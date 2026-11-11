import { apiClient } from "./client";


export async function listBarbers({ includeInactive, skip, limit, signal } = {}) {
  const response = await apiClient.get("/barbers", {
    signal,
    params: {
      include_inactive: includeInactive || undefined,
      skip,
      limit,
    },
  });

  return response.data;
}


export async function createBarber(payload) {
  const response = await apiClient.post("/barbers", payload);
  return response.data;
}


export async function updateBarber(barberId, payload) {
  const response = await apiClient.put(
    `/barbers/${barberId}`,
    payload
  );

  return response.data;
}


export async function setBarberActive(barberId, isActive) {
  const action = isActive ? "activate" : "deactivate";

  const response = await apiClient.patch(
    `/barbers/${barberId}/${action}`
  );

  return response.data;
}

export async function getBarberAccess(barberId, signal) {
  const response = await apiClient.get(`/barbers/${barberId}/access`, { signal });
  return response.data;
}

export async function saveBarberAccess(barberId, payload) {
  const response = await apiClient.put(`/barbers/${barberId}/access`, payload);
  return response.data;
}


export async function getBarberSchedule(barberId) {
  const response = await apiClient.get(
    `/barbers/${barberId}/schedule`
  );

  return response.data;
}


export async function updateBarberSchedule(barberId, days) {
  const response = await apiClient.put(
    `/barbers/${barberId}/schedule`,
    { days }
  );

  return response.data;
}


export async function listBarberTimeOff(barberId) {
  const response = await apiClient.get(
    `/barbers/${barberId}/time-off`
  );

  return response.data;
}


export async function createBarberTimeOff(barberId, payload) {
  const response = await apiClient.post(
    `/barbers/${barberId}/time-off`,
    payload
  );

  return response.data;
}


export async function deleteBarberTimeOff(
  barberId,
  timeOffId
) {
  await apiClient.delete(
    `/barbers/${barberId}/time-off/${timeOffId}`
  );
}
