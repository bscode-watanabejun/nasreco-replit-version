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
    <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => !disabled && setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          data-testid={`input-dropdown-${placeholder.toLowerCase()}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-32 p-0.5" align="center">
        <div className="space-y-0 max-h-40 overflow-y-auto">
          {(options || []).map((option, index) => (
            <button
              key={index}
              className="w-full text-left px-1.5 py-0 text-xs hover:bg-slate-100 leading-tight min-h-[1.2rem] border-0 bg-transparent"
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
        <div className="flex items-center gap-1 mb-3">
          {/* 居室番号 */}
          <div className="text-lg font-bold text-blue-600 min-w-[50px]">
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
          
          {/* 区分 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">区分</span>
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
            placeholder="承認者"
            className={`w-12 ${inputBaseClass} px-1`}
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
            onClick={() =>
              handleStaffStamp(record.id, record.residentId)
            }
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
        <div className="flex items-center gap-1">
          {/* 記録 */}
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs font-medium text-blue-600">記録</span>
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

          {/* 差し戻し */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">差し戻し</span>
            <input
              type="text"
              value={record.rejectionReason || ""}
              disabled
              placeholder="--"
              className={`w-16 ${inputBaseClass} px-1 bg-gray-100 cursor-not-allowed`}
            />
          </div>

          {/* 看護チェックボックス */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">看護</span>
            <input
              type="checkbox"
              checked={record.nursingCheck || false}
              disabled
              className="cursor-not-allowed"
            />
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
      // 一時的レコード（新規作成）かどうかを判定
      if (id && typeof id === 'string' && id.startsWith("temp-")) {
        // 新規作成の場合：完全なレコードデータを構築
        const currentData = queryClient.getQueryData(["/api/bathing-records", selectedDate]) as any[];
        const currentRecord = currentData?.find((record: any) => record.id === id);
        
        if (!currentRecord) {
          console.error("一時的レコードが見つかりません", { id, currentData });
          throw new Error("一時的レコードが見つかりません");
        }

        // 必須フィールドの確認
        const finalResidentId = residentId || currentRecord.residentId;
        if (!finalResidentId || finalResidentId === "") {
          throw new Error("利用者IDが設定されていません");
        }

        // 新規作成用の完全なデータを構築
        const createData = {
          residentId: finalResidentId,
          recordDate: selectedDate, // ISO形式の日付文字列
          timing: currentRecord.timing || "午前",
          hour: currentRecord.hour || "",
          minute: currentRecord.minute || "",
          staffName: currentRecord.staffName || "",
          bathType: currentRecord.bathType || "",
          weight: currentRecord.weight || "",
          bloodPressureSystolic: currentRecord.bloodPressureSystolic || "",
          bloodPressureDiastolic: currentRecord.bloodPressureDiastolic || "",
          pulseRate: currentRecord.pulseRate || "",
          oxygenSaturation: currentRecord.oxygenSaturation || "",
          notes: currentRecord.notes || "",
          rejectionReason: currentRecord.rejectionReason || "",
          nursingCheck: currentRecord.nursingCheck || false,
          // 更新対象フィールドを上書き
          [field]: value
        };
        
        console.log("Creating bathing record with data:", createData);
        await apiRequest("/api/bathing-records", "POST", createData);
      } else {
        // 既存レコード更新の場合
        console.log("Updating existing record:", { id, field, value });
        const updateData = { [field]: value };
        await apiRequest(`/api/bathing-records/${id}`, "PATCH", updateData);
      }
    },
    // 楽観的更新の実装
    onMutate: async ({ id, field, value, residentId }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/bathing-records", selectedDate] });
      
      // 現在のデータのスナップショットを取得
      const previousBathingRecords = queryClient.getQueryData(["/api/bathing-records", selectedDate]);
      
      // 楽観的に更新
      queryClient.setQueryData(["/api/bathing-records", selectedDate], (old: any) => {
        if (!old) return old;
        
        if (id && typeof id === 'string' && id.startsWith("temp-")) {
          // 新規作成の場合：一時的なレコードを更新
          return old.map((record: any) => {
            if (record.id === id) {
              return { ...record, [field]: value };
            }
            return record;
          });
        } else {
          // 既存レコード更新の場合
          return old.map((record: any) => {
            if (record.id === id) {
              return { ...record, [field]: value };
            }
            return record;
          });
        }
      });
      
      // ロールバック用のコンテキストを返す
      return { previousBathingRecords };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousBathingRecords) {
        queryClient.setQueryData(["/api/bathing-records", selectedDate], context.previousBathingRecords);
      }
      
      console.error('Update error:', error);
      toast({
        title: "エラー",
        description: error.message || "入浴記録の更新に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
    onSuccess: (data, variables) => {
      // 新規作成の場合のみinvalidateを実行（一時的IDを実際のIDに置き換えるため）
      if (variables.id && typeof variables.id === 'string' && variables.id.startsWith("temp-")) {
        queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      }
      // 既存レコード更新の場合は楽観的更新のみで完了（invalidateしない）
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
    mutationFn: async ({ recordId, newResidentId }: { recordId: string; newResidentId: string }) => {
      await apiRequest(`/api/bathing-records/${recordId}`, "PATCH", {
        residentId: newResidentId
      });
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
            return { ...record, residentId: newResidentId };
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
    onSuccess: () => {
      // 成功時はサーバーから最新データを取得して確実に同期
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
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

  // 新しい入浴記録の追加（空のカードを最下部に追加）
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
      
      // 新しい空のレコードを作成（文字列型で統一）
      const newEmptyRecord = {
        id: tempId,
        residentId: residentList[0]?.id, // 最初の利用者を自動選択
        recordDate: selectedDate, // YYYY-MM-DD形式
        timing: "午前",
        hour: "",
        minute: "",
        staffName: "",
        bathType: "",
        weight: "",
        bloodPressureSystolic: "",
        bloodPressureDiastolic: "",
        pulseRate: "",
        oxygenSaturation: "",
        notes: "",
        rejectionReason: "",
        nursingCheck: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTemporary: true,
      };
      
      // 既存のレコードに新しい空のレコードを追加
      return [...old, newEmptyRecord];
    });
  };

  // フィルタリングロジック
  const getFilteredBathingRecords = () => {
    if (!residents || !Array.isArray(residents)) {
      return [];
    }
    
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

    const existingRecords = (Array.isArray(bathingRecords) ? bathingRecords : []).filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      if (recordDate !== selectedDate) return false;

      // フロアフィルタリング（空のresidentIdの場合は通す）
      if (record.residentId !== "") {
        const resident = filteredResidents.find(
          (r: any) => r.id === record.residentId,
        );
        if (!resident) return false;
      }

      return true;
    });

    // 当日以前の日付の場合、すべての利用者のカードを表示
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDateObj <= today) {
      const recordsWithEmpty = [...existingRecords];

      filteredResidents.forEach((resident: any) => {
        const hasRecord = existingRecords.some(
          (record: any) => record.residentId === resident.id,
        );
        if (!hasRecord) {
          recordsWithEmpty.push({
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
          });
        }
      });

      return recordsWithEmpty;
    }

    return existingRecords;
  };

  const filteredBathingRecords = useMemo(() => {
    if (!residents || !Array.isArray(residents)) {
      return [];
    }
    return getFilteredBathingRecords().sort((a: any, b: any) => {
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
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
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

        {/* フィルター */}
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
      </div>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6 pb-24">
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
      <div className="fixed bottom-0 left-0 right-0 bg-orange-50 p-4 flex justify-end">
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