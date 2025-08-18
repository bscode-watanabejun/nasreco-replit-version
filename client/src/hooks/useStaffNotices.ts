import { useQuery, useQueryClient } from "@tanstack/react-query";

// 未読連絡事項数を取得するフック
export function useUnreadStaffNoticesCount() {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["staff-notices", "unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/staff-notices/unread-count", {
        credentials: "include"
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // 認証エラーの場合は0を返す
          return 0;
        }
        throw new Error("未読連絡事項数の取得に失敗しました");
      }
      
      const data = await response.json();
      return data.count as number;
    },
    refetchInterval: 10000, // 10秒ごとに更新
    staleTime: 8000, // 8秒間はfreshと見なす
    retry: (failureCount, error) => {
      // 認証エラーの場合は再試行しない
      if (error instanceof Error && error.message.includes("401")) {
        return false;
      }
      return failureCount < 3;
    },
    // デフォルト値として0を設定
    initialData: 0,
  });

  // 手動で未読数を更新する関数
  const refetchUnreadCount = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-notices", "unread-count"] });
  };

  return {
    ...query,
    refetchUnreadCount,
  };
}