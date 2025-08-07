import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertResidentSchema } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, Edit, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import type { InsertResident, Resident } from "@shared/schema";

// 年齢計算関数
const calculateAge = (birthDate: string): string => {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age.toString();
};

export default function UserInfoManagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const [editOpen, setEditOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  const { data: residents = [], isLoading } = useQuery<Resident[]>({
    queryKey: ["/api/residents"],
  });

  const form = useForm<InsertResident>({
    resolver: zodResolver(insertResidentSchema),
    defaultValues: {
      roomNumber: "",
      floor: "",
      name: "",
      gender: "",
      admissionDate: "",
      retirementDate: "",
      dateOfBirth: "",
      age: undefined,
      postalCode: "",
      address: "",
      attendingPhysician: "",
      careLevel: "",
      insuranceNumber: "",
      careAuthorizationPeriod: "",
      isAdmitted: false,
      emergencyContact1Name: "",
      emergencyContact1Relationship: "",
      emergencyContact1Phone1: "",
      emergencyContact1Phone2: "",
      emergencyContact1Address: "",
      emergencyContact2Name: "",
      emergencyContact2Relationship: "",
      emergencyContact2Phone1: "",
      emergencyContact2Phone2: "",
      emergencyContact2Address: "",
      medicationMorning: false,
      medicationEvening: false,
      medicationMorningBefore: false,
      medicationEveningBefore: false,
      medicationBedtime: false,
      medicationOther: false,
      eyeDropsMorning: false,
      eyeDropsEvening: false,
      eyeDropsMorningBefore: false,
      eyeDropsEveningBefore: false,
      eyeDropsBedtime: false,
      eyeDropsOther: false,
      bathingSunday: false,
      bathingMonday: false,
      bathingTuesday: false,
      bathingWednesday: false,
      bathingThursday: false,
      bathingFriday: false,
      bathingSaturday: false,
      bathSunday: false,
      bathMonday: false,
      bathTuesday: false,
      bathWednesday: false,
      bathThursday: false,
      bathFriday: false,
      bathSaturday: false,
      medicationTimeSunday: false,
      medicationTimeMonday: false,
      medicationTimeTuesday: false,
      medicationTimeWednesday: false,
      medicationTimeThursday: false,
      medicationTimeFriday: false,
      medicationTimeSaturday: false,
      excretionTimeUrineStanding: false,
      excretionTimeUrineAssisted: false,
      excretionTime: "",
      diaperSize: "",
      diaperType: "",
      medicationWeekMonday: false,
      medicationWeekTuesday: false,
      medicationWeekWednesday: false,
      medicationWeekThursday: false,
      medicationWeekFriday: false,
      medicationWeekSaturday: false,
      medicationWeekSunday: false,
      medicationFrequency: "",
      mealLunch: false,
      mealDinner: false,
      notes: "",
    },
  });

  const editForm = useForm<InsertResident>({
    resolver: zodResolver(insertResidentSchema),
    defaultValues: form.getValues(),
  });

  // 生年月日の変更を監視して年齢を自動計算
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'dateOfBirth' && value.dateOfBirth) {
        const age = parseInt(calculateAge(value.dateOfBirth));
        form.setValue('age', age);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    const subscription = editForm.watch((value, { name }) => {
      if (name === 'dateOfBirth' && value.dateOfBirth) {
        const age = parseInt(calculateAge(value.dateOfBirth));
        editForm.setValue('age', age);
      }
    });
    return () => subscription.unsubscribe();
  }, [editForm]);

  const createResidentMutation = useMutation({
    mutationFn: (data: InsertResident) => apiRequest("/api/residents", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      toast({ description: "利用者を作成しました" });
      form.reset();
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "利用者の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  const updateResidentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertResident }) => 
      apiRequest(`/api/residents/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      toast({ description: "利用者情報を更新しました" });
      setEditOpen(false);
      setEditingResident(null);
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "利用者情報の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertResident) => {
    createResidentMutation.mutate(data);
  };

  const onEditSubmit = (data: InsertResident) => {
    if (editingResident) {
      updateResidentMutation.mutate({ id: editingResident.id, data });
    }
  };

  const openEditDialog = (resident: Resident) => {
    setEditingResident(resident);
    // Convert dates to string format for form and handle null values
    const formData = {
      ...resident,
      dateOfBirth: resident.dateOfBirth ? new Date(resident.dateOfBirth).toISOString().split('T')[0] : "",
      admissionDate: resident.admissionDate ? new Date(resident.admissionDate).toISOString().split('T')[0] : "",
      retirementDate: resident.retirementDate ? new Date(resident.retirementDate).toISOString().split('T')[0] : "",
      age: resident.age ?? undefined,
      roomNumber: resident.roomNumber ?? "",
      notes: resident.notes ?? "",
    };
    editForm.reset(formData);
    setEditOpen(true);
  };

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
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/management-menu")}
                className="p-2"
                data-testid="button-back-management"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ご利用者情報管理
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">ご利用者一覧</span>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 text-white" data-testid="button-create-resident">
                <Plus className="w-4 h-4 mr-2" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新しいご利用者を追加</DialogTitle>
                <DialogDescription>
                  ご利用者の基本情報を入力してください。
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Basic Information */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">基本情報</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="roomNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>部屋番号</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="101" data-testid="input-room-number" />
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
                              <FormLabel>フロア</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-floor">
                                    <SelectValue placeholder="フロアを選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1F">1F</SelectItem>
                                  <SelectItem value="2F">2F</SelectItem>
                                  <SelectItem value="3F">3F</SelectItem>
                                  <SelectItem value="4F">4F</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>利用者名 *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="山田太郎" data-testid="input-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>性別</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-gender">
                                    <SelectValue placeholder="性別を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="男性">男性</SelectItem>
                                  <SelectItem value="女性">女性</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>生年月日</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-birth-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>年齢</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="75" disabled data-testid="input-age" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  <Card>
                    <CardContent className="p-4">
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>備考</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ""}
                                placeholder="その他の特記事項があれば入力してください"
                                rows={4}
                                data-testid="input-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      data-testid="button-cancel"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      disabled={createResidentMutation.isPending}
                      className="bg-pink-500 hover:bg-pink-600 text-white"
                      data-testid="button-submit"
                    >
                      {createResidentMutation.isPending ? "作成中..." : "作成"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Residents List */}
        <div className="grid gap-4">
          {residents.map((resident: Resident) => (
            <Card key={resident.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {resident.roomNumber && (
                          <span className="text-sm text-gray-500 mr-2">{resident.roomNumber}号室</span>
                        )}
                        {resident.name}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {resident.gender} • {resident.age}歳
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">フロア:</span> {resident.floor || "未設定"}
                      </div>
                      <div>
                        <span className="font-medium">要介護度:</span> {resident.careLevel || "未設定"}
                      </div>
                      <div>
                        <span className="font-medium">主治医:</span> {resident.attendingPhysician || "未設定"}
                      </div>
                      <div>
                        <span className="font-medium">入居日:</span>{" "}
                        {resident.admissionDate 
                          ? new Date(resident.admissionDate).toLocaleDateString("ja-JP")
                          : "未設定"
                        }
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(resident)}
                    className="ml-4"
                    data-testid={`button-edit-${resident.id}`}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    編集
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {residents.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">まだご利用者が登録されていません</p>
                <p className="text-gray-400 text-sm mt-1">「新規作成」ボタンから最初のご利用者を追加してください</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ご利用者情報を編集</DialogTitle>
            <DialogDescription>
              {editingResident?.name}さんの情報を編集します。
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="roomNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>部屋番号</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="101" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>利用者名 *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="山田太郎" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardContent className="p-4">
                  <FormField
                    control={editForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備考</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="その他の特記事項があれば入力してください"
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={updateResidentMutation.isPending}
                  className="bg-pink-500 hover:bg-pink-600 text-white"
                >
                  {updateResidentMutation.isPending ? "更新中..." : "更新"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}