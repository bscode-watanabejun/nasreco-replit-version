import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const errorData = await res.json();
      console.error("❌ API Error Response:", errorData);
      throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
    } catch (jsonError) {
      const text = await res.text() || res.statusText;
      console.error("❌ API Error (text):", text);
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest(
  url: string,
  method: string = 'GET',
  data?: unknown | undefined,
): Promise<any> {
  // FormDataの場合は、Content-Typeヘッダーを設定しない（ブラウザが自動設定）
  const isFormData = data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // 204 No Content の場合は空のレスポンスを返す
  if (res.status === 204) {
    return null;
  }
  
  // レスポンスボディが空の場合はJSONパースをスキップ
  const contentLength = res.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }
  
  try {
    const responseData = await res.json();
    return responseData;
  } catch (error) {
    // JSONパースに失敗した場合は空のレスポンスとして扱う
    console.warn('JSONパースに失敗しました。空のレスポンスとして処理します。', error);
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
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
