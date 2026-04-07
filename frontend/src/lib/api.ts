// Use relative URLs so requests go through Next.js rewrites (see next.config.ts).
// This makes cookies same-origin from the browser's POV, which is required for the
// edge middleware to read auth cookies.
const API_BASE = "";

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function drainQueue(error: Error | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });

  if (res.status === 401 && !path.includes("/auth/")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        isRefreshing = false;
        drainQueue(null);
      } catch (e) {
        isRefreshing = false;
        drainQueue(e as Error);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw e;
      }
    } else {
      await new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      });
    }

    const retryRes = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      credentials: "include",
      ...options,
    });
    if (!retryRes.ok) {
      const errorBody = await retryRes.text().catch(() => "");
      throw new Error(`API error ${retryRes.status}: ${errorBody}`);
    }
    return retryRes.json();
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }
  return res.json();
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
