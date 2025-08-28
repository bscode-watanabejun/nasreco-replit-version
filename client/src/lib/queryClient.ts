import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = `${res.status}: ${res.statusText}`;
    let errorDetails = null;
    
    try {
      // Response bodyを一度だけ読み取る
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        console.error("❌ API Error Response:", errorData);
        // エラー詳細を完全に表示
        if (errorData.errors && Array.isArray(errorData.errors)) {
          console.error("❌ Server validation errors:");
          errorData.errors.forEach((err: any, index: number) => {
            console.error(`  Error ${index + 1}:`, JSON.stringify(err, null, 2));
          });
        }
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData;
      } else {
        const text = await res.text();
        console.error("❌ API Error (text):", text);
        errorMessage = text || errorMessage;
      }
    } catch (parseError) {
      console.error("❌ Error parsing response:", parseError);
      // パースエラーの場合はデフォルトメッセージを使用
    }
    
    const error = new Error(errorMessage);
    // エラー詳細を Error オブジェクトに追加
    (error as any).errors = errorDetails?.errors;
    (error as any).details = errorDetails;
    throw error;
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
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 30000, // 30秒
      gcTime: 300000, // 5分
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
