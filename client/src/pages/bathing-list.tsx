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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiRequest, queryClient, getEnvironmentPath } from "@/lib/queryClient";
import {
  Plus,
  Calendar,
  Building,
  User,
  Trash2,
  ArrowLeft,
  Sparkles,
  Mic,
  MicOff,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { matchFloor } from "@/lib/floorFilterUtils";
import type { MasterSetting } from "@shared/schema";

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
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  disableFocusMove = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  disableFocusMove?: boolean;
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

    // フォーカス移動が無効化されている場合はスキップ
    if (disableFocusMove) return;

    // 特定の遅延後にフォーカス移動を実行
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
  };

  return (
    <div className={`relative ${open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => !disabled && setOpen(true)}
            onClick={(e) => e.preventDefault()}
            placeholder={placeholder}
            className={`${className} ${disabled ? 'cursor-not-allowed' : ''} ${open ? '!border-blue-500' : ''} transition-all outline-none`}
            disabled={disabled}
          />
        </PopoverTrigger>
        <PopoverContent className="w-32 p-0.5" align="center">
          <div className="space-y-0 max-h-60 overflow-y-auto">
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
  existingResidentIds,
}: {
  record: any;
  residents: any[];
  onResidentChange: (recordId: string, residentId: string) => void;
  existingResidentIds?: string[];
}) {
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null);
  
  // pendingResidentIdがある場合はそれを使用、なければrecord.residentIdを使用
  const effectiveResidentId = pendingResidentId || record.residentId;
  const currentResident = residents.find((r: any) => r.id === effectiveResidentId);
  const isAllEmpty = isAllBathingFieldsEmpty(record);
  
  // 利用者選択肢（valueとlabelを名前で統一）
  const residentOptions = residents
    .filter((r: any) => {
      // 新規カード（利用者未選択）の場合のみフィルタリング
      if (!record.residentId && existingResidentIds) {
        return !existingResidentIds.includes(r.id);
      }
      // 既存カードまたは利用者選択済みの場合は全て表示
      return true;
    })
    .map((r: any) => ({
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
  
  // 追加ボタンで作成されたカード（isUserAdded: true）のみ利用者変更可能
  // 初期表示カード（入浴曜日設定ベース）は全て変更不可
  const disabled = record.isUserAdded !== true;

  return (
    <div className="font-medium text-sm truncate w-20 sm:w-32 flex-shrink-0">
      {disabled ? (
        <span className="text-slate-800">
          {currentResident?.name || "未選択"}
        </span>
      ) : (
        <InputWithDropdown
          value={currentResident?.name || ""}
          options={residentOptions}
          onSave={(selectedName) => {
            const selectedResident = residents.find((r: any) => r.name === selectedName);
            if (selectedResident) {
              handleResidentChange(selectedResident.id);
            }
          }}
          placeholder="利用者選択"
          className="h-auto min-h-[1.5rem] border-0 bg-transparent p-0 text-sm font-medium focus:ring-0 text-left w-full"
          disabled={!isAllEmpty}
          disableFocusMove={true}
        />
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
  existingResidentIds,

  handleFieldUpdate,
  handleSaveRecord,
  handleStaffStamp,
  handleAIButtonClick,
  deleteMutation,
  changeResidentMutation,
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
  existingResidentIds?: string[];

  handleFieldUpdate: (residentId: string, field: string, value: any) => void;
  handleSaveRecord: (residentId: string, field: string, value: any) => void;
  handleStaffStamp: (recordId: string, residentId?: string) => void;
  handleAIButtonClick: (resident: any, record: any) => void;
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
      handleFieldUpdate(record.id, field, value);
      if (value && value.toString().trim() !== "") {
        handleSaveRecord(record.residentId, field, value);
      }
    }
  };

  return (
    <Card className="bg-white shadow-sm" data-bathing-id={record.id}>
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
              existingResidentIds={existingResidentIds}
              onResidentChange={(recordId, residentId) => {
                changeResidentMutation.mutate({ recordId, newResidentId: residentId });
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
                  handleFieldUpdate(record.id, "hour", value);
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
                  handleFieldUpdate(record.id, "minute", value);
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
                handleFieldUpdate(record.id, "bathType", value);
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
                handleFieldUpdate(record.id, "staffName", e.target.value);
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
                  // セッション職員情報があるか確認
                  const newStaffName = user?.staffName || user?.firstName || 'スタッフ';
                  setStaffName(newStaffName);
                  handleFieldUpdate(record.id, "staffName", newStaffName);
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
                height: "24px",
                width: "24px",
                minHeight: "24px",
                minWidth: "24px",
                maxHeight: "24px",
                maxWidth: "24px",
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
                handleFieldUpdate(record.id, "temperature", value);
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
                  handleFieldUpdate(record.id, "bloodPressureSystolic", value);
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
                  handleFieldUpdate(record.id, "bloodPressureDiastolic", value);
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
                handleFieldUpdate(record.id, "pulseRate", value);
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
                handleFieldUpdate(record.id, "oxygenSaturation", value);
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
          <div className="flex items-center flex-1 gap-1">
            <NotesInput
              residentId={record.residentId}
              initialValue={notes}
              onSave={(value) => {
                handleFieldUpdate(record.id, "notes", value);
                if (value && value.trim()) {
                  handleSaveRecord(record.residentId, "notes", value);
                }
              }}
            />

            {/* AIボタン */}
            <button
              className="rounded text-xs flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white"
              style={{
                height: "24px",
                width: "24px",
                minHeight: "24px",
                minWidth: "24px",
                maxHeight: "24px",
                maxWidth: "24px",
              }}
              onClick={() => handleAIButtonClick(resident, record)}
              title="音声認識"
            >
              <Sparkles className="w-3 h-3" />
            </button>
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
                    height: "24px",
                    width: "24px",
                    minHeight: "24px",
                    minWidth: "24px",
                    maxHeight: "24px",
                    maxWidth: "24px",
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
  const dateParam = urlParams.get("date");
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  });
  // 確認ダイアログ用の状態
  const [showStaffConfirm, setShowStaffConfirm] = useState(false);
  const [pendingStaffAction, setPendingStaffAction] = useState<{
    recordId: string;
    residentId?: string;
    currentStaffName: string;
  } | null>(null);

  // 音声認識ダイアログ用の状態
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [selectedResidentForVoice, setSelectedResidentForVoice] = useState<{
    id: string;
    name: string;
    recordId: string;
  } | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const recognitionRef = useRef<any>(null);

  const [selectedFloor, setSelectedFloor] = useState(
    urlParams.get("floor") || "all"
  );

  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });
  
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
  

  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["/api/bathing-records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
  }, []);


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
        const data = await apiRequest("/api/bathing-records", "GET");

        if (Array.isArray(data)) {
          return data;
        } else if (data === null || data === undefined) {
          return [];
        } else {
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
        
        let foundMatch = false;
        // temp-で始まる一時レコードを実際のIDに置き換え
        const updated = old.map((record: any) => {
          const dateMatch = format(new Date(record.recordDate), 'yyyy-MM-dd') === format(new Date(variables.recordDate), 'yyyy-MM-dd');
          const condition = record.id?.startsWith('temp-') && 
              record.residentId === variables.residentId && 
              dateMatch;
          
          if (condition) {
            foundMatch = true;
            return { 
              ...record, 
              ...serverResponse, 
              id: serverResponse.id,
              // isUserAddedフラグを維持
              isUserAdded: record.isUserAdded || false
            };
          }
          return record;
        });
        
        // マッチする一時レコードがない場合は新規追加
        if (!foundMatch) {
          updated.push(serverResponse);
        }
        
        return updated;
      });
    },
    onError: (error: any) => {
      console.error("入浴記録作成エラー:", error);
      
      toast({
        title: "エラー",
        description: error.message || "入浴記録の作成に失敗しました。",
        variant: "destructive",
      });
      // エラー時も楽観的更新を維持（フォーカス維持のため）
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

  // フィールド更新（楽観的更新のみ）- 服薬一覧と同じパターン
  const handleFieldUpdate = (recordId: string, field: string, value: any) => {
    console.log(`Updating field ${field} for record ${recordId} with value:`, value);

    const queryKey = ["/api/bathing-records"];
    
    // 利用者変更時の特別処理（服薬一覧と同じ）
    if (field === 'residentId') {
      // 利用者情報を追加して楽観的更新
      const resident = residents?.find(r => r.id === value);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        return old.map((record: any) => 
          record.id === recordId ? {
            ...record,
            [field]: value,
            // 利用者情報も同時に更新
            residentName: resident?.name || '',
            roomNumber: resident?.roomNumber || '',
            floor: resident?.floor || ''
          } : record
        );
      });
      return;
    }
    
    // 通常のフィールド更新（服薬一覧と同じ）
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      
      return old.map((record: any) => 
        record.id === recordId ? {
          ...record,
          [field]: value === "empty" ? "" : value
        } : record
      );
    });
  };

  // 食事一覧と同じシンプルなパターンに統一（重複防止キャッシュは削除）

  // DB保存処理（食事一覧と完全に同じパターンに変更）
  const lastSaveRef = useRef<Record<string, any>>({});

  // 複数フィールドを一括保存する関数
  const handleSaveMultipleFields = (residentId: string, fields: Record<string, any>) => {
    // React Queryのキャッシュから現在のデータを取得（楽観的更新含む）
    const currentCachedData = queryClient.getQueryData(["/api/bathing-records"]) as any[] || [];
    
    // 楽観的更新を含むキャッシュから検索
    const existingRecord = currentCachedData.find((record: any) => 
      record.residentId === residentId && 
      format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
    
    // レコードデータ作成（既存の値を保持しつつ、指定されたフィールドを更新）
    const recordData = {
      residentId,
      recordDate: selectedDate,
      timing: "午前",
      hour: fields.hour !== undefined ? (fields.hour === "empty" ? "" : fields.hour) : (existingRecord?.hour || ""),
      minute: fields.minute !== undefined ? (fields.minute === "empty" ? "" : fields.minute) : (existingRecord?.minute || ""),
      staffName: fields.staffName !== undefined ? (fields.staffName === "empty" ? "" : fields.staffName) : (existingRecord?.staffName || ""),
      bathType: fields.bathType !== undefined ? (fields.bathType === "empty" ? "" : fields.bathType) : (existingRecord?.bathType || ""),
      temperature: fields.temperature !== undefined ? (fields.temperature === "empty" ? "" : fields.temperature) : (existingRecord?.temperature || ""),
      weight: existingRecord?.weight || "",
      bloodPressureSystolic: fields.bloodPressureSystolic !== undefined ? (fields.bloodPressureSystolic === "empty" ? "" : fields.bloodPressureSystolic) : (existingRecord?.bloodPressureSystolic || ""),
      bloodPressureDiastolic: fields.bloodPressureDiastolic !== undefined ? (fields.bloodPressureDiastolic === "empty" ? "" : fields.bloodPressureDiastolic) : (existingRecord?.bloodPressureDiastolic || ""),
      pulseRate: fields.pulseRate !== undefined ? (fields.pulseRate === "empty" ? "" : fields.pulseRate) : (existingRecord?.pulseRate || ""),
      oxygenSaturation: fields.oxygenSaturation !== undefined ? (fields.oxygenSaturation === "empty" ? "" : fields.oxygenSaturation) : (existingRecord?.oxygenSaturation || ""),
      notes: fields.notes !== undefined ? fields.notes : (existingRecord?.notes || ""),
    };

    // 更新/作成判定
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      createMutation.mutate(recordData);
    }

    // バイタルデータをバイタル一覧にも同時登録
    if (['temperature', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'pulseRate', 'oxygenSaturation', 'notes', 'hour', 'minute', 'staffName'].some(field => fields[field] !== undefined) && Object.values(fields).some(value => value && value !== "empty")) {
      const bathingHour = fields.hour !== undefined ? fields.hour : recordData.hour;
      
      const vitalData = {
        residentId,
        recordDate: selectedDate,
        timing: getTimingFromBathingTime(bathingHour, recordData),
        hour: fields.hour !== undefined ? (fields.hour === "empty" ? null : parseInt(fields.hour, 10)) : (recordData.hour ? parseInt(recordData.hour, 10) : null),
        minute: fields.minute !== undefined ? (fields.minute === "empty" ? null : parseInt(fields.minute, 10)) : (recordData.minute ? parseInt(recordData.minute, 10) : null),
        staffName: fields.staffName !== undefined ? (fields.staffName === "empty" ? null : fields.staffName) : recordData.staffName,
        temperature: fields.temperature !== undefined ? (fields.temperature === "empty" ? null : parseFloat(fields.temperature)) : (recordData.temperature ? parseFloat(recordData.temperature) : null),
        bloodPressureSystolic: fields.bloodPressureSystolic !== undefined ? (fields.bloodPressureSystolic === "empty" ? null : parseInt(fields.bloodPressureSystolic, 10)) : (recordData.bloodPressureSystolic ? parseInt(recordData.bloodPressureSystolic, 10) : null),
        bloodPressureDiastolic: fields.bloodPressureDiastolic !== undefined ? (fields.bloodPressureDiastolic === "empty" ? null : parseInt(fields.bloodPressureDiastolic, 10)) : (recordData.bloodPressureDiastolic ? parseInt(recordData.bloodPressureDiastolic, 10) : null),
        pulseRate: fields.pulseRate !== undefined ? (fields.pulseRate === "empty" ? null : parseInt(fields.pulseRate, 10)) : (recordData.pulseRate ? parseInt(recordData.pulseRate, 10) : null),
        oxygenSaturation: fields.oxygenSaturation !== undefined ? (fields.oxygenSaturation === "empty" ? null : parseFloat(fields.oxygenSaturation)) : (recordData.oxygenSaturation ? parseFloat(recordData.oxygenSaturation) : null),
        notes: fields.notes !== undefined ? fields.notes : recordData.notes,
      };
      
      upsertVitalMutation.mutate({ vitalData });
    }
  };

  const handleSaveRecord = (residentId: string, field: string, value: any) => {
    const saveKey = `${residentId}-${field}`;
    const lastValue = lastSaveRef.current[saveKey];
    
    // 重複防止：同じ利用者の同じフィールドで同じ値を連続して保存しない
    if (lastValue === value) {
      return;
    }
    
    lastSaveRef.current[saveKey] = value;

    // React Queryのキャッシュから現在のデータを取得（楽観的更新含む）
    const currentCachedData = queryClient.getQueryData(["/api/bathing-records"]) as any[] || [];
    
    // React Queryキャッシュからレコード検索
    
    // 楽観的更新を含むキャッシュから検索：実際のレコードを優先
    const realRecord = currentCachedData.find((record: any) => 
      record.residentId === residentId && 
      format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
      record.id && !record.id.startsWith('temp-')
    );
    
    const tempRecord = currentCachedData.find((record: any) => 
      record.residentId === residentId && 
      format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
      record.id && record.id.startsWith('temp-')
    );
    
    // 実際のレコードがあればそれを使用、なければ一時的カードを使用
    const existingRecord = realRecord || tempRecord;
    

    // 変更されたフィールドの値
    const fieldValue = value === "empty" ? "" : value;

    // recordDataの作成：更新時は変更フィールドのみ、新規作成時は全フィールド
    const recordData: any = {
      residentId,
      recordDate: selectedDate,
      timing: "午前",
    };

    if (!existingRecord || existingRecord.id?.startsWith('temp-')) {
      // 新規作成時：全フィールドを含める
      recordData.hour = field === 'hour' ? fieldValue : (existingRecord?.hour ?? "");
      recordData.minute = field === 'minute' ? fieldValue : (existingRecord?.minute ?? "");
      recordData.staffName = field === 'staffName' ? fieldValue : (existingRecord?.staffName ?? "");
      recordData.bathType = field === 'bathType' ? fieldValue : (existingRecord?.bathType ?? "");
      recordData.temperature = field === 'temperature' ? fieldValue : (existingRecord?.temperature ?? "");
      recordData.weight = field === 'weight' ? fieldValue : (existingRecord?.weight ?? "");
      recordData.bloodPressureSystolic = field === 'bloodPressureSystolic' ? fieldValue : (existingRecord?.bloodPressureSystolic ?? "");
      recordData.bloodPressureDiastolic = field === 'bloodPressureDiastolic' ? fieldValue : (existingRecord?.bloodPressureDiastolic ?? "");
      recordData.pulseRate = field === 'pulseRate' ? fieldValue : (existingRecord?.pulseRate ?? "");
      recordData.oxygenSaturation = field === 'oxygenSaturation' ? fieldValue : (existingRecord?.oxygenSaturation ?? "");
      recordData.notes = field === 'notes' ? fieldValue : (existingRecord?.notes ?? "");
    } else {
      // 更新時：変更されたフィールドのみ
      recordData[field] = fieldValue;
    }

    
    // 更新/作成判定：実際のレコードがあれば更新、なければ作成
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      // 実際のDBレコードの場合は更新API使用
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      // 一時的カードまたは新規カードの場合：サーバー側で既存レコード検索後、更新または作成
      createMutation.mutate(recordData);
    }

    // バイタルデータをバイタル一覧にも同時登録
    if (['temperature', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'pulseRate', 'oxygenSaturation', 'notes', 'hour', 'minute', 'staffName'].includes(field) && value && value !== "empty") {
      // 入浴時間からタイミングを判定（existingRecordを優先使用）
      const bathingHour = field === 'hour' ? value : (existingRecord?.hour ?? "");
      
      // existingRecordを優先してフィールド値を取得
      const getFieldValue = (fieldName: string, currentValue: any) => {
        if (field === fieldName) {
          return currentValue === "empty" ? null : currentValue;
        }
        return existingRecord?.[fieldName] ?? null;
      };
      
      const vitalData = {
        residentId,
        recordDate: selectedDate,
        timing: getTimingFromBathingTime(bathingHour, existingRecord || {}), // existingRecordを使用
        // staffIdはサーバー側で自動設定するため、フロントでは送信しない
        hour: (() => { const val = getFieldValue('hour', value); return val && val !== "" ? parseInt(val, 10) : null; })(),
        minute: (() => { const val = getFieldValue('minute', value); return val && val !== "" ? parseInt(val, 10) : null; })(),
        staffName: getFieldValue('staffName', value),
        temperature: (() => { const val = getFieldValue('temperature', value); return val && val !== "" ? parseFloat(val) : null; })(),
        bloodPressureSystolic: (() => { const val = getFieldValue('bloodPressureSystolic', value); return val && val !== "" ? parseInt(val, 10) : null; })(),
        bloodPressureDiastolic: (() => { const val = getFieldValue('bloodPressureDiastolic', value); return val && val !== "" ? parseInt(val, 10) : null; })(),
        pulseRate: (() => { const val = getFieldValue('pulseRate', value); return val && val !== "" ? parseInt(val, 10) : null; })(),
        oxygenSaturation: (() => { const val = getFieldValue('oxygenSaturation', value); return val && val !== "" ? parseFloat(val) : null; })(),
        notes: getFieldValue('notes', value),
      };
      
      // バイタル一覧にも登録
      upsertVitalMutation.mutate({ vitalData });
    }
  };


  // 利用者変更用ミューテーション
  const changeResidentMutation = useMutation({
    mutationFn: async ({ recordId, newResidentId }: { recordId: string; newResidentId: string }) => {
      // 新規カード（temp-ID）の場合はAPIを呼び出さない
      if (recordId.startsWith('temp-')) {
        return { id: recordId, residentId: newResidentId };
      }

      // 既存カードの場合のみAPIを呼び出す
      return await apiRequest(`/api/bathing-records/${recordId}`, "PATCH", {
        residentId: newResidentId
      });
    },
    // 楽観的更新で即座にUIを更新（ソート順は維持）
    onMutate: async ({ recordId, newResidentId }) => {
      const queryKey = ["/api/bathing-records"];

      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey });

      // 現在のデータのスナップショットを取得
      const previousRecords = queryClient.getQueryData(queryKey);

      // 楽観的更新（利用者変更と関連情報の更新）
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return old.map((record: any) => {
          if (record.id === recordId) {
            const resident = residents?.find((r: any) => r.id === newResidentId);
            return {
              ...record,
              residentId: newResidentId,
              residentName: resident?.name || '',
              roomNumber: resident?.roomNumber || '',
              floor: resident?.floor || ''
            };
          }
          return record;
        });
      });

      // sortedRecordsState も同様に更新（順番は変えない）
      setSortedRecordsState(prev => prev.map(record => {
        if (record.id === recordId) {
          const resident = residents?.find((r: any) => r.id === newResidentId);
          return {
            ...record,
            residentId: newResidentId,
            residentName: resident?.name || '',
            roomNumber: resident?.roomNumber || '',
            floor: resident?.floor || ''
          };
        }
        return record;
      }));

      // ロールバック用のコンテキストを返す
      return { previousRecords, recordId, queryKey };
    },
    onSuccess: (data, { recordId }) => {
      // 利用者選択後、最初の入力項目にフォーカス
      setTimeout(() => {
        const bathingCard = document.querySelector(`[data-bathing-id="${recordId}"]`);
        const firstInput = bathingCard?.querySelector('input:not([disabled]):not([placeholder="利用者選択"])');
        if (firstInput) {
          (firstInput as HTMLElement).focus();
        }
      }, 100);
    },
    onError: (error: any, _, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousRecords && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousRecords);
      }

      console.error('Change resident error:', error);
      toast({
        title: "エラー",
        description: error.message || "利用者の変更に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // 入浴記録の削除
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {

      try {
        // 一時的レコード（temp-）の場合は、サーバーAPIを呼ばずローカルデータのみ削除
        if (id && typeof id === 'string' && id.startsWith("temp-")) {
          return { success: true, isTemporary: true };
        } else {
          const result = await apiRequest(`/api/bathing-records/${id}`, "DELETE");
          return result;
        }
      } catch (error: any) {
        console.error("削除処理エラー:", error?.message || error);
        throw error; // エラーを再スローして onError ハンドラーに渡す
      }
    },
    onMutate: async (id: string) => {
      return {};
    },
    onSuccess: (data, id) => {
      // 一時的レコードかどうかを判定
      const isTemporary = id && typeof id === 'string' && id.startsWith("temp-");

      // 楽観的更新を使用しているため、成功時の無効化は不要
      // 削除完了メッセージは表示しない（静かに削除）
    },
    onError: (error: any, id, context) => {

      toast({
        title: "エラー",
        description: error?.message || "入浴記録の削除に失敗しました。",
        variant: "destructive",
      });

      // エラー時も楽観的更新を維持（フォーカス維持のため）
    },
  });

  // 入浴一覧の時分に基づいてタイミングを判定する関数
  const getTimingFromBathingTime = (hour: string | number | null, recordData: any) => {
    // 入浴記録から時間を取得（優先順位：引数のhour → recordData.hour）
    const bathingHour = hour !== null && hour !== undefined && hour !== "" 
      ? (typeof hour === 'string' ? parseInt(hour, 10) : hour)
      : (recordData.hour ? parseInt(recordData.hour, 10) : null);
    
    // 時間が設定されていない場合は現在時刻を使用
    if (bathingHour === null || isNaN(bathingHour)) {
      const currentHour = new Date().getHours();
      if (currentHour >= 6 && currentHour < 12) {
        return "午前";
      } else if (currentHour >= 12 && currentHour < 18) {
        return "午後";
      } else {
        return "臨時";
      }
    }
    
    // 入浴時間に基づいてタイミングを判定
    // 午前（6:00-11:59）、午後（12:00-17:59）、臨時（18:00-5:59）
    if (bathingHour >= 6 && bathingHour < 12) {
      return "午前";
    } else if (bathingHour >= 12 && bathingHour < 18) {
      return "午後";
    } else {
      return "臨時";
    }
  };

  const upsertVitalMutation = useMutation({
    mutationFn: async (data: { existingVitalId?: string; vitalData: any }) => {
      // 同一日時・同一利用者・同一タイミングの既存バイタル記録を検索
      const searchDate = format(data.vitalData.recordDate, 'yyyy-MM-dd');
      const startDate = `${searchDate}T00:00:00.000Z`;
      const endDate = `${searchDate}T23:59:59.999Z`;
      
      const existingVitalResponse = await apiRequest(`/api/vital-signs?residentId=${data.vitalData.residentId}&startDate=${startDate}&endDate=${endDate}`);
      const existingVitals = Array.isArray(existingVitalResponse) ? existingVitalResponse : [];
      
      // 同じタイミングの既存レコードを検索
      const existingVital = existingVitals.find((vital: any) => 
        vital.timing === data.vitalData.timing
      );

      if (existingVital) {
        return apiRequest(
          `/api/vital-signs/${existingVital.id}`,
          "PATCH",
          data.vitalData
        );
      } else {
        return apiRequest("/api/vital-signs", "POST", data.vitalData);
      }
    },
    onSuccess: () => {
      // 楽観的更新を使用しているため、成功時の無効化は不要（フォーカス維持のため）
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "バイタル記録の更新に失敗しました。",
        variant: "destructive",
      });
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

  // スタッフ印の実際の処理を実行する関数
  const executeStaffStamp = (recordId: string, residentId?: string) => {
    const user = currentUser as any;
    // セッション職員情報があるか確認
    const staffName = user?.staffName ||
      (user?.firstName && user?.lastName
        ? `${user.lastName} ${user.firstName}`
        : user?.email || "スタッフ");

    // 一時レコードの場合は、bathingRecordsから検索せずに引数から取得
    let record;
    if (recordId.startsWith('temp-')) {
      // 一時レコードの場合は基本情報のみを持つオブジェクトを作成
      record = {
        id: recordId,
        residentId: residentId,
        staffName: "",
        hour: null,
        minute: null
      };
    } else {
      // 通常レコードの場合は既存の検索ロジック
      record = bathingRecords.find((r: any) => r.id === recordId);
      if (!record) return;
    }

    const effectiveResidentId = residentId || record.residentId;

    // 利用者が選択されていない場合（初期表示カード）は、楽観的更新のみ実行
    if (!effectiveResidentId) {
        const currentStaffName = record.staffName || "";

        if (currentStaffName) {
            // 承認者名が入力済みの場合：承認者名、時、分をクリア（楽観的更新のみ）
            handleFieldUpdate(recordId, "staffName", "");
            handleFieldUpdate(recordId, "hour", null);
            handleFieldUpdate(recordId, "minute", null);
        } else {
            // 承認者名が空の場合：承認者名と現在時刻を自動入力（楽観的更新のみ）
            const currentTime = getCurrentTimeOptions();
            handleFieldUpdate(recordId, "staffName", staffName);
            handleFieldUpdate(recordId, "hour", currentTime.hour);
            handleFieldUpdate(recordId, "minute", currentTime.minute);
        }
        return;
    }

    const currentStaffName = record.staffName || "";

    if (currentStaffName) {
      // 承認者名が入力済みの場合：承認者名、時、分をクリア
      handleFieldUpdate(effectiveResidentId, "staffName", "");
      handleFieldUpdate(effectiveResidentId, "hour", null);
      handleFieldUpdate(effectiveResidentId, "minute", null);
      // 保存処理を一括で実行
      handleSaveMultipleFields(effectiveResidentId, {
        staffName: "",
        hour: "",
        minute: ""
      });
    } else {
      // 承認者名が空の場合：承認者名と現在時刻を自動入力
      const currentTime = getCurrentTimeOptions();
      handleFieldUpdate(effectiveResidentId, "staffName", staffName);
      handleFieldUpdate(effectiveResidentId, "hour", currentTime.hour);
      handleFieldUpdate(effectiveResidentId, "minute", currentTime.minute);
      // 保存処理を一括で実行
      handleSaveMultipleFields(effectiveResidentId, {
        staffName: staffName,
        hour: currentTime.hour.toString(),
        minute: currentTime.minute.toString()
      });
    }
  };

  // 音声認識の初期化とハンドラ
  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "エラー",
        description: "お使いのブラウザは音声認識に対応していません。",
        variant: "destructive",
      });
      return null;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    // 言語設定（autoの場合は日本語をデフォルトに）
    const languageCode = selectedLanguage === 'auto' ? 'ja-JP' : selectedLanguage;
    recognition.lang = languageCode;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setVoiceText(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('音声認識エラー:', event.error);
      setIsRecording(false);

      if (event.error === 'not-allowed') {
        toast({
          title: "マイクへのアクセスが拒否されました",
          description: "音声認識を使用するにはマイクへのアクセスを許可してください。",
          variant: "destructive",
        });
      } else if (event.error === 'no-speech') {
        // 音声が検出されなかった場合は特に何もしない（継続的に待機）
      } else {
        toast({
          title: "音声認識エラー",
          description: "音声認識中にエラーが発生しました。",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      console.log('音声認識が終了しました');
      // 録音状態をfalseに更新
      setIsRecording(false);
    };

    return recognition;
  };

  // 音声認識の開始/停止
  const toggleRecording = () => {
    if (isRecording) {
      // 停止
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
    } else {
      // 開始
      const recognition = initializeSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsRecording(true);
        } catch (e) {
          console.error('音声認識の開始に失敗:', e);
          toast({
            title: "エラー",
            description: "音声認識を開始できませんでした。",
            variant: "destructive",
          });
        }
      }
    }
  };

  // AIボタンクリック時の処理
  const handleAIButtonClick = (resident: any, record: any) => {
    setSelectedResidentForVoice({
      id: resident?.id || record.residentId,
      name: resident?.name || "未選択",
      recordId: record.id,
    });
    setVoiceText("");
    setVoiceDialogOpen(true);

    // ダイアログ表示後に少し待ってから自動で音声認識を開始
    setTimeout(() => {
      const recognition = initializeSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsRecording(true);
        } catch (e) {
          console.error('音声認識の自動開始に失敗:', e);
        }
      }
    }, 1000);
  };

  // AI処理の実行
  const handleAIProcess = async () => {
    if (!voiceText.trim()) {
      toast({
        title: "エラー",
        description: "処理するテキストがありません。",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // AI処理APIの呼び出し
      const response = await apiRequest('/api/ai/process-record', 'POST', {
        text: voiceText,
        prompt: `あなたは優秀な看護師兼介護士です。
他の看護師および介護士が記録した看護記録または介護記録を提示しますので、記録として
１、シンプルに
２、ふさわしい丁寧語の文章

に修正してください。記録に存在しない情報は一切追加しないでください。
もし人名が入っている場合は人名はひらがなにして、敬称は「さん」にしてください。
日本語以外の場合は、日本語に翻訳してから文章を修正してください。彼や彼女など記録の対象者を指す言葉は取り除いてください。
看護用語、介護用語の誤変換と想定される単語は看護用語、介護用語に直してください。
（例）正式畳→清拭畳
一度修正した文章を見直し、必要な場合は再度修正を行ってから返してください。`
      });

      if (response.processedText) {
        // 処理結果を記録内容に反映
        if (selectedResidentForVoice) {
          handleFieldUpdate(selectedResidentForVoice.recordId, 'notes', response.processedText);
          if (selectedResidentForVoice.id !== "未選択") {
            handleSaveRecord(selectedResidentForVoice.id, 'notes', response.processedText);
          }
        }

        // ダイアログを閉じる
        setVoiceDialogOpen(false);

        // 音声認識を停止
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        setIsRecording(false);

      }
    } catch (error) {
      console.error('AI処理エラー:', error);
      toast({
        title: "エラー",
        description: "AI処理に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ダイアログクローズ時のクリーンアップ
  const handleVoiceDialogClose = () => {
    // 音声認識を停止
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setVoiceDialogOpen(false);
    setVoiceText("");
    setSelectedResidentForVoice(null);
  };

  // スタッフ印機能（確認ダイアログ付き）
  const handleStaffStamp = (recordId: string, residentId?: string) => {
    const user = currentUser as any;
    // セッション職員情報があるか確認
    const staffName = user?.staffName ||
      (user?.firstName && user?.lastName
        ? `${user.lastName} ${user.firstName}`
        : user?.email || "スタッフ");

    // 一時レコードの場合は、bathingRecordsから検索せずに引数から取得
    let record;
    if (recordId.startsWith('temp-')) {
      // 一時レコードの場合は基本情報のみを持つオブジェクトを作成
      record = {
        id: recordId,
        residentId: residentId,
        staffName: "",
        hour: null,
        minute: null
      };
    } else {
      // 通常レコードの場合は既存の検索ロジック
      record = bathingRecords.find((r: any) => r.id === recordId);
      if (!record) return;
    }

    // 現在の記入者名を取得
    const currentStaffName = record.staffName || "";

    // 記入者が入力されていて、かつ自分以外の場合は確認
    if (currentStaffName && currentStaffName !== staffName) {
      setPendingStaffAction({
        recordId,
        residentId,
        currentStaffName
      });
      setShowStaffConfirm(true);
      return;
    }

    // それ以外は即座に実行
    executeStaffStamp(recordId, residentId);
  };

  // 新規入浴記録追加機能
  const addNewRecord = () => {
    const newTempId = `temp-empty-${Date.now()}`;
    const newRecord = {
      id: newTempId,
      residentId: null,
      recordDate: selectedDate,
      timing: "午前",
      hour: null,
      minute: null,
      staffName: "",
      bathType: "",
      temperature: "",
      weight: "",
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      pulseRate: "",
      oxygenSaturation: "",
      notes: "",
      rejectionReason: null,
      nursingCheck: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTemporary: true,
      isUserAdded: true, // 新規追加カードのフラグ
    };

    // 楽観的更新で即座に画面に空のカードを表示
    const queryKey = ["/api/bathing-records"];
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return [newRecord];
      return [...old, newRecord];
    });

    // sortedRecordsStateにも追加（最後尾に追加）
    setSortedRecordsState(prev => [...prev, newRecord]);

    // DOM更新後に新規カードの利用者選択フィールドにフォーカスを設定し、画面を一番下にスクロール
    setTimeout(() => {
      try {
        // 新規追加されたカードを探す
        const newCard = document.querySelector(`[data-bathing-id="${newTempId}"]`);
        if (newCard) {
          console.log('Found new card:', newTempId);

          // 画面を一番下にスクロール（複数の方法を試行）
          try {
            // 方法1: スムーズスクロール
            newCard.scrollIntoView({ behavior: 'smooth', block: 'end' });

            // 方法2: 画面全体を最下部にスクロール（フォールバック）
            setTimeout(() => {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 200);
          } catch (scrollError) {
            console.error('Scroll error:', scrollError);
            // 方法3: 強制的に最下部にスクロール
            window.scrollTo(0, document.body.scrollHeight);
          }

          // 利用者選択フィールド（InputWithDropdown）を探す
          const residentSelect = newCard.querySelector('[placeholder="利用者選択"]') as HTMLElement;
          if (residentSelect) {
            console.log('Focusing on new bathing card resident select:', newTempId);
            residentSelect.focus(); // フォーカス設定でプルダウンが自動表示される
          }
        } else {
          console.error('New card not found:', newTempId);
        }
      } catch (error) {
        console.error('Failed to focus on new bathing card:', error);
      }
    }, 150); // DOM更新完了を待つ時間を少し延長
  };

  // 選択日付から曜日を取得し、入浴日フィールドを判定
  const getBathDayField = useCallback((date: Date) => {
    const dayOfWeek = date.getDay();
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

  // 初期ソート済みレコードを保持（日付・フロア変更時のみ更新）
  const [sortedRecordsState, setSortedRecordsState] = useState<any[]>([]);

  // 日付やフロアが変更された時のみ再ソート
  useEffect(() => {
    if (isLoading || !bathingRecords || !residents) return;

    const bathDayField = getBathDayField(selectedDate);

    // 1. 該当日付のレコードを取得
    const todayRecords = bathingRecords.filter((record: any) => {
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      return recordDate === format(selectedDate, "yyyy-MM-dd");
    });

    // 2. 入浴日設定のある利用者から、レコードが存在しない利用者用の一時レコードを生成
    const filteredResidents = (residents as any[]).filter((resident: any) => {
      // フロアフィルタ
      if (selectedFloor !== "all") {
        if (!matchFloor(resident.floor, selectedFloor)) {
          return false;
        }
      }

      // 入浴日フィルタ（該当曜日にチェックONの利用者のみ）
      return resident[bathDayField] === true;
    });

    // レコードが存在しない利用者用の一時レコード生成
    const missingResidentRecords = filteredResidents
      .filter((resident: any) =>
        !todayRecords.some((record: any) => record.residentId === resident.id)
      )
      .map((resident: any) => ({
        id: `temp-${resident.id}`,
        residentId: resident.id,
        isTemporary: true,
        recordDate: selectedDate,
        staffName: "",
        hour: null,
        minute: null,
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
      }));

    // 3. 全レコードを統合（既存レコード + 一時レコード）
    const allRecords = [...todayRecords, ...missingResidentRecords];

    // 4. レコードをソート（居室番号順、ユーザー追加カード→最後固定）
    const sorted = allRecords.sort((a: any, b: any) => {
      // ユーザー追加カード（isUserAddedフラグ）は常に最後に表示
      const isUserAddedA = a.isUserAdded === true;
      const isUserAddedB = b.isUserAdded === true;

      if (isUserAddedA && !isUserAddedB) return 1;  // Aがユーザー追加 → 後ろ
      if (!isUserAddedA && isUserAddedB) return -1; // Bがユーザー追加 → 前
      if (isUserAddedA && isUserAddedB) {
        // 両方ユーザー追加の場合は追加順（IDベース）
        return a.id.localeCompare(b.id);
      }

      // 通常レコード同士の場合は利用者の居室番号でソート
      const residentA = residents?.find((r: any) => r.id === a.residentId);
      const residentB = residents?.find((r: any) => r.id === b.residentId);

      if (!residentA && !residentB) return 0;
      if (!residentA) return 1;
      if (!residentB) return -1;

      const roomA = parseInt(residentA.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);
      const roomB = parseInt(residentB.roomNumber?.toString().replace(/[^\d]/g, '') || "0", 10);

      return roomA - roomB;
    });

    setSortedRecordsState(sorted);
  }, [selectedDate, selectedFloor, isLoading, bathingRecords, residents, getBathDayField]);






  // 共通のスタイル
  const inputBaseClass = "text-center border rounded px-1 py-1 text-xs h-8 transition-colors focus:border-blue-500 focus:outline-none";

  // ドロップダウンオプション（マスタ設定から動的生成）
  const floorOptions = useMemo(() => {
    return floorMasterSettings
      .filter(setting => setting.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((setting) => {
        const optionValue = setting.value === "全階" ? "all" : setting.value;
        return { value: optionValue, label: setting.label };
      });
  }, [floorMasterSettings]);

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
    { value: "", label: "" },
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center justify-between w-full">
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
                  params.set('date', format(selectedDate, 'yyyy-MM-dd'));
                  params.set('floor', selectedFloor);
                  const dashboardPath = getEnvironmentPath("/");
                  const targetUrl = `${dashboardPath}?${params.toString()}`;
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
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
                data-testid="input-date"
              />
            </div>
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {floorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
          ) : sortedRecordsState.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の利用者がいません</p>
            </div>
          ) : (
            // 保存されたソート順でレンダリング
            (() => {
              // 既存カードの利用者IDリストを作成
              const existingResidentIds = sortedRecordsState
                .filter((record: any) => record.residentId)
                .map((record: any) => record.residentId);

              return sortedRecordsState.map((record: any) => {
                // bathingRecordsから最新のデータを取得（changeResidentMutationの更新を反映）
                const latestRecord = bathingRecords?.find((r: any) => r.id === record.id) || record;

                return (
                  <BathingCard
                    key={latestRecord.residentId ?
                         `${latestRecord.residentId}-${format(selectedDate, 'yyyy-MM-dd')}` :
                         latestRecord.id}
                    record={latestRecord}
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
                    existingResidentIds={existingResidentIds}
                    handleFieldUpdate={handleFieldUpdate}
                    handleSaveRecord={handleSaveRecord}
                    handleStaffStamp={handleStaffStamp}
                    handleAIButtonClick={handleAIButtonClick}
                    deleteMutation={deleteMutation}
                    changeResidentMutation={changeResidentMutation}
                  />
                );
              });
            })()
          )}
        </div>
      </main>

      {/* 記入者変更確認ダイアログ */}
      <AlertDialog open={showStaffConfirm} onOpenChange={setShowStaffConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記入者の変更確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在「{pendingStaffAction?.currentStaffName}」が記入者として登録されています。
              <br />
              この記入者をクリアしてもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowStaffConfirm(false);
              setPendingStaffAction(null);
            }}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingStaffAction) {
                executeStaffStamp(
                  pendingStaffAction.recordId,
                  pendingStaffAction.residentId
                );
              }
              setShowStaffConfirm(false);
              setPendingStaffAction(null);
            }}>
              変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 音声認識ダイアログ */}
      <Dialog open={voiceDialogOpen} onOpenChange={handleVoiceDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>音声認識</DialogTitle>
            <DialogDescription>
              音声で記録を入力できます。マイクボタンを押して話してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 言語選択 */}
            <div>
              <Label className="text-sm font-medium text-gray-700">言語</Label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRecording}
              >
                <option value="auto">🌐 自動検出</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="en-US">🇺🇸 英語</option>
                <option value="vi-VN">🇻🇳 ベトナム語</option>
                <option value="zh-CN">🇨🇳 中国語</option>
                <option value="ko-KR">🇰🇷 韓国語</option>
              </select>
            </div>

            {/* テキストエリア */}
            <div>
              <textarea
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="音声認識されたテキストがここに表示されます..."
                className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 録音状態表示 */}
            <div className="flex items-center justify-center gap-2">
              {isRecording ? (
                <div className="flex items-center gap-2 text-red-600">
                  <MicOff className="w-5 h-5 animate-pulse" />
                  <span className="text-sm">録音中...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Mic className="w-5 h-5" />
                  <span className="text-sm">待機中</span>
                </div>
              )}
            </div>

            {/* ボタン */}
            <div className="flex gap-2 justify-center">
              <Button
                onClick={toggleRecording}
                variant={isRecording ? "destructive" : "default"}
                disabled={isProcessing}
                className="min-w-[100px]"
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    停止
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    録音
                  </>
                )}
              </Button>
              <Button
                onClick={handleAIProcess}
                disabled={isProcessing || !voiceText.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? '処理中...' : '認識'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
