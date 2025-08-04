import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, Edit, Calendar, MapPin, Phone, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

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
  insuranceNumber: z.string().optional(),
  careAuthorizationPeriod: z.string().optional(),
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
  medicationMorning: z.boolean().optional(),
  medicationEvening: z.boolean().optional(),
  medicationMorningBefore: z.boolean().optional(),
  medicationEveningBefore: z.boolean().optional(),
  medicationBedtime: z.boolean().optional(),
  medicationOther: z.boolean().optional(),
  
  // 点眼時間帯
  eyeDropsMorning: z.boolean().optional(),
  eyeDropsEvening: z.boolean().optional(),
  eyeDropsMorningBefore: z.boolean().optional(),
  eyeDropsEveningBefore: z.boolean().optional(),
  eyeDropsBedtime: z.boolean().optional(),
  eyeDropsOther: z.boolean().optional(),
  
  // 入浴日
  bathSunday: z.boolean().optional(),
  bathMonday: z.boolean().optional(),
  bathTuesday: z.boolean().optional(),
  bathWednesday: z.boolean().optional(),
  bathThursday: z.boolean().optional(),
  bathFriday: z.boolean().optional(),
  bathSaturday: z.boolean().optional(),
  
  // 清拭・リネン交換日
  bathingSunday: z.boolean().optional(),
  bathingMonday: z.boolean().optional(),
  bathingTuesday: z.boolean().optional(),
  bathingWednesday: z.boolean().optional(),
  bathingThursday: z.boolean().optional(),
  bathingFriday: z.boolean().optional(),
  bathingSaturday: z.boolean().optional(),
  
  // 服薬週次
  medicationTimeSunday: z.boolean().optional(),
  medicationTimeMonday: z.boolean().optional(),
  medicationTimeTuesday: z.boolean().optional(),
  medicationTimeWednesday: z.boolean().optional(),
  medicationTimeThursday: z.boolean().optional(),
  medicationTimeFriday: z.boolean().optional(),
  medicationTimeSaturday: z.boolean().optional(),
  
  // 排泄情報
  excretionTimeUrineStanding: z.boolean().optional(),
  excretionTimeUrineAssisted: z.boolean().optional(),
  excretionTime: z.string().optional(),
  diaperSize: z.string().optional(),
  diaperType: z.string().optional(),
  
  // 腹膜透析
  medicationFrequency: z.string().optional(),
  mealLunch: z.boolean().optional(),
  mealDinner: z.boolean().optional(),
  
  notes: z.string().optional(),
});

type ResidentForm = z.infer<typeof residentSchema>;

