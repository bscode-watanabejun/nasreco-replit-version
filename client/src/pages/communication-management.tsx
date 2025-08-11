import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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

  const truncateContent = (content: string, maxLength: number = 30) => {
    return content.length > maxLength ? `${content.substring(0, maxLength)}...` : content;
  };

  return (
    <div className="min-h-screen bg-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/management-menu')}
            className="text-gray-600 hover:text-gray-800"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">
            連絡事項管理
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-sm border-pink-200">
              <CardHeader className="bg-pink-100 border-b border-pink-200">
                <CardTitle className="text-lg text-gray-800">新規連絡事項登録</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Facility Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          施設名
                        </label>
                        <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600" data-testid="text-facility-name">
                          {facilitySettings?.facilityName || "施設名未設定"}
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>閲覧期間（開始）</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-start-date"
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
                            <FormLabel>閲覧期間（終了）</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-end-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Target Floor and Job Role */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="targetFloor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>閲覧所属階</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-floor">
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
                            <FormLabel>閲覧職種</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-job-role">
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
          </div>

          {/* Right Panel - Read Status */}
          <div className="lg:col-span-1">
            <Card className="bg-white shadow-sm border-pink-200">
              <CardHeader className="bg-pink-100 border-b border-pink-200">
                <CardTitle className="text-lg text-gray-800">既読情報</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {selectedNotice ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-4" data-testid="text-selected-notice">
                      選択中: {truncateContent(selectedNotice.content, 20)}
                    </div>
                    {readStatus.length > 0 ? (
                      <div className="space-y-2">
                        {readStatus.map((status) => (
                          <div key={status.id} className="p-2 bg-gray-50 rounded text-sm" data-testid={`read-status-${status.id}`}>
                            <div className="font-medium text-gray-800">
                              {status.staffName} {status.staffLastName}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {status.readAt && format(new Date(status.readAt), 'MM/dd HH:mm', { locale: ja })}
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

        {/* Notices Table */}
        <Card className="bg-white shadow-sm border-pink-200">
          <CardHeader className="bg-pink-100 border-b border-pink-200">
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[120px]">閲覧期間</TableHead>
                    <TableHead className="flex-1">連絡事項内容</TableHead>
                    <TableHead className="w-[80px]">所属階</TableHead>
                    <TableHead className="w-[80px]">職種</TableHead>
                    <TableHead className="w-[60px]">詳細</TableHead>
                    <TableHead className="w-[60px]">削除</TableHead>
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
                      <TableCell className="text-sm">
                        {formatDateRange(notice.startDate, notice.endDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {truncateContent(notice.content)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {notice.targetFloor}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {notice.targetJobRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                            >
                              <Info className="w-4 h-4 text-blue-500" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>連絡事項内容</DialogTitle>
                              <DialogDescription>
                                {formatDateRange(notice.startDate, notice.endDate)} | {notice.targetFloor} | {notice.targetJobRole}
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
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-delete-${notice.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}