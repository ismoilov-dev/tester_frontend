import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "../stores/auth";
import { useAttempt } from "../stores/attempt";
import type { TokenPair } from "./types";

const baseURL = import.meta.env.VITE_API_URL as string;

export const adminApi = axios.create({ baseURL });
export const studentApi = axios.create({ baseURL });

adminApi.interceptors.request.use(cfg => {
  const t = useAuth.getState().access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

studentApi.interceptors.request.use(cfg => {
  const t = useAttempt.getState().token;
  if (t) cfg.headers["X-Participant-Token"] = t;
  return cfg;
});

// ---- Admin token yangilash: bir vaqtdagi 401 lar uchun bitta umumiy refresh ----
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccess(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = useAuth.getState().refresh;
  if (!refresh) return Promise.resolve(null);
  refreshPromise = axios
    .post<Omit<TokenPair, "user">>(`${baseURL}/auth/refresh/`, { refresh })
    .then(r => {
      useAuth.getState().setTokens(r.data.access, r.data.refresh ?? refresh);
      return r.data.access;
    })
    .catch(() => {
      useAuth.getState().clear();
      return null;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

adminApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const cfg = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  const url = cfg?.url ?? "";
  if (error.response?.status === 401 && cfg && !cfg._retry && !url.includes("/auth/login") && !url.includes("/auth/refresh")) {
    cfg._retry = true;
    const access = await refreshAccess();
    if (access) {
      cfg.headers.Authorization = `Bearer ${access}`;
      return adminApi(cfg);
    }
  }
  return Promise.reject(error);
});
