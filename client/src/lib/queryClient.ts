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
  console.log("🌐 API Request:", { method, url, data });
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log("📡 API Response status:", res.status, res.statusText);

  await throwIfResNotOk(res);
  
  // JSONレスポンスを解析して返す
  try {
    // レスポンスの内容を確認するためにテキストとして先に読む
    const responseText = await res.text();
    console.log("📄 Raw response text (first 200 chars):", responseText.substring(0, 200));
    
    // HTMLが返されている場合の処理
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error("❌ Server returned HTML instead of JSON");
      throw new Error("サーバーがHTMLページを返しました。ルーティングまたは認証の問題の可能性があります");
    }
    
    const responseData = JSON.parse(responseText);
    console.log("📦 API Response data:", responseData);
    return responseData;
  } catch (parseError: any) {
    console.error("❌ JSON parsing error:", parseError);
    if (parseError.message.includes("HTML")) {
      throw parseError;
    }
    throw new Error("サーバーからの応答の解析に失敗しました");
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
