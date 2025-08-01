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
import { Plus, Calendar, User, Edit, ClipboardList, Activity, Utensils, Pill, Baby, FileText, ArrowLeft, Save, Check, X, MoreHorizontal, Info, Search } from "lucide-react";
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
  type?: "text" | "datetime-local" | "select" | "time";
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
        className="h-full min-h-[5rem] resize-none"
        autoFocus
      />
    );
  }

  return (
    <Input
      type={type === "time" ? "time" : type}
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
  const [newRecordBlocks, setNewRecordBlocks] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedFloor, setSelectedFloor] = useState<string>("all");

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: careRecords = [], isLoading } = useQuery({
    queryKey: ["/api/care-records"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
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

  // 新規追加ブロック作成
  const addNewRecordBlock = () => {
    const newBlock = {
      id: Date.now().toString(),
      residentId: selectedResident ? selectedResident.id : "",
      category: "",
      recordDate: new Date().toISOString().slice(0, 16),
      description: "",
      notes: "",
    };
    setNewRecordBlocks(prev => [...prev, newBlock]);
  };

  // インライン新規記録作成ハンドラー
  const handleNewRecordEdit = (blockId: string, field: string, value: string) => {
    setNewRecordBlocks(prev => 
      prev.map(block => 
        block.id === blockId 
          ? { ...block, [field]: value }
          : block
      )
    );

    // 更新されたブロックを取得
    const updatedBlocks = newRecordBlocks.map(block => 
      block.id === blockId 
        ? { ...block, [field]: value }
        : block
    );
    
    const updatedBlock = updatedBlocks.find(block => block.id === blockId);
    if (!updatedBlock) return;

    // 必須フィールドがすべて入力されたら自動保存
    const hasRequiredFields = selectedResident 
      ? updatedBlock.category && updatedBlock.description // 利用者詳細画面
      : updatedBlock.residentId && updatedBlock.category && updatedBlock.description; // メイン画面

    if (hasRequiredFields) {
      const submitData = {
        ...updatedBlock,
        residentId: selectedResident ? selectedResident.id : updatedBlock.residentId,
      };
      createMutation.mutate(submitData);
      // 保存後にブロックを削除
      setNewRecordBlocks(prev => prev.filter(block => block.id !== blockId));
    }
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

  // 階数のオプションを生成（利用者データから）
  const floorOptions = [
    { value: "all", label: "全階" },
    ...Array.from(new Set((residents as any[]).map(r => r.floor).filter(Boolean)))
      .sort((a, b) => a - b)
      .map(floor => ({ value: floor.toString(), label: `${floor}階` }))
  ];

  // フィルター適用済みの利用者一覧
  const filteredResidents = (residents as any[]).filter((resident: any) => {
    // 階数フィルター
    if (selectedFloor !== "all" && resident.floor?.toString() !== selectedFloor) {
      return false;
    }
    
    // 日付フィルター（入所日・退所日による絞り込み）
    const filterDate = new Date(selectedDate);
    const admissionDate = resident.admissionDate ? new Date(resident.admissionDate) : null;
    const retirementDate = resident.retirementDate ? new Date(resident.retirementDate) : null;
    
    // 入所日がある場合、選択した日付が入所日以降である必要がある
    if (admissionDate && filterDate < admissionDate) {
      return false;
    }
    
    // 退所日がある場合、選択した日付が退所日以前である必要がある
    if (retirementDate && filterDate > retirementDate) {
      return false;
    }
    
    return true;
  });

  const { data: vitals = [] } = useQuery({
    queryKey: ["/api/vitals", selectedResident?.id],
    enabled: !!selectedResident,
  });

  const { data: mealRecords = [] } = useQuery({
    queryKey: ["/api/meal-records", selectedResident?.id],
    enabled: !!selectedResident,
  });

  // 記録内容全文表示用のstate
  const [selectedRecordContent, setSelectedRecordContent] = useState<string>("");
  const [contentDialogOpen, setContentDialogOpen] = useState(false);

  if (view === 'detail' && selectedResident) {
    return (
      <div className="min-h-screen bg-blue-100">
        <div className="bg-blue-200 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">介護記録</h1>
          </div>
          <div className="text-center mb-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-slate-700 bg-white"
            />
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident.roomNumber || "未設定"}: {selectedResident.name}　
              <span className="text-sm font-normal">
                {selectedResident.gender} {selectedResident.age || "未設定"}歳 {selectedResident.careLevel || "未設定"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-150 p-2 text-center">
          <span className="text-sm font-medium">{format(new Date(), "M月d日", { locale: ja })}</span>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-2">
          {(careRecords as any[])
            .filter((record: any) => {
              if (record.residentId !== selectedResident.id) return false;
              const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
              return recordDate === selectedDate;
            })
            .sort((a: any, b: any) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
            .length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <p>選択した日付の介護記録がありません</p>
              </div>
            ) : (
              (careRecords as any[])
                .filter((record: any) => {
                  if (record.residentId !== selectedResident.id) return false;
                  const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
                  return recordDate === selectedDate;
                })
                .sort((a: any, b: any) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
                .map((record: any) => {
                  const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
                  const recordTime = format(new Date(record.recordDate), "HH : mm", { locale: ja });
                  
                  return (
                    <div key={record.id} className="bg-white border border-slate-200 p-3 shadow-sm">
                      <div className="flex h-20">
                        {/* 左側：時間、カテゴリ、記録者を縦並び */}
                        <div className="flex flex-col justify-between min-w-[120px] mr-3">
                          <InlineEditableField
                            value={recordTime}
                            onSave={(value) => {
                              // 時刻の更新処理
                              const [hours, minutes] = value.split(':');
                              const currentDate = new Date(record.recordDate);
                              currentDate.setHours(parseInt(hours), parseInt(minutes));
                              updateMutation.mutate({ 
                                id: record.id, 
                                field: 'recordDate', 
                                value: currentDate.toISOString()
                              });
                            }}
                            type="time"
                            placeholder="時刻"
                          />
                          <InlineEditableField
                            value={record.category}
                            onSave={(value) => updateMutation.mutate({ id: record.id, field: 'category', value })}
                            type="select"
                            options={categoryOptions}
                            placeholder="カテゴリ"
                          />
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded truncate">
                            {(currentUser as any)?.firstName || (currentUser as any)?.email || "記録者"}
                          </span>
                        </div>
                        
                        {/* 中央：記録内容（高さいっぱい） */}
                        <div className="flex-1 mr-3">
                          <div className="h-full">
                            <InlineEditableField
                              value={record.description}
                              onSave={(value) => updateMutation.mutate({ id: record.id, field: 'description', value })}
                              placeholder="記録内容"
                              multiline={true}
                            />
                          </div>
                        </div>
                        
                        {/* 右側：アイコンを縦並び */}
                        <div className="flex flex-col justify-center space-y-1">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 p-1 h-8 w-8">
                            <Info className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:bg-blue-50 p-1 h-8 w-8"
                            onClick={() => {
                              setSelectedRecordContent(record.description);
                              setContentDialogOpen(true);
                            }}
                          >
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-blue-200 p-4 flex justify-between">
          <Button 
            variant="ghost" 
            className="bg-blue-300 hover:bg-blue-400"
            onClick={() => setView('list')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" className="bg-blue-300 hover:bg-blue-400">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* 記録内容全文表示ダイアログ */}
        <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>記録内容</DialogTitle>
              <DialogDescription>記録の詳細内容を表示しています</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="p-4 bg-slate-50 rounded-lg border">
                <p className="text-slate-800 whitespace-pre-wrap">{selectedRecordContent}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

        {/* Filter Controls */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">日付（入所・退所による絞り込み）</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">階数</label>
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {floorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Residents Selection Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">利用者一覧</h2>
          {filteredResidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mt-2">利用者情報画面から利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredResidents.map((resident: any) => (
                <Card 
                  key={resident.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedResident(resident);
                    setView('detail');
                    form.setValue('residentId', resident.id);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-blue-600">
                            {resident.roomNumber || "未設定"}
                          </div>
                          <div className="text-xs text-slate-500">号室</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base truncate">{resident.name}</div>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <div className="text-sm font-medium text-slate-700">
                            {resident.careLevel || "未設定"}
                          </div>
                          <div className="text-xs text-slate-500">介護度</div>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResident(resident);
                          setView('detail');
                          form.setValue('residentId', resident.id);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>


      </main>
    </div>
  );
}
