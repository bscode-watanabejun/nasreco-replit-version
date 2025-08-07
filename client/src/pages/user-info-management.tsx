import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const residentSchema = z.object({
  roomNumber: z.string().optional(),
  floor: z.string().optional(),
  name: z.string().min(1, "利用者名を入力してください"),
  gender: z.string().optional(),
  admissionDate: z.string().optional(),
  retirementDate: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  attendingPhysician: z.string().optional(),
  careLevel: z.string().optional(),
  careRatio: z.string().optional(),
  insuranceNumber: z.string().optional(),
  careAuthorizationPeriodFrom: z.string().optional(),
  careAuthorizationPeriodTo: z.string().optional(),
  isHospitalized: z.boolean().optional(),
  isAdmitted: z.boolean().optional(),
  
  // 緊急連絡先1
  emergencyContact1Name: z.string().optional(),
  emergencyContact1Relationship: z.string().optional(),
  emergencyContact1Phone1: z.string().optional(),
  emergencyContact1Phone2: z.string().optional(),
  emergencyContact1Address: z.string().optional(),
  
  // 緊急連絡先2
  emergencyContact2Name: z.string().optional(),
  emergencyContact2Relationship: z.string().optional(),
  emergencyContact2Phone1: z.string().optional(),
  emergencyContact2Phone2: z.string().optional(),
  emergencyContact2Address: z.string().optional(),
  
  // 服薬時間帯
  medicationWakeUp: z.boolean().optional(),
  medicationMorningBefore: z.boolean().optional(),
  medicationMorningAfter: z.boolean().optional(),
  medicationLunchBefore: z.boolean().optional(),
  medicationLunchAfter: z.boolean().optional(),
  medicationEveningBefore: z.boolean().optional(),
  medicationEveningAfter: z.boolean().optional(),
  medicationBedtime: z.boolean().optional(),
  medicationAsNeeded: z.boolean().optional(),
  
  // 服薬時間帯週次
  medicationWeekMonday: z.boolean().optional(),
  medicationWeekTuesday: z.boolean().optional(),
  medicationWeekWednesday: z.boolean().optional(),
  medicationWeekThursday: z.boolean().optional(),
  medicationWeekFriday: z.boolean().optional(),
  medicationWeekSaturday: z.boolean().optional(),
  medicationWeekSunday: z.boolean().optional(),
  
  // 服薬時間帯月次
  medicationMonthly: z.string().optional(),
  
  // 点眼時間帯
  eyeDropsWakeUp: z.boolean().optional(),
  eyeDropsMorningBefore: z.boolean().optional(),
  eyeDropsMorningAfter: z.boolean().optional(),
  eyeDropsLunchBefore: z.boolean().optional(),
  eyeDropsLunchAfter: z.boolean().optional(),
  eyeDropsEveningBefore: z.boolean().optional(),
  eyeDropsEveningAfter: z.boolean().optional(),
  eyeDropsBedtime: z.boolean().optional(),
  eyeDropsAsNeeded: z.boolean().optional(),
  
  // 点眼時間帯週次
  eyeDropsWeekMonday: z.boolean().optional(),
  eyeDropsWeekTuesday: z.boolean().optional(),
  eyeDropsWeekWednesday: z.boolean().optional(),
  eyeDropsWeekThursday: z.boolean().optional(),
  eyeDropsWeekFriday: z.boolean().optional(),
  eyeDropsWeekSaturday: z.boolean().optional(),
  eyeDropsWeekSunday: z.boolean().optional(),
  
  // 清掃リネン交換日
  linenChangeMonday: z.boolean().optional(),
  linenChangeTuesday: z.boolean().optional(),
  linenChangeWednesday: z.boolean().optional(),
  linenChangeThursday: z.boolean().optional(),
  linenChangeFriday: z.boolean().optional(),
  linenChangeSaturday: z.boolean().optional(),
  linenChangeSunday: z.boolean().optional(),
  
  // 入浴日
  bathMonday: z.boolean().optional(),
  bathTuesday: z.boolean().optional(),
  bathWednesday: z.boolean().optional(),
  bathThursday: z.boolean().optional(),
  bathFriday: z.boolean().optional(),
  bathSaturday: z.boolean().optional(),
  bathSunday: z.boolean().optional(),
  
  // 食事
  mealTubeFeeding: z.boolean().optional(),
  mealOralFeeding: z.boolean().optional(),
  
  // 排泄
  excretionIndependent: z.boolean().optional(),
  excretionAssisted: z.boolean().optional(),
  
  // 排泄時間
  excretionTime: z.string().optional(),
  
  // おむつサイズ
  diaperSize: z.string().optional(),
  
  // おむつコース
  diaperCourse: z.string().optional(),
  
  notes: z.string().optional(),
});

