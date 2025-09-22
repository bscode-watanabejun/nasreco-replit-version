import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient } from "@/lib/queryClient";

export function useAuth() {
  const { data: replitUser, isLoading: isReplitLoading, error: replitError } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    gcTime: 10 * 60 * 1000, // 10分間メモリに保持
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    enabled: !queryClient.getQueryData(["/api/auth/staff-user"]), // 職員ログイン中は無効化
  });

  const { data: staffUser, isLoading: isStaffLoading } = useQuery({
    queryKey: ["/api/auth/staff-user"],
    retry: false,
    enabled: (replitUser === null || replitUser === undefined) && !isReplitLoading,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    gcTime: 10 * 60 * 1000, // 10分間メモリに保持
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // 認証状態をmemoで安定化してレンダリングループを防ぐ
  const authState = useMemo(() => {
    const hasReplitUser = replitUser !== undefined && replitUser !== null;
    const hasStaffUser = staffUser !== undefined && staffUser !== null;

    // 職員ログイン成功後はstaffUserが優先される
    if (hasStaffUser) {
      return {
        user: staffUser,
        isLoading: false,
        isAuthenticated: true,
        authType: 'staff' as const,
        isStaffAuth: true,
        isReplitAuth: false,
        tenantId: (staffUser as any)?.tenantId || null,
        hasMultipleTenants: false, // スタッフユーザーは通常1つのテナントのみ
      };
    }

    // Replitユーザーがいる場合
    if (hasReplitUser) {
      return {
        user: replitUser,
        isLoading: false,
        isAuthenticated: true,
        authType: 'replit' as const,
        isStaffAuth: false,
        isReplitAuth: true,
        tenantId: (replitUser as any)?.tenantId || null,
        hasMultipleTenants: (replitUser as any)?.tenants && Array.isArray((replitUser as any).tenants) && (replitUser as any).tenants.length > 1,
      };
    }

    // どちらのクエリも完了していない場合はローディング
    const bothQueriesFinished = !isReplitLoading && (!isStaffLoading || replitUser !== null);

    return {
      user: null,
      isLoading: !bothQueriesFinished,
      isAuthenticated: false,
      authType: null,
      isStaffAuth: false,
      isReplitAuth: false,
      tenantId: null,
      hasMultipleTenants: false,
    };
  }, [replitUser, staffUser, isReplitLoading, isStaffLoading]);

  return authState;
}

// テナント管理用のカスタムフック
export function useTenant() {
  const { tenantId, hasMultipleTenants, user, isAuthenticated } = useAuth();

  // テナント切り替え機能（管理者権限のあるユーザー向け）
  const switchTenant = async (newTenantId: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('認証が必要です');
    }

    // ユーザーがアクセス可能なテナントかチェック
    if ((user as any).tenants && Array.isArray((user as any).tenants)) {
      const hasAccess = (user as any).tenants.some((tenant: any) => tenant.id === newTenantId);
      if (!hasAccess) {
        throw new Error('指定されたテナントへのアクセス権限がありません');
      }
    }

    // テナント情報を更新（APIを経由してセッションを更新）
    try {
      const response = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId: newTenantId }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('テナントの切り替えに失敗しました');
      }

      // キャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ["/api/auth/staff-user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      return true;
    } catch (error) {
      console.error('テナント切り替えエラー:', error);
      throw error;
    }
  };

  return {
    currentTenantId: tenantId,
    hasMultipleTenants,
    availableTenants: (user as any)?.tenants || [],
    switchTenant,
  };
}
