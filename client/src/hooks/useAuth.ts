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
    };
  }, [replitUser, staffUser, isReplitLoading, isStaffLoading]);

  return authState;
}
