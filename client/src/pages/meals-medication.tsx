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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Utensils, Pill } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const mealMedicationSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  type: z.string().min(1, "記録タイプを選択してください"),
  mealType: z.string().optional(),
  mealIntake: z.string().optional(),
  medicationName: z.string().optional(),
  dosage: z.string().optional(),
  administeredTime: z.string().optional(),
  notes: z.string().optional(),
});

type MealMedicationForm = z.infer<typeof mealMedicationSchema>;

export default function MealsMedication() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [recordType, setRecordType] = useState<"meal" | "medication">("meal");
  
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const selectedDate = urlParams.get('date') || format(new Date(), "yyyy-MM-dd");
  const selectedFloor = urlParams.get('floor') || "all";

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["/api/meals-medication"],
  });

  const form = useForm<MealMedicationForm>({
    resolver: zodResolver(mealMedicationSchema),
    defaultValues: {
      residentId: "",
      recordDate: new Date().toISOString().slice(0, 16),
      type: recordType,
      mealType: "",
      mealIntake: "",
      medicationName: "",
      dosage: "",
      administeredTime: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MealMedicationForm) => {
      const recordData = {
        ...data,
        recordDate: data.recordDate,
        administeredTime: data.administeredTime || undefined,
        mealType: data.mealType || undefined,
        mealIntake: data.mealIntake || undefined,
        medicationName: data.medicationName || undefined,
        dosage: data.dosage || undefined,
        notes: data.notes || undefined,
      };
      
      await apiRequest("POST", "/api/meals-medication", recordData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals-medication"] });
      form.reset();
      setOpen(false);
      toast({
        title: "成功",
        description: `${recordType === "meal" ? "食事" : "服薬"}記録を作成しました`,
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `${recordType === "meal" ? "食事" : "服薬"}記録の作成に失敗しました`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MealMedicationForm) => {
    createMutation.mutate({ ...data, type: recordType });
  };

  const mealTypes = [
    { value: "breakfast", label: "朝食" },
    { value: "lunch", label: "昼食" },
    { value: "dinner", label: "夕食" },
    { value: "snack", label: "間食" },
  ];

  const mealIntakeOptions = [
    { value: "full", label: "完食" },
    { value: "partial", label: "半分" },
    { value: "minimal", label: "少量" },
    { value: "none", label: "摂取なし" },
  ];

  const mealRecords = records.filter((r: any) => r.type === "meal");
  const medicationRecords = records.filter((r: any) => r.type === "medication");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Utensils className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">食事/服薬記録</h1>
              <p className="text-slate-600">食事・投薬記録の管理</p>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新規記録</DialogTitle>
                <DialogDescription>
                  食事または服薬記録を入力してください
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={recordType} onValueChange={(value) => setRecordType(value as "meal" | "medication")} className="mb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="meal">食事記録</TabsTrigger>
                  <TabsTrigger value="medication">服薬記録</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="residentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>利用者</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="利用者を選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {residents.map((resident: any) => (
                              <SelectItem key={resident.id} value={resident.id}>
                                {resident.name}
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
                    name="recordDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>記録日時</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recordType === "meal" ? (
                    <>
                      <FormField
                        control={form.control}
                        name="mealType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>食事種別</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="食事種別を選択" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mealTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
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
                        name="mealIntake"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>摂取量</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="摂取量を選択" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mealIntakeOptions.map((option) => (
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
                    </>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="medicationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>薬剤名</FormLabel>
                            <FormControl>
                              <Input placeholder="薬剤名を入力" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dosage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>用量</FormLabel>
                            <FormControl>
                              <Input placeholder="用量を入力（例：1錠、5ml）" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="administeredTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>服薬時刻</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備考</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="特記事項があれば入力してください"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {createMutation.isPending ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="meals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="meals">食事記録 ({mealRecords.length})</TabsTrigger>
            <TabsTrigger value="medications">服薬記録 ({medicationRecords.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="meals" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">記録を読み込み中...</p>
              </div>
            ) : mealRecords.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-slate-600">食事記録がありません</p>
                </CardContent>
              </Card>
            ) : (
              mealRecords.map((record: any) => {
                const resident = residents.find((r: any) => r.id === record.residentId);
                const mealTypeLabel = mealTypes.find(t => t.value === record.mealType)?.label || record.mealType;
                const intakeLabel = mealIntakeOptions.find(o => o.value === record.mealIntake)?.label || record.mealIntake;
                
                return (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Utensils className="w-5 h-5 text-blue-600" />
                        {mealTypeLabel}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {resident?.name || "不明な利用者"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(record.recordDate), "PPP HH:mm", { locale: ja })}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-1">
                        <p><strong>摂取量:</strong> {intakeLabel}</p>
                        {record.notes && (
                          <p className="text-slate-600 bg-slate-50 p-2 rounded mt-2">
                            <strong>備考:</strong> {record.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="medications" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">記録を読み込み中...</p>
              </div>
            ) : medicationRecords.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-slate-600">服薬記録がありません</p>
                </CardContent>
              </Card>
            ) : (
              medicationRecords.map((record: any) => {
                const resident = residents.find((r: any) => r.id === record.residentId);
                
                return (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Pill className="w-5 h-5 text-green-600" />
                        {record.medicationName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {resident?.name || "不明な利用者"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(record.recordDate), "PPP HH:mm", { locale: ja })}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-1">
                        <p><strong>用量:</strong> {record.dosage}</p>
                        {record.administeredTime && (
                          <p><strong>服薬時刻:</strong> {format(new Date(record.administeredTime), "HH:mm")}</p>
                        )}
                        {record.notes && (
                          <p className="text-slate-600 bg-slate-50 p-2 rounded mt-2">
                            <strong>備考:</strong> {record.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