type ResidentForm = z.infer<typeof residentSchema>;

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
  const [editingResident, setEditingResident] = useState<any>(null);

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["/api/residents"],
  });

  const form = useForm<ResidentForm>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      roomNumber: "",
      floor: "",
      name: "",
      gender: "",
      admissionDate: "",
      retirementDate: "",
      dateOfBirth: "",
      age: "",
      postalCode: "",
      address: "",
      attendingPhysician: "",
      careLevel: "",
      careRatio: "",
      insuranceNumber: "",
      careAuthorizationPeriodFrom: "",
      careAuthorizationPeriodTo: "",
      isHospitalized: false,
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
      
      // 服薬時間帯
      medicationWakeUp: false,
      medicationMorningBefore: false,
      medicationMorningAfter: false,
      medicationLunchBefore: false,
      medicationLunchAfter: false,
      medicationEveningBefore: false,
      medicationEveningAfter: false,
      medicationBedtime: false,
      medicationAsNeeded: false,
      
      // 服薬時間帯週次
      medicationWeekMonday: false,
      medicationWeekTuesday: false,
      medicationWeekWednesday: false,
      medicationWeekThursday: false,
      medicationWeekFriday: false,
      medicationWeekSaturday: false,
      medicationWeekSunday: false,
      
      // 服薬時間帯月次
      medicationMonthly: "",
      
      // 点眼時間帯
      eyeDropsWakeUp: false,
      eyeDropsMorningBefore: false,
      eyeDropsMorningAfter: false,
      eyeDropsLunchBefore: false,
      eyeDropsLunchAfter: false,
      eyeDropsEveningBefore: false,
      eyeDropsEveningAfter: false,
      eyeDropsBedtime: false,
      eyeDropsAsNeeded: false,
      
      // 点眼時間帯週次
      eyeDropsWeekMonday: false,
      eyeDropsWeekTuesday: false,
      eyeDropsWeekWednesday: false,
      eyeDropsWeekThursday: false,
      eyeDropsWeekFriday: false,
      eyeDropsWeekSaturday: false,
      eyeDropsWeekSunday: false,
      
      // 清掃リネン交換日
      linenChangeMonday: false,
      linenChangeTuesday: false,
      linenChangeWednesday: false,
      linenChangeThursday: false,
      linenChangeFriday: false,
      linenChangeSaturday: false,
      linenChangeSunday: false,
      
      // 入浴日
      bathMonday: false,
      bathTuesday: false,
      bathWednesday: false,
      bathThursday: false,
      bathFriday: false,
      bathSaturday: false,
      bathSunday: false,
      
      // 食事
      mealTubeFeeding: false,
      mealOralFeeding: false,
      
      // 排泄
      excretionIndependent: false,
      excretionAssisted: false,
      
      // 排泄時間
      excretionTime: "",
      
      // おむつサイズ
      diaperSize: "",
      
      // おむつコース
      diaperCourse: "",
      
      notes: "",
    },
  });

  const editForm = useForm<ResidentForm>({
    resolver: zodResolver(residentSchema),
    defaultValues: form.getValues(),
  });

  // 生年月日の変更を監視して年齢を自動計算
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'dateOfBirth' && value.dateOfBirth) {
        const age = calculateAge(value.dateOfBirth);
        form.setValue('age', age);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    const subscription = editForm.watch((value, { name }) => {
      if (name === 'dateOfBirth' && value.dateOfBirth) {
        const age = calculateAge(value.dateOfBirth);
        editForm.setValue('age', age);
      }
    });
    return () => subscription.unsubscribe();
  }, [editForm]);

  const createResidentMutation = useMutation({
    mutationFn: (data: ResidentForm) => apiRequest("/api/residents", "POST", data),
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
    mutationFn: ({ id, data }: { id: number; data: ResidentForm }) => 
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

  const onSubmit = (data: ResidentForm) => {
    createResidentMutation.mutate(data);
  };

  const onEditSubmit = (data: ResidentForm) => {
    if (editingResident) {
      updateResidentMutation.mutate({ id: editingResident.id, data });
    }
  };

  const openEditDialog = (resident: any) => {
    setEditingResident(resident);
    editForm.reset(resident);
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
              <Button className="bg-pink-500 hover:bg-pink-600 text-white">
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
                                <Input {...field} placeholder="101" />
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
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
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
                                <Input {...field} placeholder="山田太郎" />
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
                              <Select onValueChange={field.onChange} value={field.value}>
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
                          control={form.control}
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
                          control={form.control}
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
                          control={form.control}
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
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>年齢</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="75" disabled />
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
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="介護度を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="要支援1">要支援1</SelectItem>
                                  <SelectItem value="要支援2">要支援2</SelectItem>
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
                          name="careRatio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>割合</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
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
                      </div>
                      
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>郵便番号</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="123-4567" />
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
                                <Input {...field} placeholder="東京都渋谷区..." />
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
                                <Input {...field} placeholder="田中医院 田中先生" />
                              </FormControl>
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
                                <Input {...field} placeholder="12345678" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="careAuthorizationPeriodFrom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>介護認定期間（開始）</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="careAuthorizationPeriodTo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>介護認定期間（終了）</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="isHospitalized"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>入院</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Emergency Contacts */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">緊急連絡先</h3>
                      
                      {/* Emergency Contact 1 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">緊急連絡先1</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emergencyContact1Name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>氏名</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="山田花子" />
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
                                <FormLabel>続柄</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="長女" />
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
                                <FormLabel>電話番号1</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="090-1234-5678" />
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
                                <FormLabel>電話番号2</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="03-1234-5678" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="emergencyContact1Address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>住所</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="東京都新宿区..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Emergency Contact 2 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">緊急連絡先2</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emergencyContact2Name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>氏名</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="山田次郎" />
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
                                <FormLabel>続柄</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="長男" />
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
                                <FormLabel>電話番号1</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="080-1234-5678" />
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
                                <FormLabel>電話番号2</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="042-123-4567" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="emergencyContact2Address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>住所</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="神奈川県横浜市..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Care Details */}
                  <Card>
                    <CardContent className="p-4 space-y-6">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">ケア詳細</h3>
                      
                      {/* 服薬時間帯 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯</h4>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                          <FormField
                            control={form.control}
                            name="medicationWakeUp"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">起床後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationMorningBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">朝前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationMorningAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">朝後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationLunchBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">昼前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationLunchAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">昼後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationEveningBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">夕前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationEveningAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">夕後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationBedtime"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">眠前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationAsNeeded"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">頓服</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 服薬時間帯週次 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯週次</h4>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                          <FormField
                            control={form.control}
                            name="medicationWeekMonday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">月曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekTuesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">火曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekWednesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">水曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekThursday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">木曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekFriday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">金曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekSaturday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">土曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="medicationWeekSunday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">日曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 服薬時間帯月次 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯月次</h4>
                        <FormField
                          control={form.control}
                          name="medicationMonthly"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-32">
                                    <SelectValue placeholder="日を選択" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({length: 31}, (_, i) => i + 1).map((day) => (
                                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* 点眼時間帯 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">点眼時間帯</h4>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                          <FormField
                            control={form.control}
                            name="eyeDropsWakeUp"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">起床後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsMorningBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">朝前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsMorningAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">朝後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsLunchBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">昼前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsLunchAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">昼後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsEveningBefore"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">夕前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsEveningAfter"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">夕後</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsBedtime"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">眠前</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsAsNeeded"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">頓服</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 点眼時間帯週次 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">点眼時間帯週次</h4>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekMonday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">月曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekTuesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">火曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekWednesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">水曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekThursday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">木曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekFriday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">金曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekSaturday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">土曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eyeDropsWeekSunday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">日曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 清掃リネン交換日 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">清掃リネン交換日</h4>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                          <FormField
                            control={form.control}
                            name="linenChangeMonday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">月曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeTuesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">火曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeWednesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">水曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeThursday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">木曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeFriday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">金曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeSaturday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">土曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="linenChangeSunday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">日曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 入浴日 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">入浴日</h4>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                          <FormField
                            control={form.control}
                            name="bathMonday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">月曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathTuesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">火曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathWednesday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">水曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathThursday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">木曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathFriday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">金曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathSaturday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">土曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bathSunday"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">日曜日</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 食事 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">食事</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="mealTubeFeeding"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">経管</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mealOralFeeding"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">経口</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 排泄 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">排泄</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="excretionIndependent"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">自立便</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="excretionAssisted"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm">介助便</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 排泄時間 */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">排泄時間</h4>
                        <FormField
                          control={form.control}
                          name="excretionTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="排泄時間の詳細を入力してください"
                                  rows={3}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* おむつサイズ */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">おむつサイズ</h4>
                        <FormField
                          control={form.control}
                          name="diaperSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder="おむつのサイズを入力してください" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* おむつコース */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">おむつコース</h4>
                        <FormField
                          control={form.control}
                          name="diaperCourse"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder="おむつコースを入力してください" />
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
                      onClick={() => setOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      disabled={createResidentMutation.isPending}
                      className="bg-pink-500 hover:bg-pink-600 text-white"
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
          {residents.map((resident: any) => (
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
                            <Input {...field} placeholder="101" />
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
                          <FormLabel>フロア</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                    <FormField
                      control={editForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>性別</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                            <Input {...field} placeholder="75" disabled />
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="介護度を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="要支援1">要支援1</SelectItem>
                              <SelectItem value="要支援2">要支援2</SelectItem>
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
                      name="careRatio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>割合</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                  </div>
                  
                  <div className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>郵便番号</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123-4567" />
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
                            <Input {...field} placeholder="東京都渋谷区..." />
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
                            <Input {...field} placeholder="田中医院 田中先生" />
                          </FormControl>
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
                            <Input {...field} placeholder="12345678" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="careAuthorizationPeriodFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>介護認定期間（開始）</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="careAuthorizationPeriodTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>介護認定期間（終了）</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="isHospitalized"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>入院</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contacts */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">緊急連絡先</h3>
                  
                  {/* Emergency Contact 1 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">緊急連絡先1</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="emergencyContact1Name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>氏名</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="山田花子" />
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
                            <FormLabel>続柄</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="長女" />
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
                            <FormLabel>電話番号1</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="090-1234-5678" />
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
                            <FormLabel>電話番号2</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="03-1234-5678" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="東京都新宿区..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Emergency Contact 2 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">緊急連絡先2</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="emergencyContact2Name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>氏名</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="山田次郎" />
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
                            <FormLabel>続柄</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="長男" />
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
                            <FormLabel>電話番号1</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="080-1234-5678" />
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
                            <FormLabel>電話番号2</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="042-123-4567" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="神奈川県横浜市..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Care Details */}
              <Card>
                <CardContent className="p-4 space-y-6">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">ケア詳細</h3>
                  
                  {/* 服薬時間帯 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯</h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                      <FormField
                        control={editForm.control}
                        name="medicationWakeUp"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">起床後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationMorningBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">朝前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationMorningAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">朝後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationLunchBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">昼前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationLunchAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">昼後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationEveningBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">夕前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationEveningAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">夕後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationBedtime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">眠前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationAsNeeded"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">頓服</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 服薬時間帯週次 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯週次</h4>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                      <FormField
                        control={editForm.control}
                        name="medicationWeekMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">月曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekTuesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">火曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekWednesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">水曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekThursday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">木曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekFriday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">金曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekSaturday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">土曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="medicationWeekSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">日曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 服薬時間帯月次 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">服薬時間帯月次</h4>
                    <FormField
                      control={editForm.control}
                      name="medicationMonthly"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="日を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.from({length: 31}, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 点眼時間帯 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">点眼時間帯</h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWakeUp"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">起床後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsMorningBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">朝前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsMorningAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">朝後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsLunchBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">昼前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsLunchAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">昼後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsEveningBefore"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">夕前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsEveningAfter"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">夕後</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsBedtime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">眠前</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsAsNeeded"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">頓服</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 点眼時間帯週次 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">点眼時間帯週次</h4>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">月曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekTuesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">火曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekWednesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">水曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekThursday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">木曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekFriday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">金曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekSaturday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">土曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="eyeDropsWeekSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">日曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 清掃リネン交換日 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">清掃リネン交換日</h4>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                      <FormField
                        control={editForm.control}
                        name="linenChangeMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">月曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeTuesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">火曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeWednesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">水曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeThursday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">木曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeFriday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">金曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeSaturday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">土曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="linenChangeSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">日曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 入浴日 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">入浴日</h4>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                      <FormField
                        control={editForm.control}
                        name="bathMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">月曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathTuesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">火曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathWednesday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">水曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathThursday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">木曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathFriday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">金曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathSaturday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">土曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bathSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">日曜日</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 食事 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">食事</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="mealTubeFeeding"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">経管</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="mealOralFeeding"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">経口</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 排泄 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">排泄</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="excretionIndependent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">自立便</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="excretionAssisted"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">介助便</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 排泄時間 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">排泄時間</h4>
                    <FormField
                      control={editForm.control}
                      name="excretionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="排泄時間の詳細を入力してください"
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* おむつサイズ */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">おむつサイズ</h4>
                    <FormField
                      control={editForm.control}
                      name="diaperSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="おむつのサイズを入力してください" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* おむつコース */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">おむつコース</h4>
                    <FormField
                      control={editForm.control}
                      name="diaperCourse"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="おむつコースを入力してください" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notes */
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