export default function UserInfo() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const selectedDate = urlParams.get('date') || format(new Date(), "yyyy-MM-dd");
  const selectedFloor = urlParams.get('floor') || "all";
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
      
      // 服薬時間帯
      medicationMorning: false,
      medicationEvening: false,
      medicationMorningBefore: false,
      medicationEveningBefore: false,
      medicationBedtime: false,
      medicationOther: false,
      
      // 点眼時間帯
      eyeDropsMorning: false,
      eyeDropsEvening: false,
      eyeDropsMorningBefore: false,
      eyeDropsEveningBefore: false,
      eyeDropsBedtime: false,
      eyeDropsOther: false,
      
      // 入浴日
      bathSunday: false,
      bathMonday: false,
      bathTuesday: false,
      bathWednesday: false,
      bathThursday: false,
      bathFriday: false,
      bathSaturday: false,
      
      // 清拭・リネン交換日
      bathingSunday: false,
      bathingMonday: false,
      bathingTuesday: false,
      bathingWednesday: false,
      bathingThursday: false,
      bathingFriday: false,
      bathingSaturday: false,
      
      // 服薬週次
      medicationTimeSunday: false,
      medicationTimeMonday: false,
      medicationTimeTuesday: false,
      medicationTimeWednesday: false,
      medicationTimeThursday: false,
      medicationTimeFriday: false,
      medicationTimeSaturday: false,
      
      // 排泄情報
      excretionTimeUrineStanding: false,
      excretionTimeUrineAssisted: false,
      excretionTime: "",
      diaperSize: "",
      diaperType: "",
      
      // 腹膜透析
      medicationFrequency: "",
      mealLunch: false,
      mealDinner: false,
      
      notes: "",
    },
  });

  const editForm = useForm<ResidentForm>({
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
      
      // 服薬時間帯
      medicationMorning: false,
      medicationEvening: false,
      medicationMorningBefore: false,
      medicationEveningBefore: false,
      medicationBedtime: false,
      medicationOther: false,
      
      // 点眼時間帯
      eyeDropsMorning: false,
      eyeDropsEvening: false,
      eyeDropsMorningBefore: false,
      eyeDropsEveningBefore: false,
      eyeDropsBedtime: false,
      eyeDropsOther: false,
      
      // 入浴日
      bathSunday: false,
      bathMonday: false,
      bathTuesday: false,
      bathWednesday: false,
      bathThursday: false,
      bathFriday: false,
      bathSaturday: false,
      
      // 清拭・リネン交換日
      bathingSunday: false,
      bathingMonday: false,
      bathingTuesday: false,
      bathingWednesday: false,
      bathingThursday: false,
      bathingFriday: false,
      bathingSaturday: false,
      
      // 服薬週次
      medicationTimeSunday: false,
      medicationTimeMonday: false,
      medicationTimeTuesday: false,
      medicationTimeWednesday: false,
      medicationTimeThursday: false,
      medicationTimeFriday: false,
      medicationTimeSaturday: false,
      
      // 排泄情報
      excretionTimeUrineStanding: false,
      excretionTimeUrineAssisted: false,
      excretionTime: "",
      diaperSize: "",
      diaperType: "",
      
      // 腹膜透析
      medicationFrequency: "",
      mealLunch: false,
      mealDinner: false,
      
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ResidentForm) => {
      const residentData = {
        ...data,
        dateOfBirth: data.dateOfBirth || undefined,
        admissionDate: data.admissionDate || undefined,
        retirementDate: data.retirementDate || undefined,
        postalCode: data.postalCode || undefined,
        address: data.address || undefined,
        attendingPhysician: data.attendingPhysician || undefined,
        careLevel: data.careLevel || undefined,
        insuranceNumber: data.insuranceNumber || undefined,
        careAuthorizationPeriod: data.careAuthorizationPeriod || undefined,
        emergencyContact1Name: data.emergencyContact1Name || undefined,
        emergencyContact1Relationship: data.emergencyContact1Relationship || undefined,
        emergencyContact1Phone1: data.emergencyContact1Phone1 || undefined,
        emergencyContact1Phone2: data.emergencyContact1Phone2 || undefined,
        emergencyContact1Address: data.emergencyContact1Address || undefined,
        emergencyContact2Name: data.emergencyContact2Name || undefined,
        emergencyContact2Relationship: data.emergencyContact2Relationship || undefined,
        emergencyContact2Phone1: data.emergencyContact2Phone1 || undefined,
        emergencyContact2Phone2: data.emergencyContact2Phone2 || undefined,
        emergencyContact2Address: data.emergencyContact2Address || undefined,
        notes: data.notes || undefined,
      };
      
      await apiRequest("POST", "/api/residents", residentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      form.reset();
      setOpen(false);
      toast({
        title: "成功",
        description: "利用者情報を登録しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "利用者情報の登録に失敗しました",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ResidentForm & { id: string }) => {
      const residentData = {
        ...data,
        dateOfBirth: data.dateOfBirth || undefined,
        admissionDate: data.admissionDate || undefined,
        retirementDate: data.retirementDate || undefined,
        postalCode: data.postalCode || undefined,
        address: data.address || undefined,
        attendingPhysician: data.attendingPhysician || undefined,
        careLevel: data.careLevel || undefined,
        insuranceNumber: data.insuranceNumber || undefined,
        careAuthorizationPeriod: data.careAuthorizationPeriod || undefined,
        emergencyContact1Name: data.emergencyContact1Name || undefined,
        emergencyContact1Relationship: data.emergencyContact1Relationship || undefined,
        emergencyContact1Phone1: data.emergencyContact1Phone1 || undefined,
        emergencyContact1Phone2: data.emergencyContact1Phone2 || undefined,
        emergencyContact1Address: data.emergencyContact1Address || undefined,
        emergencyContact2Name: data.emergencyContact2Name || undefined,
        emergencyContact2Relationship: data.emergencyContact2Relationship || undefined,
        emergencyContact2Phone1: data.emergencyContact2Phone1 || undefined,
        emergencyContact2Phone2: data.emergencyContact2Phone2 || undefined,
        emergencyContact2Address: data.emergencyContact2Address || undefined,
        notes: data.notes || undefined,
      };
      
      await apiRequest("PUT", `/api/residents/${data.id}`, residentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      editForm.reset();
      setEditOpen(false);
      setEditingResident(null);
      toast({
        title: "成功",
        description: "利用者情報を更新しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "利用者情報の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResidentForm) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: ResidentForm) => {
    if (editingResident) {
      updateMutation.mutate({ ...data, id: editingResident.id });
    }
  };

  const handleEditClick = (resident: any) => {
    setEditingResident(resident);
    
    // Convert dates to string format for the form
    const formData = {
      ...resident,
      admissionDate: resident.admissionDate ? new Date(resident.admissionDate).toISOString().split('T')[0] : "",
      retirementDate: resident.retirementDate ? new Date(resident.retirementDate).toISOString().split('T')[0] : "",
      dateOfBirth: resident.dateOfBirth ? new Date(resident.dateOfBirth).toISOString().split('T')[0] : "",
      age: resident.age ? resident.age.toString() : "",
      roomNumber: resident.roomNumber || "",
      floor: resident.floor || "",
      name: resident.name || "",
      gender: resident.gender || "",
      postalCode: resident.postalCode || "",
      address: resident.address || "",
      attendingPhysician: resident.attendingPhysician || "",
      careLevel: resident.careLevel || "",
      insuranceNumber: resident.insuranceNumber || "",
      careAuthorizationPeriod: resident.careAuthorizationPeriod || "",
      isAdmitted: resident.isAdmitted || false,
      emergencyContact1Name: resident.emergencyContact1Name || "",
      emergencyContact1Relationship: resident.emergencyContact1Relationship || "",
      emergencyContact1Phone1: resident.emergencyContact1Phone1 || "",
      emergencyContact1Phone2: resident.emergencyContact1Phone2 || "",
      emergencyContact1Address: resident.emergencyContact1Address || "",
      emergencyContact2Name: resident.emergencyContact2Name || "",
      emergencyContact2Relationship: resident.emergencyContact2Relationship || "",
      emergencyContact2Phone1: resident.emergencyContact2Phone1 || "",
      emergencyContact2Phone2: resident.emergencyContact2Phone2 || "",
      emergencyContact2Address: resident.emergencyContact2Address || "",
      
      // 服薬時間帯
      medicationMorning: resident.medicationMorning || false,
      medicationEvening: resident.medicationEvening || false,
      medicationMorningBefore: resident.medicationMorningBefore || false,
      medicationEveningBefore: resident.medicationEveningBefore || false,
      medicationBedtime: resident.medicationBedtime || false,
      medicationOther: resident.medicationOther || false,
      
      // 点眼時間帯
      eyeDropsMorning: resident.eyeDropsMorning || false,
      eyeDropsEvening: resident.eyeDropsEvening || false,
      eyeDropsMorningBefore: resident.eyeDropsMorningBefore || false,
      eyeDropsEveningBefore: resident.eyeDropsEveningBefore || false,
      eyeDropsBedtime: resident.eyeDropsBedtime || false,
      eyeDropsOther: resident.eyeDropsOther || false,
      
      // 入浴日
      bathSunday: resident.bathSunday || false,
      bathMonday: resident.bathMonday || false,
      bathTuesday: resident.bathTuesday || false,
      bathWednesday: resident.bathWednesday || false,
      bathThursday: resident.bathThursday || false,
      bathFriday: resident.bathFriday || false,
      bathSaturday: resident.bathSaturday || false,
      
      // 清拭・リネン交換日
      bathingSunday: resident.bathingSunday || false,
      bathingMonday: resident.bathingMonday || false,
      bathingTuesday: resident.bathingTuesday || false,
      bathingWednesday: resident.bathingWednesday || false,
      bathingThursday: resident.bathingThursday || false,
      bathingFriday: resident.bathingFriday || false,
      bathingSaturday: resident.bathingSaturday || false,
      
      // 服薬週次
      medicationTimeSunday: resident.medicationTimeSunday || false,
      medicationTimeMonday: resident.medicationTimeMonday || false,
      medicationTimeTuesday: resident.medicationTimeTuesday || false,
      medicationTimeWednesday: resident.medicationTimeWednesday || false,
      medicationTimeThursday: resident.medicationTimeThursday || false,
      medicationTimeFriday: resident.medicationTimeFriday || false,
      medicationTimeSaturday: resident.medicationTimeSaturday || false,
      
      // 排泄情報
      excretionTimeUrineStanding: resident.excretionTimeUrineStanding || false,
      excretionTimeUrineAssisted: resident.excretionTimeUrineAssisted || false,
      excretionTime: resident.excretionTime || "",
      diaperSize: resident.diaperSize || "",
      diaperType: resident.diaperType || "",
      
      // 腹膜透析
      medicationFrequency: resident.medicationFrequency || "",
      mealLunch: resident.mealLunch || false,
      mealDinner: resident.mealDinner || false,
      
      notes: resident.notes || "",
    };
    
    editForm.reset(formData);
    setEditOpen(true);
  };

  const genderOptions = [
    { value: "male", label: "男性" },
    { value: "female", label: "女性" },
    { value: "other", label: "その他" },
  ];

  const floorOptions = [
    { value: "1F", label: "1階" },
    { value: "2F", label: "2階" },
    { value: "3F", label: "3階" },
    { value: "4F", label: "4階" },
  ];

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ご利用者情報</h1>
              <p className="text-slate-600">利用者情報の管理</p>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                新規登録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新規利用者登録</DialogTitle>
                <DialogDescription>
                  利用者の基本情報を入力してください
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* 基本情報 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">基本情報</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>居室番号</FormLabel>
                            <FormControl>
                              <Input placeholder="101" {...field} />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="階を選択" />
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
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>利用者名 *</FormLabel>
                            <FormControl>
                              <Input placeholder="山田 太郎" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>性別</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="性別を選択" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">男性</SelectItem>
                                <SelectItem value="female">女性</SelectItem>
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              <Input type="number" placeholder="85" {...field} />
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
                              <Input placeholder="123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input placeholder="東京都○○区○○1-1-1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="attendingPhysician"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>主治医</FormLabel>
                            <FormControl>
                              <Input placeholder="○○クリニック" {...field} />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        control={form.control}
                        name="insuranceNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>被保険者番号</FormLabel>
                            <FormControl>
                              <Input placeholder="1234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="careAuthorizationPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>介護認定期間</FormLabel>
                          <FormControl>
                            <Input placeholder="2024/07/12 ～ 2025/01/31" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 緊急連絡先1 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">緊急連絡先1</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContact1Name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>氏名</FormLabel>
                            <FormControl>
                              <Input placeholder="田中 一郎" {...field} />
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
                              <Input placeholder="長男" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContact1Phone1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>電話1</FormLabel>
                            <FormControl>
                              <Input placeholder="080-1234-5678" {...field} />
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
                            <FormLabel>電話2</FormLabel>
                            <FormControl>
                              <Input placeholder="080-1234-5678" {...field} />
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
                            <Input placeholder="埼玉県○○市○○区1-1-1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 緊急連絡先2 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">緊急連絡先2</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContact2Name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>氏名</FormLabel>
                            <FormControl>
                              <Input placeholder="田中 花子" {...field} />
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
                              <Input placeholder="長女" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContact2Phone1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>電話1</FormLabel>
                            <FormControl>
                              <Input placeholder="080-5678-9012" {...field} />
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
                            <FormLabel>電話2</FormLabel>
                            <FormControl>
                              <Input placeholder="080-5678-9012" {...field} />
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
                            <Input placeholder="埼玉県○○市○○区1-1-1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 服薬時間帯セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">服薬時間帯</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <FormField
                        control={form.control}
                        name="medicationMorning"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>夕前</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 点眼時間帯セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">点眼時間帯</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <FormField
                        control={form.control}
                        name="eyeDropsMorning"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>夕前</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 入浴日セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">入浴日</h3>
                    <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                      <FormField
                        control={form.control}
                        name="bathSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>日曜日</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bathMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>土曜日</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 清拭・リネン交換日セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">清拭・リネン交換日</h3>
                    <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                      <FormField
                        control={form.control}
                        name="bathingSunday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>日曜日</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bathingMonday"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>土曜日</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 排泄情報セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">排泄情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="excretionTimeUrineStanding"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
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
                              <Input placeholder="L" {...field} />
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
                              <Input placeholder="テープ" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="excretionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>排泄時間</FormLabel>
                          <FormControl>
                            <Input placeholder="詳細な排泄時間を記入" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 腹膜透析情報セクション */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 border-b pb-2">腹膜透析情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="medicationFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>月次</FormLabel>
                            <FormControl>
                              <Input placeholder="月1回" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mealLunch"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>経口</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mealDinner"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </FormControl>
                            <FormLabel>経口</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備考</FormLabel>
                        <FormControl>
                          <Textarea placeholder="その他の特記事項があれば記入してください" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={createMutation.isPending}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      className="bg-orange-600 hover:bg-orange-700"
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "登録中..." : "登録"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Residents List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-slate-600">利用者情報を読み込み中...</p>
            </div>
          ) : (residents as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 text-lg mb-2">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mb-4">「新規登録」ボタンから利用者を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(residents as any[]).map((resident: any) => {
                const age = calculateAge(resident.dateOfBirth);
                const genderLabel = genderOptions.find(g => g.value === resident.gender)?.label;
                
                return (
                  <Card key={resident.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* 情報アイコン */}
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-slate-600" />
                          </div>
                        </div>
                        
                        {/* 部屋番号 */}
                        <div className="flex-shrink-0 text-center min-w-[80px]">
                          <div className="bg-slate-50 rounded-lg px-3 py-2 border">
                            <div className="text-lg font-bold text-slate-700">
                              {resident.roomNumber || "未設定"}
                            </div>
                          </div>
                        </div>
                        
                        {/* 名前 */}
                        <div className="flex-1 min-w-0">
                          <div className="bg-slate-50 rounded-lg px-4 py-3 border">
                            <div className="font-semibold text-lg text-slate-800 truncate">
                              {resident.name}
                            </div>
                            {resident.nameKana && (
                              <div className="text-sm text-slate-500 truncate">
                                {resident.nameKana}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 要介護度 */}
                        <div className="flex-shrink-0 text-center min-w-[100px]">
                          <div className="bg-slate-50 rounded-lg px-3 py-2 border">
                            <div className="text-sm font-medium text-slate-700">
                              {resident.careLevel || "未設定"}
                            </div>
                          </div>
                        </div>
                        
                        {/* 編集ボタン */}
                        <div className="flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditClick(resident)}
                            className="h-10 w-10 p-0 hover:bg-slate-100"
                          >
                            <Edit className="w-5 h-5 text-slate-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800">利用者情報編集</DialogTitle>
            </DialogHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                {/* 基本情報セクション - Same as create form */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Room and Floor */}
                    <FormField
                      control={editForm.control}
                      name="roomNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>部屋番号</FormLabel>
                          <FormControl>
                            <Input placeholder="101" {...field} />
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="階を選択" />
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

                    {/* Name */}
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名 *</FormLabel>
                          <FormControl>
                            <Input placeholder="山田 太郎" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Gender */}
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
                              {genderOptions.map((option) => (
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

                    {/* Date of Birth */}
                    <FormField
                      control={editForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>生年月日</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                const age = calculateAge(e.target.value);
                                if (age !== null) {
                                  editForm.setValue("age", age.toString());
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Age */}
                    <FormField
                      control={editForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>年齢</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="85" 
                              {...field}
                              readOnly
                              className="bg-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 連絡先情報セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">連絡先情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>郵便番号</FormLabel>
                          <FormControl>
                            <Input placeholder="123-4567" {...field} />
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
                            <Input placeholder="東京都渋谷区..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 医療・介護情報セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">医療・介護情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="attendingPhysician"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>主治医</FormLabel>
                          <FormControl>
                            <Input placeholder="田中医師" {...field} />
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
                          <FormControl>
                            <Input placeholder="要介護2" {...field} />
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
                          <FormLabel>保険証番号</FormLabel>
                          <FormControl>
                            <Input placeholder="12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="careAuthorizationPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>認定有効期間</FormLabel>
                          <FormControl>
                            <Input placeholder="2024年4月1日〜2025年3月31日" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="admissionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>入所日</FormLabel>
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
                          <FormLabel>退所日</FormLabel>
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
                    name="isAdmitted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </FormControl>
                        <FormLabel>現在入所中</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {/* 緊急連絡先1セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">緊急連絡先1</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="emergencyContact1Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名</FormLabel>
                          <FormControl>
                            <Input placeholder="山田 花子" {...field} />
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
                            <Input placeholder="長女" {...field} />
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
                            <Input placeholder="090-1234-5678" {...field} />
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
                            <Input placeholder="03-1234-5678" {...field} />
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
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input placeholder="東京都新宿区..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 緊急連絡先2セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">緊急連絡先2</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="emergencyContact2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名</FormLabel>
                          <FormControl>
                            <Input placeholder="山田 二郎" {...field} />
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
                            <Input placeholder="長男" {...field} />
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
                            <Input placeholder="080-1234-5678" {...field} />
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
                            <Input placeholder="042-123-4567" {...field} />
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
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input placeholder="神奈川県横浜市..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 服薬時間帯セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">服薬時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <FormField
                      control={form.control}
                      name="medicationMorning"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 点眼時間帯セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">点眼時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <FormField
                      control={form.control}
                      name="eyeDropsMorning"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>夕前</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 入浴日セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">入浴日</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <FormField
                      control={form.control}
                      name="bathSunday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>日曜日</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bathMonday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>土曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 清拭・リネン交換日セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">清拭・リネン交換日</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <FormField
                      control={form.control}
                      name="bathingSunday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>日曜日</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bathingMonday"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>土曜日</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 排泄情報セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">排泄情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="excretionTimeUrineStanding"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
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
                            <Input placeholder="L" {...field} />
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
                            <Input placeholder="テープ" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="excretionTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>排泄時間</FormLabel>
                        <FormControl>
                          <Input placeholder="詳細な排泄時間を記入" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 腹膜透析情報セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">腹膜透析情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="medicationFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>月次</FormLabel>
                          <FormControl>
                            <Input placeholder="月1回" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mealLunch"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>経口</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mealDinner"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel>経口</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 備考セクション */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">備考</h3>
                  <FormField
                    control={editForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>特記事項</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="特記事項があれば記入してください..."
                            className="w-full p-3 border border-slate-300 rounded-md resize-vertical min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-700"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "更新中..." : "更新"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
