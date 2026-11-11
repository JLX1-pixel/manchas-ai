import { apiClient } from "./client";

export async function login({ businessSlug, email, password }) {
  const response = await apiClient.post("/auth/login", {
    business_slug: businessSlug || null,
    email,
    password,
  });

  return response.data;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}

export async function registerBusiness(payload) {
  const response = await apiClient.post("/auth/register", payload);
  return response.data;
}

export async function requestPasswordReset({ businessSlug, email }) {
  const response = await apiClient.post("/auth/password-reset/request", {
    business_slug: businessSlug || null,
    email,
  });

  return response.data;
}

export async function confirmPasswordReset({ token, newPassword }) {
  const response = await apiClient.post("/auth/password-reset/confirm", {
    token,
    new_password: newPassword,
  });

  return response.data;
}
