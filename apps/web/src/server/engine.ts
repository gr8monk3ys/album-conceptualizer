type EngineFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

function getEngineBaseUrl() {
  return process.env.ENGINE_API_URL ?? "http://localhost:8000/api/v1";
}

export async function engineFetch(path: string, init?: EngineFetchInit) {
  const base = getEngineBaseUrl().replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    accept: "application/json",
    ...(init?.headers ?? {}),
  };

  const apiKey = process.env.ENGINE_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}
