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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, Edit, ArrowLeft, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingResident, setDeletingResident] = useState<Resident | null>(null);

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

  const deleteResidentMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/residents/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      toast({ description: "利用者情報を削除しました" });
      setDeleteOpen(false);
      setDeletingResident(null);
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "利用者情報の削除に失敗しました",
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

  const openDeleteDialog = (resident: Resident) => {
    setDeletingResident(resident);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingResident) {
      deleteResidentMutation.mutate(deletingResident.id);
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
      careAuthorizationPeriodStart: resident.careAuthorizationPeriodStart ? new Date(resident.careAuthorizationPeriodStart).toISOString().split('T')[0] : "",
      careAuthorizationPeriodEnd: resident.careAuthorizationPeriodEnd ? new Date(resident.careAuthorizationPeriodEnd).toISOString().split('T')[0] : "",
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
                              <FormLabel>居室番号</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="100" data-testid="input-room-number" />
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
                              <FormLabel>階</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-floor">
                                    <SelectValue placeholder="階を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
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
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>利用者名</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="浅倉 照一" data-testid="input-name" />
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
                          name="admissionDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>入居日</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-admission-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="retirementDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>退居日</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-retirement-date" />
                              </FormControl>
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
                                <Input {...field} value={field.value || ""} placeholder="69" disabled data-testid="input-age" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>郵便番号</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="000-0000" data-testid="input-postal-code" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>住所</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" data-testid="input-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="attendingPhysician"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>主治医</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="ふれあい在宅クリニック" data-testid="input-attending-physician" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="careLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>介護度</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-care-level">
                                    <SelectValue placeholder="介護度を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="要介護1">要介護1</SelectItem>
                                  <SelectItem value="要介護2">要介護2</SelectItem>
                                  <SelectItem value="要介護3">要介護3</SelectItem>
                                  <SelectItem value="要介護4">要介護4</SelectItem>
                                  <SelectItem value="要介護5">要介護5</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="careLevelRatio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>割合</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-care-level-ratio">
                                    <SelectValue placeholder="割合を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="insuranceNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>被保険者番号</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="0007777777" data-testid="input-insurance-number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="careAuthorizationPeriodStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>介護認定期間 From</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-care-period-start" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="careAuthorizationPeriodEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>介護認定期間 To</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-care-period-end" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isAdmitted"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-admitted"
                                />
                              </FormControl>
                              <FormLabel>入院</FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Emergency Contact */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">緊急連絡先</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="emergencyContact1Name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>氏名1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="テスト" data-testid="input-emergency1-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact1Relationship"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>続柄1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="息子" data-testid="input-emergency1-relationship" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact1Phone1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>電話1-1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="080-5555-5555" data-testid="input-emergency1-phone1" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact1Phone2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>電話1-2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="080-5555-5555" data-testid="input-emergency1-phone2" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact1Address"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>住所1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" data-testid="input-emergency1-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact2Name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>氏名2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="テスト" data-testid="input-emergency2-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact2Relationship"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>続柄2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="長男" data-testid="input-emergency2-relationship" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact2Phone1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>電話2-1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="080-5555-5555" data-testid="input-emergency2-phone1" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact2Phone2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>電話2-2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="080-5555-5555" data-testid="input-emergency2-phone2" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="emergencyContact2Address"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>住所2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" data-testid="input-emergency2-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="medicationMorning"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-morning"
                                />
                              </FormControl>
                              <FormLabel>朝後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationEvening"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-evening"
                                />
                              </FormControl>
                              <FormLabel>夕後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationMorningBefore"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-morning-before"
                                />
                              </FormControl>
                              <FormLabel>朝前</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationEveningBefore"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-evening-before"
                                />
                              </FormControl>
                              <FormLabel>夕前</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationBedtime"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-bedtime"
                                />
                              </FormControl>
                              <FormLabel>昼後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationOther"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-other"
                                />
                              </FormControl>
                              <FormLabel>夕前</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Medication Schedule Weekly */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯　週次</h3>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                        <FormField
                          control={form.control}
                          name="medicationTimeMonday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-monday"
                                />
                              </FormControl>
                              <FormLabel>月曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeTuesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-tuesday"
                                />
                              </FormControl>
                              <FormLabel>火曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeWednesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-wednesday"
                                />
                              </FormControl>
                              <FormLabel>水曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeThursday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-thursday"
                                />
                              </FormControl>
                              <FormLabel>木曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeFriday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-friday"
                                />
                              </FormControl>
                              <FormLabel>金曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeSaturday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-saturday"
                                />
                              </FormControl>
                              <FormLabel>土曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationTimeSunday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-medication-time-sunday"
                                />
                              </FormControl>
                              <FormLabel>日曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Meal Information */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯　月次</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <FormLabel className="text-sm font-medium">食事</FormLabel>
                          <div className="flex space-x-4">
                            <FormField
                              control={form.control}
                              name="mealLunch"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="checkbox-meal-lunch"
                                    />
                                  </FormControl>
                                  <FormLabel>経管</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="mealDinner"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="checkbox-meal-dinner"
                                    />
                                  </FormControl>
                                  <FormLabel>経口</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Eye Drops Schedule */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">点眼時間帯</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="eyeDropsMorning"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-morning"
                                />
                              </FormControl>
                              <FormLabel>朝後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eyeDropsEvening"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-evening"
                                />
                              </FormControl>
                              <FormLabel>夕後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eyeDropsMorningBefore"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-morning-before"
                                />
                              </FormControl>
                              <FormLabel>朝前</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eyeDropsEveningBefore"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-evening-before"
                                />
                              </FormControl>
                              <FormLabel>夕前</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eyeDropsBedtime"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-bedtime"
                                />
                              </FormControl>
                              <FormLabel>昼後</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eyeDropsOther"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-other"
                                />
                              </FormControl>
                              <FormLabel>夕前</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Eye Drops Schedule Weekly */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">点眼時間帯　週次</h3>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                        <FormField
                          control={form.control}
                          name="medicationWeekMonday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-monday"
                                />
                              </FormControl>
                              <FormLabel>月曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekTuesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-tuesday"
                                />
                              </FormControl>
                              <FormLabel>火曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekWednesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-wednesday"
                                />
                              </FormControl>
                              <FormLabel>水曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekThursday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-thursday"
                                />
                              </FormControl>
                              <FormLabel>木曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekFriday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-friday"
                                />
                              </FormControl>
                              <FormLabel>金曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekSaturday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-saturday"
                                />
                              </FormControl>
                              <FormLabel>土曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medicationWeekSunday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-eyedrops-week-sunday"
                                />
                              </FormControl>
                              <FormLabel>日曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bathing/Linen Schedule */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">清掃リネン交換日</h3>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                        <FormField
                          control={form.control}
                          name="bathingMonday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-monday"
                                />
                              </FormControl>
                              <FormLabel>月曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingTuesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-tuesday"
                                />
                              </FormControl>
                              <FormLabel>火曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingWednesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-wednesday"
                                />
                              </FormControl>
                              <FormLabel>水曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingThursday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-thursday"
                                />
                              </FormControl>
                              <FormLabel>木曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingFriday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-friday"
                                />
                              </FormControl>
                              <FormLabel>金曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingSaturday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-saturday"
                                />
                              </FormControl>
                              <FormLabel>土曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathingSunday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bathing-sunday"
                                />
                              </FormControl>
                              <FormLabel>日曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bath Schedule */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">入浴日</h3>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                        <FormField
                          control={form.control}
                          name="bathMonday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-monday"
                                />
                              </FormControl>
                              <FormLabel>月曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathTuesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-tuesday"
                                />
                              </FormControl>
                              <FormLabel>火曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathWednesday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-wednesday"
                                />
                              </FormControl>
                              <FormLabel>水曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathThursday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-thursday"
                                />
                              </FormControl>
                              <FormLabel>木曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathFriday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-friday"
                                />
                              </FormControl>
                              <FormLabel>金曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathSaturday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-saturday"
                                />
                              </FormControl>
                              <FormLabel>土曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bathSunday"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-bath-sunday"
                                />
                              </FormControl>
                              <FormLabel>日曜日</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* 排泄 */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">排泄</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="excretionTimeUrineStanding"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>自立便</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="excretionTimeUrineAssisted"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>介助便</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="diaperSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>おむつサイズ</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="おむつサイズ" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="diaperType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>おむつコース</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="おむつコース" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="excretionTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>排泄時間</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="排泄時間の詳細" />
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
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">入居日:</span>
                        <div className="text-gray-900 dark:text-gray-100">
                          {resident.admissionDate 
                            ? new Date(resident.admissionDate).toLocaleDateString("ja-JP")
                            : "未設定"
                          }
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">階:</span>
                        <div className="text-gray-900 dark:text-gray-100">{resident.floor || "未設定"}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">ご利用者名:</span>
                        <div className="text-gray-900 dark:text-gray-100 font-medium">{resident.name}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">介護度:</span>
                        <div className="text-gray-900 dark:text-gray-100">{resident.careLevel || "未設定"}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">居室番号:</span>
                        <div className="text-gray-900 dark:text-gray-100">{resident.roomNumber || "未設定"}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col ml-4 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(resident)}
                      data-testid={`button-edit-${resident.id}`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(resident)}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                      data-testid={`button-delete-${resident.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      削除
                    </Button>
                  </div>
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
                          <FormLabel>居室番号</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="100" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="floor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>階</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="階を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>利用者名</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="浅倉 照一" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>性別</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
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
                      control={editForm.control}
                      name="admissionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>入居日</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="retirementDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>退居日</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>生年月日</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>年齢</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="69" disabled />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>郵便番号</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="000-0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="attendingPhysician"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>主治医</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="ふれあい在宅クリニック" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="careLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>介護度</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="介護度を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="要介護1">要介護1</SelectItem>
                              <SelectItem value="要介護2">要介護2</SelectItem>
                              <SelectItem value="要介護3">要介護3</SelectItem>
                              <SelectItem value="要介護4">要介護4</SelectItem>
                              <SelectItem value="要介護5">要介護5</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="careLevelRatio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>割合</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="割合を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="insuranceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>被保険者番号</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="0007777777" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="careAuthorizationPeriodStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>介護認定期間 From</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="careAuthorizationPeriodEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>介護認定期間 To</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="isAdmitted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>入院</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">緊急連絡先</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名1</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="テスト" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>続柄1</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="息子" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Phone1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>電話1-1</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="080-5555-5555" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Phone2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>電話1-2</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="080-5555-5555" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>住所1</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名2</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="テスト" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>続柄2</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="長男" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Phone1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>電話2-1</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="080-5555-5555" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Phone2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>電話2-2</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="080-5555-5555" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>住所2</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="埼玉県テスト市テスト区1-1-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Medication Schedule */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="medicationMorning"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>朝後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationEvening"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationMorningBefore"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>朝前</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationEveningBefore"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationBedtime"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>昼後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationOther"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Medication Schedule Weekly */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯　週次</h3>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    <FormField
                      control={editForm.control}
                      name="medicationTimeMonday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>月曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeTuesday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>火曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeWednesday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>水曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeThursday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>木曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeFriday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>金曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeSaturday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>土曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationTimeSunday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>日曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Meal Information */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">服薬時間帯　月次</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FormLabel className="text-sm font-medium">食事</FormLabel>
                      <div className="flex space-x-4">
                        <FormField
                          control={editForm.control}
                          name="mealLunch"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>経管</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="mealDinner"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>経口</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Eye Drops Schedule */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">点眼時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="eyeDropsMorning"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>朝後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="eyeDropsEvening"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="eyeDropsMorningBefore"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>朝前</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="eyeDropsEveningBefore"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="eyeDropsBedtime"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>昼後</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="eyeDropsOther"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Eye Drops Schedule Weekly */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">点眼時間帯　週次</h3>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    <FormField
                      control={editForm.control}
                      name="medicationWeekMonday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>月曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekTuesday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>火曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekWednesday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>水曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekThursday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>木曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekFriday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>金曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekSaturday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>土曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="medicationWeekSunday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>日曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Excretion Information */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">排泄</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="excretionTimeUrineStanding"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>自立便</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="excretionTimeUrineAssisted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>介助便</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="diaperSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>おむつサイズ</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="おむつサイズ" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="diaperType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>おむつコース</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="おむつコース" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="excretionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>排泄時間</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="リタンが取りでん" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ご利用者の削除</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingResident?.name}さんの情報を削除してもよろしいですか？
              この操作は取り消すことができません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteResidentMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              {deleteResidentMutation.isPending ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}