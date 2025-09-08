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
import { format, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";

// 全角数字を半角数字に変換するユーティリティ関数
const convertZenkakuToHankaku = (text: string): string => {
  return text.replace(/[０-９．]/g, (char) => {
    const zenkakuNums = '０１２３４５６７８９．';
    const hankakuNums = '0123456789.';
    const index = zenkakuNums.indexOf(char);
    return index !== -1 ? hankakuNums[index] : char;
  });
};

// JST時間変換ユーティリティ関数
const toJSTDatetimeLocal = (date: string | Date | null): string => {
  if (!date) return "";
  
  try {
    const utcDate = new Date(date);
    // Invalid Dateかどうかをチェック
    if (isNaN(utcDate.getTime())) {
      console.warn("Invalid date received:", date);
      return "";
    }
    
    // JST（UTC+9）に変換
    const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().slice(0, 16);
  } catch (error) {
    console.error("Error in toJSTDatetimeLocal:", error, "date:", date);
    return "";
  }
};

const fromDatetimeLocalToJST = (value: string): Date | null => {
  // 空値の場合はnullを返す
  if (!value || value.trim() === "") {
    return null;
  }
  
  try {
    // datetime-local値をJST時間として解釈
    const jstDate = new Date(value + ":00+09:00");
    // Invalid Dateかどうかをチェック
    if (isNaN(jstDate.getTime())) {
      console.warn("Invalid datetime-local value received:", value);
      return null;
    }
    return jstDate;
  } catch (error) {
    console.error("Error in fromDatetimeLocalToJST:", error, "value:", value);
    return null;
  }
};

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  enableAutoFocus = true,
}: {
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

    // enableAutoFocusがtrueの場合のみフォーカス移動を実行
    if (enableAutoFocus) {
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
    }
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
              // enableAutoFocusがfalseの場合は常にプルダウンを閉じる
              if (!enableAutoFocus) {
                setOpen(false);
                setTimeout(() => setIsFocused(false), 50);
              } else if (!open) {
                // enableAutoFocusがtrueの場合は従来通りの動作
                setTimeout(() => setIsFocused(false), 50);
              }
              handleInputBlur();
            }}
            onKeyDown={handleKeyDown}
            onClick={() => {
              if (!disabled && !open) {
                setOpen(true);
                setIsFocused(true);
              }
            }}
            placeholder={placeholder}
            className={`${className} ${disabled ? 'cursor-not-allowed' : ''} ${isFocused || open ? '!border-blue-500' : ''} transition-all outline-none`}
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
    </div>
  );
}

// 利用者選択コンポーネント
function ResidentSelector({
  weight,
  residents,
  onResidentChange,
}: {
  weight: any;
  residents: any[];
  onResidentChange: (weightId: string, residentId: string) => void;
}) {
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null);
  
  // pendingResidentIdがある場合はそれを使用、なければweight.residentIdを使用
  const effectiveResidentId = pendingResidentId || weight.residentId;
  const currentResident = residents.find((r: any) => r.id === effectiveResidentId);
  const isAllEmpty = !weight.weight && !weight.notes;
  
  // 利用者選択肢（valueとlabelを名前で統一）
  const residentOptions = residents.map((r: any) => ({
    value: r.name,
    label: r.name,
  }));

  const handleResidentChange = (residentId: string) => {
    // 即座にUIを更新するためにローカル状態を設定
    setPendingResidentId(residentId);
    
    // 実際の更新処理を呼び出し
    onResidentChange(weight.id, residentId);
  };

  // weight.residentIdが変更されたらローカル状態をクリア
  useEffect(() => {
    if (pendingResidentId && weight.residentId === pendingResidentId) {
      // サーバーからの更新でresidentIdが正しく反映されたらローカル状態をクリア
      setPendingResidentId(null);
    }
  }, [weight.residentId, pendingResidentId]);

  // weight.residentIdが外部から変更された場合、ローカル状態をリセット
  useEffect(() => {
    setPendingResidentId(null);
  }, [weight.id, weight.residentId]);

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

