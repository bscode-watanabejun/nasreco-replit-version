import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTenantSchema, updateTenantSchema, updateTenantApiSchema } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatJapanDateTime } from "@/lib/utils";
import { Plus, Shield, Edit, ArrowLeft, Trash2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Tenant, InsertTenant, UpdateTenant, UpdateTenantApi } from "@shared/schema";
import type { TenantWithStaff } from "@/../../server/storage";

export default function MultiTenantManagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithStaff | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState<TenantWithStaff | null>(null);

  // ログインユーザーがシステム管理者かどうかを判定
  const isSystemAdmin = (user as any)?.authority === "システム管理者";

  const { data: tenantList = [], isLoading, error } = useQuery<TenantWithStaff[]>({
    queryKey: ["/api/tenants"],
  });

  const form = useForm<InsertTenant>({
    resolver: zodResolver(insertTenantSchema),
    defaultValues: {
      tenantId: "",
      tenantName: "",
      status: "有効",
    },
  });

  const editForm = useForm<UpdateTenant>({
    resolver: zodResolver(updateTenantSchema),
  });

  // 新規作成用ミューテーション
  const createMutation = useMutation({
    mutationFn: async (data: InsertTenant) => {
      return await apiRequest("/api/tenants", "POST", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      form.reset();
      setOpen(false);

      toast({
        title: "成功",
        description: "テナント情報を作成しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "テナント情報の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 更新用ミューテーション
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateTenantApi) => {
      return await apiRequest(`/api/tenants/${data.id}`, "PATCH", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setEditOpen(false);
      setEditingTenant(null);
      editForm.reset();
      toast({
        title: "成功",
        description: "テナント情報を更新しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "テナント情報の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/tenants/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setDeleteOpen(false);
      setDeletingTenant(null);
      toast({
        title: "成功",
        description: "テナント情報を削除しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "テナント情報の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTenant) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: UpdateTenant) => {
    if (editingTenant) {
      const updateData = { ...data, id: editingTenant.id };
      updateMutation.mutate(updateData);
    }
  };

  const handleEdit = (tenant: TenantWithStaff) => {
    setEditingTenant(tenant);
    editForm.reset({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      status: tenant.status as "有効" | "無効",
    });
    setEditOpen(true);
  };

  const handleDelete = (tenant: TenantWithStaff) => {
    setDeletingTenant(tenant);
    setDeleteOpen(true);
  };

  const handleOpenTenant = (tenant: TenantWithStaff) => {
    // テナント専用URLを生成して開く
    const tenantUrl = `/tenant/${tenant.tenantId}/`;
    window.open(tenantUrl, '_blank');
  };

  const sortedTenants = [...tenantList].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

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
      <div className="sticky top-0 z-50 bg-pink-100 shadow-sm border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const menuPath = getEnvironmentPath("/management-menu");
                  navigate(menuPath);
                }}
                className="p-2 text-pink-800 hover:bg-pink-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-pink-800">
                マルチテナント管理
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-gray-500" />
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">テナント一覧</span>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新しいテナントを追加</DialogTitle>
                <DialogDescription>
                  テナントの基本情報を入力してください。
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>テナントID（サブドメイン名）</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="facility-a"
                            onChange={(e) => {
                              // 小文字に変換し、無効文字を除去
                              const cleaned = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, '')
                                .replace(/^-+|-+$/g, '') // 先頭・末尾のハイフンを除去
                                .replace(/-{2,}/g, '-'); // 連続するハイフンを1つに
                              field.onChange(cleaned);
                            }}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          英小文字・数字・ハイフンのみ。3-20文字。https://nasreco/{field.value || "テナントID"}/として使用されます。
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>テナント名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="施設A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ステータス</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="ステータスを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="有効">有効</SelectItem>
                            <SelectItem value="無効">無効</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

          {/* 編集用Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>テナント情報を編集</DialogTitle>
                <DialogDescription>
                  テナントの情報を編集してください。
                </DialogDescription>
              </DialogHeader>

              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>テナントID（サブドメイン名）</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="facility-a"
                            onChange={(e) => {
                              // 小文字に変換し、無効文字を除去
                              const cleaned = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, '')
                                .replace(/^-+|-+$/g, '') // 先頭・末尾のハイフンを除去
                                .replace(/-{2,}/g, '-'); // 連続するハイフンを1つに
                              field.onChange(cleaned);
                            }}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          英小文字・数字・ハイフンのみ。3-20文字。https://nasreco/{field.value || "テナントID"}/として使用されます。
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>テナント名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="施設A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ステータス</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="ステータスを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="有効">有効</SelectItem>
                            <SelectItem value="無効">無効</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      更新
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tenant List - Desktop Table View */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-pink-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-pink-800">テナントID</th>
                      <th className="text-left p-2 font-medium text-pink-800">テナント名</th>
                      <th className="text-left p-2 font-medium text-pink-800">ステータス</th>
                      <th className="text-left p-2 font-medium text-pink-800">作成日</th>
                      <th className="text-left p-2 font-medium text-pink-800">登録者</th>
                      <th className="text-left p-2 font-medium text-pink-800">更新者</th>
                      <th className="text-center p-2 font-medium text-pink-800">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTenants.map((tenant, index) => (
                      <tr key={tenant.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-2">
                          {tenant.tenantId}
                        </td>
                        <td className="p-2">
                          {tenant.tenantName}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tenant.status === "有効"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {tenant.status}
                          </span>
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {formatJapanDateTime(tenant.createdAt)}
                        </td>
                        <td className="p-2 text-sm">
                          {tenant.createdByName || "-"}
                        </td>
                        <td className="p-2 text-sm">
                          {tenant.updatedByName || "-"}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(tenant)}
                              className="text-blue-600 hover:bg-blue-50"
                              title="テナント情報を編集"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTenant(tenant)}
                              className="text-green-600 hover:bg-green-50"
                              title={`${tenant.tenantName}の環境にアクセス`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50"
                                  title="テナントを削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>テナント削除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    このテナントを完全に削除しますか？この操作は取り消せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(tenant.id)}
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

        {/* Tenant List - Mobile Card View */}
        <div className="md:hidden space-y-4">
          {sortedTenants.map((tenant) => (
            <Card key={tenant.id} className="border border-pink-200">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* ヘッダー部分 */}
                  <div className="flex items-center justify-between pb-2 border-b border-pink-100">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-pink-800">{tenant.tenantName}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tenant.status === "有効"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {tenant.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tenant)}
                        className="text-blue-600 hover:bg-blue-50"
                        title="テナント情報を編集"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTenant(tenant)}
                        className="text-green-600 hover:bg-green-50"
                        title={`${tenant.tenantName}の環境にアクセス`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            title="テナントを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>テナント削除</AlertDialogTitle>
                            <AlertDialogDescription>
                              このテナントを完全に削除しますか？この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => deleteMutation.mutate(tenant.id)}
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* テナント情報グリッド */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">テナントID</label>
                      <div className="text-gray-900">
                        {tenant.tenantId}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">作成日</label>
                      <div className="text-gray-600">
                        {formatJapanDateTime(tenant.createdAt)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">登録者</label>
                      <div className="text-gray-900">
                        {tenant.createdByName || "-"}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">更新者</label>
                      <div className="text-gray-900">
                        {tenant.updatedByName || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedTenants.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>テナント情報がまだ登録されていません</p>
            <p className="text-sm">上の「新規作成」ボタンからテナントを追加してください</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テナント削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTenant?.tenantName}を完全に削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deletingTenant) {
                  deleteMutation.mutate(deletingTenant.id);
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