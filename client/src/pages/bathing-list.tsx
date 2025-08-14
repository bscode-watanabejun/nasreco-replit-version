import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Calendar,
  Building,
  User,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// インライン編集用のコンポーネント
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder = "",
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    if (localValue !== value) {
      onSave(localValue);
    }
    setIsOpen(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setLocalValue(value);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          data-testid={`input-dropdown-${placeholder.toLowerCase()}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0" align="start">
        <div className="max-h-60 overflow-auto">
          {options.map((option, index) => (
            <button
              key={index}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 transition-colors border-0 bg-transparent"
              onClick={() => {
                setLocalValue(option.value);
                onSave(option.value);
                setIsOpen(false);
              }}
              data-testid={`option-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 全入浴項目が未入力かどうかを判定する関数
function isAllBathingFieldsEmpty(record: any) {
  return (
    !record.bathType &&
    !record.weight &&
    !record.bloodPressureSystolic &&
    !record.bloodPressureDiastolic &&
    !record.pulseRate &&
    !record.oxygenSaturation &&
    !record.notes
  );
}

// 利用者選択コンポーネント
function ResidentSelector({
  record,
  residents,
  onResidentChange,
}: {
  record: any;
  residents: any[];
  onResidentChange: (recordId: string, residentId: string) => void;
}) {
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null);
  
  // pendingResidentIdがある場合はそれを使用、なければrecord.residentIdを使用
  const effectiveResidentId = pendingResidentId || record.residentId;
  const currentResident = residents.find((r: any) => r.id === effectiveResidentId);
  const isAllEmpty = isAllBathingFieldsEmpty(record);
  
  // 利用者選択肢（valueとlabelを名前で統一）
  const residentOptions = residents.map((r: any) => ({
    value: r.name,
    label: r.name,
  }));

  const handleResidentChange = (residentId: string) => {
    // 即座にUIを更新するためにローカル状態を設定
    setPendingResidentId(residentId);
    
    // 実際の更新処理を呼び出し
    onResidentChange(record.id, residentId);
  };

  // record.residentIdが変更されたらローカル状態をクリア
  useEffect(() => {
    if (pendingResidentId && record.residentId === pendingResidentId) {
      // サーバーからの更新でresidentIdが正しく反映されたらローカル状態をクリア
      setPendingResidentId(null);
    }
  }, [record.residentId, pendingResidentId]);

  // record.residentIdが外部から変更された場合、ローカル状態をリセット
  useEffect(() => {
    setPendingResidentId(null);
  }, [record.id, record.residentId]);

  // 全項目未入力でない場合は変更不可
  const disabled = !isAllEmpty;

  return (
    <div className="font-medium text-sm truncate w-20 sm:w-24">
      {disabled ? (
        <span className="text-slate-800">
          {currentResident?.name || "未選択"}
        </span>
      ) : (
        <Select
          value={currentResident?.name || ""}
          onValueChange={(selectedName) => {
            const selectedResident = residents.find((r: any) => r.name === selectedName);
            if (selectedResident) {
              handleResidentChange(selectedResident.id);
            }
          }}
          data-testid={`select-resident-${record.id}`}
        >
          <SelectTrigger className="w-full h-7 text-xs border-0 bg-transparent p-0 focus:ring-0">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            {residentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// 入浴カードコンポーネント
function BathingCard({
  record,
  residents,
  selectedTiming,
  inputBaseClass,
  hourOptions,
  minuteOptions,
  bathTypeOptions,
  weightOptions,
  systolicBPOptions,
  diastolicBPOptions,
  pulseOptions,
  spo2Options,
  localNotes,
  setLocalNotes,
  updateMutation,
  handleStaffStamp,
  deleteMutation,
  changeResidentMutation,
}: {
  record: any;
  residents: any[];
  selectedTiming: string;
  inputBaseClass: string;
  hourOptions: any[];
  minuteOptions: any[];
  bathTypeOptions: any[];
  weightOptions: any[];
  systolicBPOptions: any[];
  diastolicBPOptions: any[];
  pulseOptions: any[];
  spo2Options: any[];
  localNotes: Record<string, string>;
  setLocalNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateMutation: any;
  handleStaffStamp: (recordId: string, residentId?: string) => void;
  deleteMutation: any;
  changeResidentMutation: any;
}) {
  const resident = residents.find((r: any) => r.id === record.residentId);

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-3">
        {/* ヘッダー：居室番号、利用者名、時間、記入者 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <div className="text-lg font-bold text-blue-600 min-w-[50px]">
              {resident?.roomNumber || "未設定"}
            </div>
            <ResidentSelector
              record={record}
              residents={residents}
              onResidentChange={(recordId, residentId) => 
                changeResidentMutation.mutate({ recordId, newResidentId: residentId })
              }
            />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="bg-slate-100 px-1 py-1 rounded text-xs">
              {selectedTiming}
            </span>
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={record.hour?.toString() || ""}
                options={hourOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: record.id,
                    field: "hour",
                    value,
                    residentId: record.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
              <span className="text-xs">:</span>
              <InputWithDropdown
                value={record.minute?.toString() || ""}
                options={minuteOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: record.id,
                    field: "minute",
                    value,
                    residentId: record.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
            </div>
            <input
              type="text"
              value={record.staffName || ""}
              onChange={(e) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "staffName",
                  value: e.target.value,
                  residentId: record.residentId,
                })
              }
              placeholder="承認者"
              className={`w-12 ${inputBaseClass} px-1`}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center justify-center"
              style={{
                height: "32px",
                width: "32px",
                minHeight: "32px",
                minWidth: "32px",
                maxHeight: "32px",
                maxWidth: "32px",
              }}
              onClick={() =>
                handleStaffStamp(record.id, record.residentId)
              }
              data-testid={`button-stamp-${record.id}`}
            >
              <User className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* メイン入浴項目 */}
        <div className="flex gap-1 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              区分
            </span>
            <InputWithDropdown
              value={record.bathType || ""}
              options={bathTypeOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "bathType",
                  value,
                  residentId: record.residentId,
                })
              }
              placeholder="--"
              className={`w-16 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              体重
            </span>
            <InputWithDropdown
              value={
                record.weight
                  ? parseFloat(record.weight.toString()).toFixed(1)
                  : ""
              }
              options={weightOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "weight",
                  value,
                  residentId: record.residentId,
                })
              }
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              血圧
            </span>
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={record.bloodPressureSystolic?.toString() || ""}
                options={systolicBPOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: record.id,
                    field: "bloodPressureSystolic",
                    value,
                    residentId: record.residentId,
                  })
                }
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
              />
              <span className="text-xs">/</span>
              <InputWithDropdown
                value={record.bloodPressureDiastolic?.toString() || ""}
                options={diastolicBPOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: record.id,
                    field: "bloodPressureDiastolic",
                    value,
                    residentId: record.residentId,
                  })
                }
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              脈拍
            </span>
            <InputWithDropdown
              value={record.pulseRate?.toString() || ""}
              options={pulseOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "pulseRate",
                  value,
                  residentId: record.residentId,
                })
              }
              placeholder="--"
              className={`w-8 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              SpO2
            </span>
            <InputWithDropdown
              value={record.oxygenSaturation?.toString() || ""}
              options={spo2Options}
              onSave={(value) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "oxygenSaturation",
                  value,
                  residentId: record.residentId,
                })
              }
              placeholder="--"
              className={`w-8 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs font-medium text-blue-600">
              記録
            </span>
            <textarea
              value={
                localNotes[record.id] !== undefined
                  ? localNotes[record.id]
                  : record.notes || ""
              }
              onChange={(e) => {
                setLocalNotes((prev) => ({
                  ...prev,
                  [record.id]: e.target.value,
                }));
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue !== (record.notes || "")) {
                  updateMutation.mutate({
                    id: record.id,
                    field: "notes",
                    value: newValue,
                    residentId: record.residentId,
                  });
                }
                // ローカル状態をクリア
                setLocalNotes((prev) => {
                  const updated = { ...prev };
                  delete updated[record.id];
                  return updated;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              placeholder="記録内容"
              className={`w-24 ${inputBaseClass} px-2 resize-none`}
              rows={1}
              style={{ minHeight: "32px", maxHeight: "64px" }}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              差し戻し
            </span>
            <input
              type="text"
              value={record.rejectionReason || ""}
              disabled
              placeholder="--"
              className={`w-16 ${inputBaseClass} px-1 bg-gray-100 cursor-not-allowed`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              看護
            </span>
            <input
              type="checkbox"
              checked={record.nursingCheck || false}
              disabled
              className="cursor-not-allowed"
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="bg-red-500 hover:bg-red-600 text-white ml-1 rounded text-xs flex items-center justify-center"
                style={{
                  height: "32px",
                  width: "32px",
                  minHeight: "32px",
                  minWidth: "32px",
                  maxHeight: "32px",
                  maxWidth: "32px",
                }}
                data-testid={`button-delete-${record.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
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
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(record.id)}
                >
                  削除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BathingList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedFloor, setSelectedFloor] = useState<string>("全階");
  const [selectedTiming, setSelectedTiming] = useState<string>("午前");
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // 利用者データの取得
  const { data: residents } = useQuery({
    queryKey: ["/api/residents"],
  });

  // 入浴記録データの取得
  const { data: bathingRecords, isLoading } = useQuery({
    queryKey: ["/api/bathing-records", selectedDate],
    queryFn: async () => {
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
      const response = await fetch(
        `/api/bathing-records?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch bathing records');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // 入浴記録の作成
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/bathing-records", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      toast({
        title: "入浴記録を作成しました",
        description: "新しい入浴記録が追加されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "入浴記録の作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // 入浴記録の更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value, residentId }: any) => {
      const updateData = { [field]: value };
      if (residentId) {
        updateData.residentId = residentId;
      }
      return apiRequest(`/api/bathing-records/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
    onError: (error) => {
      console.error("Update error:", error);
    },
  });

  // 入浴記録の削除
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bathing-records/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      toast({
        title: "入浴記録を削除しました",
        description: "記録が正常に削除されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "入浴記録の削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // 利用者変更
  const changeResidentMutation = useMutation({
    mutationFn: ({ recordId, newResidentId }: { recordId: string; newResidentId: string }) =>
      apiRequest(`/api/bathing-records/${recordId}`, "PATCH", { residentId: newResidentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      toast({
        title: "利用者を変更しました",
        description: "入浴記録の利用者が更新されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "利用者の変更に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // スタッフスタンプ機能
  const handleStaffStamp = (recordId: string, residentId?: string) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const staffName = currentUser.firstName && currentUser.lastName 
      ? `${currentUser.lastName} ${currentUser.firstName}`
      : currentUser.email?.split('@')[0] || 'スタッフ';

    updateMutation.mutate({
      id: recordId,
      field: "staffName",
      value: staffName,
      residentId,
    });
  };

  // 新しい入浴記録の追加
  const handleAddRecord = () => {
    const newRecord = {
      residentId: "temp-new-" + Date.now(),
      recordDate: new Date(selectedDate).toISOString(),
      timing: selectedTiming,
      hour: null,
      minute: null,
      staffName: "",
      bathType: "",
      weight: null,
      bloodPressureSystolic: null,
      bloodPressureDiastolic: null,
      pulseRate: null,
      oxygenSaturation: null,
      notes: "",
      rejectionReason: "",
      nursingCheck: false,
    };

    createMutation.mutate(newRecord);
  };

  // フィルタリング
  const filteredBathingRecords = (Array.isArray(bathingRecords) ? bathingRecords : [])?.filter((record: any) => {
    const resident = residents?.find((r: any) => r.id === record.residentId);
    
    if (selectedFloor !== "全階" && resident?.floor !== selectedFloor) {
      return false;
    }
    
    if (selectedTiming !== "全て" && record.timing !== selectedTiming) {
      return false;
    }
    
    return true;
  }) || [];

  // 共通のスタイル
  const inputBaseClass = "text-center border rounded px-1 py-1 text-xs h-8 transition-colors focus:border-blue-500 focus:outline-none";

  // ドロップダウンオプション
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, "0"),
  }));

  const minuteOptions = [0, 15, 30, 45].map((m) => ({
    value: m.toString(),
    label: m.toString().padStart(2, "0"),
  }));

  const bathTypeOptions = [
    { value: "入浴", label: "入浴" },
    { value: "シャワー浴", label: "シャワー浴" },
    { value: "清拭", label: "清拭" },
    { value: "×", label: "×" },
    { value: "", label: "空白" },
  ];

  const weightOptions = Array.from({ length: 61 }, (_, i) => {
    const weight = 30 + i * 0.5;
    return {
      value: weight.toString(),
      label: `${weight.toFixed(1)}kg`,
    };
  });

  const systolicBPOptions = Array.from({ length: 101 }, (_, i) => ({
    value: (80 + i).toString(),
    label: (80 + i).toString(),
  }));

  const diastolicBPOptions = Array.from({ length: 81 }, (_, i) => ({
    value: (40 + i).toString(),
    label: (40 + i).toString(),
  }));

  const pulseOptions = Array.from({ length: 121 }, (_, i) => ({
    value: (40 + i).toString(),
    label: (40 + i).toString(),
  }));

  const spo2Options = Array.from({ length: 21 }, (_, i) => ({
    value: (80 + i).toString(),
    label: (80 + i).toString(),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-slate-600 hover:text-slate-800"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
            <h1 className="text-xl font-bold text-slate-800">入浴一覧</h1>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-4 px-4 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
              data-testid="input-date"
            />
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-600" />
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-24" data-testid="select-floor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全階">全階</SelectItem>
                <SelectItem value="1階">1階</SelectItem>
                <SelectItem value="2階">2階</SelectItem>
                <SelectItem value="3階">3階</SelectItem>
                <SelectItem value="4階">4階</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">時間帯:</span>
            <Select value={selectedTiming} onValueChange={setSelectedTiming}>
              <SelectTrigger className="w-20" data-testid="select-timing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全て">全て</SelectItem>
                <SelectItem value="午前">午前</SelectItem>
                <SelectItem value="午後">午後</SelectItem>
                <SelectItem value="臨時">臨時</SelectItem>
                <SelectItem value="前日">前日</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-slate-600">
              <p>読み込み中...</p>
            </div>
          ) : filteredBathingRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の記録がありません</p>
            </div>
          ) : (
            filteredBathingRecords.map((record: any) => (
              <BathingCard
                key={record.id}
                record={record}
                residents={residents as any[]}
                selectedTiming={selectedTiming}
                inputBaseClass={inputBaseClass}
                hourOptions={hourOptions}
                minuteOptions={minuteOptions}
                bathTypeOptions={bathTypeOptions}
                weightOptions={weightOptions}
                systolicBPOptions={systolicBPOptions}
                diastolicBPOptions={diastolicBPOptions}
                pulseOptions={pulseOptions}
                spo2Options={spo2Options}
                localNotes={localNotes}
                setLocalNotes={setLocalNotes}
                updateMutation={updateMutation}
                handleStaffStamp={handleStaffStamp}
                deleteMutation={deleteMutation}
                changeResidentMutation={changeResidentMutation}
              />
            ))
          )}
        </div>
      </main>

      {/* フッター：追加ボタン */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={handleAddRecord}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 shadow-lg"
          data-testid="button-add-record"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}