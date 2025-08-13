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
  
  // 共通スタイル定数
  const inputBaseClass = "h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectTriggerClass = "h-8 min-h-8 max-h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 leading-none py-0";
  
  // URLパラメータから日付と時間帯、フロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedTiming, setSelectedTiming] = useState(urlParams.get('timing') || "午前");
  const [selectedFloor, setSelectedFloor] = useState(() => {
    // URLパラメータから階数を取得
    const floorParam = urlParams.get('floor');
    if (floorParam) {
      // ダッシュボードから来た'all'を'全階'に変換
      if (floorParam === 'all') {
        return "全階";
      }
      return floorParam;
    }
    
    // localStorageからトップ画面の選択階数を取得
    const savedFloor = localStorage.getItem('selectedFloor');
    if (savedFloor) {
      if (savedFloor === 'all') {
        return "全階";
      } else {
        // "1F" -> "1" の変換を行う
        const cleanFloor = savedFloor.replace('F', '');
        return cleanFloor;
      }
    }
    return "全階";
  });

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
      await apiRequest("/api/vital-signs", "POST", {
        ...data,
        recordDate: new Date(data.recordDate || new Date()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
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
          if (value && value.trim() !== '') {
            const numValue = parseFloat(value);
            newRecordData[field] = !isNaN(numValue) ? numValue : null;
          } else {
            newRecordData[field] = null;
          }
        } else if (['hour', 'minute'].includes(field)) {
          newRecordData[field] = value ? parseInt(value) : null;
        }
        
        await apiRequest("/api/vital-signs", "POST", newRecordData);
      } else {
        // 既存レコードの更新
        const updateData: any = { [field]: value };
        if (field === 'recordDate') {
          updateData[field] = new Date(value);
        } else if (['temperature', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'pulseRate', 'respirationRate', 'oxygenSaturation', 'bloodSugar'].includes(field)) {
          if (value && value.trim() !== '') {
            const numValue = parseFloat(value);
            updateData[field] = !isNaN(numValue) ? numValue : null;
          } else {
            updateData[field] = null;
          }
        } else if (['hour', 'minute'].includes(field)) {
          updateData[field] = value ? parseInt(value) : null;
        }
        
        await apiRequest(`/api/vital-signs/${id}`, "PATCH", updateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "バイタルサインの更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 記録削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/vital-signs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      toast({
        title: "成功",
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

  // 選択肢の定義
  const timingOptions = [
    { value: "午前", label: "午前" },
    { value: "午後", label: "午後" },
    { value: "夜間", label: "夜間" },
  ];

  const floorOptions = [
    { value: "全階", label: "全階" },
    { value: "1", label: "1階" },
    { value: "2", label: "2階" },
    { value: "3", label: "3階" },
    { value: "4", label: "4階" },
    { value: "5", label: "5階" },
  ];

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: i.toString(), label: `${i}時` }));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({ value: i.toString(), label: `${i}分` }));

  // バイタルサインの選択肢
  const temperatureOptions = Array.from({ length: 50 }, (_, i) => {
    const temp = (35.0 + i * 0.1).toFixed(1);
    return { value: temp, label: temp };
  });

  const systolicBPOptions = Array.from({ length: 101 }, (_, i) => {
    const bp = (80 + i).toString();
    return { value: bp, label: bp };
  });

  const diastolicBPOptions = Array.from({ length: 81 }, (_, i) => {
    const bp = (40 + i).toString();
    return { value: bp, label: bp };
  });

  const pulseOptions = Array.from({ length: 101 }, (_, i) => {
    const pulse = (40 + i).toString();
    return { value: pulse, label: pulse };
  });

  const spo2Options = Array.from({ length: 31 }, (_, i) => {
    const spo2 = (70 + i).toString();
    return { value: spo2, label: spo2 };
  });

  const respirationOptions = Array.from({ length: 31 }, (_, i) => {
    const rr = (10 + i).toString();
    return { value: rr, label: rr };
  });

  // スタッフ印機能
  const handleStaffStamp = async (vitalId: string, residentId?: string) => {
    const user = currentUser as any;
    const staffName = user?.firstName && user?.lastName 
      ? `${user.lastName} ${user.firstName}`
      : user?.email || "スタッフ";
    
    await updateMutation.mutate({ 
      id: vitalId, 
      field: 'staffName', 
      value: staffName,
      residentId 
    });
  };

  // 新規記録追加
  const addNewRecord = () => {
    const residentList = residents as any[];
    if (!residentList || residentList.length === 0) {
      toast({
        title: "エラー",
        description: "利用者情報が見つかりません",
        variant: "destructive",
      });
      return;
    }

    // 最初の利用者に対して新規レコードを作成
    const firstResident = residentList[0];
    const newRecord = {
      residentId: firstResident.id,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
    };

    createMutation.mutate(newRecord);
  };

  // フィルタリングロジック
  const getFilteredVitalSigns = () => {
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      if (selectedFloor === "全階") return true;
      
      const residentFloor = resident.floor;
      return residentFloor === selectedFloor;
    });

    const existingVitals = (vitalSigns as any[]).filter((vital: any) => {
      const vitalDate = format(new Date(vital.recordDate), "yyyy-MM-dd");
      if (vitalDate !== selectedDate) return false;
      
      if (vital.timing !== selectedTiming) return false;
      
      // フロアフィルタリング
      const resident = filteredResidents.find((r: any) => r.id === vital.residentId);
      if (!resident) return false;
      
      return true;
    });

    // 当日以前の日付の場合、すべての利用者のカードを表示
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDateObj <= today) {
      const vitalsWithEmpty = [...existingVitals];
      
      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingVitals.some((vital: any) => vital.residentId === resident.id);
        if (!hasRecord) {
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
            isTemporary: true
          });
        }
      });
      
      const uniqueVitals = vitalsWithEmpty.reduce((acc: any[], current: any) => {
        const existing = acc.find(item => item.residentId === current.residentId);
        if (!existing) {
          acc.push(current);
        } else {
          if (existing.isTemporary && !current.isTemporary) {
            const index = acc.findIndex(item => item.residentId === current.residentId);
            acc[index] = current;
          }
        }
        return acc;
      }, []);
      
      return uniqueVitals;
    }
    
    return existingVitals;
  };

  const filteredVitalSigns = getFilteredVitalSigns().sort((a: any, b: any) => {
    const residentA = (residents as any[]).find((r: any) => r.id === a.residentId);
    const residentB = (residents as any[]).find((r: any) => r.id === b.residentId);
    const roomA = parseInt(residentA?.roomNumber || "0");
    const roomB = parseInt(residentB?.roomNumber || "0");
    return roomA - roomB;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
          
          {/* 時間選択 */}
          <div className="flex items-center space-x-1">
            <Select value={selectedTiming} onValueChange={setSelectedTiming}>
              <SelectTrigger className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm">
                <SelectValue placeholder="時間" />
              </SelectTrigger>
              <SelectContent>
                {timingOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* 記録一覧 */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {filteredVitalSigns.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <p>選択した条件の記録がありません</p>
          </div>
        ) : (
          filteredVitalSigns.map((vital: any) => {
            const resident = (residents as any[]).find((r: any) => r.id === vital.residentId);
            
            return (
              <Card key={vital.id} className="bg-white shadow-sm">
                <CardContent className="p-3">
                  {/* ヘッダー：居室番号、利用者名、時間、記入者 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-blue-600 min-w-[50px]">
                        {resident?.roomNumber || "未設定"}
                      </div>
                      <div className="font-medium text-base">
                        {resident?.name || "未設定"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">{selectedTiming}</span>
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
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white h-6 w-6 p-0"
                        onClick={() => handleStaffStamp(vital.id, vital.residentId)}
                        data-testid={`button-stamp-${vital.id}`}
                      >
                        <User className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* メインバイタル */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-xs font-medium text-blue-600 mb-1">体温</div>
                      <Select 
                        value={vital.temperature?.toString() || ""} 
                        onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'temperature', value, residentId: vital.residentId })}
                      >
                        <SelectTrigger className={`w-full ${selectTriggerClass}`}>
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          {temperatureOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs font-medium text-blue-600 mb-1">血圧</div>
                      <div className="flex items-center justify-center gap-0.5 text-sm">
                        <Select 
                          value={vital.bloodPressureSystolic?.toString() || ""} 
                          onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'bloodPressureSystolic', value, residentId: vital.residentId })}
                        >
                          <SelectTrigger className={`w-8 ${selectTriggerClass} px-0.5`}>
                            <SelectValue placeholder="--" />
                          </SelectTrigger>
                          <SelectContent>
                            {systolicBPOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs">/</span>
                        <Select 
                          value={vital.bloodPressureDiastolic?.toString() || ""} 
                          onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'bloodPressureDiastolic', value, residentId: vital.residentId })}
                        >
                          <SelectTrigger className={`w-8 ${selectTriggerClass} px-0.5`}>
                            <SelectValue placeholder="--" />
                          </SelectTrigger>
                          <SelectContent>
                            {diastolicBPOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs font-medium text-blue-600 mb-1">脈拍</div>
                      <Select 
                        value={vital.pulseRate?.toString() || ""} 
                        onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'pulseRate', value, residentId: vital.residentId })}
                      >
                        <SelectTrigger className={`w-full ${selectTriggerClass}`}>
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          {pulseOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs font-medium text-blue-600 mb-1">SpO2</div>
                      <Select 
                        value={vital.oxygenSaturation?.toString() || ""} 
                        onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'oxygenSaturation', value, residentId: vital.residentId })}
                      >
                        <SelectTrigger className={`w-full ${selectTriggerClass}`}>
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          {spo2Options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* サブバイタルと記録 */}
                  <div className="flex gap-2 mb-3 items-center">
                    <div className="text-center">
                      <div className="text-xs font-medium mb-1">血糖</div>
                      <input
                        type="text"
                        value={vital.bloodSugar?.toString() || ""}
                        onChange={(e) => updateMutation.mutate({ id: vital.id, field: 'bloodSugar', value: e.target.value, residentId: vital.residentId })}
                        placeholder="--"
                        className={`w-12 ${inputBaseClass}`}
                      />
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs font-medium mb-1">呼吸</div>
                      <Select 
                        value={vital.respirationRate?.toString() || ""} 
                        onValueChange={(value) => updateMutation.mutate({ id: vital.id, field: 'respirationRate', value, residentId: vital.residentId })}
                      >
                        <SelectTrigger className={`w-12 ${selectTriggerClass}`}>
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          {respirationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1">
                      <div className="text-xs font-medium mb-1">記録</div>
                      <input
                        type="text"
                        value={vital.notes || ""}
                        onChange={(e) => updateMutation.mutate({ id: vital.id, field: 'notes', value: e.target.value, residentId: vital.residentId })}
                        placeholder="記録内容"
                        className={`w-full ${inputBaseClass} px-2`}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="bg-red-500 hover:bg-red-600 h-6 w-6 p-0"
                          data-testid={`button-delete-${vital.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
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
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-orange-50 p-4 flex justify-center">
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