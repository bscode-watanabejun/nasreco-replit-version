import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, Building, User, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// インライン編集用のコンポーネント
function InlineEditableField({ 
  value, 
  onSave, 
  type = "text", 
  placeholder = "", 
  options = [],
  disabled = false
}: {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "select" | "number";
  placeholder?: string;
  options?: { value: string; label: string; }[];
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = async () => {
    if (currentValue !== value && !disabled) {
      await onSave(currentValue);
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (disabled || !isEditing) {
    return (
      <div 
        className={`cursor-pointer hover:bg-slate-50 p-2 rounded border-2 border-transparent hover:border-slate-200 transition-colors ${disabled ? 'cursor-not-allowed bg-slate-100' : ''}`}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {value || <span className="text-slate-400">{placeholder}</span>}
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

export default function Vitals() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // URLパラメータから日付と時間帯、フロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedTiming, setSelectedTiming] = useState(urlParams.get('timing') || "午前");
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || "全階");

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: vitalSigns = [], isLoading } = useQuery({
    queryKey: ["/api/vital-signs"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // 新規記録作成用ミューテーション
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/vital-signs", {
        ...data,
        recordDate: new Date(data.recordDate || new Date()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      toast({
        title: "成功",
        description: "バイタルサインを記録しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "バイタルサインの記録に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 記録更新用ミューテーション
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value, residentId }: { id: string; field: string; value: string; residentId?: string }) => {
      // 一時的なレコード（IDがtempで始まる）の場合は新規作成
      if (id.startsWith('temp-')) {
        const newRecordData: any = {
          residentId: residentId || id.split('-')[1], // temp-{residentId}-{date}-{timing}から抽出
          recordDate: new Date(selectedDate),
          timing: selectedTiming,
          [field]: value,
        };
        
        // データ型を適切に変換
        if (field === 'recordDate') {
          newRecordData[field] = new Date(value);
        } else if (['temperature', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'pulseRate', 'respirationRate', 'oxygenSaturation', 'bloodSugar'].includes(field)) {
          newRecordData[field] = value ? parseFloat(value) : null;
        } else if (['hour', 'minute'].includes(field)) {
          newRecordData[field] = value ? parseInt(value) : null;
        }
        
        await apiRequest("POST", "/api/vital-signs", newRecordData);
      } else {
        // 既存レコードの更新
        const updateData: any = { [field]: value };
        if (field === 'recordDate') {
          updateData[field] = new Date(value);
        } else if (['temperature', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'pulseRate', 'respirationRate', 'oxygenSaturation', 'bloodSugar'].includes(field)) {
          updateData[field] = value ? parseFloat(value) : null;
        } else if (['hour', 'minute'].includes(field)) {
          updateData[field] = value ? parseInt(value) : null;
        }
        await apiRequest("PATCH", `/api/vital-signs/${id}`, updateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
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

  // 記録削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vital-signs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      toast({
        title: "削除完了",
        description: "記録を削除しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "記録の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // オプションの定義
  const temperatureOptions = Array.from({ length: 21 }, (_, i) => {
    const temp = (36.0 + i * 0.1).toFixed(1);
    return { value: temp, label: temp };
  });

  const systolicBPOptions = Array.from({ length: 51 }, (_, i) => {
    const bp = (80 + i).toString();
    return { value: bp, label: bp };
  });

  const diastolicBPOptions = Array.from({ length: 41 }, (_, i) => {
    const bp = (50 + i).toString();
    return { value: bp, label: bp };
  });

  const pulseOptions = Array.from({ length: 51 }, (_, i) => {
    const pulse = (50 + i).toString();
    return { value: pulse, label: pulse };
  });

  const spo2Options = Array.from({ length: 31 }, (_, i) => {
    const spo2 = (70 + i).toString();
    return { value: spo2, label: spo2 };
  });

  const respirationOptions = Array.from({ length: 16 }, (_, i) => {
    const rr = (10 + i).toString();
    return { value: rr, label: rr };
  });

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0'),
  }));

  const minuteOptions = [
    { value: "0", label: "00" },
    { value: "15", label: "15" },
    { value: "30", label: "30" },
    { value: "45", label: "45" },
  ];

  const timingOptions = [
    { value: "午前", label: "午前" },
    { value: "午後", label: "午後" },
    { value: "臨時", label: "臨時" },
    { value: "前日", label: "前日" },
  ];

  const floorOptions = [
    { value: "全階", label: "全階" },
    { value: "1", label: "1階" },
    { value: "2", label: "2階" },
    { value: "3", label: "3階" },
    { value: "4", label: "4階" },
    { value: "5", label: "5階" },
  ];

  // 新規記録作成
  const addNewRecord = () => {
    const newRecord = {
      residentId: "",
      recordDate: new Date(),
      timing: selectedTiming,
      temperature: null,
      bloodPressureSystolic: null,
      bloodPressureDiastolic: null,
      pulseRate: null,
      respirationRate: null,
      oxygenSaturation: null,
      bloodSugar: null,
      notes: "",
      staffName: "",
    };
    createMutation.mutate(newRecord);
  };

  // 記入者スタンプ機能
  const handleStaffStamp = (vitalId: string, residentId?: string) => {
    const now = new Date();
    const hour = now.getHours().toString();
    const minute = Math.floor(now.getMinutes() / 15) * 15; // 15分単位に丸める
    const staffName = (currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明";
    
    updateMutation.mutate({ id: vitalId, field: 'hour', value: hour, residentId });
    updateMutation.mutate({ id: vitalId, field: 'minute', value: minute.toString(), residentId });
    updateMutation.mutate({ id: vitalId, field: 'staffName', value: staffName, residentId });
  };

  // 階数でフィルタリングした利用者リスト
  const filteredResidents = (residents as any[]).filter((resident: any) => {
    if (selectedFloor === "全階") return true;
    return resident.floor?.toString() === selectedFloor;
  });

  // フィルタリング済みの記録を取得し、存在しない場合は空のレコードを作成
  const getFilteredVitalSigns = () => {
    const existingVitals = (vitalSigns as any[]).filter((vital: any) => {
      const vitalDate = format(new Date(vital.recordDate), "yyyy-MM-dd");
      if (vitalDate !== selectedDate) return false;
      
      if (vital.timing !== selectedTiming) return false;
      
      if (selectedFloor !== "全階") {
        const resident = residents.find((r: any) => r.id === vital.residentId);
        if (!resident || resident.floor?.toString() !== selectedFloor) return false;
      }
      
      return true;
    });

    // 当日以前の日付の場合、すべての利用者のカードを表示
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // 今日の終わりまでを含む

    if (selectedDateObj <= today) {
      // 各利用者に対してレコードが存在するかチェック、なければ空のレコードを作成
      const vitalsWithEmpty = [...existingVitals];
      
      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingVitals.some((vital: any) => vital.residentId === resident.id);
        if (!hasRecord) {
          // 空のレコードを作成
          vitalsWithEmpty.push({
            id: `temp-${resident.id}-${selectedDate}-${selectedTiming}`,
            residentId: resident.id,
            recordDate: selectedDate,
            timing: selectedTiming,
            hour: null,
            minute: null,
            staffName: null,
            temperature: null,
            bloodPressureSystolic: null,
            bloodPressureDiastolic: null,
            pulseRate: null,
            respirationRate: null,
            oxygenSaturation: null,
            bloodSugar: null,
            notes: null,
            createdAt: null,
            updatedAt: null,
            isTemporary: true // 一時的なレコードフラグ
          });
        }
      });
      
      return vitalsWithEmpty;
    }
    
    return existingVitals;
  };

  const filteredVitalSigns = getFilteredVitalSigns();

  return (
    <div className="min-h-screen bg-blue-100">
      {/* ヘッダー */}
      <div className="bg-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">バイタル一覧</h1>
          </div>
        </div>
      </div>

      {/* フィルタ条件 */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex gap-4 items-center justify-center">
          {/* 日付選択 */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-slate-700 bg-white"
            />
          </div>
          
          {/* 時間選択 */}
          <Select value={selectedTiming} onValueChange={setSelectedTiming}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="時間選択" />
            </SelectTrigger>
            <SelectContent>
              {timingOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-blue-600" />
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-32">
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

      {/* 記録一覧 */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {filteredVitalSigns.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <p>選択した条件の記録がありません</p>
          </div>
        ) : (
          filteredVitalSigns.map((vital: any) => {
            const resident = residents.find((r: any) => r.id === vital.residentId);
            const hasAnyData = vital.temperature || vital.bloodPressureSystolic || vital.bloodPressureDiastolic || 
                              vital.pulseRate || vital.respirationRate || vital.oxygenSaturation || 
                              vital.bloodSugar || vital.notes || vital.staffName;
            
            return (
              <Card key={vital.id} className="bg-white shadow-sm">
                <CardContent className="p-4">
                  {/* 第1行：居室番号、利用者名、時間、時分、記入者、スタンプボタン */}
                  <div className="grid grid-cols-6 gap-2 mb-4 items-center">
                    <div className="text-center">
                      <div className="text-lg font-bold">{resident?.roomNumber || "未設定"}</div>
                    </div>
                    
                    <div>
                      <InlineEditableField
                        value={resident?.name || ""}
                        onSave={(value) => {
                          // 利用者名変更は記録がない場合のみ
                          if (!hasAnyData) {
                            const newResident = residents.find((r: any) => r.name === value);
                            if (newResident) {
                              updateMutation.mutate({ id: vital.id, field: 'residentId', value: newResident.id, residentId: vital.residentId });
                            }
                          }
                        }}
                        type="select"
                        options={filteredResidents.map((r: any) => ({ value: r.name, label: r.name }))}
                        disabled={hasAnyData}
                        placeholder="利用者選択"
                      />
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-slate-100 p-2 rounded">{selectedTiming}</div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <InlineEditableField
                        value={vital.hour?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'hour', value, residentId: vital.residentId })}
                        type="select"
                        options={hourOptions}
                        placeholder="時"
                      />
                      <span>:</span>
                      <InlineEditableField
                        value={vital.minute?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'minute', value, residentId: vital.residentId })}
                        type="select"
                        options={minuteOptions}
                        placeholder="分"
                      />
                    </div>
                    
                    <div>
                      <InlineEditableField
                        value={vital.staffName || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'staffName', value, residentId: vital.residentId })}
                        placeholder="記入者"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleStaffStamp(vital.id, vital.residentId)}
                        data-testid={`button-stamp-${vital.id}`}
                      >
                        <User className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 第2行：バイタル項目 */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm font-medium text-blue-600 mb-2">KT</div>
                      <InlineEditableField
                        value={vital.temperature?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'temperature', value, residentId: vital.residentId })}
                        type="select"
                        options={temperatureOptions}
                        placeholder="体温"
                      />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-blue-600 mb-2">BP</div>
                      <div className="flex items-center gap-1">
                        <InlineEditableField
                          value={vital.bloodPressureSystolic?.toString() || ""}
                          onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'bloodPressureSystolic', value, residentId: vital.residentId })}
                          type="select"
                          options={systolicBPOptions}
                          placeholder="上"
                        />
                        <span>/</span>
                        <InlineEditableField
                          value={vital.bloodPressureDiastolic?.toString() || ""}
                          onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'bloodPressureDiastolic', value, residentId: vital.residentId })}
                          type="select"
                          options={diastolicBPOptions}
                          placeholder="下"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-blue-600 mb-2">P</div>
                      <InlineEditableField
                        value={vital.pulseRate?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'pulseRate', value, residentId: vital.residentId })}
                        type="select"
                        options={pulseOptions}
                        placeholder="脈拍"
                      />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-blue-600 mb-2">SPO2</div>
                      <div className="flex items-center gap-1">
                        <InlineEditableField
                          value={vital.oxygenSaturation?.toString() || ""}
                          onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'oxygenSaturation', value, residentId: vital.residentId })}
                          type="select"
                          options={spo2Options}
                          placeholder="SPO2"
                        />
                        {vital.oxygenSaturation && <span className="text-sm text-slate-600">%</span>}
                      </div>
                    </div>
                  </div>
                  
                  {/* 第3行：BS、RR、記録、削除ボタン */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div>
                      <div className="text-sm font-medium mb-2">BS</div>
                      <InlineEditableField
                        value={vital.bloodSugar?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'bloodSugar', value, residentId: vital.residentId })}
                        type="number"
                        placeholder="血糖値"
                      />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium mb-2">RR</div>
                      <InlineEditableField
                        value={vital.respirationRate?.toString() || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'respirationRate', value, residentId: vital.residentId })}
                        type="select"
                        options={respirationOptions}
                        placeholder="呼吸数"
                      />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium mb-2">記録</div>
                      <InlineEditableField
                        value={vital.notes || ""}
                        onSave={(value) => updateMutation.mutate({ id: vital.id, field: 'notes', value, residentId: vital.residentId })}
                        placeholder="記録内容"
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-red-500 hover:bg-red-600"
                            data-testid={`button-delete-${vital.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>記録削除の確認</AlertDialogTitle>
                            <AlertDialogDescription>
                              この記録を削除してもよろしいですか？この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(vital.id)}>
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-blue-200 p-4 flex justify-center">
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={addNewRecord}
          data-testid="button-add-record"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}