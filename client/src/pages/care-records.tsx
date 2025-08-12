import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Plus, Calendar, User, Edit, ClipboardList, Activity, Utensils, Pill, Baby, FileText, ArrowLeft, Save, Check, X, MoreHorizontal, Info, Search, Paperclip, Trash2, Building } from "lucide-react";
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
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [newRecordBlocks, setNewRecordBlocks] = useState<any[]>([]);
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState<string>(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedFloor, setSelectedFloor] = useState<string>(urlParams.get('floor') || "all");

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
    ...Array.from(new Set((residents as any[]).map(r => {
      // "1F", "2F" などのF文字を除去して数値のみ取得
      const floor = r.floor?.toString().replace('F', '');
      return floor ? parseInt(floor) : null;
    }).filter(Boolean)))
      .sort((a, b) => a - b)
      .map(floor => ({ value: floor.toString(), label: `${floor}階` }))
  ];

  // フィルター適用済みの利用者一覧
  const filteredResidents = (residents as any[]).filter((resident: any) => {
    // 階数フィルター
    if (selectedFloor !== "all") {
      // 利用者のfloor値も正規化（"1F" → "1"）
      const residentFloor = resident.floor?.toString().replace('F', '');
      if (residentFloor !== selectedFloor) {
        return false;
      }
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
  }).sort((a, b) => {
    const roomA = parseInt(a.roomNumber || '999999');
    const roomB = parseInt(b.roomNumber || '999999');
    return roomA - roomB;
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
  
  // 記録詳細画面用のstate
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  
  // ファイルアップロード用state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; type: string }>>([]);

  // ファイルアップロード処理
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const url = URL.createObjectURL(file);
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          url: url,
          type: file.type
        }]);
      });
    }
  };

  // 介護記録詳細画面
  if (showRecordDetail && selectedRecordForDetail && selectedResident) {
    const recordTime = format(new Date(selectedRecordForDetail.recordDate), "HH : mm", { locale: ja });
    const categoryLabel = categoryOptions.find(opt => opt.value === selectedRecordForDetail.category)?.label || selectedRecordForDetail.category;
    
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">介護記録詳細</h1>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident.roomNumber || "未設定"}: {selectedResident.name}　　
              <span className="text-sm font-normal">
                {selectedResident.gender === 'male' ? '男性' : selectedResident.gender === 'female' ? '女性' : '未設定'} {selectedResident.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident.careLevel || '未設定'}
              </span>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4">
          {/* 記録情報カード */}
          <div className="bg-white border border-slate-200 p-4 shadow-sm mb-4">
            <div className="flex h-auto">
              <div className="flex flex-col justify-start min-w-[150px] mr-4">
                <div className="text-lg font-medium text-slate-800 mb-2">{recordTime}</div>
                <div className="text-sm text-slate-600 mb-2">{categoryLabel}</div>
                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded text-center">
                  記録者: {(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                </div>
              </div>
              <div className="flex-1">
                <div className="border border-slate-200 p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-slate-800 whitespace-pre-wrap">{selectedRecordForDetail.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ファイル添付エリア */}
          <div className="bg-white border border-slate-200 p-4 shadow-sm">
            <h3 className="text-lg font-medium text-slate-800 mb-4">添付ファイル</h3>
            
            {/* アップロードされたファイル表示 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="border border-slate-200 p-4 rounded-lg bg-slate-50 relative">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-32 object-cover rounded mb-2" />
                  ) : (
                    <div className="w-full h-32 bg-slate-200 rounded mb-2 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <p className="text-xs text-slate-600 truncate">{file.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-red-500 hover:bg-red-50"
                    onClick={() => {
                      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {/* ファイルアップロードエリア */}
              <label className="border-2 border-dashed border-slate-300 p-4 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 flex flex-col items-center justify-center h-32">
                <Paperclip className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600">ファイルを追加</span>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {/* ページングドット */}
            <div className="flex justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
            </div>
          </div>
        </main>

        {/* 戻るボタン */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex justify-start">
          <Button 
            variant="ghost" 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowRecordDetail(false)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedResident) {
    return (
      <div className="min-h-screen bg-orange-50">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
                {selectedResident.gender === 'male' ? '男性' : selectedResident.gender === 'female' ? '女性' : '未設定'} {selectedResident.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident.careLevel || '未設定'}
              </span>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-2">
          {(careRecords as any[])
            .filter((record: any) => {
              if (record.residentId !== selectedResident.id) return false;
              const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
              return recordDate === selectedDate;
            })
            .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime())
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
                .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime())
                .map((record: any) => {
                  const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
                  const recordTime = format(new Date(record.recordDate), "HH : mm", { locale: ja });
                  
                  return (
                    <div key={record.id} className="bg-white border border-slate-200 p-3 shadow-sm">
                      <div className="flex h-32">
                        {/* 左側：時間、カテゴリ、記録者を縦並び */}
                        <div className="flex flex-col justify-between min-w-[150px] mr-3">
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
                          <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded text-center break-words">
                            記録者: {(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                          </div>
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:bg-blue-50 p-1 h-8 w-8"
                            onClick={() => {
                              setSelectedRecordForDetail(record);
                              setShowRecordDetail(true);
                            }}
                          >
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

        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex justify-between">
          <Button 
            variant="ghost" 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setView('list')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const now = new Date();
              const newRecord = {
                residentId: selectedResident.id,
                recordDate: now.toISOString(),
                category: 'general',
                description: '',
              };
              
              createMutation.mutate(newRecord);
            }}
          >
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
    <div className="min-h-screen bg-orange-50 p-2">
      <div className="max-w-full mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800">介護記録</h1>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="フロア選択" />
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
          {filteredResidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mt-2">利用者情報画面から利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
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
                  <CardContent className="p-1.5 sm:p-2">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <div className="text-center min-w-[40px] sm:min-w-[50px]">
                          <div className="text-sm sm:text-lg font-bold text-blue-600">
                            {resident.roomNumber || "未設定"}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm sm:text-base truncate">{resident.name}</div>
                        </div>
                        <div className="text-center min-w-[60px] sm:min-w-[80px]">
                          <div className="text-xs sm:text-sm font-medium text-slate-700">
                            {resident.careLevel || "未設定"}
                          </div>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex items-center gap-1 px-2 sm:px-3 text-xs sm:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResident(resident);
                          setView('detail');
                          form.setValue('residentId', resident.id);
                        }}
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">記録</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
