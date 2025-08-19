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
import { format, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";

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
  hourOptions,
  minuteOptions,
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
  hourOptions: any[];
  minuteOptions: any[];
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
            <ResidentSelector
              weight={weight}
              residents={residents}
              onResidentChange={(weightId, residentId) => 
                changeResidentMutation.mutate({ weightId, newResidentId: residentId })
              }
            />
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
                const newValue = e.target.value;
                if (newValue !== (weight.weight?.toString() || "")) {
                  updateMutation.mutate({
                    id: weight.id,
                    field: "weight",
                    value: newValue,
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

        {/* 中段：計測日、時、分、承認者、承認アイコン */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">計測日</span>
            <input
              type="date"
              value={weight.measurementDate || ""}
              onChange={(e) => {
                updateMutation.mutate({
                  id: weight.id,
                  field: "measurementDate",
                  value: e.target.value,
                  residentId: weight.residentId,
                });
              }}
              className={`w-32 ${inputBaseClass} ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={weight.hour?.toString() || ""}
                options={hourOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: weight.id,
                    field: "hour",
                    value,
                    residentId: weight.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
                disabled={!isResidentSelected}
              />
              <span className="text-xs">:</span>
              <InputWithDropdown
                value={weight.minute?.toString() || ""}
                options={minuteOptions}
                onSave={(value) =>
                  updateMutation.mutate({
                    id: weight.id,
                    field: "minute",
                    value,
                    residentId: weight.residentId,
                  })
                }
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
                disabled={!isResidentSelected}
              />
            </div>
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
              className={`w-12 ${inputBaseClass} px-1 ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
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
            <span className="text-xs font-medium text-blue-600">記録</span>
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
                // ローカル状態をクリア
                setLocalNotes((prev) => {
                  const updated = { ...prev };
                  delete updated[weight.id];
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
              className={`flex-1 ${inputBaseClass} px-2 resize-none ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              rows={1}
              style={{ minHeight: "32px", maxHeight: "64px" }}
              disabled={!isResidentSelected}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className={`ml-1 rounded text-xs flex items-center justify-center ${
                    isResidentSelected
                      ? "bg-red-500 hover:bg-red-600 text-white"
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
                  disabled={!isResidentSelected}
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

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: weightRecords = [] } = useQuery({
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
      residentId,
    }: {
      id: string;
      field: string;
      value: string;
      residentId?: string;
    }) => {
      // 一時的なレコード（IDがtempで始まる）の場合は新規作成
      if (id.startsWith("temp-")) {
        const residentIdFromTemp = residentId || id.split("-")[1]; // temp-{residentId}-{month}から抽出
        
        // residentIdの検証
        if (!residentIdFromTemp || residentIdFromTemp === 'undefined' || residentIdFromTemp === 'null') {
          throw new Error('利用者情報が正しく設定されていません。ページを再読み込みしてください。');
        }

        const newRecordData: any = {
          residentId: residentIdFromTemp,
          recordDate: new Date(selectedMonth + "-01"),
          [field]: value,
        };

        // データ型を適切に変換
        if (field === "measurementDate") {
          newRecordData[field] = value;
        } else if (["hour", "minute"].includes(field)) {
          if (value && value.trim() !== "") {
            const intValue = parseInt(value);
            if (!isNaN(intValue)) {
              newRecordData[field] = intValue;
            }
          }
        } else if (field === "weight") {
          if (value && value.trim() !== "") {
            newRecordData[field] = value;
          }
        } else {
          // その他のフィールド（notes, staffName等）はそのまま設定
          newRecordData[field] = value;
        }

        await apiRequest("/api/weight-records", "POST", newRecordData);
      } else {
        // 既存レコードの更新
        const updateData: any = { [field]: value };
        if (field === "measurementDate") {
          updateData[field] = value;
        } else if (["hour", "minute"].includes(field)) {
          if (value && value.trim() !== "") {
            const intValue = parseInt(value);
            if (!isNaN(intValue)) {
              updateData[field] = intValue;
            }
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
        // その他のフィールド（notes, staffName等）は最初の { [field]: value } でそのまま設定される

        await apiRequest(`/api/weight-records/${id}`, "PATCH", updateData);
      }
    },
    // 楽観的更新の実装
    onMutate: async ({ id, field, value }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/weight-records"] });
      
      // 現在のデータのスナップショットを取得
      const previousWeightRecords = queryClient.getQueryData(["/api/weight-records"]);
      
      // 楽観的に更新
      queryClient.setQueryData(["/api/weight-records"], (old: any) => {
        if (!old) return old;
        
        if (id.startsWith("temp-")) {
          // 新規作成の場合：一時的なレコードを更新
          return old.map((weight: any) => {
            if (weight.id === id) {
              return { ...weight, [field]: value };
            }
            return weight;
          });
        } else {
          // 既存レコード更新の場合
          return old.map((weight: any) => {
            if (weight.id === id) {
              return { ...weight, [field]: value };
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
    onSuccess: (_, variables) => {
      // 新規作成の場合のみinvalidateを実行（一時的IDを実際のIDに置き換えるため）
      if (variables.id.startsWith("temp-")) {
        queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
      }
      // 既存レコード更新の場合は楽観的更新のみで完了（invalidateしない）
    },
  });

  // 記録削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/weight-records/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
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

  // スタッフ印機能
  const handleStaffStamp = async (weightId: string, residentId?: string) => {
    const user = currentUser as any;
    const staffName =
      user?.firstName && user?.lastName
        ? `${user.lastName} ${user.firstName}`
        : user?.email || "スタッフ";

    // 現在の体重記録を取得
    const weight = filteredWeightRecords.find((w: any) => w.id === weightId);
    if (!weight) return;

    const currentHour = weight.hour?.toString() || "";
    const currentMinute = weight.minute?.toString() || "";
    const currentStaffName = weight.staffName || "";
    
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
        id: weightId,
        field,
        value: value as string,
        residentId,
      });
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
    queryClient.setQueryData(["/api/weight-records"], (old: any) => {
      if (!old) return old;
      
      // 新しい空のレコードを作成
      const newEmptyRecord = {
        id: tempId,
        residentId: "", // 空の状態に設定
        recordDate: selectedMonth,
        measurementDate: null,
        hour: null,
        minute: null,
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

  // フィルタリングロジック
  const getFilteredWeightRecords = () => {
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

    const existingWeights = (weightRecords as any[]).filter((weight: any) => {
      const weightMonth = format(new Date(weight.recordDate), "yyyy-MM");
      if (weightMonth !== selectedMonth) return false;

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
        weightsWithEmpty.push({
          id: `temp-${resident.id}-${selectedMonth}`,
          residentId: resident.id,
          recordDate: selectedMonth,
          measurementDate: null,
          hour: null,
          minute: null,
          staffName: null,
          weight: null,
          notes: null,
          createdAt: null,
          updatedAt: null,
          isTemporary: true,
        });
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

  const filteredWeightRecords = getFilteredWeightRecords().sort((a: any, b: any) => {
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
            <h1 className="text-xl font-bold text-slate-800">体重一覧</h1>
          </div>
        </div>
      </div>

      {/* フィルタ条件 */}
      <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
        <div className="flex gap-2 sm:gap-4 items-center justify-center">
          {/* 年月選択 */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedMonth}
              options={monthOptions}
              onSave={(value) => setSelectedMonth(value)}
              placeholder="年月選択"
              className="w-24 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              enableAutoFocus={false}
            />
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      <main className="max-w-4xl mx-auto px-4 py-4 pb-24 space-y-4">
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
              hourOptions={hourOptions}
              minuteOptions={minuteOptions}
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