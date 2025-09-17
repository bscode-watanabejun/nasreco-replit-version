import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Info, Calendar, Building } from "lucide-react";
import { useLocation } from "wouter";
import { type StaffNotice } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly
          onClick={() => setOpen(!open)}
          placeholder={placeholder}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent className="w-32 p-0.5" align="center">
        <div className="space-y-0 max-h-40 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full text-left px-1.5 py-0 text-xs hover:bg-slate-100 leading-tight min-h-[1.2rem]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Communications() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize from URL params if available
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  });
  const [selectedJobRole, setSelectedJobRole] = useState("全体");
  const [selectedFloor, setSelectedFloor] = useState(() => {
    const floorParam = urlParams.get('floor');
    if (floorParam) {
      if (floorParam === 'all') return '全階';
      const floorNumber = floorParam.replace('F', '');
      if (!isNaN(Number(floorNumber))) {
        return `${floorNumber}階`;
      }
    }
    return '全階';
  });
  const [selectedNotice, setSelectedNotice] = useState<StaffNotice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch staff notices
  const { data: notices = [], isLoading: isLoadingNotices } = useQuery<StaffNotice[]>({
    queryKey: ['/api/staff-notices'],
  });

  // Fetch read status for all notices to determine unread status
  const { data: readStatuses = {}, isLoading: isLoadingReadStatuses } = useQuery<{[key: string]: any[]}>({
    queryKey: ['/api/staff-notices-read-status', notices.map(n => n.id), (user as any)?.id],
    queryFn: async () => {
      if (!notices.length || !user || !(user as any)?.id) {
        return {};
      }

      const results = await Promise.all(
        notices.map(async (notice) => {
          try {
            const response = await fetch(`/api/staff-notices/${notice.id}/read-status`);
            const data = await response.json();
            return { noticeId: notice.id, statuses: data };
          } catch (error) {
            return { noticeId: notice.id, statuses: [] };
          }
        })
      );

      const statusMap: {[key: string]: any[]} = {};
      results.forEach(result => {
        statusMap[result.noticeId] = result.statuses;
      });
      return statusMap;
    },
    enabled: notices.length > 0 && !!user && !!(user as any)?.id,
  });

  // Mark notice as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (noticeId: string) => {
      const response = await fetch(`/api/staff-notices/${noticeId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }
      return response.json();
    },
    onSuccess: () => {
      if (!selectedNotice || !user || !(user as any)?.id) {
        setIsDialogOpen(false);
        return;
      }

      const staffId = (user as any).id;
      const noticeId = selectedNotice.id;

      // 楽観的更新：キャッシュを即座に更新して既読状態を反映
      queryClient.setQueryData<{[key: string]: any[]}>(['/api/staff-notices-read-status', notices.map(n => n.id), staffId], (oldData) => {
        if (!oldData) return oldData;

        const newData = { ...oldData };
        // 既読状態を追加（既読として扱う）
        if (!newData[noticeId]) {
          newData[noticeId] = [];
        }

        // すでに既読状態がある場合は重複しないようにチェック
        const existingStatus = newData[noticeId].find((status: any) => status.staffId === staffId);
        if (!existingStatus) {
          newData[noticeId] = [...newData[noticeId], { staffId, noticeId, readAt: new Date().toISOString() }];
        }

        return newData;
      });

      // バックグラウンドでデータを再検証
      queryClient.invalidateQueries({
        queryKey: ['/api/staff-notices-read-status'],
      });

      // トップ画面の未読件数を楽観的に更新（-1）
      queryClient.setQueryData<number>(["staff-notices", "unread-count"], (oldCount) => {
        return Math.max(0, (oldCount || 0) - 1);
      });

      // トップ画面の未読件数も更新（バックグラウンド再検証）
      queryClient.invalidateQueries({
        queryKey: ["staff-notices", "unread-count"],
      });

      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "既読処理に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Check if notice is unread for current user
  const isNoticeUnread = (notice: StaffNotice): boolean => {
    // 既読状態の読み込み中またはユーザー情報がない場合は未読判定しない
    if (isLoadingReadStatuses || !user || !(user as any)?.id) return false;

    // 既読状態が読み込み済みで、該当通知の既読情報がない場合は未読とする
    if (!readStatuses[notice.id]) return true;

    // 既読状態をチェック
    // staff_managementテーブルのプライマリキー（UUID）で比較
    const staffManagementId = (user as any).id;
    return !readStatuses[notice.id].some((status: any) => status.staffId === staffManagementId);
  };

  // Filter notices based on selected criteria
  const filteredNotices = notices.filter(notice => {
    // Filter by date (notices active on selected date)
    const selectedDateObj = selectedDate;
    const startDate = new Date(notice.startDate);
    const endDate = new Date(notice.endDate);

    if (selectedDateObj < startDate || selectedDateObj > endDate) {
      return false;
    }

    // Filter by job role
    if (selectedJobRole !== "全体" && notice.targetJobRole !== "全体" && notice.targetJobRole !== selectedJobRole) {
      return false;
    }

    // Filter by floor
    if (selectedFloor !== "全階" && notice.targetFloor !== "全階" && notice.targetFloor !== selectedFloor) {
      return false;
    }

    return true;
  });

  const handleNoticeClick = (notice: StaffNotice) => {
    setSelectedNotice(notice);
    setIsDialogOpen(true);
  };

  const handleMarkAsRead = () => {
    if (selectedNotice) {
      markAsReadMutation.mutate(selectedNotice.id);
    }
  };

  // Mark notice as unread mutation
  const markAsUnreadMutation = useMutation({
    mutationFn: async (noticeId: string) => {
      const response = await fetch(`/api/staff-notices/${noticeId}/mark-unread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to mark as unread');
      }
      return response.json();
    },
    onSuccess: () => {
      if (!selectedNotice || !user || !(user as any)?.id) {
        setIsDialogOpen(false);
        return;
      }

      const staffId = (user as any).id;
      const noticeId = selectedNotice.id;

      // 楽観的更新：キャッシュを即座に更新して未読状態を反映
      queryClient.setQueryData<{[key: string]: any[]}>(['/api/staff-notices-read-status', notices.map(n => n.id), staffId], (oldData) => {
        if (!oldData) return oldData;

        const newData = { ...oldData };
        // 既読状態を削除（未読として扱う）
        if (newData[noticeId]) {
          newData[noticeId] = newData[noticeId].filter((status: any) => status.staffId !== staffId);
        }

        return newData;
      });

      // バックグラウンドでデータを再検証
      queryClient.invalidateQueries({
        queryKey: ['/api/staff-notices-read-status'],
      });

      // トップ画面の未読件数を楽観的に更新（+1）
      queryClient.setQueryData<number>(["staff-notices", "unread-count"], (oldCount) => {
        return (oldCount || 0) + 1;
      });

      // トップ画面の未読件数も更新（バックグラウンド再検証）
      queryClient.invalidateQueries({
        queryKey: ["staff-notices", "unread-count"],
      });

      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "未読マークに失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsUnread = () => {
    if (selectedNotice) {
      markAsUnreadMutation.mutate(selectedNotice.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-800 text-white p-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              const targetUrl = `/?${params.toString()}`;
              setLocation(targetUrl);
            }}
            className="text-white hover:bg-blue-700 p-1"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold" data-testid="title-communications">連絡事項</h1>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-3 shadow-sm border-b">
        <div className="flex gap-2 items-center justify-center flex-wrap">
          {/* Date Selection */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              data-testid="input-date"
            />
          </div>

          {/* Job Role Selection */}
          <div className="flex items-center space-x-1">
            <span className="text-xs sm:text-sm">職種</span>
            <InputWithDropdown
              value={selectedJobRole}
              options={[
                { value: "全体", label: "全体" },
                { value: "介護", label: "介護" },
                { value: "施設看護", label: "施設看護" },
                { value: "訪問看護", label: "訪問看護" }
              ]}
              onSave={(value) => setSelectedJobRole(value)}
              placeholder="職種選択"
              className="w-20 sm:w-24 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Floor Selection */}
          <div className="flex items-center space-x-1">
            <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedFloor}
              options={[
                { value: "全階", label: "全階" },
                { value: "1階", label: "1階" },
                { value: "2階", label: "2階" },
                { value: "3階", label: "3階" },
                { value: "4階", label: "4階" }
              ]}
              onSave={(value) => setSelectedFloor(value)}
              placeholder="階数選択"
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notice List */}
      <div className="p-2 space-y-0">
        {isLoadingNotices ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">読み込み中...</p>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-notices">
            該当する連絡事項がありません
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            {filteredNotices.map((notice, index) => {
              const isUnread = isNoticeUnread(notice);
              
              return (
                <div
                  key={notice.id}
                  className={`${index > 0 ? 'border-t' : ''} px-2 py-1`}
                  data-testid={`notice-item-${notice.id}`}
                >
                  <div className="flex items-center gap-2">
                    {/* Start Date */}
                    <div className="flex-shrink-0 text-xs text-gray-600 w-10">
                      {format(new Date(notice.startDate), "d日", { locale: ja })}
                    </div>
                    
                    {/* Floor */}
                    <div className="flex-shrink-0 text-xs text-gray-600 w-8 text-center">
                      {notice.targetFloor}
                    </div>
                    
                    {/* Content */}
                    <div className={`flex-1 text-xs leading-tight truncate ${isUnread ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                      {notice.content}
                    </div>
                    
                    {/* Info Icon */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNoticeClick(notice);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        aria-label="詳細を表示"
                      >
                        <Info className="w-4 h-4 text-blue-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notice Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md mx-auto" data-testid="dialog-notice-detail">
          <DialogHeader>
            <DialogTitle>連絡事項詳細</DialogTitle>
            <DialogDescription>
              連絡事項の詳細を確認し、既読・未読の設定ができます。
            </DialogDescription>
          </DialogHeader>
          
          {selectedNotice && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">閲覧期間</h4>
                <p className="text-sm">
                  {format(new Date(selectedNotice.startDate), "yyyy年M月d日", { locale: ja })} ～ {format(new Date(selectedNotice.endDate), "yyyy年M月d日", { locale: ja })}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-1">対象階</h4>
                  <p className="text-sm">{selectedNotice.targetFloor}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-1">対象職種</h4>
                  <p className="text-sm">{selectedNotice.targetJobRole}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">連絡事項内容</h4>
                <p className="text-sm whitespace-pre-wrap border p-3 rounded bg-gray-50">
                  {selectedNotice.content}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex gap-1 pt-4">
            <Button
              onClick={handleMarkAsRead}
              disabled={markAsReadMutation.isPending}
              data-testid="button-mark-read"
              size="sm"
              className="flex-1 text-xs px-2"
            >
              既読
            </Button>
            <Button
              variant="outline"
              onClick={handleMarkAsUnread}
              disabled={markAsUnreadMutation.isPending}
              data-testid="button-mark-unread"
              size="sm"
              className="flex-1 text-xs px-2"
            >
              未読
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-close"
              size="sm"
              className="flex-1 text-xs px-2"
            >
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}