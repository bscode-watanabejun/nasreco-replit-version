import React, { useState, useEffect, useRef, useMemo } from "react";
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
  disabled = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // アクティブ要素を監視してフォーカス状態を更新
  useEffect(() => {
    const checkFocus = () => {
      if (inputRef.current) {
        setIsFocused(document.activeElement === inputRef.current);
      }
    };

    // 初回チェック
    checkFocus();

    // フォーカス変更を監視
    const handleFocusChange = () => {
      checkFocus();
    };

    // document全体でfocus/blurイベントを監視
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

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
          // フォーカス移動前に現在のプルダウンを確実に閉じる
          setOpen(false);
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
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
                setIsFocused(true);
              }
            }}
            onBlur={(e) => {
              // プルダウンが開いている場合はフォーカスを維持
              if (!open) {
                setTimeout(() => setIsFocused(false), 50);
              }
              handleInputBlur();
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.preventDefault()}
            placeholder={placeholder}
            className={`${className} ${disabled ? 'cursor-not-allowed' : ''} ${isFocused || open ? '!border-blue-500' : ''} transition-all outline-none`}
            disabled={disabled}
          />
        </PopoverTrigger>
        <PopoverContent className="w-32 p-0.5" align="center">
          <div className="space-y-0 max-h-40 overflow-y-auto">
            {(options || []).map((option, index) => (
              <button
                key={index}
                className="w-full text-left px-1.5 py-0 text-xs hover:bg-slate-100 leading-tight min-h-[1.2rem] border-0 bg-transparent"
                onClick={() => handleSelect(option.value)}
                data-testid={`option-${option.value}`}
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

  // 全項目未入力でない場合は変更不可
  const disabled = !isAllEmpty;

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
  inputBaseClass,
  hourOptions,
  minuteOptions,
  bathTypeOptions,
  temperatureOptions,
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
  inputBaseClass: string;
  hourOptions: any[];
  minuteOptions: any[];
  bathTypeOptions: any[];
  temperatureOptions: any[];
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
        {/* 上段：居室番号、利用者名、時間、区分、承認者、承認アイコン */}
        <div className="flex items-center gap-0.5 sm:gap-1 mb-3">
          {/* 居室番号 */}
          <div className="text-sm sm:text-lg font-bold text-blue-600 min-w-[35px] sm:min-w-[50px] flex-shrink-0">
            {resident?.roomNumber || "未設定"}
          </div>
          
          {/* 利用者名 */}
          <ResidentSelector
            record={record}
            residents={residents}
            onResidentChange={(recordId, residentId) => 
              changeResidentMutation.mutate({ recordId, newResidentId: residentId })
            }
          />
          
          {/* 時間 */}
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
              disabled={!record.residentId}
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
              disabled={!record.residentId}
            />
          </div>
          
          {/* 区分 */}
          <div className="flex items-center gap-1">
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
              disabled={!record.residentId}
            />
          </div>
          
          {/* 承認者 */}
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
              onSave={(value) =>
                updateMutation.mutate({
                  id: record.id,
                  field: "temperature",
                  value,
                  residentId: record.residentId,
                })
              }
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
              disabled={!record.residentId}
            />
          </div>

          {/* 血圧 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">血圧</span>
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
                disabled={!record.residentId}
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
                disabled={!record.residentId}
              />
            </div>
          </div>

          {/* 脈拍 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">脈拍</span>
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

          {/* SpO2 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">SpO2</span>
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
        </div>

        {/* 下段：記録、差し戻し、看護チェックボックス、削除アイコン */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* 記録 */}
          <div className="flex items-center flex-1">
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
              className={`flex-1 min-w-0 ${inputBaseClass} px-2 resize-none`}
              rows={1}
              style={{ minHeight: "32px", maxHeight: "64px" }}
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
              }`}
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
      return floorParam;
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
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // 利用者データの取得
  const { data: residents } = useQuery({
    queryKey: ["/api/residents"],
    queryFn: async () => {
      try {
        const data = await apiRequest("/api/residents", "GET");
        console.log("Residents API response:", data);
        
        // 入浴日設定をデバッグログ出力
        if (Array.isArray(data)) {
          data.forEach((resident: any) => {
            const bathDays = [];
            if (resident.bathSunday) bathDays.push('日');
            if (resident.bathMonday) bathDays.push('月');
            if (resident.bathTuesday) bathDays.push('火');
            if (resident.bathWednesday) bathDays.push('水');
            if (resident.bathThursday) bathDays.push('木');
            if (resident.bathFriday) bathDays.push('金');
            if (resident.bathSaturday) bathDays.push('土');
            
            console.log(`利用者 ${resident.roomNumber} ${resident.name}: 入浴日=[${bathDays.join(',')}]`);
          });
        }
        
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch residents:", error);
        return [];
      }
    },
  });

  // 現在のユーザー情報を取得
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // 入浴記録データの取得（バイタル一覧と同じシンプルな実装）
  const { data: bathingRecords = [] } = useQuery({
    queryKey: ["/api/bathing-records"],
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

  // 入浴記録の更新（バイタル一覧と同じシンプルな実装）
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
        const residentIdFromTemp = residentId || id.split("-")[1]; // temp-{residentId}-{date}から抽出
        
        // residentIdの検証
        if (!residentIdFromTemp || residentIdFromTemp === 'undefined' || residentIdFromTemp === 'null') {
          throw new Error('利用者情報が正しく設定されていません。ページを再読み込みしてください。');
        }

        const newRecordData: any = {
          residentId: residentIdFromTemp,
          recordDate: selectedDate, // ISO文字列として送信
          timing: "午前",
          [field]: value,
        };
        
        console.log("Creating new bathing record:", newRecordData);

        // データ型を適切に変換（文字列として送信）
        if (field === "recordDate") {
          newRecordData[field] = value; // ISO文字列として送信
        } else if (
          ["hour", "minute", "bloodPressureSystolic", "bloodPressureDiastolic", "pulseRate", "oxygenSaturation", "temperature", "weight"].includes(field)
        ) {
          // 数値フィールドも文字列として送信（空文字列の場合はnullに変換）
          newRecordData[field] = value === "" ? null : String(value);
        } else if (field === "nursingCheck") {
          newRecordData[field] = value === "true" || value === true;
        }

        return await apiRequest("/api/bathing-records", "POST", newRecordData);
      } else {
        // 既存レコードの更新
        const updateData: any = { [field]: value };

        console.log("Updating existing bathing record:", { id, field, value, updateData });
        
        // データ型を適切に変換（文字列として送信）
        if (field === "recordDate") {
          updateData[field] = value; // ISO文字列として送信
        } else if (
          ["hour", "minute", "bloodPressureSystolic", "bloodPressureDiastolic", "pulseRate", "oxygenSaturation", "temperature", "weight"].includes(field)
        ) {
          // 数値フィールドも文字列として送信（空文字列の場合はnullに変換）
          updateData[field] = value === "" ? null : String(value);
        } else if (field === "nursingCheck") {
          updateData[field] = value === "true" || value === true;
        }

        return await apiRequest(`/api/bathing-records/${id}`, "PATCH", updateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({
        title: "エラー",
        description: error.message || "更新に失敗しました",
        variant: "destructive",
      });
    },
  });

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
      } catch (error) {
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
      // 楽観的更新：即座にローカルから削除
      await queryClient.cancelQueries({ queryKey: ["/api/bathing-records"] });
      
      const previousData = queryClient.getQueryData(["/api/bathing-records"]);
      
      queryClient.setQueryData(["/api/bathing-records"], (old: any) => {
        // oldが配列でない場合は何もしない
        if (!old || !Array.isArray(old)) {
          console.warn("キャッシュデータが配列ではありません:", old);
          return old;
        }
        return old.filter((record: any) => record.id !== id);
      });
      
      return { previousData };
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
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/bathing-records"], context.previousData);
      }
      
      // より詳細なエラー情報をログ出力
      console.error('削除エラー詳細:', {
        errorObject: error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        recordId: id,
        timestamp: new Date().toISOString()
      });
      
      // エラーメッセージをより詳細に
      let errorMessage = "入浴記録の削除に失敗しました。";
      if (error?.message) {
        errorMessage = `削除エラー: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `削除エラー: ${error}`;
      }
      
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // 利用者変更
  const changeResidentMutation = useMutation({
    mutationFn: async ({ recordId, newResidentId }: { recordId: string; newResidentId: string }) => {
      // 一時的レコード（新規作成）かどうかを判定
      if (recordId && typeof recordId === 'string' && recordId.startsWith("temp-")) {
        // 新規作成の場合：完全なレコードデータを構築
        const currentData = queryClient.getQueryData(["/api/bathing-records", selectedDate]) as any[];
        const currentRecord = Array.isArray(currentData) ? currentData.find((record: any) => record.id === recordId) : null;
        
        if (!currentRecord) {
          throw new Error("一時的レコードが見つかりません");
        }
        
        const createData = {
          residentId: newResidentId,
          recordDate: selectedDate,
          timing: currentRecord.timing || "午前",
          hour: currentRecord.hour || "",
          minute: currentRecord.minute || "",
          staffName: currentRecord.staffName || "",
          bathType: currentRecord.bathType || "",
          temperature: currentRecord.temperature || "",
          bloodPressureSystolic: currentRecord.bloodPressureSystolic || "",
          bloodPressureDiastolic: currentRecord.bloodPressureDiastolic || "",
          pulseRate: currentRecord.pulseRate || "",
          oxygenSaturation: currentRecord.oxygenSaturation || "",
          notes: currentRecord.notes || "",
          rejectionReason: currentRecord.rejectionReason || "",
          nursingCheck: currentRecord.nursingCheck || false,
        };
        
        await apiRequest("/api/bathing-records", "POST", createData);
      } else {
        // 既存レコードの更新
        await apiRequest(`/api/bathing-records/${recordId}`, "PATCH", {
          residentId: newResidentId
        });
      }
    },
    // 楽観的更新で即座にUIを更新
    onMutate: async ({ recordId, newResidentId }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/bathing-records", selectedDate] });
      
      // 現在のデータのスナップショットを取得
      const previousBathingRecords = queryClient.getQueryData(["/api/bathing-records", selectedDate]);
      
      // 楽観的に更新（利用者変更）
      queryClient.setQueryData(["/api/bathing-records", selectedDate], (old: any) => {
        if (!old) return old;
        
        return old.map((record: any) => {
          if (record.id === recordId) {
            return { 
              ...record, 
              residentId: newResidentId,
              // 一時的レコードの場合はisTemporaryフラグを保持
              isTemporary: record.id.startsWith("temp-") ? true : record.isTemporary
            };
          }
          return record;
        });
      });
      
      // ロールバック用のコンテキストを返す
      return { previousBathingRecords };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousBathingRecords) {
        queryClient.setQueryData(["/api/bathing-records", selectedDate], context.previousBathingRecords);
      }
      
      console.error('Change resident error:', error);
      toast({
        title: "エラー",
        description: error.message || "利用者の変更に失敗しました",
        variant: "destructive",
      });
      
      // エラー時もサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
    onSuccess: (data, { recordId }) => {
      // 一時的レコードの場合は新規作成なので、選択日付のデータのみ更新
      if (recordId && typeof recordId === 'string' && recordId.startsWith("temp-")) {
        queryClient.invalidateQueries({ queryKey: ["/api/bathing-records", selectedDate] });
      } else {
        // 既存レコードの場合は全体を更新
        queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      }
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

  const handleStaffStamp = async (recordId: string, residentId?: string) => {
    const user = currentUser as any;
    const staffName = user?.firstName && user?.lastName
      ? `${user.lastName} ${user.firstName}`
      : user?.email || "スタッフ";
      
    // 現在の入浴記録を取得
    const record = filteredBathingRecords.find((r: any) => r.id === recordId);
    if (!record) return;
    
    const currentStaffName = record.staffName || "";
    
    if (currentStaffName) {
      // 承認者名が入力済みの場合：承認者名、時、分をクリア
      try {
        // 各フィールドを順次クリア（短い間隔で実行）
        await new Promise(resolve => {
          updateMutation.mutate({
            id: recordId,
            field: "staffName",
            value: "",
            residentId: residentId || record.residentId,
          });
          setTimeout(resolve, 100);
        });
        
        await new Promise(resolve => {
          updateMutation.mutate({
            id: recordId,
            field: "hour",
            value: "",
            residentId: residentId || record.residentId,
          });
          setTimeout(resolve, 100);
        });
        
        updateMutation.mutate({
          id: recordId,
          field: "minute",
          value: "",
          residentId: residentId || record.residentId,
        });
      } catch (error) {
        console.error("Error clearing fields:", error);
      }
    } else {
      // 承認者名が空の場合：承認者名と現在時刻を自動入力
      const currentTime = getCurrentTimeOptions();
      
      try {
        // 各フィールドを順次入力（短い間隔で実行）
        await new Promise(resolve => {
          updateMutation.mutate({
            id: recordId,
            field: "staffName",
            value: staffName,
            residentId: residentId || record.residentId,
          });
          setTimeout(resolve, 100);
        });
        
        await new Promise(resolve => {
          updateMutation.mutate({
            id: recordId,
            field: "hour",
            value: currentTime.hour,
            residentId: residentId || record.residentId,
          });
          setTimeout(resolve, 100);
        });
        
        updateMutation.mutate({
          id: recordId,
          field: "minute",
          value: currentTime.minute,
          residentId: residentId || record.residentId,
        });
      } catch (error) {
        console.error("Error setting fields:", error);
      }
    }
  };

  // 新規記録追加（空のカードを最下部に追加）
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
    
    // 一時的なIDを生成（タイムスタンプベース）
    const tempId = `temp-new-${Date.now()}`;
    
    // 楽観的更新で空のカードを即座に追加
    queryClient.setQueryData(["/api/bathing-records", selectedDate], (old: any) => {
      if (!old) return old;
      
      // 同じIDが既に存在しないかチェック
      const existingRecord = old.find((record: any) => record.id === tempId);
      if (existingRecord) {
        console.warn(`重複したIDの新規記録作成を防止: ${tempId}`);
        return old;
      }
      
      // 新しい空のレコードを作成
      const newEmptyRecord = {
        id: tempId,
        residentId: "", // 空の状態に設定
        recordDate: selectedDate,
        timing: "午前",
        hour: "",
        minute: "",
        staffName: "",
        bathType: "",
        temperature: "",
        bloodPressureSystolic: "",
        bloodPressureDiastolic: "",
        pulseRate: "",
        oxygenSaturation: "",
        notes: "",
        rejectionReason: "",
        nursingCheck: false,
        createdAt: null,
        updatedAt: null,
        isTemporary: true,
      };
      
      console.log(`新規空カードを追加: ${tempId}`);
      return [...old, newEmptyRecord];
    });
  };

  // 選択日付から曜日を取得し、入浴日フィールドを判定
  const getBathDayField = (date: string) => {
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
  };

  // フィルタリングロジック
  const getFilteredBathingRecords = () => {
    if (!residents || !Array.isArray(residents)) {
      return [];
    }
    
    const bathDayField = getBathDayField(selectedDate);
    console.log(`選択日付: ${selectedDate}, 曜日フィールド: ${bathDayField}`);
    
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      // フロアフィルタ
      if (selectedFloor !== "全階") {
        const residentFloor = resident.floor;
        if (!residentFloor) return false;
        
        const selectedFloorNumber = selectedFloor.replace("階", "");
        if (residentFloor !== selectedFloor && residentFloor !== selectedFloorNumber) {
          return false;
        }
      }
      
      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      if (resident[bathDayField] !== true) {
        console.log(`利用者 ${resident.name} は ${bathDayField} がfalseのためフィルタアウト`);
        return false;
      }
      
      console.log(`利用者 ${resident.name} は ${bathDayField} がtrueのため表示対象`);
      return true;
    });

    const existingRecords = (Array.isArray(bathingRecords) ? bathingRecords : []).filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) {
        console.log(`日付不一致でフィルタアウト: ${record.id}, recordDate=${recordDate}, selectedDate=${selectedDate}`);
        return false;
      }

      // フロアと曜日フィルタリング（空のresidentIdの場合は通す）
      if (record.residentId !== "") {
        const resident = filteredResidents.find(
          (r: any) => r.id === record.residentId,
        );
        if (!resident) {
          console.log(`利用者が曜日フィルタで除外: recordId=${record.id}, residentId=${record.residentId}`);
          return false;
        } else {
          console.log(`既存記録として採用: recordId=${record.id}, resident=${resident.roomNumber} ${resident.name}`);
        }
      } else {
        console.log(`空のresidentIdの記録: recordId=${record.id}`);
      }

      return true;
    });
    
    console.log(`既存の入浴記録: ${existingRecords.length}件`);

    // 当日以前の日付の場合、曜日フィルタに合致する利用者のカードを表示
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    console.log(`日付比較: 選択日=${selectedDateObj.toDateString()}, 今日=${today.toDateString()}`);
    console.log(`selectedDateObj <= today: ${selectedDateObj <= today}`);

    if (selectedDateObj <= today) {
      const recordsWithEmpty = [...existingRecords];

      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingRecords.some(
          (record: any) => record.residentId === resident.id,
        );
        
        console.log(`利用者チェック: ${resident.roomNumber} ${resident.name}, 既存記録有無: ${hasRecord}`);
        
        if (!hasRecord) {
          console.log(`空のカードを追加: ${resident.roomNumber} ${resident.name} (${bathDayField}=true)`);
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
            console.log(`空カード追加完了: ${tempRecord.id}`);
          } else {
            console.warn(`重複したレコードID: ${tempRecord.id} (${resident.roomNumber} ${resident.name})`);
          }
        } else {
          console.log(`既存記録があるためスキップ: ${resident.roomNumber} ${resident.name}`);
        }
      });

      console.log(`曜日フィルタ適用後の表示対象: ${recordsWithEmpty.length}件`);
      
      // 重複チェック
      const idCounts = {};
      recordsWithEmpty.forEach(record => {
        idCounts[record.id] = (idCounts[record.id] || 0) + 1;
      });
      
      const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
      if (duplicates.length > 0) {
        console.error(`重複したレコードID検出:`, duplicates);
        duplicates.forEach(([id, count]) => {
          const duplicateRecords = recordsWithEmpty.filter(r => r.id === id);
          console.error(`ID ${id} (${count}件):`, duplicateRecords);
        });
      }
      
      // 一時的レコードをクエリキャッシュに保存（重複チェック付き）
      const tempRecords = recordsWithEmpty.filter(record => record.id.startsWith('temp-'));
      if (tempRecords.length > 0) {
        console.log(`一時的レコードをキャッシュに保存: ${tempRecords.length}件`);
        
        // 現在のキャッシュデータを取得
        const currentCacheData = queryClient.getQueryData(["/api/bathing-records", selectedDate]) as any[];
        const currentCache = Array.isArray(currentCacheData) ? currentCacheData : [];
        
        // 重複を避けてマージ
        const mergedData = [...currentCache];
        recordsWithEmpty.forEach(newRecord => {
          const exists = mergedData.some(existing => existing.id === newRecord.id);
          if (!exists) {
            mergedData.push(newRecord);
          }
        });
        
        console.log(`キャッシュ更新: ${currentCache.length}件 → ${mergedData.length}件`);
        queryClient.setQueryData(["/api/bathing-records", selectedDate], mergedData);
      }
      
      return recordsWithEmpty;
    }

    return existingRecords;
  };

  // フィルタリングロジック（バイタル一覧と同じシンプルな実装）
  const filteredBathingRecords = useMemo(() => {
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
        
        const selectedFloorNumber = selectedFloor.replace("階", "");
        if (residentFloor !== selectedFloor && residentFloor !== selectedFloorNumber) {
          return false;
        }
      }
      
      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      return resident[bathDayField] === true;
    });

    // 既存の入浴記録（選択日付 + フィルタ済み利用者）
    const existingRecords = bathingRecords.filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) return false;

      // 利用者が曜日フィルタに含まれているかチェック
      const resident = filteredResidents.find((r: any) => r.id === record.residentId);
      return !!resident;
    });

    // 一時的レコードを追加（既存レコードがない利用者）
    const allRecords = [...existingRecords];
    filteredResidents.forEach((resident: any) => {
      const hasRecord = existingRecords.some((record: any) => record.residentId === resident.id);
      if (!hasRecord) {
        allRecords.push({
          id: `temp-${resident.id}-${selectedDate}`,
          residentId: resident.id,
          recordDate: selectedDate,
          timing: "午前",
          hour: null,
          minute: null,
          staffName: null,
          bathType: null,
          temperature: null,
          bloodPressureSystolic: null,
          bloodPressureDiastolic: null,
          pulseRate: null,
          oxygenSaturation: null,
          notes: null,
          rejectionReason: null,
          nursingCheck: false,
          createdAt: null,
          updatedAt: null,
        });
      }
    });

    // 居室番号順にソート
    return allRecords.sort((a: any, b: any) => {
      const residentA = residents.find((r: any) => r.id === a.residentId);
      const residentB = residents.find((r: any) => r.id === b.residentId);
      const roomA = parseInt(residentA?.roomNumber || "0");
      const roomB = parseInt(residentB?.roomNumber || "0");
      return roomA - roomB;
    });
  }, [residents, bathingRecords, selectedDate, selectedFloor]);

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
              onClick={() => setLocation("/")}
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
              />
            </div>
          </div>
        </div>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6 pb-24">
        <div className="space-y-4">
          {filteredBathingRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の記録がありません</p>
            </div>
          ) : (
            filteredBathingRecords.map((record: any, index: number) => (
              <BathingCard
                key={`${record.id}-${record.residentId || 'no-resident'}-${index}`}
                record={record}
                residents={residents as any[]}
                inputBaseClass={inputBaseClass}
                hourOptions={hourOptions}
                minuteOptions={minuteOptions}
                bathTypeOptions={bathTypeOptions}
                temperatureOptions={temperatureOptions}
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