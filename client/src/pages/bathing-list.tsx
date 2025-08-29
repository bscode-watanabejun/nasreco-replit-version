// Last updated: 2025-08-28 05:14
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

// 記録内容用のIME対応textareaコンポーネント（食事一覧と同じ）
function NotesInput({
  residentId,
  initialValue,
  onSave,
}: {
  residentId: string;
  initialValue: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    // カーソルアウト時に保存
    onSave(value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    setValue(e.currentTarget.value);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder="記録内容"
      className="flex-1 min-w-0 border rounded px-2 py-1 text-xs resize-none text-left align-top transition-colors focus:border-blue-500 focus:outline-none"
      rows={1}
      style={{ minHeight: "32px", maxHeight: "64px", overflow: "auto" }}
    />
  );
}

// インライン編集用のコンポーネント（処置一覧と同じ実装）
function InputWithDropdown({
  id,
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  enableAutoFocus = true,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  enableAutoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [lastSavedValue, setLastSavedValue] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);


  useEffect(() => {
    const checkFocus = () => {
      if (inputRef.current) {
        setIsFocused(document.activeElement === inputRef.current);
      }
    };
    document.addEventListener('focusin', checkFocus);
    document.addEventListener('focusout', checkFocus);
    return () => {
      document.removeEventListener('focusin', checkFocus);
      document.removeEventListener('focusout', checkFocus);
    };
  }, []);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    
    // 重複防止：同じ値を連続して保存しない
    if (selectedValue === lastSavedValue) {
      setOpen(false);
      return;
    }
    
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    setLastSavedValue(selectedValue);
    onSave(selectedValue);
    setOpen(false);

    if (enableAutoFocus) {
      setTimeout(() => {
        if (inputRef.current) {
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
    }
  };

  return (
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => !disabled && setOpen(true)}
            onClick={(e) => {
              if (disabled) return;
              e.preventDefault();
            }}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
            data-component="input-with-dropdown"
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
    </div>
  );
}

// 全入浴項目が未入力かどうかを判定する関数
function isAllBathingFieldsEmpty(record: any) {
  return (
    !record.bathType &&
    !record.temperature &&
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
  
  // 全項目未入力でない、かつ、一時的レコードでない場合は変更不可
  const disabled = !isAllEmpty && !record.id.startsWith('temp-');

  return (
    <div className="font-medium text-xs sm:text-sm truncate w-16 sm:w-24 flex-shrink-0">
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
  currentUser,
  inputBaseClass,
  hourOptions,
  minuteOptions,
  bathTypeOptions,
  temperatureOptions,
  systolicBPOptions,
  diastolicBPOptions,
  pulseOptions,
  spo2Options,
  
  handleFieldUpdate,
  handleSaveRecord,
  handleStaffStamp,
  deleteMutation,
}: {
  record: any;
  residents: any[];
  currentUser: any;
  inputBaseClass: string;
  hourOptions: any[];
  minuteOptions: any[];
  bathTypeOptions: any[];
  temperatureOptions: any[];
  systolicBPOptions: any[];
  diastolicBPOptions: any[];
  pulseOptions: any[];
  spo2Options: any[];
  
  handleFieldUpdate: (residentId: string, field: string, value: any) => void;
  handleSaveRecord: (residentId: string, field: string, value: any) => void;
  handleStaffStamp: (recordId: string, residentId?: string) => void;
  deleteMutation: any;
  changeResidentMutation: any;
}) {
  const resident = residents.find((r: any) => r.id === record.residentId);
  const [staffName, setStaffName] = useState(record.staffName || "");
  const [notes, setNotes] = useState(record.notes || "");

  useEffect(() => {
    setStaffName(record.staffName || "");
  }, [record.staffName]);

  useEffect(() => {
    setNotes(record.notes || "");
  }, [record.notes]);

  const handleStaffNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStaffName(e.target.value);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };

  const handleBlur = (field: string, value: any) => {
    if (value !== record[field]) {
      handleFieldUpdate(record.residentId, field, value);
      if (value && value.toString().trim() !== "") {
        handleSaveRecord(record.residentId, field, value);
      }
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-3">
        {/* 上段：居室番号、利用者名、時間、区分、承認者、承認アイコン */}
        <div className="flex items-center mb-3">
          {/* 左側：居室番号、利用者名 */}
          <div className="flex items-center gap-0.5 flex-1">
            {/* 居室番号 */}
            <div className="text-sm sm:text-lg font-bold text-blue-600 min-w-[35px] sm:min-w-[50px] flex-shrink-0">
              {resident?.roomNumber || "未設定"}
            </div>
            
            {/* 利用者名 */}
            <ResidentSelector
              record={record}
              residents={residents}
              onResidentChange={(recordId, residentId) => {
                handleFieldUpdate(residentId, "residentId", residentId);
                handleSaveRecord(residentId, "residentId", residentId);
              }}
            />
          </div>
          
          {/* 右側：時間、区分、承認者、承認アイコン */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* 時間 */}
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={record.hour?.toString() || ""}
                options={hourOptions}
                onSave={(value) => {
                  console.log("🎯 Hour onSave called with:", value);
                  handleFieldUpdate(record.residentId, "hour", value);
                  if (value && value !== "" && value !== "empty") {
                    handleSaveRecord(record.residentId, "hour", value);
                  }
                }}
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
              <span className="text-xs">:</span>
              <InputWithDropdown
                value={record.minute?.toString() || ""}
                options={minuteOptions}
                onSave={(value) => {
                  handleFieldUpdate(record.residentId, "minute", value);
                  if (value && value !== "" && value !== "empty") {
                    handleSaveRecord(record.residentId, "minute", value);
                  }
                }}
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
              />
            </div>
            
            {/* 区分 */}
            <InputWithDropdown
              value={record.bathType || ""}
              options={bathTypeOptions}
              onSave={(value) => {
                handleFieldUpdate(record.residentId, "bathType", value);
                if (value && value !== "" && value !== "empty") {
                  handleSaveRecord(record.residentId, "bathType", value);
                }
              }}
              placeholder="--"
              className={`w-16 ${inputBaseClass}`}
            />
            
            {/* 承認者 */}
            <input
              type="text"
              value={staffName}
              onChange={(e) => {
                setStaffName(e.target.value);
                handleFieldUpdate(record.residentId, "staffName", e.target.value);
              }}
              onBlur={(e) => {
                const value = e.target.value;
                if (value && value.trim()) {
                  handleSaveRecord(record.residentId, "staffName", value);
                }
              }}
              onClick={(e) => {
                const currentValue = e.currentTarget.value;
                if (!currentValue.trim()) {
                  const user = currentUser as any;
                  const newStaffName = user?.firstName || 'スタッフ';
                  setStaffName(newStaffName);
                  handleFieldUpdate(record.residentId, "staffName", newStaffName);
                }
              }}
              placeholder=""
              className={`w-12 ${inputBaseClass} px-1`}
              disabled={!record.residentId}
            />
            
            {/* 承認アイコン */}
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
              onClick={() => handleStaffStamp(record.id, record.residentId)}
              data-testid={`button-stamp-${record.id}`}
            >
              <User className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 中段：体温、血圧、脈拍、SpO2 */}
        <div className="flex items-center gap-1 mb-3">
          {/* 体温 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">体温</span>
            <InputWithDropdown
              value={
                record.temperature
                  ? parseFloat(record.temperature.toString()).toFixed(1)
                  : ""
              }
              options={temperatureOptions}
              onSave={(value) => {
                handleFieldUpdate(record.residentId, "temperature", value);
                if (value && value !== "" && value !== "empty") {
                  handleSaveRecord(record.residentId, "temperature", value);
                }
              }}
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
            />
          </div>

          {/* 血圧 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">血圧</span>
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={record.bloodPressureSystolic?.toString() || ""}
                options={systolicBPOptions}
                onSave={(value) => {
                  handleFieldUpdate(record.residentId, "bloodPressureSystolic", value);
                  if (value && value !== "" && value !== "empty") {
                    handleSaveRecord(record.residentId, "bloodPressureSystolic", value);
                  }
                }}
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
              />
              <span className="text-xs">/</span>
              <InputWithDropdown
                value={record.bloodPressureDiastolic?.toString() || ""}
                options={diastolicBPOptions}
                onSave={(value) => {
                  handleFieldUpdate(record.residentId, "bloodPressureDiastolic", value);
                  if (value && value !== "" && value !== "empty") {
                    handleSaveRecord(record.residentId, "bloodPressureDiastolic", value);
                  }
                }}
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
              />
            </div>
          </div>

          {/* 脈拍 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">脈拍</span>
            <InputWithDropdown
              value={record.pulseRate?.toString() || ""}
              options={pulseOptions}
              onSave={(value) => {
                handleFieldUpdate(record.residentId, "pulseRate", value);
                if (value && value !== "" && value !== "empty") {
                  handleSaveRecord(record.residentId, "pulseRate", value);
                }
              }}
              placeholder="--"
              className={`w-8 ${inputBaseClass}`}
            />
          </div>

          {/* SpO2 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">SpO2</span>
            <InputWithDropdown
              value={record.oxygenSaturation?.toString() || ""}
              options={spo2Options}
              onSave={(value) => {
                handleFieldUpdate(record.residentId, "oxygenSaturation", value);
                if (value && value !== "" && value !== "empty") {
                  handleSaveRecord(record.residentId, "oxygenSaturation", value);
                }
              }}
              placeholder="--"
              className={`w-8 ${inputBaseClass}`}
            />
          </div>
        </div>

        {/* 下段：記録、差し戻し、看護チェックボックス、削除アイコン */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* 記録 */}
          <div className="flex items-center flex-1">
            <NotesInput
              residentId={record.residentId}
              initialValue={notes}
              onSave={(value) => {
                handleFieldUpdate(record.residentId, "notes", value);
                if (value && value.trim()) {
                  handleSaveRecord(record.residentId, "notes", value);
                }
              }}
            />
          </div>

          {/* 差し戻し */}
          <div className="flex items-center">
            <input
              type="text"
              value={record.rejectionReason || ""}
              disabled
              placeholder="--"
              className={`w-12 sm:w-16 ${inputBaseClass} px-1 bg-gray-100 cursor-not-allowed flex-shrink-0 ${
                record.rejectionReason ? 'text-red-600 font-bold' : ''
              } text-center`}
            />
          </div>

          {/* 看護チェックボックス */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={record.nursingCheck || false}
              disabled
              className="cursor-not-allowed w-3 h-3 sm:w-4 sm:h-4"
            />
            <span className="text-xs font-medium text-blue-600">看</span>
          </div>

          {/* 削除アイコン */}
          <div className="flex items-center">
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
        </div>
      </CardContent>
    </Card>
  );
}

export default function BathingList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // URLパラメータから日付と階数の初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState<string>(
    urlParams.get("date") || format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedFloor, setSelectedFloor] = useState(() => {
    // URLパラメータから階数を取得
    const floorParam = urlParams.get("floor");
    if (floorParam) {
      // ダッシュボードから来た'all'を'全階'に変換
      if (floorParam === "all") {
        return "全階";
      }
      return `${floorParam}階`;
    }

    // localStorageからトップ画面の選択階数を取得
    const savedFloor = localStorage.getItem("selectedFloor");
    if (savedFloor) {
      if (savedFloor === "all") {
        return "全階";
      } else {
        // "1F" -> "1階" の変換を行う
        const cleanFloor = savedFloor.replace("F", "階");
        return cleanFloor;
      }
    }
    return "全階";
  });
  
  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});
  
  // デバウンス用タイマー
  const invalidateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // デバウンス付きキャッシュ無効化関数
  const debouncedInvalidateQueries = useCallback(() => {
    if (invalidateTimerRef.current) {
      clearTimeout(invalidateTimerRef.current);
    }
    
    invalidateTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    }, 200); // 200ms後に実行
  }, []);
  

  // ページロード時に入浴記録を強制的に再取得
  useEffect(() => {
    console.log("=== ページロード時の強制再取得 ===");
    // キャッシュを完全にクリアしてから再取得
    queryClient.removeQueries({ queryKey: ["/api/bathing-records"] });
    // すぐに再取得を開始
    queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
  }, []); // 空の依存配列でページロード時のみ実行


  // 利用者データの取得
  const { data: residents, isLoading: residentsLoading } = useQuery({
    queryKey: ["/api/residents"],
    queryFn: async () => {
      try {
        const data = await apiRequest("/api/residents");
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch residents:", error);
        return [];
      }
    },
    staleTime: 30000, // 30秒間はキャッシュを利用
  });

  // 現在のユーザー情報を取得
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // 入浴記録データの取得
  const bathingRecordsQuery = useQuery({
    queryKey: ["/api/bathing-records"],
    queryFn: async () => {
      try {
        console.log("=== 入浴記録APIを呼び出し中 ===");
        
        // 直接fetchを使用してデフォルトクエリ関数をバイパス
        const response = await fetch("/api/bathing-records", {
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        });
        
        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("入浴記録API結果:", data);
        console.log("API結果の型:", typeof data);
        console.log("API結果がnull:", data === null);
        console.log("API結果がfalse:", data === false);
        console.log("API結果が配列:", Array.isArray(data));
        
        if (Array.isArray(data)) {
          return data;
        } else if (data === null || data === undefined) {
          console.log("データがnull/undefinedなので空配列を返す");
          return [];
        } else {
          console.log("予期しないデータ型:", data, "空配列を返す");
          return [];
        }
      } catch (error) {
        console.error("Failed to fetch bathing records:", error);
        return [];
      }
    },
    staleTime: 0, // 常に最新データを取得
    retry: 2, // リトライ回数を制限
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
    refetchOnMount: true, // マウント時に再取得
  });

  // データの安全な取得
  const bathingRecords = Array.isArray(bathingRecordsQuery.data) ? bathingRecordsQuery.data : [];
  const bathingRecordsLoading = bathingRecordsQuery.isLoading;

  // デバッグログを追加
  console.log("=== bathingRecordsQuery デバッグ ===");
  console.log("bathingRecordsQuery.data:", bathingRecordsQuery.data);
  console.log("bathingRecordsQuery.isLoading:", bathingRecordsQuery.isLoading);
  console.log("bathingRecordsQuery.error:", bathingRecordsQuery.error);
  console.log("bathingRecords（最終値）:", bathingRecords);
  console.log("bathingRecords.length:", bathingRecords?.length);

  // データ読み込み中の状態
  const isLoading = residentsLoading || bathingRecordsLoading;

  // 入浴記録の作成
  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/bathing-records", "POST", data),
    onSuccess: (serverResponse, variables) => {
      const queryKey = ["/api/bathing-records"];
      
      // 食事一覧と同じパターンで一時レコードを置き換える
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        // temp-で始まる一時レコードを実際のIDに置き換え
        return old.map((record: any) => {
          if (record.id?.startsWith('temp-') && 
              record.residentId === variables.residentId && 
              format(new Date(record.recordDate), 'yyyy-MM-dd') === format(new Date(variables.recordDate), 'yyyy-MM-dd')) {
            return { ...record, ...serverResponse, id: serverResponse.id };
          }
          return record;
        });
      });
    },
    onError: (error: any) => {
      console.error("入浴記録作成エラー:", error);
      
      toast({
        title: "エラー",
        description: error.message || "入浴記録の作成に失敗しました。",
        variant: "destructive",
      });
      // エラー時は invalidate してサーバーの状態と同期させる
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<any> }) => {
      if (id.startsWith("temp-")) {
        throw new Error("一時的なレコードは更新できません。");
      }
      return apiRequest(`/api/bathing-records/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      const queryKey = ["/api/bathing-records"];
      await queryClient.cancelQueries({ queryKey });
      const previousRecords = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === id ? { ...record, ...data } : record
        );
      });
      
      return { previousRecords };
    },
    onError: (error: any, _, context) => {
      toast({
        title: "エラー",
        description: error.message || "入浴記録の更新に失敗しました。",
        variant: "destructive",
      });
      if (context?.previousRecords) {
        queryClient.setQueryData(["/api/bathing-records"], context.previousRecords);
      }
    },
    onSuccess: () => {
      // 楽観的更新を使用しているため、成功時の無効化は不要
    },
  });

  // フィールド更新（楽観的更新のみ）- 食事一覧と同じパターン
  const handleFieldUpdate = (residentId: string, field: string, value: any) => {

    const queryKey = ["/api/bathing-records"];
    
    // 食事一覧と同じ楽観的更新
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      
      // 既存のレコードを探す（食事一覧と同じ条件）
      const existingIndex = old.findIndex((record: any) => 
        record.residentId === residentId && 
        format(new Date(record.recordDate), 'yyyy-MM-dd') === selectedDate
      );
      
      if (existingIndex >= 0) {
        // 既存レコードを更新
        const updated = [...old];
        updated[existingIndex] = {
          ...updated[existingIndex],
          [field]: value === "empty" ? "" : value
        };
        return updated;
      } else {
        // 新規レコードを追加（食事一覧と同じパターン）
        const newRecord = {
          id: `temp-${Date.now()}`,
          residentId,
          staffId: (currentUser as any)?.id || (currentUser as any)?.claims?.sub || 'unknown',
          recordDate: new Date(selectedDate),
          timing: "午前",
          hour: field === 'hour' ? (value === "empty" ? "" : value) : '',
          minute: field === 'minute' ? (value === "empty" ? "" : value) : '',
          staffName: field === 'staffName' ? (value === "empty" ? "" : value) : '',
          bathType: field === 'bathType' ? (value === "empty" ? "" : value) : '',
          temperature: field === 'temperature' ? (value === "empty" ? "" : value) : '',
          weight: '',
          bloodPressureSystolic: field === 'bloodPressureSystolic' ? (value === "empty" ? "" : value) : '',
          bloodPressureDiastolic: field === 'bloodPressureDiastolic' ? (value === "empty" ? "" : value) : '',
          pulseRate: field === 'pulseRate' ? (value === "empty" ? "" : value) : '',
          oxygenSaturation: field === 'oxygenSaturation' ? (value === "empty" ? "" : value) : '',
          notes: field === 'notes' ? value : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return [...old, newRecord];
      }
    });
    
    // 自動保存は無効化 - 重複登録を防ぐため（食事一覧と同じ）
  };

  // 食事一覧と同じシンプルなパターンに統一（重複防止キャッシュは削除）

  // DB保存処理（食事一覧と完全に同じパターンに変更）
  const lastSaveRef = useRef<Record<string, any>>({});
  
  const handleSaveRecord = (residentId: string, field: string, value: any) => {
    const saveKey = `${residentId}-${field}`;
    const lastValue = lastSaveRef.current[saveKey];
    
    // 重複防止：同じ利用者の同じフィールドで同じ値を連続して保存しない
    if (lastValue === value) {
      console.log("⏸️ Skipping duplicate save in handleSaveRecord:", saveKey, value);
      return;
    }
    
    lastSaveRef.current[saveKey] = value;

    // React Queryのキャッシュから現在のデータを取得（楽観的更新含む）
    const currentCachedData = queryClient.getQueryData(["/api/bathing-records"]) as any[] || [];
    
    console.log("🔍 Searching for existing record:", {
      searchResidentId: residentId,
      searchDate: selectedDate,
      originalBathingRecordsLength: bathingRecords.length,
      currentCachedDataLength: currentCachedData.length,
      cachedRecords: currentCachedData.map(r => ({
        id: r.id,
        residentId: r.residentId,
        recordDate: r.recordDate,
        formattedDate: format(new Date(r.recordDate), 'yyyy-MM-dd'),
        isTemp: r.id?.startsWith('temp-')
      }))
    });
    
    // 楽観的更新を含むキャッシュから検索
    const existingRecord = currentCachedData.find((record: any) => 
      record.residentId === residentId && 
      format(new Date(record.recordDate), 'yyyy-MM-dd') === selectedDate
    );
    
    console.log("📋 Existing record found:", existingRecord);

    // 食事一覧と同じレコードデータ作成方式
    const recordData = {
      residentId,
      staffId: (currentUser as any)?.id || (currentUser as any)?.claims?.sub || 'unknown',
      recordDate: new Date(selectedDate),
      timing: "午前",
      hour: existingRecord?.hour || "",
      minute: existingRecord?.minute || "",
      staffName: existingRecord?.staffName || "",
      bathType: existingRecord?.bathType || "",
      temperature: existingRecord?.temperature || "",
      weight: existingRecord?.weight || "",
      bloodPressureSystolic: existingRecord?.bloodPressureSystolic || "",
      bloodPressureDiastolic: existingRecord?.bloodPressureDiastolic || "",
      pulseRate: existingRecord?.pulseRate || "",
      oxygenSaturation: existingRecord?.oxygenSaturation || "",
      notes: existingRecord?.notes || "",
    };

    // フィールドを更新（食事一覧と同じ方式）
    if (field === 'hour') {
      recordData.hour = value === "empty" ? "" : value;
    } else if (field === 'minute') {
      recordData.minute = value === "empty" ? "" : value;
    } else if (field === 'staffName') {
      recordData.staffName = value === "empty" ? "" : value;
    } else if (field === 'bathType') {
      recordData.bathType = value === "empty" ? "" : value;
    } else if (field === 'temperature') {
      recordData.temperature = value === "empty" ? "" : value;
    } else if (field === 'bloodPressureSystolic') {
      recordData.bloodPressureSystolic = value === "empty" ? "" : value;
    } else if (field === 'bloodPressureDiastolic') {
      recordData.bloodPressureDiastolic = value === "empty" ? "" : value;
    } else if (field === 'pulseRate') {
      recordData.pulseRate = value === "empty" ? "" : value;
    } else if (field === 'oxygenSaturation') {
      recordData.oxygenSaturation = value === "empty" ? "" : value;
    } else if (field === 'notes') {
      recordData.notes = value;
    }

    console.log("💾 Record data to save:", JSON.stringify(recordData, null, 2));
    
    // 食事一覧と同じ更新/作成判定
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      console.log("🔄 Updating existing record with ID:", existingRecord.id);
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      console.log("➕ Creating new record");
      createMutation.mutate(recordData);
    }
  };


  // 入浴記録の削除
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("削除処理開始:", { recordId: id, timestamp: new Date().toISOString() });
      
      try {
        // 一時的レコード（temp-）の場合は、サーバーAPIを呼ばずローカルデータのみ削除
        if (id && typeof id === 'string' && id.startsWith("temp-")) {
          console.log("一時的レコードをローカルから削除:", id);
          return { success: true, isTemporary: true };
        } else {
          // 既存レコードの場合は通常の削除API
          console.log("既存レコードをサーバーから削除:", id);
          const result = await apiRequest(`/api/bathing-records/${id}`, "DELETE");
          console.log("削除API呼び出し成功:", { recordId: id, result });
          return result;
        }
      } catch (error: any) {
        console.error("削除処理中にエラー発生:", {
          recordId: id,
          error: error,
          errorMessage: error?.message,
          errorStack: error?.stack,
          timestamp: new Date().toISOString()
        });
        throw error; // エラーを再スローして onError ハンドラーに渡す
      }
    },
    onMutate: async (id: string) => {
      console.log("削除のonMutate: 楽観的更新をスキップ（順番維持のため）", id);
      // 楽観的更新を行わず、サーバーレスポンス後のinvalidateQueriesのみに依存
      return {};
    },
    onSuccess: (data, id) => {
      // 一時的レコードかどうかを判定
      const isTemporary = id && typeof id === 'string' && id.startsWith("temp-");
      
      if (!isTemporary) {
        // 既存レコードの削除成功時のみサーバーデータを更新
        queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      }
      // 削除完了メッセージは表示しない（静かに削除）
    },
    onError: (error: any, id, context) => {
      console.error('削除エラー:', error);
      
      toast({
        title: "エラー",
        description: error?.message || "入浴記録の削除に失敗しました。",
        variant: "destructive",
      });
      
      // エラー時もキャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
  });

  

  // 承認者入力補助機能
  // 現在時刻に最も近いプルダウン項目を取得する関数
  const getCurrentTimeOptions = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 時刻のオプション（0-23時、0-59分）
    const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
    
    // 現在時刻に最も近い値を見つける
    const nearestHour = hourOptions.find(h => parseInt(h) === currentHour) || currentHour.toString().padStart(2, '0');
    
    // 分は5分単位で丸める（例：13分→15分、17分→15分、23分→25分）
    const roundedMinute = Math.round(currentMinute / 5) * 5;
    const nearestMinute = Math.min(roundedMinute, 59).toString().padStart(2, '0');
    
    return { hour: nearestHour, minute: nearestMinute };
  };

  const handleStaffStamp = (recordId: string, residentId?: string) => {
    const user = currentUser as any;
    const staffName = user?.firstName && user?.lastName
      ? `${user.lastName} ${user.firstName}`
      : user?.email || "スタッフ";
      
    const record = bathingRecords.find((r: any) => r.id === recordId);
    if (!record) return;
    
    const effectiveResidentId = residentId || record.residentId;
    if (!effectiveResidentId) {
        toast({ title: "エラー", description: "利用者情報が見つかりません。", variant: "destructive" });
        return;
    }

    const currentStaffName = record.staffName || "";
    
    if (currentStaffName) {
      // 承認者名が入力済みの場合：承認者名、時、分をクリア
      handleFieldUpdate(effectiveResidentId, "staffName", "");
      handleFieldUpdate(effectiveResidentId, "hour", null);
      handleFieldUpdate(effectiveResidentId, "minute", null);
    } else {
      // 承認者名が空の場合：承認者名と現在時刻を自動入力
      const currentTime = getCurrentTimeOptions();
      handleFieldUpdate(effectiveResidentId, "staffName", staffName);
      handleFieldUpdate(effectiveResidentId, "hour", currentTime.hour);
      handleFieldUpdate(effectiveResidentId, "minute", currentTime.minute);
    }
  };

  // 新規入浴記録追加機能
  const addNewRecord = () => {
    const newRecord = {
      residentId: null,
      recordDate: selectedDate,
      timing: "午前",
      hour: new Date().getHours().toString(),
      minute: (Math.round(new Date().getMinutes() / 15) * 15).toString(),
    };
    createMutation.mutate(newRecord);
  };

  // 選択日付から曜日を取得し、入浴日フィールドを判定
  const getBathDayField = useCallback((date: string) => {
    const dayOfWeek = new Date(date).getDay();
    const bathDayFields = [
      'bathSunday',    // 0: 日曜日
      'bathMonday',    // 1: 月曜日  
      'bathTuesday',   // 2: 火曜日
      'bathWednesday', // 3: 水曜日
      'bathThursday',  // 4: 木曜日
      'bathFriday',    // 5: 金曜日
      'bathSaturday'   // 6: 土曜日
    ];
    return bathDayFields[dayOfWeek];
  }, []);

  // フィルタリングロジック
  const getFilteredBathingRecords = useCallback(() => {
    console.log("=== getFilteredBathingRecords 実行 ===");
    console.log("isLoading:", isLoading);
    console.log("residents:", residents ? residents.length : "null/undefined");
    console.log("bathingRecords:", bathingRecords ? bathingRecords.length : "null/undefined");
    console.log("selectedDate:", selectedDate);
    
    // データが読み込み中の場合は空配列を返す
    if (isLoading || !residents || !Array.isArray(residents)) {
      console.log("❌ データ不十分のため空配列を返す");
      return [];
    }
    
    const bathDayField = getBathDayField(selectedDate);
    console.log("bathDayField:", bathDayField);
    
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      // フロアフィルタ
      if (selectedFloor !== "全階") {
        const residentFloor = resident.floor;
        if (!residentFloor) {
          return false;
        }
        
        // 選択された階数から数字部分を抽出（例：「1階」→「1」）
        const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
        
        // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
        const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
        
        // 数字部分が空の場合も除外
        if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
          return false;
        }
      }
      
      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      return resident[bathDayField] === true;
    });

    const existingRecords = (Array.isArray(bathingRecords) ? bathingRecords : []).filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) {
        return false;
      }

      // 一時的レコード（temp-で始まる）の場合は常に表示
      if (record.id && record.id.startsWith("temp-")) {
        return true;
      }

      // residentIdが設定されている通常レコードの場合、利用者チェック
      if (record.residentId && record.residentId !== "") {
        // 既存の入浴記録は曜日設定に関係なく常に表示（利用者が存在する場合）
        const resident = residents?.find((r: any) => r.id === record.residentId);
        if (!resident) {
          return false;
        } else {
          // 階数フィルタのチェック（既存レコード用）
          if (selectedFloor !== "全階") {
            const residentFloor = resident.floor;
            
            if (!residentFloor) {
              return false;
            }
            
            // 選択された階数から数字部分を抽出（例：「1階」→「1」）
            const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
            
            // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
            const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
            
            if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
              return false;
            }
          }
        }
      }

      return true;
    });

    // 当日以前の日付の場合、曜日フィルタに合致する利用者のカードを表示
    // タイムゾーンの問題を避けるため、日付文字列での比較を使用
    const todayString = format(new Date(), "yyyy-MM-dd");

    if (selectedDate <= todayString) {
      const recordsWithEmpty = [...existingRecords];

      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingRecords.some(
          (record: any) => record.residentId === resident.id,
        );
        
        if (!hasRecord) {
          const tempRecord = {
            id: `temp-${resident.id}-${selectedDate}`,
            residentId: resident.id,
            recordDate: selectedDate,
            timing: "午前", // デフォルト値
            hour: null,
            minute: null,
            staffName: null,
            bathType: null,
            temperature: null,
            weight: null,
            bloodPressureSystolic: null,
            bloodPressureDiastolic: null,
            pulseRate: null,
            oxygenSaturation: null,
            notes: null,
            rejectionReason: null,
            nursingCheck: false,
            createdAt: null,
            updatedAt: null,
            isTemporary: true,
          };
          
          // 同じIDのレコードが既に存在しないかチェック
          const duplicateExists = recordsWithEmpty.some(record => record.id === tempRecord.id);
          if (!duplicateExists) {
            recordsWithEmpty.push(tempRecord);
          }
        }
      });
      
      // 体重一覧と同じ重複除去処理を追加
      const uniqueRecords = recordsWithEmpty.reduce(
        (acc: any[], current: any) => {
          const existing = acc.find(
            (item) => item.residentId === current.residentId,
          );
          if (!existing) {
            acc.push(current);
          } else {
            if (existing.isTemporary && !current.isTemporary) {
              // 一時的レコードがあるが実際のレコードもある場合、実際のレコードを優先
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
      
      return uniqueRecords;
    }

    return existingRecords;
  }, [residents, bathingRecords, selectedDate, selectedFloor, isLoading, getBathDayField]);

  // フィルタリングロジック（ソートなし）
  const getFilteredRecords = useCallback(() => {
    if (!residents || !Array.isArray(residents) || !bathingRecords || !Array.isArray(bathingRecords)) {
      return [];
    }

    const bathDayField = getBathDayField(selectedDate);
    
    // 利用者フィルタ（階層 + 曜日）
    const filteredResidents = residents.filter((resident: any) => {
      // フロアフィルタ
      if (selectedFloor !== "全階") {
        const residentFloor = resident.floor;
        if (!residentFloor) return false;
        
        // 選択された階数から数字部分を抽出（例：「1階」→「1」）
        const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
        
        // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
        const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
        
        if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
          return false;
        }
      }
      
      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      return resident[bathDayField] === true;
    });

    // 既存の入浴記録（選択日付でフィルタ）
    const existingRecords = bathingRecords.filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) return false;

      // 既存レコード（利用者が設定されている場合も含む）は基本的に表示
      // ただし、フロアフィルタは適用する
      if (record.residentId && record.residentId !== '') {
        const resident = residents.find((r: any) => r.id === record.residentId);
        if (!resident) return false; // 利用者が見つからない場合は非表示
        
        // フロアフィルタのチェック（既存レコード用）
        if (selectedFloor !== "全階") {
          const residentFloor = resident.floor;
          console.log(`[既存レコード階数チェック] 利用者=${resident.name}, residentFloor="${residentFloor}", selectedFloor="${selectedFloor}"`);
          
          if (!residentFloor) {
            console.log(`[既存レコード階数チェック] 利用者 ${resident.name} はfloorがnull/undefinedのためフィルタアウト`);
            return false;
          }
          
          // 選択された階数から数字部分を抽出（例：「1階」→「1」）
          const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
          
          // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
          const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
          
          console.log(`[既存レコード階数チェック] 階数比較: 利用者階数="${residentFloorNumber}", 選択階数="${selectedFloorNumber}"`);
          
          if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
            console.log(`[既存レコード階数チェック] 利用者 ${resident.name} は階数不一致のためフィルタアウト`);
            return false;
          }
          
          console.log(`[既存レコード階数チェック] 利用者 ${resident.name} は階数一致のため採用`);
        }
        return true; // フロア条件を満たす既存レコードは表示
      }

      // residentIdがnullまたは空の場合は表示する（空カード）
      return true;
    });

    // 既存レコードのみを返す（一時的レコードの自動生成は行わない）
    return existingRecords;
  }, [residents, bathingRecords, selectedDate, selectedFloor]);

  // レコードをソートする関数（居室番号の若い順）
  const sortRecords = useCallback((records: any[]) => {
    if (!residents || !Array.isArray(residents)) return records;
    
    return [...records].sort((a: any, b: any) => {
      const residentA = residents.find((r: any) => r.id === a.residentId);
      const residentB = residents.find((r: any) => r.id === b.residentId);
      
      // 利用者が見つからない場合は最後に配置
      if (!residentA && !residentB) return 0;
      if (!residentA) return 1;
      if (!residentB) return -1;
      
      const roomA = residentA.roomNumber || "0";
      const roomB = residentB.roomNumber || "0";
      
      // 数値として変換を試行
      const numA = parseInt(roomA.toString().replace(/[^\d]/g, ''), 10);
      const numB = parseInt(roomB.toString().replace(/[^\d]/g, ''), 10);
      
      // 両方とも有効な数値の場合
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // 片方が数値でない場合は文字列として比較
      return roomA.toString().localeCompare(roomB.toString(), undefined, { numeric: true });
    });
  }, [residents]);

  // ソート順序を保持するための参照（初回とフィルター変更時のみ更新）
  const sortOrderRef = useRef<{[key: string]: number}>({});
  
  // ソート順序の更新（初回とフィルター条件変更時のみ）
  const sortedOrderMap = useMemo(() => {
    if (isLoading || !residents || !Array.isArray(residents) || !bathingRecords || !Array.isArray(bathingRecords)) {
      return {};
    }

    const filtered = getFilteredBathingRecords();
    const sorted = sortRecords(filtered);
    
    // ソート順序をマップに記録
    const orderMap: {[key: string]: number} = {};
    sorted.forEach((record, index) => {
      orderMap[record.id] = index;
    });
    
    sortOrderRef.current = orderMap;
    return orderMap;
  }, [residents, selectedDate, selectedFloor, isLoading]);

  // フィルタリングされたレコード（既存のソート順序を維持）
  const filteredBathingRecords = useMemo(() => {
    console.log("=== filteredBathingRecords useMemo 実行 ===");
    console.log("isLoading:", isLoading);
    console.log("residents:", residents ? `${residents.length}件` : "null/undefined");
    console.log("bathingRecords:", bathingRecords ? `${bathingRecords.length}件` : "null/undefined");
    console.log("selectedDate:", selectedDate);
    console.log("selectedFloor:", selectedFloor);
    
    // より詳細なデバッグ情報を追加
    if (isLoading) {
      console.log("❌ ローディング中のため空配列を返す");
      return [];
    }
    
    if (!residents || !Array.isArray(residents)) {
      console.log("❌ residents データが無効のため空配列を返す", residents);
      return [];
    }
    
    if (!bathingRecords || !Array.isArray(bathingRecords)) {
      console.log("❌ bathingRecords データが無効のため空配列を返す", bathingRecords);
      return [];
    }

    console.log("✅ データ準備完了、フィルタリング実行");
    
    // 直接フィルタリングロジックを実装（循環参照を避けるため）
    const bathDayField = getBathDayField(selectedDate);
    console.log("bathDayField:", bathDayField);
    
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      // フロアフィルタ
      if (selectedFloor !== "全階") {
        const residentFloor = resident.floor;
        if (!residentFloor) {
          return false;
        }
        
        // 選択された階数から数字部分を抽出（例：「1階」→「1」）
        const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
        
        // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
        const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
        
        // 数字部分が空の場合も除外
        if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
          return false;
        }
      }
      
      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      return resident[bathDayField] === true;
    });

    console.log("filteredResidents:", filteredResidents.length, "人");

    const existingRecords = (Array.isArray(bathingRecords) ? bathingRecords : []).filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) {
        return false;
      }

      // 一時的レコード（temp-で始まる）の場合は常に表示
      if (record.id && record.id.startsWith("temp-")) {
        return true;
      }

      // residentIdが設定されている通常レコードの場合、利用者チェック
      if (record.residentId && record.residentId !== "") {
        // 既存の入浴記録は曜日設定に関係なく常に表示（利用者が存在する場合）
        const resident = residents?.find((r: any) => r.id === record.residentId);
        if (!resident) {
          return false;
        } else {
          // 階数フィルタのチェック（既存レコード用）
          if (selectedFloor !== "全階") {
            const residentFloor = resident.floor;
            
            if (!residentFloor) {
              return false;
            }
            
            // 選択された階数から数字部分を抽出（例：「1階」→「1」）
            const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
            
            // 利用者の階数から数字部分を抽出（「1」「1階」「1F」など全て対応）
            const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
            
            if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
              return false;
            }
          }
        }
      }

      return true;
    });

    console.log("existingRecords:", existingRecords.length, "件");

    // 当日以前の日付の場合、曜日フィルタに合致する利用者のカードを表示
    // タイムゾーンの問題を避けるため、日付文字列での比較を使用
    const todayString = format(new Date(), "yyyy-MM-dd");
    console.log("todayString:", todayString, "selectedDate:", selectedDate);

    if (selectedDate <= todayString) {
      console.log("✅ 選択日が今日以前なので空カードを生成");
      const recordsWithEmpty = [...existingRecords];

      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingRecords.some(
          (record: any) => record.residentId === resident.id,
        );
        
        if (!hasRecord) {
          console.log(`空カード生成: ${resident.roomNumber} ${resident.name}`);
          const tempRecord = {
            id: `temp-${resident.id}-${selectedDate}`,
            residentId: resident.id,
            recordDate: selectedDate,
            timing: "午前", // デフォルト値
            hour: null,
            minute: null,
            staffName: null,
            bathType: null,
            temperature: null,
            weight: null,
            bloodPressureSystolic: null,
            bloodPressureDiastolic: null,
            pulseRate: null,
            oxygenSaturation: null,
            notes: null,
            rejectionReason: null,
            nursingCheck: false,
            createdAt: null,
            updatedAt: null,
            isTemporary: true,
          };
          
          // 同じIDのレコードが既に存在しないかチェック
          const duplicateExists = recordsWithEmpty.some(record => record.id === tempRecord.id);
          if (!duplicateExists) {
            recordsWithEmpty.push(tempRecord);
          }
        }
      });

      console.log("recordsWithEmpty:", recordsWithEmpty.length, "件");

      // 重複除去処理
      const uniqueRecords = recordsWithEmpty.reduce(
        (acc: any[], current: any) => {
          const existing = acc.find(
            (item) => item.residentId === current.residentId,
          );
          if (!existing) {
            acc.push(current);
          } else {
            if (existing.isTemporary && !current.isTemporary) {
              // 一時的レコードがあるが実際のレコードもある場合、実際のレコードを優先
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
      
      console.log("uniqueRecords:", uniqueRecords.length, "件");
      var filtered = uniqueRecords;
    } else {
      console.log("❌ 選択日が未来なので既存レコードのみ");
      var filtered = existingRecords;
    }

    console.log("最終フィルタリング結果:", filtered.length, "件");
    
    // 新しいレコードにはソート順序を設定しない（空のレコードは最下部に表示するため）
    // 利用者が設定されたレコードのみソート順序を設定
    filtered.forEach((record) => {
      if (!(record.id in sortOrderRef.current) && record.residentId && record.residentId !== "") {
        // 利用者が設定された新しいレコードのみソート順序を設定
        const maxOrder = Math.max(...Object.values(sortOrderRef.current), -1);
        sortOrderRef.current[record.id] = maxOrder + 1;
      }
    });
    
    // 利用者が設定されたレコードと空のレコードを分離
    const recordsWithResident = filtered.filter(record => record.residentId && record.residentId !== "");
    const emptyRecords = filtered.filter(record => !record.residentId || record.residentId === "");
    
    // 利用者が設定されたレコードは既存のソート順序を使用してソート（順序は固定）
    const sortedRecordsWithResident = [...recordsWithResident].sort((a, b) => {
      const orderA = sortOrderRef.current[a.id];
      const orderB = sortOrderRef.current[b.id];
      
      // ソート順序が設定されているレコード同士の比較
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      
      // ソート順序が設定されていないレコードは利用者の居室番号でソート
      if (orderA === undefined && orderB === undefined) {
        const residentA = residents?.find((r: any) => r.id === a.residentId);
        const residentB = residents?.find((r: any) => r.id === b.residentId);
        
        if (!residentA && !residentB) return 0;
        if (!residentA) return 1;
        if (!residentB) return -1;
        
        const roomA = parseInt(residentA.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);
        const roomB = parseInt(residentB.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);
        
        return roomA - roomB;
      }
      
      // 片方のみソート順序が設定されている場合
      if (orderA === undefined) return 1;
      if (orderB === undefined) return -1;
      
      return 0;
    });
    
    // 空のレコードは作成順（ID順）でソート
    const sortedEmptyRecords = [...emptyRecords].sort((a, b) => {
      // temp- で始まるIDは作成順、通常のIDは既存のソート順
      if (a.id.startsWith("temp-") && b.id.startsWith("temp-")) {
        return a.id.localeCompare(b.id);
      }
      const orderA = sortOrderRef.current[a.id] ?? 999999;
      const orderB = sortOrderRef.current[b.id] ?? 999999;
      return orderA - orderB;
    });
    
    // 利用者設定済みレコードを先に、空のレコードを後に配置
    const sorted = [...sortedRecordsWithResident, ...sortedEmptyRecords];
    
    return sorted;
  }, [residents, bathingRecords, selectedDate, selectedFloor, getBathDayField, isLoading]);

  // 共通のスタイル
  const inputBaseClass = "text-center border rounded px-1 py-1 text-xs h-8 transition-colors focus:border-blue-500 focus:outline-none";

  // ドロップダウンオプション
  const floorOptions = [
    { value: "全階", label: "全階" },
    { value: "1階", label: "1階" },
    { value: "2階", label: "2階" },
    { value: "3階", label: "3階" },
    { value: "4階", label: "4階" },
    { value: "5階", label: "5階" },
  ];

  const hourOptions = [
    // 6時から23時まで
    ...Array.from({ length: 18 }, (_, i) => ({
      value: (6 + i).toString(),
      label: (6 + i).toString().padStart(2, "0"),
    })),
    // 0時から5時まで
    ...Array.from({ length: 6 }, (_, i) => ({
      value: i.toString(),
      label: i.toString().padStart(2, "0"),
    }))
  ];

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

  const temperatureOptions = Array.from({ length: 50 }, (_, i) => {
    const temp = (35.0 + i * 0.1).toFixed(1);
    return { value: temp, label: temp };
  });

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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // 現在アクティブな要素からフォーカスを外すことで、
                // 編集中のフィールドがあればデバウンスされた保存がトリガーされる可能性がある
                const activeElement = document.activeElement as HTMLElement;
                if (activeElement && typeof activeElement.blur === 'function') {
                  activeElement.blur();
                }

                // 短い遅延の後でページ遷移する
                // これにより、blurイベントハンドラが実行される時間を確保する
                setTimeout(() => {
                  const params = new URLSearchParams();
                  params.set('date', selectedDate);
                  params.set('floor', selectedFloor === "全階" ? "all" : selectedFloor.replace("階", ""));
                  const targetUrl = `/?${params.toString()}`;
                  console.log('入浴一覧からトップ画面へ遷移:', targetUrl);
                  setLocation(targetUrl);
                }, 200);
              }}
              className="h-8 w-8 p-0"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">入浴一覧</h1>
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
                data-testid="input-date"
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
                enableAutoFocus={false}
              />
            </div>
          </div>
        </div>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-2 pt-2 pb-24">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-slate-600">
              <p>データを読み込み中...</p>
            </div>
          ) : filteredBathingRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の利用者がいません</p>
            </div>
          ) : (
            // 食事一覧と同じ利用者ベースのレンダリングに変更
            (() => {
              const bathDayField = getBathDayField(selectedDate);
              const filteredResidents = (residents as any[]).filter((resident: any) => {
                // フロアフィルタ
                if (selectedFloor !== "全階") {
                  const residentFloor = resident.floor;
                  if (!residentFloor) return false;
                  
                  const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
                  const residentFloorNumber = residentFloor.toString().replace(/[^0-9]/g, "");
                  
                  if (!residentFloorNumber || selectedFloorNumber !== residentFloorNumber) {
                    return false;
                  }
                }
                
                // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
                return resident[bathDayField] === true;
              })
              // 居室番号の若い順にソート
              .sort((a: any, b: any) => {
                const roomA = parseInt(a.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);
                const roomB = parseInt(b.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);
                return roomA - roomB;
              });
              
              return filteredResidents;
            })().map((resident: any) => {
                // 同一利用者の既存レコードを検索（食事一覧と同じパターン）
                const existingRecord = bathingRecords.find((r: any) => 
                  r.residentId === resident.id && 
                  format(new Date(r.recordDate), 'yyyy-MM-dd') === selectedDate
                );
                
                return (
                  <BathingCard
                    key={resident.id} // 利用者IDをキーに使用（食事一覧と同じ）
                    record={existingRecord || { residentId: resident.id, isTemporary: true }} // 既存レコードまたは一時レコード
                    residents={residents as any[]}
                    currentUser={currentUser}
                    inputBaseClass={inputBaseClass}
                    hourOptions={hourOptions}
                    minuteOptions={minuteOptions}
                    bathTypeOptions={bathTypeOptions}
                    temperatureOptions={temperatureOptions}
                    systolicBPOptions={systolicBPOptions}
                    diastolicBPOptions={diastolicBPOptions}
                    pulseOptions={pulseOptions}
                    spo2Options={spo2Options}
                    handleFieldUpdate={handleFieldUpdate}
                    handleSaveRecord={handleSaveRecord}
                    handleStaffStamp={handleStaffStamp}
                    deleteMutation={deleteMutation}
                    changeResidentMutation={handleFieldUpdate}
                  />
                );
              })
          )}
        </div>
      </main>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-end max-w-lg mx-auto">
          <Button
            onClick={addNewRecord}
            className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
            data-testid="button-add-record"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}