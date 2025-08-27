import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
  });

  const { data: staffUser, isLoading: isStaffLoading } = useQuery({
    queryKey: ["/api/auth/staff-user"],
    retry: false,
    enabled: replitUser === null && !isReplitLoading,
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
    const bothQueriesFinished = !isReplitLoading && (!isStaffLoading || replitUser !== null);
    
    return {
      user: hasReplitUser ? replitUser : hasStaffUser ? staffUser : null,
      isLoading: !bothQueriesFinished,
      isAuthenticated: hasReplitUser || hasStaffUser,
      authType: hasReplitUser ? 'replit' : hasStaffUser ? 'staff' : null,
      isStaffAuth: hasStaffUser,
      isReplitAuth: hasReplitUser,
    };
  }, [replitUser, staffUser, isReplitLoading, isStaffLoading]);

  return authState;
}
