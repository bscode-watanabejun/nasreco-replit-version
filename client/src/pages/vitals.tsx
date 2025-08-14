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
function InlineEditableField({
  value,
  onSave,
  type = "text",
  placeholder = "",
  options = [],
  disabled = false,
}: {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "select" | "number";
  placeholder?: string;
  options?: { value: string; label: string }[];
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
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (disabled || !isEditing) {
    return (
      <div
        className={`cursor-pointer hover:bg-slate-50 p-2 rounded border-2 border-transparent hover:border-slate-200 transition-colors ${disabled ? "cursor-not-allowed bg-slate-100" : ""}`}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {value || <span className="text-slate-400">{placeholder}</span>}
      </div>
    );
  }

  if (type === "select") {
    return (
      <Select
        value={currentValue}
        onValueChange={setCurrentValue}
        onOpenChange={(open) => !open && handleBlur()}
      >
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

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    setInputValue(selectedValue);
    onSave(selectedValue);
    setOpen(false);

    // 特定の遅延後にフォーカス移動を実行
    setTimeout(() => {
      if (inputRef.current) {
        const allInputs = Array.from(
          document.querySelectorAll("input, textarea, select, button"),
        ).filter(
          (el) =>
            el !== inputRef.current &&
            !el.hasAttribute("disabled") &&
            (el as HTMLElement).offsetParent !== null,
        ) as HTMLElement[];

        const currentElement = inputRef.current;
        const allElements = Array.from(
          document.querySelectorAll("input, textarea, select, button"),
        ).filter(
          (el) =>
            !el.hasAttribute("disabled") &&
            (el as HTMLElement).offsetParent !== null,
        ) as HTMLElement[];

        const currentIndex = allElements.indexOf(currentElement);
        if (currentIndex >= 0 && currentIndex < allElements.length - 1) {
          allElements[currentIndex + 1].focus();
        }
      }
    }, 200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (disabled) return;
    onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter") {
      onSave(inputValue);
      setOpen(false);
    } else if (e.key === "Escape") {
      setInputValue(value);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.preventDefault()}
          placeholder={placeholder}
          className={`${className} ${disabled ? 'cursor-not-allowed' : ''}`}
          disabled={disabled}
        />
      </PopoverTrigger>
      <PopoverContent className="w-32 p-0.5" align="center">
        <div className="space-y-0 max-h-40 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full text-left px-1.5 py-0 text-xs hover:bg-slate-100 leading-tight min-h-[1.2rem]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 全バイタル項目が未入力かどうかを判定する関数
function isAllVitalFieldsEmpty(vital: any) {
  return (
    !vital.temperature &&
    !vital.bloodPressureSystolic &&
    !vital.bloodPressureDiastolic &&
    !vital.pulseRate &&
    !vital.oxygenSaturation &&
    !vital.bloodSugar &&
    !vital.respirationRate &&
    !vital.notes
  );
}

// 利用者選択コンポーネント
function ResidentSelector({
  vital,
  residents,
  onResidentChange,
}: {
  vital: any;
  residents: any[];
  onResidentChange: (vitalId: string, residentId: string) => void;
}) {
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null);
  
  // pendingResidentIdがある場合はそれを使用、なければvital.residentIdを使用
  const effectiveResidentId = pendingResidentId || vital.residentId;
  const currentResident = residents.find((r: any) => r.id === effectiveResidentId);
  const isAllEmpty = isAllVitalFieldsEmpty(vital);
  
  // 利用者選択肢（valueとlabelを名前で統一）
  const residentOptions = residents.map((r: any) => ({
    value: r.name,
    label: r.name,
  }));

  const handleResidentChange = (residentId: string) => {
    // 即座にUIを更新するためにローカル状態を設定
    setPendingResidentId(residentId);
    
    // 実際の更新処理を呼び出し
    onResidentChange(vital.id, residentId);
  };

  // vital.residentIdが変更されたらローカル状態をクリア
  // ただし、pendingResidentIdが設定されている場合は、それが優先される
  useEffect(() => {
    if (pendingResidentId && vital.residentId === pendingResidentId) {
      // サーバーからの更新でresidentIdが正しく反映されたらローカル状態をクリア
      setPendingResidentId(null);
    }
  }, [vital.residentId, pendingResidentId]);

  // 全項目未入力でない場合は変更不可
  const disabled = !isAllEmpty;

  return (
    <div className="font-medium text-sm truncate w-20 sm:w-24">
      <InputWithDropdown
        value={currentResident?.name || ""}
        options={residentOptions}
        onSave={(selectedName) => {
          // 名前から利用者IDを取得
          const selectedResident = residents.find((r: any) => r.name === selectedName);
          if (selectedResident) {
            handleResidentChange(selectedResident.id);
          }
        }}
        placeholder="利用者選択"
        className="h-auto min-h-[1.5rem] border-0 bg-transparent p-0 text-sm font-medium focus:ring-0 text-left w-full"
        disabled={disabled}
      />
    </div>
  );
}

// バイタルカードコンポーネント
function VitalCard({
  vital,
  residents,
  selectedTiming,
  inputBaseClass,
  hourOptions,
  minuteOptions,
  temperatureOptions,
  systolicBPOptions,
  diastolicBPOptions,
  pulseOptions,
  spo2Options,
  respirationOptions,
  localNotes,
  setLocalNotes,
  localBloodSugar,
  setLocalBloodSugar,
  updateMutation,
  handleStaffStamp,
  deleteMutation,
  changeResidentMutation,
}: {
  vital: any;
  residents: any[];
  selectedTiming: string;
  inputBaseClass: string;
  hourOptions: any[];
  minuteOptions: any[];
  temperatureOptions: any[];
  systolicBPOptions: any[];
  diastolicBPOptions: any[];
  pulseOptions: any[];
  spo2Options: any[];
  respirationOptions: any[];
  localNotes: Record<string, string>;
  setLocalNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  localBloodSugar: Record<string, string>;
  setLocalBloodSugar: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateMutation: any;
  handleStaffStamp: (vitalId: string, residentId?: string) => void;
  deleteMutation: any;
  changeResidentMutation: any;
}) {
  const resident = residents.find((r: any) => r.id === vital.residentId);

  return (
    <Card key={`${vital.id}-${vital.residentId}`} className="bg-white shadow-sm">
      <CardContent className="p-3">
        {/* ヘッダー：居室番号、利用者名、時間、記入者 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <div className="text-lg font-bold text-blue-600 min-w-[50px]">
              {resident?.roomNumber || "未設定"}
            </div>
            <ResidentSelector
              vital={vital}
              residents={residents}
              onResidentChange={(vitalId, residentId) => 
                changeResidentMutation.mutate({ vitalId, newResidentId: residentId })
              }
            />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="bg-slate-100 px-1 py-1 rounded text-xs">
              {selectedTiming}
            </span>
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={vital.hour?.toString() || ""}
                options={hourOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: vital.id,
                    field: "hour",
                    value,
                    residentId: vital.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
              <span className="text-xs">:</span>
              <InputWithDropdown
                value={vital.minute?.toString() || ""}
                options={minuteOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: vital.id,
                    field: "minute",
                    value,
                    residentId: vital.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
            </div>
            <input
              type="text"
              value={vital.staffName || ""}
              onChange={(e) =>
                updateMutation.mutate({
                  id: vital.id,
                  field: "staffName",
                  value: e.target.value,
                  residentId: vital.residentId,
                })
              }
              placeholder="記入者"
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
                handleStaffStamp(vital.id, vital.residentId)
              }
              data-testid={`button-stamp-${vital.id}`}
            >
              <User className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* メインバイタル */}
        <div className="flex gap-1 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              体温
            </span>
            <InputWithDropdown
              value={
                vital.temperature
                  ? parseFloat(vital.temperature.toString()).toFixed(
                      1,
                    )
                  : ""
              }
              options={temperatureOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: vital.id,
                  field: "temperature",
                  value,
                  residentId: vital.residentId,
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
                value={vital.bloodPressureSystolic?.toString() || ""}
                options={systolicBPOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: vital.id,
                    field: "bloodPressureSystolic",
                    value,
                    residentId: vital.residentId,
                  })
                }
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
              />
              <span className="text-xs">/</span>
              <InputWithDropdown
                value={vital.bloodPressureDiastolic?.toString() || ""}
                options={diastolicBPOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: vital.id,
                    field: "bloodPressureDiastolic",
                    value,
                    residentId: vital.residentId,
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
              value={vital.pulseRate?.toString() || ""}
              options={pulseOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: vital.id,
                  field: "pulseRate",
                  value,
                  residentId: vital.residentId,
                })
              }
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              SpO2
            </span>
            <InputWithDropdown
              value={
                vital.oxygenSaturation
                  ? Math.round(
                      parseFloat(vital.oxygenSaturation.toString()),
                    ).toString()
                  : ""
              }
              options={spo2Options}
              onSave={(value) =>
                updateMutation.mutate({
                  id: vital.id,
                  field: "oxygenSaturation",
                  value,
                  residentId: vital.residentId,
                })
              }
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
            />
          </div>
        </div>

        {/* サブバイタルと記録 */}
        <div className="flex gap-1 mb-3 items-center">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              血糖
            </span>
            <input
              type="text"
              value={
                localBloodSugar[vital.id] !== undefined
                  ? localBloodSugar[vital.id]
                  : vital.bloodSugar?.toString() || ""
              }
              onChange={(e) => {
                setLocalBloodSugar((prev) => ({
                  ...prev,
                  [vital.id]: e.target.value,
                }));
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue !== (vital.bloodSugar?.toString() || "")) {
                  updateMutation.mutate({
                    id: vital.id,
                    field: "bloodSugar",
                    value: newValue,
                    residentId: vital.residentId,
                  });
                }
                // ローカル状態をクリア
                setLocalBloodSugar((prev) => {
                  const updated = { ...prev };
                  delete updated[vital.id];
                  return updated;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setLocalBloodSugar((prev) => {
                    const updated = { ...prev };
                    delete updated[vital.id];
                    return updated;
                  });
                  e.currentTarget.blur();
                }
              }}
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              呼吸
            </span>
            <InputWithDropdown
              value={vital.respirationRate?.toString() || ""}
              options={respirationOptions}
              onSave={(value) =>
                updateMutation.mutate({
                  id: vital.id,
                  field: "respirationRate",
                  value,
                  residentId: vital.residentId,
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
                localNotes[vital.id] !== undefined
                  ? localNotes[vital.id]
                  : vital.notes || ""
              }
              onChange={(e) => {
                setLocalNotes((prev) => ({
                  ...prev,
                  [vital.id]: e.target.value,
                }));
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue !== (vital.notes || "")) {
                  updateMutation.mutate({
                    id: vital.id,
                    field: "notes",
                    value: newValue,
                    residentId: vital.residentId,
                  });
                }
                // ローカル状態をクリア
                setLocalNotes((prev) => {
                  const updated = { ...prev };
                  delete updated[vital.id];
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
                  data-testid={`button-delete-${vital.id}`}
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
                    onClick={() => deleteMutation.mutate(vital.id)}
                  >
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
}

export default function Vitals() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [localBloodSugar, setLocalBloodSugar] = useState<Record<string, string>>({});

  // 共通スタイル定数
  const inputBaseClass =
    "h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectTriggerClass =
    "h-8 min-h-8 max-h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 leading-none py-0";

  // URLパラメータから日付と時間帯、フロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(
    urlParams.get("date") || format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedTiming, setSelectedTiming] = useState(
    urlParams.get("timing") || "午前",
  );
  const [selectedFloor, setSelectedFloor] = useState(() => {
    // URLパラメータから階数を取得
    const floorParam = urlParams.get("floor");
    if (floorParam) {
      // ダッシュボードから来た'all'を'全階'に変換
      if (floorParam === "all") {
        return "全階";
      }
      return floorParam;
    }

    // localStorageからトップ画面の選択階数を取得
    const savedFloor = localStorage.getItem("selectedFloor");
    if (savedFloor) {
      if (savedFloor === "all") {
        return "全階";
      } else {
        // "1F" -> "1" の変換を行う
        const cleanFloor = savedFloor.replace("F", "");
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

  // 記録更新用ミューテーション（楽観的更新対応）
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
      residentId,
    }: {
      id: string;
      field: string;
      value: string;
      residentId?: string;
    }) => {
      // 一時的なレコード（IDがtempで始まる）の場合は新規作成
      if (id.startsWith("temp-")) {
        const residentIdFromTemp = residentId || id.split("-")[1]; // temp-{residentId}-{date}-{timing}から抽出
        
        // residentIdの検証
        if (!residentIdFromTemp || residentIdFromTemp === 'undefined' || residentIdFromTemp === 'null') {
          throw new Error('利用者情報が正しく設定されていません。ページを再読み込みしてください。');
        }

        const newRecordData: any = {
          residentId: residentIdFromTemp,
          recordDate: new Date(selectedDate),
          timing: selectedTiming,
          [field]: value,
        };

        // データ型を適切に変換
        if (field === "recordDate") {
          newRecordData[field] = new Date(value);
        } else if (
          [
            "temperature",
            "bloodPressureSystolic",
            "bloodPressureDiastolic",
            "pulseRate",
            "respirationRate",
            "oxygenSaturation",
          ].includes(field)
        ) {
          if (value && value.trim() !== "") {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              newRecordData[field] = numValue;
            }
          }
          // 空の値の場合はフィールドを送信しない（削除）
        } else if (["hour", "minute"].includes(field)) {
          if (value && value.trim() !== "") {
            const intValue = parseInt(value);
            if (!isNaN(intValue)) {
              newRecordData[field] = intValue;
            }
          }
          // 空の値の場合はフィールドを送信しない（削除）
        } else {
          // その他のフィールド（bloodSugar, notes, staffName等）はそのまま設定
          newRecordData[field] = value;
        }

        await apiRequest("/api/vital-signs", "POST", newRecordData);
      } else {
        // 既存レコードの更新
        const updateData: any = { [field]: value };
        if (field === "recordDate") {
          updateData[field] = new Date(value);
        } else if (
          [
            "temperature",
            "bloodPressureSystolic",
            "bloodPressureDiastolic",
            "pulseRate",
            "respirationRate",
            "oxygenSaturation",
          ].includes(field)
        ) {
          if (value && value.trim() !== "") {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              updateData[field] = numValue;
            }
          } else {
            updateData[field] = null;
          }
        } else if (["hour", "minute"].includes(field)) {
          if (value && value.trim() !== "") {
            const intValue = parseInt(value);
            if (!isNaN(intValue)) {
              updateData[field] = intValue;
            }
          } else {
            updateData[field] = null;
          }
        }
        // その他のフィールド（bloodSugar, notes, staffName等）は最初の { [field]: value } でそのまま設定される

        await apiRequest(`/api/vital-signs/${id}`, "PATCH", updateData);
      }
    },
    // 楽観的更新の実装
    onMutate: async ({ id, field, value, residentId }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/vital-signs"] });
      
      // 現在のデータのスナップショットを取得
      const previousVitalSigns = queryClient.getQueryData(["/api/vital-signs"]);
      
      // 楽観的に更新
      queryClient.setQueryData(["/api/vital-signs"], (old: any) => {
        if (!old) return old;
        
        if (id.startsWith("temp-")) {
          // 新規作成の場合：一時的なレコードを更新
          return old.map((vital: any) => {
            if (vital.id === id) {
              return { ...vital, [field]: value };
            }
            return vital;
          });
        } else {
          // 既存レコード更新の場合
          return old.map((vital: any) => {
            if (vital.id === id) {
              return { ...vital, [field]: value };
            }
            return vital;
          });
        }
      });
      
      // ロールバック用のコンテキストを返す
      return { previousVitalSigns };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousVitalSigns) {
        queryClient.setQueryData(["/api/vital-signs"], context.previousVitalSigns);
      }
      
      console.error('Update error:', error);
      toast({
        title: "エラー",
        description: error.message || "バイタルサインの更新に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
    },
    onSuccess: (data, variables) => {
      // 新規作成の場合のみinvalidateを実行（一時的IDを実際のIDに置き換えるため）
      if (variables.id.startsWith("temp-")) {
        queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      }
      // 既存レコード更新の場合は楽観的更新のみで完了（invalidateしない）
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
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast({
        title: "エラー",
        description: error.message || "記録の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 利用者変更用ミューテーション
  const changeResidentMutation = useMutation({
    mutationFn: async ({ vitalId, newResidentId }: { vitalId: string; newResidentId: string }) => {
      await apiRequest(`/api/vital-signs/${vitalId}`, "PATCH", {
        residentId: newResidentId
      });
    },
    // 楽観的更新で即座にUIを更新
    onMutate: async ({ vitalId, newResidentId }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/vital-signs"] });
      
      // 現在のデータのスナップショットを取得
      const previousVitalSigns = queryClient.getQueryData(["/api/vital-signs"]);
      
      // 楽観的に更新（利用者変更）
      queryClient.setQueryData(["/api/vital-signs"], (old: any) => {
        if (!old) return old;
        
        return old.map((vital: any) => {
          if (vital.id === vitalId) {
            return { ...vital, residentId: newResidentId };
          }
          return vital;
        });
      });
      
      // ロールバック用のコンテキストを返す
      return { previousVitalSigns };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousVitalSigns) {
        queryClient.setQueryData(["/api/vital-signs"], context.previousVitalSigns);
      }
      
      console.error('Change resident error:', error);
      toast({
        title: "エラー",
        description: error.message || "利用者の変更に失敗しました",
        variant: "destructive",
      });
      
      // エラー時もサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
    },
    onSuccess: () => {
      // 成功時はサーバーから最新データを取得して確実に同期
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      toast({
        title: "成功",
        description: "利用者を変更しました",
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

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, "0"),
  }));
  const minuteOptions = [
    { value: "0", label: "00" },
    { value: "15", label: "15" },
    { value: "30", label: "30" },
    { value: "45", label: "45" },
  ];

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
    const staffName =
      user?.firstName && user?.lastName
        ? `${user.lastName} ${user.firstName}`
        : user?.email || "スタッフ";

    // 現在のバイタル記録を取得
    const vital = filteredVitalSigns.find((v: any) => v.id === vitalId);
    if (!vital) return;

    const currentHour = vital.hour?.toString() || "";
    const currentMinute = vital.minute?.toString() || "";
    const currentStaffName = vital.staffName || "";
    
    // 現在時刻を取得
    const now = new Date();
    const currentHourStr = now.getHours().toString();
    const currentMinuteStr = Math.floor(now.getMinutes() / 15) * 15 === now.getMinutes() 
      ? now.getMinutes().toString() 
      : (Math.floor(now.getMinutes() / 15) * 15).toString();

    let updateData: any = {};

    // 時分、承認者名の両方が空白の場合
    if (!currentHour && !currentMinute && !currentStaffName) {
      updateData = {
        hour: currentHourStr,
        minute: currentMinuteStr,
        staffName: staffName
      };
    }
    // 時分が空白で承認者名が入っている場合
    else if (!currentHour && !currentMinute && currentStaffName) {
      updateData = {
        staffName: ""
      };
    }
    // 時分が入っていて、承認者名が空白の場合
    else if ((currentHour || currentMinute) && !currentStaffName) {
      updateData = {
        hour: currentHourStr,
        minute: currentMinuteStr,
        staffName: staffName
      };
    }
    // 時分と承認者名の両方が入っている場合
    else if ((currentHour || currentMinute) && currentStaffName) {
      updateData = {
        hour: "",
        minute: "",
        staffName: ""
      };
    }

    // 複数フィールドを同時に更新
    for (const [field, value] of Object.entries(updateData)) {
      updateMutation.mutate({
        id: vitalId,
        field,
        value: value as string,
        residentId,
      });
    }
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
      const resident = filteredResidents.find(
        (r: any) => r.id === vital.residentId,
      );
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
        const hasRecord = existingVitals.some(
          (vital: any) => vital.residentId === resident.id,
        );
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
            isTemporary: true,
          });
        }
      });

      const uniqueVitals = vitalsWithEmpty.reduce(
        (acc: any[], current: any) => {
          const existing = acc.find(
            (item) => item.residentId === current.residentId,
          );
          if (!existing) {
            acc.push(current);
          } else {
            if (existing.isTemporary && !current.isTemporary) {
              const index = acc.findIndex(
                (item) => item.residentId === current.residentId,
              );
              acc[index] = current;
            }
          }
          return acc;
        },
        [],
      );

      return uniqueVitals;
    }

    return existingVitals;
  };

  const filteredVitalSigns = getFilteredVitalSigns().sort((a: any, b: any) => {
    const residentA = (residents as any[]).find(
      (r: any) => r.id === a.residentId,
    );
    const residentB = (residents as any[]).find(
      (r: any) => r.id === b.residentId,
    );
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
            <InputWithDropdown
              value={selectedTiming}
              options={timingOptions}
              onSave={(value) => setSelectedTiming(value)}
              placeholder="時間"
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedFloor}
              options={floorOptions}
              onSave={(value) => setSelectedFloor(value)}
              placeholder="フロア選択"
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
          filteredVitalSigns.map((vital: any) => (
            <VitalCard
              key={`${vital.id}-${vital.residentId}`}
              vital={vital}
              residents={residents as any[]}
              selectedTiming={selectedTiming}
              inputBaseClass={inputBaseClass}
              hourOptions={hourOptions}
              minuteOptions={minuteOptions}
              temperatureOptions={temperatureOptions}
              systolicBPOptions={systolicBPOptions}
              diastolicBPOptions={diastolicBPOptions}
              pulseOptions={pulseOptions}
              spo2Options={spo2Options}
              respirationOptions={respirationOptions}
              localNotes={localNotes}
              setLocalNotes={setLocalNotes}
              localBloodSugar={localBloodSugar}
              setLocalBloodSugar={setLocalBloodSugar}
              updateMutation={updateMutation}
              handleStaffStamp={handleStaffStamp}
              deleteMutation={deleteMutation}
              changeResidentMutation={changeResidentMutation}
            />
          ))
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
