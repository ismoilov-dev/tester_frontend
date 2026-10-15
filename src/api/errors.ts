export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: any = {}) { super(message); }
}

export function toApiError(e: any): ApiError {
  if (e instanceof ApiError) return e;
  const r = e?.response;
  if (!r) return new ApiError(0, "NETWORK", "Internet aloqasi yo'q");
  const err = r.data?.error ?? {};
  return new ApiError(r.status, err.code ?? "UNKNOWN", err.message ?? r.data?.detail ?? "Xatolik", err.details ?? {});
}

export const errMsg = (e: unknown) => toApiError(e).message;
