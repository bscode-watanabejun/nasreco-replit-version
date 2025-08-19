import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStaffManagementSchema, updateStaffManagementSchema } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, UserCog, Edit, ArrowLeft, Trash2, Unlock, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { StaffManagement, InsertStaffManagement, UpdateStaffManagement } from "@shared/schema";

// インライン編集用のコンポーネント
function InlineEditableField({ 
  value, 
  onSave, 
  type = "text", 
  placeholder = "", 
  options = [],
  disabled = false 
}: {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "select";
  placeholder?: string;
  options?: { value: string; label: string; }[];
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (currentValue !== value && !disabled) {
      setIsSaving(true);
      await onSave(currentValue);
      setIsSaving(false);
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (disabled || !isEditing) {
    return (
      <div 
        className={`cursor-pointer hover:bg-slate-50 p-1 rounded border-2 border-transparent hover:border-slate-200 transition-colors ${disabled ? "cursor-not-allowed bg-slate-100" : ""}`}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {type === "select" && options.length > 0 ? (
          options.find(opt => opt.value === value)?.label || value
        ) : (
          value || <span className="text-slate-400">{placeholder}</span>
        )}
      </div>
    );
  }

  if (type === "select") {
    return (
      <Select value={currentValue} onValueChange={setCurrentValue} onOpenChange={(open) => !open && handleBlur()}>
        <SelectTrigger className="h-auto min-h-[2rem]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={type}
      value={currentValue}
      onChange={(e) => setCurrentValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="h-auto min-h-[2rem]"
      autoFocus
    />
  );
}

export default function StaffManagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<StaffManagement | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [unlockingStaff, setUnlockingStaff] = useState<StaffManagement | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: staffList = [], isLoading, error } = useQuery<StaffManagement[]>({
    queryKey: ["/api/staff-management"],
  });

  const form = useForm<InsertStaffManagement>({
    resolver: zodResolver(insertStaffManagementSchema),
    defaultValues: {
      staffId: "",
      staffName: "",
      staffNameKana: "",
      floor: "全階",
      jobRole: "全体",
      authority: "職員",
      status: "ロック",
      sortOrder: 0,
      password: "",
    },
  });

  // 新規作成用ミューテーション
  const createMutation = useMutation({
    mutationFn: async (data: InsertStaffManagement) => {
      return await apiRequest("/api/staff-management", "POST", data);
    },
    onSuccess: (data) => {
      // キャッシュに新しいデータを直接追加
      queryClient.setQueryData<StaffManagement[]>(["/api/staff-management"], (oldData) => {
        return oldData ? [...oldData, data] : [data];
      });
      
      // さらにクエリの無効化とリフェッチも実行
      queryClient.invalidateQueries({ queryKey: ["/api/staff-management"] });
      queryClient.refetchQueries({ queryKey: ["/api/staff-management"] });
      
      form.reset();
      setOpen(false);
      
      toast({
        title: "成功",
        description: "職員情報を作成しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "職員情報の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 更新用ミューテーション
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData = { [field]: value };
      return apiRequest(`/api/staff-management/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-management"] });
      queryClient.refetchQueries({ queryKey: ["/api/staff-management"] });
      toast({
        title: "成功",
        description: "職員情報を更新しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "職員情報の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/staff-management/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-management"] });
      setDeleteOpen(false);
      setDeletingStaff(null);
      toast({
        title: "成功",
        description: "職員情報を削除しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "職員情報の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // ロック解除用ミューテーション
  const unlockMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      return apiRequest(`/api/staff-management/${id}/unlock`, "POST", { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-management"] });
      setPasswordDialogOpen(false);
      setUnlockingStaff(null);
      setNewPassword("");
      toast({
        title: "成功",
        description: "アカウントのロックを解除しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "ロック解除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // ロック用ミューテーション
  const lockMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/staff-management/${id}/lock`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-management"] });
      toast({
        title: "成功",
        description: "アカウントをロックしました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "ロックに失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertStaffManagement) => {
    createMutation.mutate(data);
  };

  const handleDelete = (staff: StaffManagement) => {
    setDeletingStaff(staff);
    setDeleteOpen(true);
  };

  const handleUnlock = (staff: StaffManagement) => {
    setUnlockingStaff(staff);
    setPasswordDialogOpen(true);
  };

  const handleLock = (staff: StaffManagement) => {
    lockMutation.mutate(staff.id);
  };

  const sortedStaff = [...staffList].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const floorOptions = [
    { value: "全階", label: "全階" },
    { value: "1階", label: "1階" },
    { value: "2階", label: "2階" },
    { value: "3階", label: "3階" },
  ];

  const jobRoleOptions = [
    { value: "全体", label: "全体" },
    { value: "介護", label: "介護" },
    { value: "施設看護", label: "施設看護" },
    { value: "訪問看護", label: "訪問看護" },
  ];

  const authorityOptions = [
    { value: "管理者", label: "管理者" },
    { value: "準管理者", label: "準管理者" },
    { value: "職員", label: "職員" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-pink-100 shadow-sm border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/management-menu")}
                className="p-2 text-pink-800 hover:bg-pink-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-pink-800">
                職員情報 管理用
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <UserCog className="w-5 h-5 text-gray-500" />
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">職員一覧</span>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>新しい職員を追加</DialogTitle>
                <DialogDescription>
                  職員の基本情報を入力してください。
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="staffId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>職員ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="staff001" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="staffName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>職員名</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="山田 太郎" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="staffNameKana"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>職員名フリガナ</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ヤマダ タロウ" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="floor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>所属階</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="所属階を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {floorOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>職種</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="職種を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {jobRoleOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="authority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>権限</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="権限を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {authorityOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sortOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ソート順</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value?.toString() || ""}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>パスワード</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} placeholder="英数字6文字以上" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      作成
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Staff List - Desktop Table View */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-pink-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-pink-800">職員ID</th>
                      <th className="text-left p-2 font-medium text-pink-800">職員名</th>
                      <th className="text-left p-2 font-medium text-pink-800">職員名フリガナ</th>
                      <th className="text-left p-2 font-medium text-pink-800">所属階</th>
                      <th className="text-left p-2 font-medium text-pink-800">職種</th>
                      <th className="text-left p-2 font-medium text-pink-800">権限</th>
                      <th className="text-left p-2 font-medium text-pink-800">最終修正日時</th>
                      <th className="text-left p-2 font-medium text-pink-800">ステータス</th>
                      <th className="text-left p-2 font-medium text-pink-800">ソート順</th>
                      <th className="text-center p-2 font-medium text-pink-800">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStaff.map((staff, index) => (
                      <tr key={staff.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.staffId}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'staffId', value })}
                            placeholder="職員ID"
                          />
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.staffName}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'staffName', value })}
                            placeholder="職員名"
                          />
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.staffNameKana}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'staffNameKana', value })}
                            placeholder="職員名フリガナ"
                          />
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.floor}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'floor', value })}
                            type="select"
                            options={floorOptions}
                          />
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.jobRole}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'jobRole', value })}
                            type="select"
                            options={jobRoleOptions}
                          />
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.authority}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'authority', value })}
                            type="select"
                            options={authorityOptions}
                          />
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {staff.lastModifiedAt ? format(new Date(staff.lastModifiedAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            staff.status === "ロック解除" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {staff.status}
                          </span>
                        </td>
                        <td className="p-2">
                          <InlineEditableField
                            value={staff.sortOrder?.toString() || "0"}
                            onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'sortOrder', value: parseInt(value) || 0 })}
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center space-x-2">
                            {staff.status === "ロック" ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:bg-green-50"
                                  >
                                    <Unlock className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>アカウントロック解除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      この職員のアカウントのロックを解除しますか？解除時、再度パスワード設定します。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleUnlock(staff)}>
                                      ロック解除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>アカウントロック</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      この職員のアカウントをロックしますか？
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleLock(staff)}>
                                      ロック
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>職員削除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    この職員のアカウントを完全に削除しますか？この操作を行うとアカウントを戻せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(staff.id)}
                                  >
                                    削除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff List - Mobile Card View */}
        <div className="md:hidden space-y-4">
          {sortedStaff.map((staff) => (
            <Card key={staff.id} className="border border-pink-200">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* ヘッダー部分 */}
                  <div className="flex items-center justify-between pb-2 border-b border-pink-100">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-pink-800">{staff.staffName}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        staff.status === "ロック解除" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {staff.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {staff.status === "ロック" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:bg-green-50"
                            >
                              <Unlock className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>アカウントロック解除</AlertDialogTitle>
                              <AlertDialogDescription>
                                この職員のアカウントのロックを解除しますか？解除時、再度パスワード設定します。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleUnlock(staff)}>
                                ロック解除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Lock className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>アカウントロック</AlertDialogTitle>
                              <AlertDialogDescription>
                                この職員のアカウントをロックしますか？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleLock(staff)}>
                                ロック
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>職員削除</AlertDialogTitle>
                            <AlertDialogDescription>
                              この職員のアカウントを完全に削除しますか？この操作を行うとアカウントを戻せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => deleteMutation.mutate(staff.id)}
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* 職員情報グリッド */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">職員ID</label>
                      <InlineEditableField
                        value={staff.staffId}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'staffId', value })}
                        placeholder="職員ID"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">ソート順</label>
                      <InlineEditableField
                        value={staff.sortOrder?.toString() || "0"}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'sortOrder', value: parseInt(value) || 0 })}
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">職員名フリガナ</label>
                      <InlineEditableField
                        value={staff.staffNameKana}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'staffNameKana', value })}
                        placeholder="職員名フリガナ"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">所属階</label>
                      <InlineEditableField
                        value={staff.floor}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'floor', value })}
                        type="select"
                        options={floorOptions}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">職種</label>
                      <InlineEditableField
                        value={staff.jobRole}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'jobRole', value })}
                        type="select"
                        options={jobRoleOptions}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">権限</label>
                      <InlineEditableField
                        value={staff.authority}
                        onSave={(value) => updateMutation.mutate({ id: staff.id, field: 'authority', value })}
                        type="select"
                        options={authorityOptions}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">最終修正日時</label>
                      <span className="text-gray-600">
                        {staff.lastModifiedAt ? format(new Date(staff.lastModifiedAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedStaff.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <UserCog className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>職員情報がまだ登録されていません</p>
            <p className="text-sm">上の「新規作成」ボタンから職員を追加してください</p>
          </div>
        )}
      </div>

      {/* Password Setting Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワード設定</DialogTitle>
            <DialogDescription>
              新しいパスワードを設定してください（英数字6文字以上）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (unlockingStaff && newPassword.length >= 6) {
                  unlockMutation.mutate({ id: unlockingStaff.id, password: newPassword });
                }
              }}
              disabled={newPassword.length < 6 || unlockMutation.isPending}
            >
              設定
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>職員削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStaff?.staffName}のアカウントを完全に削除しますか？この操作を行うとアカウントを戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deletingStaff) {
                  deleteMutation.mutate(deletingStaff.id);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}