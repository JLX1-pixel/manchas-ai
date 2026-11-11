import { listBarbers } from "./barbers";
import { apiClient } from "./client";
import { listClients } from "./clients";
import { listServices } from "./services";

async function collectPages(listPage, options) {
  const limit = 200;
  const records = new Map();

  for (let skip = 0; ; skip += limit) {
    const page = await listPage({ ...options, skip, limit });
    for (const record of page) {
      records.set(record.id, record);
    }
    if (page.length < limit) {
      return [...records.values()];
    }
  }
}

export async function loadAppointmentCatalogs(signal) {
  const options = { includeInactive: true, signal };
  const [clients, barbers, services] = await Promise.all([
    collectPages(listClients, options),
    collectPages(listBarbers, options),
    collectPages(listServices, options),
  ]);
  return { clients, barbers, services };
}

export function listAppointments({ date, barberId, signal }) {
  return collectPages(async ({ skip, limit }) => {
    const response = await apiClient.get("/appointments", {
      signal,
      params: {
        appointment_date: date,
        barber_id: barberId || undefined,
        skip,
        limit,
      },
    });
    return response.data;
  });
}

export async function createAppointment(payload) {
  const response = await apiClient.post("/appointments", payload);
  return response.data;
}

export async function rescheduleAppointment(id, payload) {
  const response = await apiClient.put(`/appointments/${id}`, payload);
  return response.data;
}

export async function changeAppointmentStatus(id, action) {
  const response = await apiClient.patch(`/appointments/${id}/${action}`);
  return response.data;
}
