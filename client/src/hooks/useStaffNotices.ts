import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type StaffNotice } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

// フィルタ条件の型定義
interface NoticeFilter {
  date: Date;
  jobRole: string;
  floor: string;
}

// 未読連絡事項数を取得するフック
export function useUnreadStaffNoticesCount(filter?: NoticeFilter) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["staff-notices", "unread-count", filter],
    queryFn: async () => {
      // フィルタ条件が指定されている場合はフロントエンドでフィルタリング
      if (filter) {
        // 全ての連絡事項を取得
        const noticesResponse = await fetch("/api/staff-notices", {
          credentials: "include"
        });

        if (!noticesResponse.ok) {
          if (noticesResponse.status === 401) {
            return 0;
          }
          throw new Error("連絡事項の取得に失敗しました");
        }

        const notices: StaffNotice[] = await noticesResponse.json();

        // 日付、職種、階数でフィルタリング
        const filteredNotices = notices.filter(notice => {
          // 日付フィルタ
          const selectedDateObj = filter.date;
          const startDate = new Date(notice.startDate);
          const endDate = new Date(notice.endDate);

          if (selectedDateObj < startDate || selectedDateObj > endDate) {
            return false;
          }

          // 職種フィルタ（変換処理を追加）
          const selectedJobRole = filter.jobRole === "全階" ? "全体" : filter.jobRole;
          if (selectedJobRole !== "全体" && notice.targetJobRole !== "全体" && notice.targetJobRole !== selectedJobRole) {
            return false;
          }

          // 階数フィルタ（変換処理を追加）
          const selectedFloor = filter.floor === "all" ? "全階" : `${filter.floor}階`;
          if (selectedFloor !== "全階" && notice.targetFloor !== "全階" && notice.targetFloor !== selectedFloor) {
            return false;
          }

          return true;
        });

        // ユーザー情報が取得できない場合は0を返す
        if (!user || !(user as any)?.id) {
          return 0;
        }

        const staffId = (user as any).id;

        // 各連絡事項の既読状態を取得して未読数をカウント
        const unreadCount = await Promise.all(
          filteredNotices.map(async (notice) => {
            try {
              const response = await fetch(`/api/staff-notices/${notice.id}/read-status`, {
                credentials: "include"
              });

              if (!response.ok) {
                return false;
              }

              const readStatuses = await response.json();

              // 未読かどうか判定
              return !readStatuses.some((status: any) => status.staffId === staffId);
            } catch (error) {
              return false;
            }
          })
        );

        return unreadCount.filter(Boolean).length;
      } else {
        // フィルタ条件がない場合は従来のAPIを使用
        const response = await fetch("/api/staff-notices/unread-count", {
          credentials: "include"
        });

        if (!response.ok) {
          if (response.status === 401) {
            return 0;
          }
          throw new Error("未読連絡事項数の取得に失敗しました");
        }

        const data = await response.json();
        return data.count as number;
      }
    },
    refetchInterval: 5000, // 5秒ごとに更新
    staleTime: 8000, // 8秒間はfreshと見なす
    refetchOnMount: true, // マウント時に必ず再取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
    retry: (failureCount, error) => {
      // 認証エラーの場合は再試行しない
      if (error instanceof Error && error.message.includes("401")) {
        return false;
      }
      return failureCount < 3;
    },
    // デフォルト値として0を設定
    initialData: 0,
    enabled: !!user, // ユーザーがログインしている場合のみクエリ実行
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