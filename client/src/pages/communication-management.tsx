import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { formatJapanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Info, Trash2, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { insertStaffNoticeSchema, type StaffNotice, type StaffNoticeReadStatus, type FacilitySettings } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Form schema
const staffNoticeFormSchema = insertStaffNoticeSchema.omit({ createdBy: true });

type StaffNoticeFormData = z.infer<typeof staffNoticeFormSchema>;

export default function CommunicationManagement() {
  const [, setLocation] = useLocation();
  const [selectedNotice, setSelectedNotice] = useState<StaffNotice | null>(null);
  const [showFullContent, setShowFullContent] = useState<StaffNotice | null>(null);
  const { toast } = useToast();

  // Fetch facility settings for facility name
  const { data: facilitySettings } = useQuery<FacilitySettings>({
    queryKey: ['/api/facility-settings'],
  });

  // Fetch staff notices
  const { data: notices = [], isLoading: isLoadingNotices } = useQuery<StaffNotice[]>({
    queryKey: ['/api/staff-notices'],
  });

  // Fetch read status for selected notice
  const { data: readStatus = [] } = useQuery<(StaffNoticeReadStatus & { staffName?: string; staffLastName?: string })[]>({
    queryKey: ['/api/staff-notices', selectedNotice?.id, 'read-status'],
    enabled: !!selectedNotice?.id,
  });

  // Form setup
  const form = useForm<StaffNoticeFormData>({
    resolver: zodResolver(staffNoticeFormSchema),
    defaultValues: {
      facilityId: "default-facility",
      content: "",
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      targetFloor: "全階",
      targetJobRole: "全体",
    },
  });

  // Create staff notice mutation
  const createNoticeMutation = useMutation({
    mutationFn: (data: StaffNoticeFormData) => 
      apiRequest('/api/staff-notices', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notices'] });
      form.reset();
      toast({
        title: "連絡事項を登録しました",
        description: "新しい連絡事項が正常に登録されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "連絡事項の登録に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Delete staff notice mutation
  const deleteNoticeMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/staff-notices/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notices'] });
      toast({
        title: "連絡事項を削除しました",
        description: "選択した連絡事項が削除されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "連絡事項の削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StaffNoticeFormData) => {
    createNoticeMutation.mutate(data);
  };

  const handleDeleteNotice = (id: string) => {
    deleteNoticeMutation.mutate(id);
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = format(new Date(startDate), 'MM/dd', { locale: ja });
    const end = format(new Date(endDate), 'MM/dd', { locale: ja });
    return `${start} ~ ${end}`;
  };

  const formatDateRangeWithYear = (startDate: string, endDate: string) => {
    const start = format(new Date(startDate), 'yyyy/MM/dd', { locale: ja });
    const end = format(new Date(endDate), 'yyyy/MM/dd', { locale: ja });
    return `${start} ~ ${end}`;
  };

  const truncateContent = (content: string, maxLength: number = 30) => {
    return content.length > maxLength ? `${content.substring(0, maxLength)}...` : content;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-pink-100 shadow-sm border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/management-menu')}
                className="p-2 text-pink-800 hover:bg-pink-200"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-pink-800" data-testid="text-page-title">
                連絡事項管理
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* New Notice Registration Section */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-gray-800">新規連絡事項登録</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Facility Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          施設名
                        </label>
                        <div className="p-3 bg-gray-100 border-2 border-gray-300 rounded-md text-sm text-gray-500 font-medium" data-testid="text-facility-name">
                          {facilitySettings?.facilityName || "施設名未設定"}
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">閲覧期間（開始）</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-start-date"
                                className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 h-8 sm:h-10"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">閲覧期間（終了）</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-end-date"
                                className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 h-8 sm:h-10"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Target Floor and Job Role */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="targetFloor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">閲覧所属階</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-floor" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 h-8 sm:h-10">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="全階">全階</SelectItem>
                                <SelectItem value="1階">1階</SelectItem>
                                <SelectItem value="2階">2階</SelectItem>
                                <SelectItem value="3階">3階</SelectItem>
                                <SelectItem value="4階">4階</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="targetJobRole"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">閲覧職種</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-job-role" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 h-8 sm:h-10">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="全体">全体</SelectItem>
                                <SelectItem value="介護">介護</SelectItem>
                                <SelectItem value="施設看護">施設看護</SelectItem>
                                <SelectItem value="訪問看護">訪問看護</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Content */}
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>連絡事項内容</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="連絡事項の内容を入力してください"
                              className="min-h-[120px] resize-none"
                              {...field}
                              data-testid="textarea-content"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={createNoticeMutation.isPending}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-8"
                        data-testid="button-submit"
                      >
                        {createNoticeMutation.isPending ? "登録中..." : "追加"}
                      </Button>
                    </div>
                  </form>
                </Form>
            </CardContent>
          </Card>

          {/* Notices Table */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-gray-800">登録済み連絡事項</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingNotices ? (
              <div className="p-8 text-center text-gray-500" data-testid="text-loading">
                読み込み中...
              </div>
            ) : notices.length === 0 ? (
              <div className="p-8 text-center text-gray-500" data-testid="text-no-notices">
                登録された連絡事項はありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium w-20">閲覧期間</TableHead>
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium">連絡事項内容</TableHead>
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium w-14">所属階</TableHead>
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium w-14">職種</TableHead>
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium w-10">詳細</TableHead>
                      <TableHead className="whitespace-nowrap px-1 sm:px-2 py-1 text-xs sm:text-sm font-medium w-10">削除</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notices.map((notice) => (
                      <TableRow
                        key={notice.id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedNotice?.id === notice.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedNotice(notice)}
                        data-testid={`notice-row-${notice.id}`}
                      >
                        <TableCell className="text-xs px-1 sm:px-2 py-1 whitespace-nowrap w-20">
                          {formatDateRange(notice.startDate, notice.endDate)}
                        </TableCell>
                        <TableCell className="text-xs px-1 sm:px-2 py-1 truncate">
                          {truncateContent(notice.content, 50)}
                        </TableCell>
                        <TableCell className="px-1 sm:px-2 py-1 w-14">
                          <Badge variant="outline" className="text-xs whitespace-nowrap py-0 px-1 h-5">
                            {notice.targetFloor}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-1 sm:px-2 py-1 w-14">
                          <Badge variant="outline" className="text-xs whitespace-nowrap py-0 px-1 h-5">
                            {notice.targetJobRole}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-1 py-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFullContent(notice);
                                }}
                                data-testid={`button-info-${notice.id}`}
                                className="p-0.5 h-6 w-6"
                              >
                                <Info className="w-3 h-3 text-blue-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl mx-4">
                              <DialogHeader>
                                <DialogTitle>連絡事項内容</DialogTitle>
                                <DialogDescription>
                                  {formatDateRangeWithYear(notice.startDate, notice.endDate)} | {notice.targetFloor} | {notice.targetJobRole}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="mt-4 p-4 bg-gray-50 rounded max-h-96 overflow-y-auto">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap" data-testid="text-full-content">
                                  {notice.content}
                                </p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                        <TableCell className="px-1 py-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-delete-${notice.id}`}
                                className="p-0.5 h-6 w-6"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="mx-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle>連絡事項を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この操作は取り消せません。選択した連絡事項が完全に削除されます。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete">キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteNotice(notice.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                  data-testid="button-confirm-delete"
                                >
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Read Status Section */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-gray-800">既読情報</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedNotice ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 mb-4" data-testid="text-selected-notice">
                    選択中: {truncateContent(selectedNotice.content, 20)}
                  </div>
                  {readStatus.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {readStatus.map((status) => (
                        <div key={status.id} className="p-2 bg-gray-50 rounded text-sm flex-none w-32" data-testid={`read-status-${status.id}`}>
                          <div className="font-medium text-gray-800 text-xs truncate">
                            {status.staffName} {status.staffLastName}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {formatJapanDateTime(status.readAt, 'MM/dd HH:mm')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm text-center py-4" data-testid="text-no-read-status">
                      まだ誰も閲覧していません
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-8" data-testid="text-select-notice">
                  連絡事項を選択してください
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}