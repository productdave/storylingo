import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function resolveApiUrl({
  configuredDomain,
  nodeEnv,
  browserOrigin,
}: {
  configuredDomain?: string;
  nodeEnv?: string;
  browserOrigin?: string;
}): string {
  if (configuredDomain) {
    const isLocalhost =
      configuredDomain.startsWith("localhost") ||
      configuredDomain.startsWith("127.0.0.1");
    const protocol = isLocalhost ? "http" : "https";
    return new URL(`${protocol}://${configuredDomain}`).href;
  }

  if (nodeEnv !== "production") {
    return "http://127.0.0.1:5000/";
  }

  if (browserOrigin && browserOrigin !== "null") {
    return new URL("/", browserOrigin).href;
  }

  throw new Error("StoryLingo API domain is unavailable");
}

export function getApiUrl(): string {
  return resolveApiUrl({
    configuredDomain: process.env.EXPO_PUBLIC_DOMAIN,
    nodeEnv: process.env.NODE_ENV,
    browserOrigin:
      typeof window !== "undefined" ? window.location.origin : undefined,
  });
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch {
    throw new Error(
      process.env.NODE_ENV !== "production"
        ? "Cannot reach the local StoryLingo server. Run npm run dev, then try again."
        : "StoryLingo could not reach the game server. Check your connection and try again.",
    );
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
