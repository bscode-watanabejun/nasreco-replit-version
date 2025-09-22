import { QueryClient, QueryFunction } from "@tanstack/react-query";

// テナントIDを取得する関数（循環参照を避けるため後で定義）
let getCurrentTenantId: () => string | null;

// テナントヘッダーを含むheadersを生成する関数
function getApiHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers = { ...additionalHeaders };

  if (getCurrentTenantId) {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }
  }

  return headers;
}

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
  
  console.log('🌐 API Request:', {
    url,
    method,
    data,
    isFormData
  });
  
  const res = await fetch(url, {
    method,
    headers: getApiHeaders(data && !isFormData ? { "Content-Type": "application/json" } : {}),
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  console.log('📡 API Response:', {
    url,
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get('content-type'),
    contentLength: res.headers.get('content-length')
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
    const responseText = await res.text();

    // 開発環境でのみレスポンステキストを出力
    const shouldLog = import.meta.env.DEV && import.meta.env.VITE_API_DEBUG !== 'false';
    if (shouldLog) {
      console.log('📄 Response text:', responseText);
    }

    if (!responseText) {
      console.warn('❌ Empty response body received');
      return null;
    }
    
    const responseData = JSON.parse(responseText);
    return responseData;
  } catch (error) {
    // JSONパースに失敗した場合は空のレスポンスとして扱う
    console.error('❌ JSON parse failed:', {
      error,
      url,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getApiHeaders();

    const res = await fetch(queryKey.join("/") as string, {
      headers,
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

// QueryClient作成後にテナントID取得関数を定義（循環参照を避けるため）
getCurrentTenantId = () => {
  // 1. URLパスから直接テナントIDを取得（最優先）
  if (typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/^\/tenant\/([^\/]+)/);
    if (pathMatch) {
      const tenantFromUrl = pathMatch[1];
      // URLのテナントIDをセッションストレージにも保存
      sessionStorage.setItem('selectedTenantId', tenantFromUrl);
      return tenantFromUrl;
    }
  }

  // 2. セッションストレージから選択されたテナントIDを確認
  const selectedTenantId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTenantId') : null;
  if (selectedTenantId) {
    return selectedTenantId;
  }

  // 3. ReactQueryのキャッシュから認証ユーザー情報を取得
  const staffUser = queryClient.getQueryData(["/api/auth/staff-user"]) as any;
  const replitUser = queryClient.getQueryData(["/api/auth/user"]) as any;

  // スタッフユーザーが優先、次にReplitユーザー
  const user = staffUser || replitUser;

  const result = user?.tenantId || null;

  return result;
};

// 現在の環境情報を取得する関数
export function getCurrentEnvironment() {
  const selectedTenantId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTenantId') : null;
  const isParentEnvironment = !selectedTenantId;
  const isTenantEnvironment = !!selectedTenantId;

  return {
    tenantId: selectedTenantId,
    isParentEnvironment,
    isTenantEnvironment,
    environmentName: isParentEnvironment ? '親環境' : isTenantEnvironment ? `テナント: ${selectedTenantId}` : '不明'
  };
}

// 現在の環境に合わせたパスを生成する関数
export function getEnvironmentPath(path: string): string {
  // セッションストレージを優先してテナント環境を判定
  const selectedTenantId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTenantId') : null;

  if (selectedTenantId) {
    // テナント環境の場合は /tenant/{tenantId}/ を前に付ける
    return `/tenant/${selectedTenantId}${path}`;
  }

  // 親環境の場合はそのまま
  return path;
}
