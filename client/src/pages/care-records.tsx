import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Edit, ClipboardList, Activity, Utensils, Pill, Baby, FileText, ArrowLeft, Save, Check } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const careRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
  notes: z.string().optional(),
});

type CareRecordForm = z.infer<typeof careRecordSchema>;

// インライン編集用のコンポーネント
function InlineEditableField({ 
  value, 
  onSave, 
  type = "text", 
  placeholder = "", 
  multiline = false,
  options = [] 
}: {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "datetime-local" | "select";
  placeholder?: string;
  multiline?: boolean;
  options?: { value: string; label: string; }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (currentValue !== value) {
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
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <div 
        className="cursor-pointer hover:bg-slate-50 p-2 rounded border-2 border-transparent hover:border-slate-200 transition-colors relative group"
        onClick={() => setIsEditing(true)}
      >
        {type === "datetime-local" && value ? (
          format(new Date(value), "PPP HH:mm", { locale: ja })
        ) : type === "select" && options.length > 0 ? (
          options.find(opt => opt.value === value)?.label || value
        ) : (
          value || <span className="text-slate-400">{placeholder}</span>
        )}
        <Edit className="w-3 h-3 absolute top-1 right-1 opacity-0 group-hover:opacity-50 transition-opacity" />
        {isSaving && <Check className="w-3 h-3 absolute top-1 right-1 text-green-600" />}
      </div>
    );
  }

  if (type === "select") {
    return (
      <Select value={currentValue} onValueChange={setCurrentValue} onOpenChange={(open) => !open && handleBlur()}>
        <SelectTrigger className="h-auto min-h-[2.5rem]">
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

  if (multiline) {
    return (
      <Textarea
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[2.5rem] resize-none"
        autoFocus
      />
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
      className="h-auto min-h-[2.5rem]"
      autoFocus
    />
  );
}

export default function CareRecords() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: careRecords = [], isLoading } = useQuery({
    queryKey: ["/api/care-records"],
  });

  const form = useForm<CareRecordForm>({
    resolver: zodResolver(careRecordSchema),
    defaultValues: {
      residentId: selectedResident?.id || "",
      recordDate: new Date().toISOString().slice(0, 16),
      category: "",
      description: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CareRecordForm) => {
      await apiRequest("POST", "/api/care-records", {
        ...data,
        recordDate: new Date(data.recordDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-records"] });
      if (selectedResident) {
        queryClient.invalidateQueries({ queryKey: ["/api/care-records", selectedResident.id] });
      }
      form.reset({
        residentId: selectedResident?.id || "",
        recordDate: new Date().toISOString().slice(0, 16),
        category: "",
        description: "",
        notes: "",
      });
      setOpen(false);
      toast({
        title: "成功",
        description: "介護記録を作成しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "介護記録の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 記録更新用ミューテーション
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      await apiRequest("PATCH", `/api/care-records/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-records"] });
      toast({
        title: "保存完了",
        description: "記録を更新しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CareRecordForm) => {
    createMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "daily_care", label: "日常介護" },
    { value: "assistance", label: "介助" },
    { value: "observation", label: "観察" },
    { value: "medication", label: "服薬" },
    { value: "meal", label: "食事" },
    { value: "excretion", label: "排泄" },
    { value: "bath", label: "入浴" },
    { value: "vital", label: "バイタル" },
    { value: "round", label: "ラウンド" },
    { value: "other", label: "その他" },
  ];

  // 利用者詳細の記録を取得（既存のcareRecordsを利用）
  const residentRecords = (careRecords as any[]).filter((record: any) => 
    selectedResident ? record.residentId === selectedResident.id : false
  );

  const { data: vitals = [] } = useQuery({
    queryKey: ["/api/vitals", selectedResident?.id],
    enabled: !!selectedResident,
  });

  const { data: mealRecords = [] } = useQuery({
    queryKey: ["/api/meal-records", selectedResident?.id],
    enabled: !!selectedResident,
  });

  if (view === 'detail' && selectedResident) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setView('list')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>戻る</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{selectedResident.name}様の介護記録</h1>
                <p className="text-slate-600">個人記録・バイタル・食事・服薬・排泄・ラウンドの確認</p>
              </div>
            </div>
            
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    form.setValue('residentId', selectedResident.id);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新規記録
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>新規介護記録 - {selectedResident.name}様</DialogTitle>
                  <DialogDescription>
                    介護記録を入力してください
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="residentId"
                      render={({ field }) => (
                        <input type="hidden" {...field} />
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

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>カテゴリ</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="カテゴリを選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categoryOptions.map((option) => (
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
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>記録内容</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="介護記録の内容を入力してください"
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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

          {/* Resident Info Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>利用者情報</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-slate-600">居室番号:</span>
                  <p className="font-medium">{selectedResident.roomNumber || "未設定"}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-600">階:</span>
                  <p className="font-medium">{selectedResident.floor || "未設定"}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-600">年齢:</span>
                  <p className="font-medium">{selectedResident.age || "未設定"}歳</p>
                </div>
                <div>
                  <span className="text-sm text-slate-600">介護度:</span>
                  <p className="font-medium">{selectedResident.careLevel || "未設定"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records List */}
          <div className="space-y-6">
              <div className="space-y-4">
                {residentRecords.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">介護記録がありません</p>
                      <p className="text-sm text-slate-500 mt-2">「新規記録」ボタンから記録を追加してください</p>
                    </CardContent>
                  </Card>
                ) : (
                  residentRecords.map((record: any) => {
                      const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
                      
                      return (
                        <Card key={record.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-slate-600 block mb-1">カテゴリ</label>
                                  <InlineEditableField
                                    value={record.category}
                                    onSave={(value) => updateMutation.mutate({ id: record.id, field: 'category', value })}
                                    type="select"
                                    options={categoryOptions}
                                    placeholder="カテゴリを選択"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-slate-600 block mb-1">記録日時</label>
                                  <InlineEditableField
                                    value={record.recordDate}
                                    onSave={(value) => updateMutation.mutate({ id: record.id, field: 'recordDate', value })}
                                    type="datetime-local"
                                    placeholder="記録日時を選択"
                                  />
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-slate-600 block mb-1">記録内容</label>
                              <InlineEditableField
                                value={record.description}
                                onSave={(value) => updateMutation.mutate({ id: record.id, field: 'description', value })}
                                multiline
                                placeholder="記録内容を入力してください"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-600 block mb-1">備考</label>
                              <InlineEditableField
                                value={record.notes || ""}
                                onSave={(value) => updateMutation.mutate({ id: record.id, field: 'notes', value })}
                                multiline
                                placeholder="備考があれば入力してください"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">介護記録</h1>
            <p className="text-slate-600">利用者を選択して記録を確認・作成</p>
          </div>
        </div>

        {/* Residents Selection Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">利用者一覧</h2>
          {(residents as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mt-2">利用者情報画面から利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(residents as any[]).map((resident: any) => (
                <Card 
                  key={resident.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedResident(resident);
                    setView('detail');
                    form.setValue('residentId', resident.id);
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{resident.name}</CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {resident.roomNumber || "未設定"}号室
                        </Badge>
                        {resident.age && (
                          <Badge variant="outline" className="text-xs">
                            {resident.age}歳
                          </Badge>
                        )}
                      </div>
                      {resident.careLevel && (
                        <p className="text-sm text-slate-600">介護度: {resident.careLevel}</p>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">クリックして記録を確認</span>
                      <Button size="sm" variant="outline">
                        記録を見る
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Records Overview */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">最近の記録</h2>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新規介護記録</DialogTitle>
                <DialogDescription>
                  介護記録を入力してください
                </DialogDescription>
              </DialogHeader>
              
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
                            {(residents as any[]).map((resident: any) => (
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

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>カテゴリ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="カテゴリを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryOptions.map((option) => (
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>記録内容</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="介護記録の内容を入力してください"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

        {/* Records List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">記録を読み込み中...</p>
            </div>
          ) : (careRecords as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-slate-600">介護記録がありません</p>
                <p className="text-sm text-slate-500 mt-2">「新規記録」ボタンから記録を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            (careRecords as any[]).map((record: any) => {
              const resident = (residents as any[]).find((r: any) => r.id === record.residentId);
              const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
              
              return (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{categoryLabel}</CardTitle>
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
                      </div>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 mb-2">{record.description}</p>
                    {record.notes && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <strong>備考:</strong> {record.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