// 体重カードコンポーネント
function WeightCard({
  weight,
  residents,
  selectedMonth,
  inputBaseClass,
  localNotes,
  setLocalNotes,
  localWeight,
  setLocalWeight,
  updateMutation,
  handleStaffStamp,
  deleteMutation,
  changeResidentMutation,
}: {
  weight: any;
  residents: any[];
  selectedMonth: string;
  inputBaseClass: string;
  localNotes: Record<string, string>;
  setLocalNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  localWeight: Record<string, string>;
  setLocalWeight: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateMutation: any;
  handleStaffStamp: (weightId: string, residentId?: string) => void;
  deleteMutation: any;
  changeResidentMutation: any;
}) {
  const resident = residents.find((r: any) => r.id === weight.residentId);
  
  // 利用者が選択されているかチェック
  const isResidentSelected = weight.residentId && weight.residentId !== "";

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-3">
        {/* 上段：居室番号、利用者名、体重 */}
        <div className="flex items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-blue-600 min-w-[50px]">
              {resident?.roomNumber || "未設定"}
            </div>
            <div className="font-medium text-sm truncate w-20 sm:w-24">
              <span className="text-slate-800">
                {resident?.name || "未選択"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs font-medium text-blue-600">体重</span>
            <input
              type="text"
              value={
                localWeight[weight.id] !== undefined
                  ? localWeight[weight.id]
                  : weight.weight?.toString() || ""
              }
              onChange={(e) => {
                setLocalWeight((prev) => ({
                  ...prev,
                  [weight.id]: e.target.value,
                }));
              }}
              onBlur={(e) => {
                const rawValue = e.target.value;
                const convertedValue = convertZenkakuToHankaku(rawValue.trim());
                
                if (convertedValue !== (weight.weight?.toString() || "")) {
                  updateMutation.mutate({
                    id: weight.id,
                    field: "weight",
                    value: convertedValue,
                    residentId: weight.residentId,
                  });
                }
                
                // ローカル状態をクリア
                setLocalWeight((prev) => {
                  const updated = { ...prev };
                  delete updated[weight.id];
                  return updated;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setLocalWeight((prev) => {
                    const updated = { ...prev };
                    delete updated[weight.id];
                    return updated;
                  });
                  e.currentTarget.blur();
                }
              }}
              placeholder="--"
              className={`w-16 ${inputBaseClass} text-left ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
          </div>
        </div>

        {/* 中段：記録日時、承認者、承認アイコン */}
        <div className="flex items-center mb-3">
          <div className="flex items-center gap-1">
            <input
              type="datetime-local"
              value={toJSTDatetimeLocal(weight.recordDate)}
              onChange={(e) => {
                try {
                  const jstDate = fromDatetimeLocalToJST(e.target.value);
                  updateMutation.mutate({
                    id: weight.id,
                    field: "recordDate",
                    value: jstDate ? jstDate.toISOString() : "",
                    residentId: weight.residentId,
                  });
                } catch (error) {
                  console.error("Error handling datetime-local change:", error, "value:", e.target.value);
                }
              }}
              className={`w-44 ${inputBaseClass} ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
          </div>
          <div className="flex items-center gap-1 text-sm ml-auto">
            <input
              type="text"
              value={weight.staffName || ""}
              onChange={(e) =>
                updateMutation.mutate({
                  id: weight.id,
                  field: "staffName",
                  value: e.target.value,
                  residentId: weight.residentId,
                })
              }
              placeholder="承認者"
              className={`w-20 ${inputBaseClass} px-1 ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
            <button
              className={`rounded text-xs flex items-center justify-center ${
                isResidentSelected 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
              style={{
                height: "32px",
                width: "32px",
                minHeight: "32px",
                minWidth: "32px",
                maxHeight: "32px",
                maxWidth: "32px",
              }}
              onClick={() =>
                isResidentSelected && handleStaffStamp(weight.id, weight.residentId)
              }
              disabled={!isResidentSelected}
              data-testid={`button-stamp-${weight.id}`}
            >
              <User className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 下段：記録、削除 */}
        <div className="flex gap-1 items-center">
          <div className="flex items-center gap-1 flex-1">
            <textarea
              value={
                localNotes[weight.id] !== undefined
                  ? localNotes[weight.id]
                  : weight.notes || ""
              }
              onChange={(e) => {
                setLocalNotes((prev) => ({
                  ...prev,
                  [weight.id]: e.target.value,
                }));
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue !== (weight.notes || "")) {
                  updateMutation.mutate({
                    id: weight.id,
                    field: "notes",
                    value: newValue,
                    residentId: weight.residentId,
                  });
                }
                // 保存処理完了後にローカル状態をクリア（少し遅延）
                setTimeout(() => {
                  setLocalNotes((prev) => {
                    const updated = { ...prev };
                    delete updated[weight.id];
                    return updated;
                  });
                }, 100);
              }}
              onKeyDown={(e) => {
                // Shiftキーを押しながらEnterで改行、Enterのみで確定（複数行対応）
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  // Escapeキー：変更を破棄して元の値に戻す
                  setLocalNotes((prev) => {
                    const updated = { ...prev };
                    delete updated[weight.id];
                    return updated;
                  });
                  e.currentTarget.blur();
                }
              }}
              placeholder="記録内容"
              className={`flex-1 min-w-0 border rounded px-2 py-1 text-xs resize-none text-left align-top transition-colors focus:border-blue-500 focus:outline-none ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              rows={1}
              style={{ minHeight: "32px", maxHeight: "64px", overflow: "auto" }}
              disabled={!isResidentSelected}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="ml-1 rounded text-xs flex items-center justify-center bg-red-500 hover:bg-red-600 text-white"
                  style={{
                    height: "32px",
                    width: "32px",
                    minHeight: "32px",
                    minWidth: "32px",
                    maxHeight: "32px",
                    maxWidth: "32px",
                  }}
                  disabled={false}
                  data-testid={`button-delete-${weight.id}`}
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
                    onClick={() => deleteMutation.mutate(weight.id)}
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

export default function WeightList() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [localWeight, setLocalWeight] = useState<Record<string, string>>({});
  

  // 共通スタイル定数
  const inputBaseClass =
    "h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  // URLパラメータから年月、フロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedMonth, setSelectedMonth] = useState(
    urlParams.get("month") || format(new Date(), "yyyy-MM"),
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

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: weightRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/weight-records"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });


  // 記録更新用ミューテーション（楽観的更新対応）
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
      updates,
      residentId,
    }: {
      id: string;
      field?: string;
      value?: string;
      updates?: Record<string, any>;
      residentId?: string;
    }) => {
      // 一時的なレコード（IDがtempで始まる）の場合は新規作成
      if (id.startsWith("temp-")) {
        const residentIdFromTemp = residentId || id.split("-")[1]; // temp-{residentId}-{month}から抽出
        
        // residentIdの検証
        if (!residentIdFromTemp || residentIdFromTemp === 'undefined' || residentIdFromTemp === 'null') {
          throw new Error('利用者情報が正しく設定されていません。ページを再読み込みしてください。');
        }

        // 既存の一時的レコードから他のフィールドを保持
        const existingWeight = filteredWeightRecords.find((w: any) => w.id === id);
        const newRecordData: any = {
          residentId: residentIdFromTemp,
          // 既存の値を保持
          weight: existingWeight?.weight || null,
          notes: existingWeight?.notes || null,
          staffName: existingWeight?.staffName || null,
          recordDate: existingWeight?.recordDate || null,
        };

        // 複数フィールド更新または単一フィールド更新
        if (updates) {
          // 複数フィールド更新の場合
          Object.assign(newRecordData, updates);
        } else if (field && value !== undefined) {
          // 単一フィールド更新の場合
          newRecordData[field] = value;
        }

        // recordDateが未設定の場合は体重入力時のみ現在のローカル時刻を設定
        if ((field === "weight" || updates?.weight) && !existingWeight?.recordDate && !newRecordData.recordDate) {
          newRecordData.recordDate = new Date();
        }
        

        // データ型を適切に変換
        if (field === "recordDate") {
          if (value && value.trim() !== "") {
            newRecordData[field] = new Date(value);
          } else {
            newRecordData[field] = null;
          }
        } else if (field === "weight") {
          if (value && value.trim() !== "") {
            newRecordData[field] = value;
          }
        } else if (field) {
          // その他のフィールド（notes, staffName等）はそのまま設定
          newRecordData[field] = value;
        }

        // 複数フィールド更新の場合のデータ型変換
        if (updates) {
          if (updates.recordDate) {
            if (updates.recordDate instanceof Date) {
              newRecordData.recordDate = updates.recordDate;
            } else if (typeof updates.recordDate === 'string' && updates.recordDate.trim() !== "") {
              newRecordData.recordDate = new Date(updates.recordDate);
            } else {
              newRecordData.recordDate = null;
            }
          }
          // その他のフィールドはそのまま（staffName, weight, notes等）
        }

        const response = await apiRequest("/api/weight-records", "POST", newRecordData);
        return { type: "create", tempId: id, newRecord: response };
      } else {
        // 既存レコードの更新
        let updateData: any = {};
        
        if (updates) {
          // 複数フィールド更新の場合
          updateData = { ...updates };
          // データ型変換
          if (updates.recordDate) {
            if (updates.recordDate instanceof Date) {
              updateData.recordDate = updates.recordDate;
            } else if (typeof updates.recordDate === 'string' && updates.recordDate.trim() !== "") {
              updateData.recordDate = new Date(updates.recordDate);
            } else {
              updateData.recordDate = null;
            }
          }
        } else if (field && value !== undefined) {
          // 単一フィールド更新の場合
          updateData[field] = value;
          if (field === "recordDate") {
            if (value && value.trim() !== "") {
              updateData[field] = new Date(value);
            } else {
              updateData[field] = null;
            }
          } else if (field === "weight") {
            if (value && value.trim() !== "") {
              updateData[field] = value;
            } else {
              updateData[field] = null;
            }
          }
        }

        await apiRequest(`/api/weight-records/${id}`, "PATCH", updateData);
        return { type: "update", recordId: id };
      }
    },
    // 楽観的更新の実装
    onMutate: async ({ id, field, value, updates }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/weight-records"] });
      
      // 現在のデータのスナップショットを取得
      const previousWeightRecords = queryClient.getQueryData(["/api/weight-records"]);
      
      // 楽観的に更新
      queryClient.setQueryData(["/api/weight-records"], (old: any) => {
        if (!old) return old;
        
        if (id.startsWith("temp-")) {
          // 新規作成の場合：一時的なレコードを探すか作成
          let found = false;
          const updated = old.map((weight: any) => {
            if (weight.id === id) {
              found = true;
              let newWeight = { ...weight };
              
              if (updates) {
                // 複数フィールド更新の場合
                Object.assign(newWeight, updates);
              } else if (field && value !== undefined) {
                // 単一フィールド更新の場合
                let updateValue: any = value;
                // recordDateの削除時は明示的にnullを設定
                if (field === "recordDate" && (!value || value.trim() === "")) {
                  updateValue = null;
                }
                newWeight[field] = updateValue;
              }
              
              return newWeight;
            }
            return weight;
          });
          
          // 一時レコードが見つからない場合は新規作成
          if (!found) {
            // temp-{residentId}-{year}-{month}から正しくresidentIdを抽出
            // 例: temp-fc32a27d-9559-4700-9e02-b0dac899c851-2025-09
            const parts = id.split("-");
            const residentId = parts.slice(1, -2).join("-"); // 最初のtemp-と最後の-year-monthを除く
            
            const newTempRecord: any = {
              id,
              residentId,
              recordDate: null,
              staffName: null,
              weight: null,
              notes: null,
              createdAt: null,
              updatedAt: null,
              isTemporary: true,
            };
            
            if (updates) {
              // 複数フィールド更新の場合
              Object.assign(newTempRecord, updates);
            } else if (field && value !== undefined) {
              // 単一フィールド更新の場合
              let updateValue: any = value;
              if (field === "recordDate" && (!value || value.trim() === "")) {
                updateValue = null;
              }
              newTempRecord[field] = updateValue;
              
              // 体重入力時は自動で記録日を設定
              if (field === "weight") {
                newTempRecord.recordDate = new Date();
              }
            }
            
            updated.push(newTempRecord);
          }
          
          return updated;
        } else {
          // 既存レコード更新の場合
          return old.map((weight: any) => {
            if (weight.id === id) {
              let newWeight = { ...weight };
              
              if (updates) {
                // 複数フィールド更新の場合
                Object.assign(newWeight, updates);
              } else if (field && value !== undefined) {
                // 単一フィールド更新の場合
                let updateValue: any = value;
                // recordDateの削除時は明示的にnullを設定
                if (field === "recordDate" && (!value || value.trim() === "")) {
                  updateValue = null;
                }
                newWeight[field] = updateValue;
              }
              
              return newWeight;
            }
            return weight;
          });
        }
      });
      
      // ロールバック用のコンテキストを返す
      return { previousWeightRecords };
    },
    onError: (error: any, _, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousWeightRecords) {
        queryClient.setQueryData(["/api/weight-records"], context.previousWeightRecords);
      }
      
      console.error('Update error:', error);
      toast({
        title: "エラー",
        description: error.message || "体重記録の更新に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
    },
    onSuccess: (result, variables) => {
      if (result?.type === "create") {
        
        // 新規作成の場合：楽観的更新されたデータを維持し、IDとサーバー情報のみ更新
        queryClient.setQueryData(["/api/weight-records"], (old: any) => {
          if (!old) return old;
          
          const updated = old.map((weight: any) => {
            if (weight.id === result.tempId) {
              
              // 楽観的更新された内容を維持し、サーバーからのIDと日時情報のみ更新
              const updatedWeight = {
                ...weight, // 楽観的更新された内容を維持
                id: result.newRecord.id, // 実際のIDに更新
                createdAt: result.newRecord.createdAt, // サーバーから返された作成日時
                updatedAt: result.newRecord.updatedAt, // サーバーから返された更新日時
              };
              
              return updatedWeight;
            }
            return weight;
          });
          
          return updated;
        });
      }
      // 既存レコード更新の場合は楽観的更新のみで完了（変更不要）
    },
  });

  // 記録削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/weight-records/${id}`, "DELETE");
      return id;
    },
    onSuccess: async (deletedId) => {
      // キャッシュを完全にクリアして強制的に再取得
      queryClient.removeQueries({ queryKey: ["/api/weight-records"] });
      await queryClient.refetchQueries({ queryKey: ["/api/weight-records"] });
    },
    onError: (error: any, id) => {
      console.error(`[体重記録削除] エラー: id=${id}`, error);
      toast({
        title: "エラー",
        description: error.message || "記録の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 利用者変更用ミューテーション
  const changeResidentMutation = useMutation({
    mutationFn: async ({ weightId, newResidentId }: { weightId: string; newResidentId: string }) => {
      await apiRequest(`/api/weight-records/${weightId}`, "PATCH", {
        residentId: newResidentId
      });
    },
    // 楽観的更新で即座にUIを更新
    onMutate: async ({ weightId, newResidentId }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/weight-records"] });
      
      // 現在のデータのスナップショットを取得
      const previousWeightRecords = queryClient.getQueryData(["/api/weight-records"]);
      
      // 楽観的に更新（利用者変更）
      queryClient.setQueryData(["/api/weight-records"], (old: any) => {
        if (!old) return old;
        
        return old.map((weight: any) => {
          if (weight.id === weightId) {
            return { ...weight, residentId: newResidentId };
          }
          return weight;
        });
      });
      
      // ロールバック用のコンテキストを返す
      return { previousWeightRecords };
    },
    onError: (error: any, _, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousWeightRecords) {
        queryClient.setQueryData(["/api/weight-records"], context.previousWeightRecords);
      }
      
      console.error('Change resident error:', error);
      toast({
        title: "エラー",
        description: error.message || "利用者の変更に失敗しました",
        variant: "destructive",
      });
      
      // エラー時もサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
    },
    onSuccess: () => {
      // 成功時はサーバーから最新データを取得して確実に同期
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
    },
  });

  // 選択肢の定義
  const floorOptions = [
    { value: "全階", label: "全階" },
    { value: "1階", label: "1階" },
    { value: "2階", label: "2階" },
    { value: "3階", label: "3階" },
    { value: "4階", label: "4階" },
    { value: "5階", label: "5階" },
  ];

  // スタッフ印機能
  const handleStaffStamp = async (weightId: string, residentId?: string) => {
    const user = currentUser as any;
    // セッション職員情報があるか確認
    const staffName = user?.staffName || 
      (user?.firstName && user?.lastName
        ? `${user.lastName} ${user.firstName}`
        : user?.email || "スタッフ");

    // 現在の体重記録を取得
    const weight = filteredWeightRecords.find((w: any) => w.id === weightId);
    if (!weight) return;

    const currentStaffName = weight.staffName || "";
    
    let updateData: any = {};

    // 承認者名が空白の場合は現在時刻とスタッフ名を設定、入っている場合はクリア
    if (!currentStaffName) {
      updateData = {
        recordDate: new Date(),
        staffName: staffName
      };
    } else {
      updateData = {
        staffName: ""
      };
    }

    // 複数フィールドを一括更新
    updateMutation.mutate({
      id: weightId,
      updates: updateData,
      residentId,
    });
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
    queryClient.setQueryData(["/api/weight-records"], (old: any) => {
      if (!old) return old;
      
      // 新しい空のレコードを作成（初期値は空白に設定）
      const newEmptyRecord = {
        id: tempId,
        residentId: "", // 空の状態に設定
        recordDate: null, // 初期値：空白
        staffName: null,
        weight: null,
        notes: null,
        createdAt: null,
        updatedAt: null,
        isTemporary: true,
      };
      
      // 既存のレコードに新しい空のレコードを追加
      return [...old, newEmptyRecord];
    });
  };

  // フィルタリングロジック（楽観的更新データを考慮）
  const getFilteredWeightRecords = () => {
    // 楽観的更新データを含む最新のキャッシュから取得
    const cacheData = queryClient.getQueryData(["/api/weight-records"]) as any[];
    const currentWeightRecords = cacheData || weightRecords;
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      if (selectedFloor === "全階") return true;

      const residentFloor = resident.floor;
      if (!residentFloor) return false; // null/undefinedをフィルタアウト
      
      // 複数のフォーマットに対応した比較
      const selectedFloorNumber = selectedFloor.replace("階", "");
      
      // "1階" 形式との比較
      if (residentFloor === selectedFloor) return true;
      
      // "1" 形式との比較
      if (residentFloor === selectedFloorNumber) return true;
      
      return false;
    });

    const existingWeights = (currentWeightRecords as any[]).filter((weight: any) => {
      // recordDateがnullの場合は体重や他のデータがあるかチェック
      if (!weight.recordDate) {
        // 体重、メモ、承認者のいずれかがあれば表示対象とする
        const hasData = weight.weight || weight.notes || weight.staffName;
        return hasData;
      }
      
      try {
        const recordDate = new Date(weight.recordDate);
        if (isNaN(recordDate.getTime())) return false;
        
        const weightMonth = format(recordDate, "yyyy-MM");
        if (weightMonth !== selectedMonth) return false;
      } catch (error) {
        console.warn("Invalid recordDate in weight record:", weight.recordDate, error);
        return false;
      }

      // フロアフィルタリング（空のresidentIdの場合は通す）
      if (weight.residentId !== "") {
        const resident = filteredResidents.find(
          (r: any) => r.id === weight.residentId,
        );
        if (!resident) return false;
      }

      return true;
    });

    // すべての利用者のカードを表示
    const weightsWithEmpty = [...existingWeights];

    filteredResidents.forEach((resident: any) => {
      const hasRecord = existingWeights.some(
        (weight: any) => weight.residentId === resident.id,
      );
      if (!hasRecord) {
        // 既存の一時的なレコードから値を取得（楽観的更新データを考慮）
        const tempId = `temp-${resident.id}-${selectedMonth}`;
        const existingTempRecord = currentWeightRecords.find(
          (weight: any) => weight.id === tempId
        );
        
        const tempRecord = {
          id: tempId,
          residentId: resident.id,
          // 既存の一時的なレコードがあればその値を使用、なければ初期値
          recordDate: existingTempRecord?.recordDate || null,
          staffName: existingTempRecord?.staffName || null,
          weight: existingTempRecord?.weight || null,
          notes: existingTempRecord?.notes || null,
          createdAt: existingTempRecord?.createdAt || null,
          updatedAt: existingTempRecord?.updatedAt || null,
          isTemporary: true,
        };
        
        weightsWithEmpty.push(tempRecord);
      }
    });

    const uniqueWeights = weightsWithEmpty.reduce(
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

    return uniqueWeights;
  };

  // キャッシュデータの変更を検知するために、直接取得
  const cacheData = queryClient.getQueryData(["/api/weight-records"]) as any[];
  
  const filteredWeightRecords = useMemo(() => {
    const result = getFilteredWeightRecords().sort((a: any, b: any) => {
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
    
    return result;
  }, [residents, selectedMonth, selectedFloor, cacheData]);

  // 年月選択肢を生成（過去1年から未来6ヶ月）
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // 過去1年
    for (let i = 12; i >= 1; i--) {
      const date = subMonths(currentDate, i);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "yyyy年M月", { locale: ja }),
      });
    }
    
    // 現在月
    options.push({
      value: format(currentDate, "yyyy-MM"),
      label: format(currentDate, "yyyy年M月", { locale: ja }),
    });
    
    // 未来6ヶ月
    for (let i = 1; i <= 6; i++) {
      const date = addMonths(currentDate, i);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "yyyy年M月", { locale: ja }),
      });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams();
                const urlParams = new URLSearchParams(window.location.search);
                const selectedDate = urlParams.get('date') || format(new Date(), "yyyy-MM-dd");
                const selectedFloor = urlParams.get('floor') || 'all';
                params.set('date', selectedDate);
                params.set('floor', selectedFloor);
                const targetUrl = `/?${params.toString()}`;
                setLocation(targetUrl);
              }}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">体重一覧</h1>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
          {/* 年月選択 */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedMonth}
              options={monthOptions}
              onSave={(value) => setSelectedMonth(value)}
              placeholder="年月選択"
              className="w-20 sm:w-24 border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8"
              enableAutoFocus={false}
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
              className="w-16 sm:w-20 border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8"
              enableAutoFocus={false}
            />
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      <main className="max-w-4xl mx-auto px-2 pt-2 pb-24 space-y-2">
        {filteredWeightRecords.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <p>選択した条件の記録がありません</p>
          </div>
        ) : (
          filteredWeightRecords.map((weight: any) => (
            <WeightCard
              key={weight.id}
              weight={weight}
              residents={residents as any[]}
              selectedMonth={selectedMonth}
              inputBaseClass={inputBaseClass}
              localNotes={localNotes}
              setLocalNotes={setLocalNotes}
              localWeight={localWeight}
              setLocalWeight={setLocalWeight}
              updateMutation={updateMutation}
              handleStaffStamp={handleStaffStamp}
              deleteMutation={deleteMutation}
              changeResidentMutation={changeResidentMutation}
            />
          ))
        )}
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