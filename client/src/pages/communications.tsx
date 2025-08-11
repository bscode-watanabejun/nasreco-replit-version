import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Info, Calendar, Building } from "lucide-react";
import { useLocation } from "wouter";
import { type StaffNotice, type StaffNoticeReadStatus } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Communications() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize from URL params if available
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(
    urlParams.get('date') || format(new Date(), "yyyy-MM-dd")
  );
  const [selectedJobRole, setSelectedJobRole] = useState("全体");
  const [selectedFloor, setSelectedFloor] = useState(
    urlParams.get('floor') === 'all' ? "全階" :
    urlParams.get('floor') === '1F' ? "1階" :
    urlParams.get('floor') === '2F' ? "2階" :
    urlParams.get('floor') === '3F' ? "3階" :
    urlParams.get('floor') === '4F' ? "4階" :
    "全階"
  );
  const [selectedNotice, setSelectedNotice] = useState<StaffNotice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch staff notices
  const { data: notices = [], isLoading: isLoadingNotices } = useQuery<StaffNotice[]>({
    queryKey: ['/api/staff-notices'],
  });

  // Fetch read status for all notices to determine unread status  
  const [readStatuses, setReadStatuses] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    if (notices.length > 0 && user && (user as any)?.id) {
      Promise.all(
        notices.map(async (notice) => {
          try {
            const response = await fetch(`/api/staff-notices/${notice.id}/read-status`);
            const data = await response.json();
            return { noticeId: notice.id, statuses: data };
          } catch (error) {
            return { noticeId: notice.id, statuses: [] };
          }
        })
      ).then((results) => {
        const statusMap: {[key: string]: any[]} = {};
        results.forEach(result => {
          statusMap[result.noticeId] = result.statuses;
        });
        setReadStatuses(statusMap);
      });
    }
  }, [notices, user]);

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
      // Refresh read statuses after marking as read
      if (notices.length > 0 && user && (user as any)?.id) {
        Promise.all(
          notices.map(async (notice) => {
            try {
              const response = await fetch(`/api/staff-notices/${notice.id}/read-status`);
              const data = await response.json();
              return { noticeId: notice.id, statuses: data };
            } catch (error) {
              return { noticeId: notice.id, statuses: [] };
            }
          })
        ).then((results) => {
          const statusMap: {[key: string]: any[]} = {};
          results.forEach(result => {
            statusMap[result.noticeId] = result.statuses;
          });
          setReadStatuses(statusMap);
        });
      }
      toast({
        title: "既読にしました",
        description: "連絡事項を既読にしました。",
      });
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
    if (!user || !(user as any)?.id || !readStatuses || !readStatuses[notice.id]) return true;
    return !readStatuses[notice.id].some((status: any) => status.staffId === (user as any).id);
  };

  // Filter notices based on selected criteria
  const filteredNotices = notices.filter(notice => {
    // Filter by date (notices active on selected date)
    const selectedDateObj = new Date(selectedDate);
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

  const handleMarkAsUnread = () => {
    // For now, we don't implement unmark functionality as it's not in the original requirements
    toast({
      title: "機能未実装",
      description: "未読にする機能は現在未実装です。",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
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
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8"
              data-testid="input-date"
            />
          </div>

          {/* Job Role Selection */}
          <div className="flex items-center space-x-1">
            <span className="text-xs sm:text-sm">職種</span>
            <Select value={selectedJobRole} onValueChange={setSelectedJobRole}>
              <SelectTrigger className="w-20 sm:w-24 h-6 sm:h-8 text-xs sm:text-sm" data-testid="select-job-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全体" data-testid="option-job-role-all">全体</SelectItem>
                <SelectItem value="介護" data-testid="option-job-role-care">介護</SelectItem>
                <SelectItem value="施設看護" data-testid="option-job-role-facility-nursing">施設看護</SelectItem>
                <SelectItem value="訪問看護" data-testid="option-job-role-visiting-nursing">訪問看護</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Floor Selection */}
          <div className="flex items-center space-x-1">
            <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm" data-testid="select-floor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全階" data-testid="option-floor-all">全階</SelectItem>
                <SelectItem value="1階" data-testid="option-floor-1">1階</SelectItem>
                <SelectItem value="2階" data-testid="option-floor-2">2階</SelectItem>
                <SelectItem value="3階" data-testid="option-floor-3">3階</SelectItem>
                <SelectItem value="4階" data-testid="option-floor-4">4階</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Notice List */}
      <div className="p-3 space-y-0">
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
                  className={`${index > 0 ? 'border-t' : ''} p-3 hover:bg-gray-50 cursor-pointer`}
                  onClick={() => handleNoticeClick(notice)}
                  data-testid={`notice-item-${notice.id}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Start Date */}
                    <div className="flex-shrink-0 text-xs sm:text-sm text-gray-600 w-12">
                      {format(new Date(notice.startDate), "d日", { locale: ja })}
                    </div>
                    
                    {/* Floor */}
                    <div className="flex-shrink-0 text-xs sm:text-sm text-gray-600 w-12 text-center">
                      {notice.targetFloor}
                    </div>
                    
                    {/* Content */}
                    <div className={`flex-1 text-sm ${isUnread ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                      {notice.content}
                    </div>
                    
                    {/* Info Icon */}
                    <div className="flex-shrink-0">
                      <Info className="w-5 h-5 text-gray-400" />
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
          </DialogHeader>
          
          {selectedNotice && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">閲覧期間</h4>
                <p className="text-sm">
                  {format(new Date(selectedNotice.startDate), "yyyy年M月d日", { locale: ja })} ～ {format(new Date(selectedNotice.endDate), "yyyy年M月d日", { locale: ja })}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">対象階</h4>
                <p className="text-sm">{selectedNotice.targetFloor}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">対象職種</h4>
                <p className="text-sm">{selectedNotice.targetJobRole}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">連絡事項内容</h4>
                <p className="text-sm whitespace-pre-wrap border p-3 rounded bg-gray-50">
                  {selectedNotice.content}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-close"
            >
              閉じる
            </Button>
            <Button
              variant="outline"
              onClick={handleMarkAsUnread}
              data-testid="button-mark-unread"
            >
              未読にする
            </Button>
            <Button
              onClick={handleMarkAsRead}
              disabled={markAsReadMutation.isPending}
              data-testid="button-mark-read"
            >
              既読にする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}