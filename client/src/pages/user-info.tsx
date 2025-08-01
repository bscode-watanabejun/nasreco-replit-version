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
  name: z.string().min(1, "氏名を入力してください"),
  nameKana: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  roomNumber: z.string().optional(),
  floor: z.string().optional(),
  admissionDate: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
});

type ResidentForm = z.infer<typeof residentSchema>;

export default function UserInfo() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["/api/residents"],
  });

  const form = useForm<ResidentForm>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      name: "",
      nameKana: "",
      dateOfBirth: "",
      gender: "",
      roomNumber: "",
      floor: "",
      admissionDate: "",
      emergencyContact: "",
      medicalHistory: "",
      allergies: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ResidentForm) => {
      const residentData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : null,
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

  const onSubmit = (data: ResidentForm) => {
    createMutation.mutate(data);
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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

                    <FormField
                      control={form.control}
                      name="nameKana"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>氏名（カナ）</FormLabel>
                          <FormControl>
                            <Input placeholder="ヤマダ タロウ" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
                      name="floor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>フロア</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="フロアを選択" />
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
                  </div>

                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>緊急連絡先</FormLabel>
                        <FormControl>
                          <Input placeholder="090-1234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="medicalHistory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>既往歴</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="既往歴・医療情報を入力してください"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>アレルギー情報</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="アレルギー情報を入力してください"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
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
                      className="bg-orange-600 hover:bg-orange-700"
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
          ) : residents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 text-lg mb-2">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mb-4">「新規登録」ボタンから利用者を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {residents.map((resident: any) => {
                const age = calculateAge(resident.dateOfBirth);
                const genderLabel = genderOptions.find(g => g.value === resident.gender)?.label;
                
                return (
                  <Card key={resident.id} className="record-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{resident.name}</CardTitle>
                          {resident.nameKana && (
                            <p className="text-sm text-slate-500">{resident.nameKana}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {age && (
                              <Badge variant="secondary" className="text-xs">
                                {age}歳
                              </Badge>
                            )}
                            {genderLabel && (
                              <Badge variant="outline" className="text-xs">
                                {genderLabel}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {resident.roomNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span>
                            {resident.floor && `${resident.floor} `}
                            {resident.roomNumber}号室
                          </span>
                        </div>
                      )}
                      
                      {resident.admissionDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span>
                            入所: {format(new Date(resident.admissionDate), "yyyy年MM月dd日", { locale: ja })}
                          </span>
                        </div>
                      )}
                      
                      {resident.emergencyContact && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span className="truncate">{resident.emergencyContact}</span>
                        </div>
                      )}
                      
                      {(resident.allergies || resident.medicalHistory) && (
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="text-red-600 text-xs">
                            医療情報あり
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
