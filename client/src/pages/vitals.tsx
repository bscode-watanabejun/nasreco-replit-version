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

// 記録内容用のIME対応textareaコンポーネント（入浴一覧と同じ）
function NotesInput({
  initialValue,
  onSave,
  disabled = false,
  className = "",
}: {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  className?: string;
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
      className={`w-full min-w-0 border rounded px-2 py-1 text-xs resize-none text-left align-top transition-colors focus:border-blue-500 focus:outline-none ${className}`}
      rows={1}
      style={{ minHeight: "32px", maxHeight: "64px", overflow: "auto" }}
      disabled={disabled}
    />
  );
}

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
  
  // 利用者選択肢（valueとlabelを名前で統一、居室番号順にソート）
  const residentOptions = residents
    .sort((a: any, b: any) => {
      const roomA = parseInt(a.roomNumber || "0");
      const roomB = parseInt(b.roomNumber || "0");
      return roomA - roomB;
    })
    .map((r: any) => ({
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
  useEffect(() => {
    if (pendingResidentId && vital.residentId === pendingResidentId) {
      // サーバーからの更新でresidentIdが正しく反映されたらローカル状態をクリア
      setPendingResidentId(null);
    }
  }, [vital.residentId, pendingResidentId]);

  // vital.residentIdが外部から変更された場合、ローカル状態をリセット
  useEffect(() => {
    setPendingResidentId(null);
  }, [vital.id, vital.residentId]);

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
  localBloodSugar,
  setLocalBloodSugar,
  updateMutation,
  handleFieldUpdate,
  handleSaveRecord,
  handleStaffStamp,
  deleteMutation,
  changeResidentMutation,
  createMutation,
  selectedDate,
  currentUser,
  onAIButtonClick,
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
  localBloodSugar: Record<string, string>;
  setLocalBloodSugar: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateMutation: any;
  handleFieldUpdate: (vitalId: string, field: string, value: string) => void;
  handleSaveRecord: (vitalId: string, field: string, value: string) => void;
  handleStaffStamp: (vitalId: string, residentId?: string) => void;
  deleteMutation: any;
  changeResidentMutation: any;
  createMutation: any;
  selectedDate: Date;
  currentUser: any;
  onAIButtonClick: (vital: any) => void;
}) {
  const resident = residents.find((r: any) => r.id === vital.residentId);
  
  // 利用者が選択されているかチェック
  const isResidentSelected = vital.residentId && vital.residentId !== "";

  return (
    <Card className="bg-white shadow-sm" data-vital-id={vital.id}>
      <CardContent className="p-3">
        {/* ヘッダー：居室番号、利用者名、時間、記入者 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <div className="text-lg font-bold text-blue-600 min-w-[50px]">
              {resident?.roomNumber || "未設定"}
            </div>
            {/* 新規カード（residentId空）の場合は選択可能、既存カードは表示のみ */}
            {!vital.residentId || vital.residentId === "" ? (
              <ResidentSelector
                vital={vital}
                residents={residents}
                onResidentChange={(vitalId, residentId) => {
                  changeResidentMutation.mutate({ vitalId, newResidentId: residentId });
                }}
              />
            ) : (
              <div className="font-medium text-sm truncate w-20 sm:w-24">
                <span className="text-slate-800">
                  {resident?.name || "未選択"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="bg-slate-100 px-1 py-1 rounded text-xs">
              {selectedTiming}
            </span>
            <div className="flex items-center gap-0.5">
              <InputWithDropdown
                value={vital.hour?.toString() || ""}
                options={hourOptions}
                onSave={(value) => {
                  handleFieldUpdate(vital.id, "hour", value);
                  if (value && value !== "") {
                    handleSaveRecord(vital.id, "hour", value);
                  }
                }}
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
                disabled={!isResidentSelected}
              />
              <span className="text-xs">:</span>
              <InputWithDropdown
                value={vital.minute?.toString() || ""}
                options={minuteOptions}
                onSave={(value) => {
                  handleFieldUpdate(vital.id, "minute", value);
                  if (value && value !== "") {
                    handleSaveRecord(vital.id, "minute", value);
                  }
                }}
                placeholder="--"
                className={`w-8 ${inputBaseClass}`}
                disabled={!isResidentSelected}
              />
            </div>
            <input
              type="text"
              value={vital.staffName || ""}
              onChange={(e) =>
                updateMutation.mutate({
                  id: vital.id,
                  data: { staffName: e.target.value }
                })
              }
              onClick={(e) => {
                const currentValue = e.currentTarget.value;
                if (!currentValue.trim() && isResidentSelected) {
                  const user = currentUser as any;
                  // セッション職員情報があるか確認
                  const newStaffName = user?.staffName || user?.firstName || 'スタッフ';
                  handleFieldUpdate(vital.id, "staffName", newStaffName);
                  handleSaveRecord(vital.id, "staffName", newStaffName);
                }
              }}
              placeholder="記入者"
              className={`w-12 ${inputBaseClass} px-1 ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
            <button
              className="rounded text-xs flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
              style={{
                height: "24px",
                width: "24px",
                minHeight: "24px",
                minWidth: "24px",
                maxHeight: "24px",
                maxWidth: "24px",
              }}
              onClick={() => handleStaffStamp(vital.id, vital.residentId)}
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
              onSave={(value) => {
                handleFieldUpdate(vital.id, "temperature", value);
                if (value && value !== "") {
                  handleSaveRecord(vital.id, "temperature", value);
                }
              }}
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
              disabled={!isResidentSelected}
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
                onSave={(value) => {
                  handleFieldUpdate(vital.id, "bloodPressureSystolic", value);
                  if (value && value !== "") {
                    handleSaveRecord(vital.id, "bloodPressureSystolic", value);
                  }
                }}
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
                disabled={!isResidentSelected}
              />
              <span className="text-xs">/</span>
              <InputWithDropdown
                value={vital.bloodPressureDiastolic?.toString() || ""}
                options={diastolicBPOptions}
                onSave={(value) => {
                  handleFieldUpdate(vital.id, "bloodPressureDiastolic", value);
                  if (value && value !== "") {
                    handleSaveRecord(vital.id, "bloodPressureDiastolic", value);
                  }
                }}
                placeholder="--"
                className={`w-10 ${inputBaseClass}`}
                disabled={!isResidentSelected}
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
              onSave={(value) => {
                handleFieldUpdate(vital.id, "pulseRate", value);
                if (value && value !== "") {
                  handleSaveRecord(vital.id, "pulseRate", value);
                }
              }}
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
              disabled={!isResidentSelected}
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
              onSave={(value) => {
                handleFieldUpdate(vital.id, "oxygenSaturation", value);
                if (value && value !== "") {
                  handleSaveRecord(vital.id, "oxygenSaturation", value);
                }
              }}
              placeholder="--"
              className={`w-12 ${inputBaseClass}`}
              disabled={!isResidentSelected}
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
              inputMode="numeric"
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
                  // 新規レコードか既存レコードかを判定
                  if (vital.id?.startsWith('temp-')) {
                    // 新規レコード作成
                    const recordData = {
                      residentId: vital.residentId,
                      recordDate: vital.recordDate || selectedDate,
                      timing: selectedTiming,
                      hour: vital.hour || null,
                      minute: vital.minute || null,
                      staffName: vital.staffName || null,
                      temperature: vital.temperature || null,
                      bloodPressureSystolic: vital.bloodPressureSystolic || null,
                      bloodPressureDiastolic: vital.bloodPressureDiastolic || null,
                      pulseRate: vital.pulseRate || null,
                      respirationRate: vital.respirationRate || null,
                      oxygenSaturation: vital.oxygenSaturation || null,
                      bloodSugar: newValue === '' ? null : newValue,
                      notes: vital.notes || null,
                    };
                    createMutation.mutate(recordData);
                  } else {
                    // 既存レコード更新
                    updateMutation.mutate({
                      id: vital.id,
                      data: { bloodSugar: newValue === '' ? null : newValue }
                    });
                  }
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
              className={`w-12 ${inputBaseClass} ${!isResidentSelected ? 'cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!isResidentSelected}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-blue-600">
              呼吸
            </span>
            <InputWithDropdown
              value={vital.respirationRate?.toString() || ""}
              options={respirationOptions}
              onSave={(value) => {
                handleFieldUpdate(vital.id, "respirationRate", value);
                if (value && value !== "") {
                  handleSaveRecord(vital.id, "respirationRate", value);
                }
              }}
              placeholder="--"
              className={`w-8 ${inputBaseClass}`}
              disabled={!isResidentSelected}
            />
          </div>

          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-xs font-medium text-blue-600 flex-shrink-0">
              記録
            </span>
            <div className="flex-1 min-w-0 max-w-[calc(100%-80px)]">
              <NotesInput
                initialValue={vital.notes || ""}
                onSave={(newValue) => {
                  if (newValue !== (vital.notes || "")) {
                    updateMutation.mutate({
                      id: vital.id,
                      data: { notes: newValue }
                    });
                  }
                }}
                disabled={!isResidentSelected}
              />
            </div>

            {/* AIボタン */}
            <button
              className="rounded text-xs flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
              style={{
                height: "24px",
                width: "24px",
                minHeight: "24px",
                minWidth: "24px",
                maxHeight: "24px",
                maxWidth: "24px",
              }}
              onClick={() => onAIButtonClick(vital)}
              title="音声認識"
              disabled={!isResidentSelected}
            >
              <Sparkles className="w-3 h-3" />
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className={`ml-1 rounded text-xs flex items-center justify-center flex-shrink-0 ${
                    isResidentSelected
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                  style={{
                    height: "24px",
                    width: "24px",
                    minHeight: "24px",
                    minWidth: "24px",
                    maxHeight: "24px",
                    maxWidth: "24px",
                  }}
                  disabled={!isResidentSelected}
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
  const [localBloodSugar, setLocalBloodSugar] = useState<Record<string, string>>({});

  // 確認ダイアログ用の状態
  const [showStaffConfirm, setShowStaffConfirm] = useState(false);
  const [pendingStaffAction, setPendingStaffAction] = useState<{
    vitalId: string;
    residentId?: string;
    currentStaffName: string;
  } | null>(null);

  // 音声認識ダイアログ用の状態
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [selectedResidentForVoice, setSelectedResidentForVoice] = useState<{
    id: string;
    name: string;
    vitalId: string;
  } | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const recognitionRef = useRef<any>(null);

  // 共通スタイル定数
  const inputBaseClass =
    "h-8 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  // URLパラメータから日付と時間帯、フロアの初期値を取得
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
  const [selectedTiming, setSelectedTiming] = useState(
    urlParams.get("timing") || (new Date().getHours() < 12 ? "午前" : "午後"),
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

  const { data: vitalSigns = [] } = useQuery({
    queryKey: ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDate) {
        const date = new Date(selectedDate);
        const startDate = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const endDate = new Date(date.setHours(23, 59, 59, 999)).toISOString();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      return await apiRequest(`/api/vital-signs?${params.toString()}`);
    },
    enabled: !!selectedDate,
    staleTime: 0, // 常に最新データを取得
    refetchOnMount: true, // マウント時に必ず再取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // 楽観的更新内でレコード統合を行う関数（食事画面と同じパターン）
  const handleFieldUpdate = (vitalId: string, field: string, value: string) => {
    // 現在のバイタルから利用者IDを取得
    const currentVital = filteredVitalSigns.find((v: any) => v.id === vitalId);
    if (!currentVital?.residentId) return;

    const residentId = currentVital.residentId;
    const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
    
    // 楽観的更新（食事画面と同じパターン）
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      
      // 既存のレコードを探す
      let existingIndex = -1;

      if (selectedTiming === "臨時") {
        // 臨時の場合：同じ利用者・日付・時間帯・時刻のレコードを検索
        // currentVitalの時刻も含めて検索
        const currentVital = old.find((record: any) => record.id === vitalId);
        if (currentVital) {
          existingIndex = old.findIndex((record: any) =>
            record.residentId === residentId &&
            record.timing === selectedTiming &&
            format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
            record.hour === currentVital.hour &&
            record.minute === currentVital.minute
          );
        }
      } else {
        // 午前・午後の場合：従来通り（同じ利用者・日付・時間帯）
        existingIndex = old.findIndex((record: any) =>
          record.residentId === residentId &&
          record.timing === selectedTiming &&
          format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
        );
      }
      
      if (existingIndex >= 0) {
        // 既存レコードを更新
        const updated = [...old];
        const fieldMapping: Record<string, string> = {
          'hour': 'hour',
          'minute': 'minute',
          'temperature': 'temperature',
          'bloodPressureSystolic': 'bloodPressureSystolic',
          'bloodPressureDiastolic': 'bloodPressureDiastolic',
          'pulseRate': 'pulseRate',
          'respirationRate': 'respirationRate',
          'oxygenSaturation': 'oxygenSaturation',
          'bloodSugar': 'bloodSugar',
          'staffName': 'staffName',
          'notes': 'notes'
        };
        
        const dbField = fieldMapping[field] || field;
        updated[existingIndex] = {
          ...updated[existingIndex],
          [dbField]: value === "" ? null : value
        };
        return updated;
      } else {
        // 新規レコードを追加
        const newRecord = {
          id: `temp-${Date.now()}`,
          residentId,
          recordDate: selectedDate,
          timing: selectedTiming,
          hour: field === 'hour' ? (value === '' ? null : parseInt(value)) : null,
          minute: field === 'minute' ? (value === '' ? null : parseInt(value)) : null,
          staffName: field === 'staffName' ? value : null,
          temperature: field === 'temperature' ? (value === '' ? null : parseFloat(value)) : null,
          bloodPressureSystolic: field === 'bloodPressureSystolic' ? (value === '' ? null : parseInt(value)) : null,
          bloodPressureDiastolic: field === 'bloodPressureDiastolic' ? (value === '' ? null : parseInt(value)) : null,
          pulseRate: field === 'pulseRate' ? (value === '' ? null : parseInt(value)) : null,
          respirationRate: field === 'respirationRate' ? (value === '' ? null : parseInt(value)) : null,
          oxygenSaturation: field === 'oxygenSaturation' ? (value === '' ? null : parseFloat(value)) : null,
          bloodSugar: field === 'bloodSugar' ? (value === '' ? null : parseFloat(value)) : null,
          notes: field === 'notes' ? value : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return [...old, newRecord];
      }
    });
  };

  // 手動でDB保存を実行する関数（食事画面と同じシンプル方式）
  const handleSaveRecord = (vitalId: string, field: string, value: string) => {
    // 現在のバイタルレコードを取得
    const currentVital = filteredVitalSigns.find((v: any) => v.id === vitalId);
    
    if (!currentVital || !currentVital.residentId) {
      return; // 利用者が未選択の場合は何もしない
    }

    // 既存レコードを検索
    let existingRecord = null;

    if (selectedTiming === "臨時") {
      // 臨時の場合：同じ利用者・日付・時間帯・時刻のレコードを検索
      existingRecord = filteredVitalSigns.find((v: any) =>
        v.residentId === currentVital.residentId &&
        v.timing === selectedTiming &&
        format(new Date(v.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
        v.hour === currentVital.hour &&
        v.minute === currentVital.minute &&
        !v.id.startsWith('temp-') // 実IDのレコードのみ
      );
    } else {
      // 午前・午後の場合：従来通り
      existingRecord = filteredVitalSigns.find((v: any) =>
        v.residentId === currentVital.residentId &&
        v.timing === selectedTiming &&
        format(new Date(v.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
        !v.id.startsWith('temp-') // 実IDのレコードのみ
      );
    }

    // 全フィールドを保持して、対象フィールドのみ更新
    const recordData: any = {
      residentId: currentVital.residentId,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
      hour: existingRecord?.hour || currentVital.hour || null,
      minute: existingRecord?.minute || currentVital.minute || null,
      staffName: existingRecord?.staffName || currentVital.staffName || null,
      temperature: existingRecord?.temperature || currentVital.temperature || null,
      bloodPressureSystolic: existingRecord?.bloodPressureSystolic || currentVital.bloodPressureSystolic || null,
      bloodPressureDiastolic: existingRecord?.bloodPressureDiastolic || currentVital.bloodPressureDiastolic || null,
      pulseRate: existingRecord?.pulseRate || currentVital.pulseRate || null,
      respirationRate: existingRecord?.respirationRate || currentVital.respirationRate || null,
      oxygenSaturation: existingRecord?.oxygenSaturation || currentVital.oxygenSaturation || null,
      bloodSugar: existingRecord?.bloodSugar || currentVital.bloodSugar || null,
      notes: existingRecord?.notes || currentVital.notes || null,
    };

    // フィールドを更新（食事画面と同じパターン）
    if (field === 'hour') {
      recordData.hour = value === '' ? null : parseInt(value);
    } else if (field === 'minute') {
      recordData.minute = value === '' ? null : parseInt(value);
    } else if (field === 'staffName') {
      recordData.staffName = value;
    } else if (field === 'temperature') {
      recordData.temperature = value === '' ? null : parseFloat(value);
    } else if (field === 'bloodPressureSystolic') {
      recordData.bloodPressureSystolic = value === '' ? null : parseInt(value);
    } else if (field === 'bloodPressureDiastolic') {
      recordData.bloodPressureDiastolic = value === '' ? null : parseInt(value);
    } else if (field === 'pulseRate') {
      recordData.pulseRate = value === '' ? null : parseInt(value);
    } else if (field === 'respirationRate') {
      recordData.respirationRate = value === '' ? null : parseInt(value);
    } else if (field === 'oxygenSaturation') {
      recordData.oxygenSaturation = value === '' ? null : parseFloat(value);
    } else if (field === 'bloodSugar') {
      recordData.bloodSugar = value === '' ? null : value;
    } else if (field === 'notes') {
      recordData.notes = value;
    }

    // insert/update判定（食事画面と同じロジック）
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      // 既存レコードの更新
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      // 新規レコード作成
      createMutation.mutate(recordData);
    }
  };

  // 新規記録作成用ミューテーション（食事画面と同じパターン）
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/vital-signs', 'POST', data);
    },
    onMutate: async (newData) => {
      const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
      const previousData = queryClient.getQueryData(queryKey);
      return { previousData };
    },
    onSuccess: (serverResponse, variables, context) => {
      // 食事画面と同じシンプルなパターン：tempIdのレコードを実際のIDに置き換えるのみ
      const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        // tempIdのレコードを実際のIDに置き換え
        return old.map((record: any) => {
          if (record.id?.startsWith('temp-') &&
              record.residentId === variables.residentId &&
              record.timing === variables.timing) {
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
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      toast({
        title: "エラー",
        description: error.message || "記録の作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // 記録更新用ミューテーション（食事画面と同じパターン）
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/vital-signs/${id}`, 'PATCH', data);
    },
    onMutate: async ({ id, data }) => {
      const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
      const previousData = queryClient.getQueryData(queryKey);
      
      // 楽観的更新実行
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((record: any) => {
          if (record.id === id) {
            return { ...record, ...data };
          }
          return record;
        });
      });
      
      return { previousData };
    },
    onSuccess: () => {
      // 楽観的更新を使用しているため、成功時の無効化は不要
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      toast({
        title: "エラー",
        description: error.message || "記録の更新に失敗しました。",
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
      // 新規カード（temp-ID）の場合はAPIを呼び出さない
      if (vitalId.startsWith('temp-')) {
        return { id: vitalId, residentId: newResidentId };
      }

      // 既存カードの場合のみAPIを呼び出す
      await apiRequest(`/api/vital-signs/${vitalId}`, "PATCH", {
        residentId: newResidentId
      });
    },
    // 楽観的更新で即座にUIを更新
    onMutate: async ({ vitalId, newResidentId }) => {
      // 正しいクエリキーを使用
      const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];

      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey });

      // 現在のデータのスナップショットを取得
      const previousVitalSigns = queryClient.getQueryData(queryKey);

      // 楽観的に更新（利用者変更）
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return old.map((vital: any) => {
          if (vital.id === vitalId) {
            return { ...vital, residentId: newResidentId };
          }
          return vital;
        });
      });

      // ロールバック用のコンテキストを返す
      return { previousVitalSigns, vitalId, queryKey };
    },
    onSuccess: (data, { vitalId }) => {
      // 利用者選択後、最初の入力項目（時間）に自動フォーカス
      setTimeout(() => {
        const vitalCard = document.querySelector(`[data-vital-id="${vitalId}"]`);
        const firstInput = vitalCard?.querySelector('input:not([disabled])');
        if (firstInput) {
          (firstInput as HTMLElement).focus();
        }
      }, 100);
    },
    onError: (error: any, _, context) => {
      // エラー時に前の状態に戻す（正しいクエリキーを使用）
      if (context?.previousVitalSigns && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousVitalSigns);
      }

      console.error('Change resident error:', error);
      toast({
        title: "エラー",
        description: error.message || "利用者の変更に失敗しました",
        variant: "destructive",
      });

      // エラー時もサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')] });
    },
  });

  // 選択肢の定義
  const timingOptions = [
    { value: "午前", label: "午前" },
    { value: "午後", label: "午後" },
    { value: "臨時", label: "臨時" },
  ];

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

  // スタッフ印の実際の処理を実行する関数
  const executeStaffStamp = async (vitalId: string, residentId?: string) => {
    const user = currentUser as any;
    // セッション職員情報があるか確認
    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';

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
      // 楽観的更新を先に実行
      handleFieldUpdate(vital.id, "hour", currentHourStr);
      handleFieldUpdate(vital.id, "minute", currentMinuteStr);
      handleFieldUpdate(vital.id, "staffName", staffName);

      updateData = {
        hour: currentHourStr,
        minute: currentMinuteStr,
        staffName: staffName
      };
    }
    // 時分が空白で承認者名が入っている場合
    else if (!currentHour && !currentMinute && currentStaffName) {
      // 楽観的更新を先に実行
      handleFieldUpdate(vital.id, "staffName", "");

      updateData = {
        staffName: ""
      };
    }
    // 時分が入っていて、承認者名が空白の場合
    else if ((currentHour || currentMinute) && !currentStaffName) {
      // 楽観的更新を先に実行
      handleFieldUpdate(vital.id, "hour", currentHourStr);
      handleFieldUpdate(vital.id, "minute", currentMinuteStr);
      handleFieldUpdate(vital.id, "staffName", staffName);

      updateData = {
        hour: currentHourStr,
        minute: currentMinuteStr,
        staffName: staffName
      };
    }
    // 時分と承認者名の両方が入っている場合
    else if ((currentHour || currentMinute) && currentStaffName) {
      // 楽観的更新を先に実行
      handleFieldUpdate(vital.id, "hour", "");
      handleFieldUpdate(vital.id, "minute", "");
      handleFieldUpdate(vital.id, "staffName", "");

      updateData = {
        hour: "",
        minute: "",
        staffName: ""
      };
    }

    // 新規カードか既存カードかを判定
    if (vitalId?.startsWith('temp-')) {
      // 新規カードの場合：createMutationを使用
      const recordData = {
        residentId: residentId || vital.residentId,
        recordDate: vital.recordDate || new Date(selectedDate),
        timing: selectedTiming,
        hour: updateData.hour !== undefined ? (updateData.hour === "" ? null : parseInt(updateData.hour)) : vital.hour,
        minute: updateData.minute !== undefined ? (updateData.minute === "" ? null : parseInt(updateData.minute)) : vital.minute,
        staffName: updateData.staffName !== undefined ? updateData.staffName : vital.staffName,
        temperature: vital.temperature || null,
        bloodPressureSystolic: vital.bloodPressureSystolic || null,
        bloodPressureDiastolic: vital.bloodPressureDiastolic || null,
        pulseRate: vital.pulseRate || null,
        respirationRate: vital.respirationRate || null,
        oxygenSaturation: vital.oxygenSaturation || null,
        bloodSugar: vital.bloodSugar || null,
        notes: vital.notes || null,
      };
      createMutation.mutate(recordData);
    } else {
      // 既存カードの場合：updateMutationを使用
      updateMutation.mutate({
        id: vitalId,
        data: updateData
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
          handleFieldUpdate(selectedResidentForVoice.vitalId, 'notes', response.processedText);
          if (selectedResidentForVoice.id !== "未選択") {
            handleSaveRecord(selectedResidentForVoice.vitalId, 'notes', response.processedText);
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
        description: "AI処理中にエラーが発生しました。",
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

  const handleStaffStamp = async (vitalId: string, residentId?: string) => {
    const user = currentUser as any;
    // セッション職員情報があるか確認
    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';

    // 現在のバイタル記録を取得
    const vital = filteredVitalSigns.find((v: any) => v.id === vitalId);
    if (!vital) return;

    const currentStaffName = vital.staffName || "";

    // 記入者が入力されていて、かつ自分以外の場合は確認
    if (currentStaffName && currentStaffName !== staffName) {
      setPendingStaffAction({
        vitalId,
        residentId,
        currentStaffName
      });
      setShowStaffConfirm(true);
      return;
    }

    // それ以外は即座に実行
    executeStaffStamp(vitalId, residentId);
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

    // 楽観的更新で空のカードを即座に追加（正しいクエリキーを使用）
    const queryKey = ["/api/vital-signs", format(selectedDate, 'yyyy-MM-dd')];
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;

      // 新しい空のレコードを作成
      const newEmptyRecord = {
        id: tempId,
        residentId: "", // 空の状態に設定
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
        isUserAdded: true, // 新規追加カードのフラグ
      };

      // 既存のレコードに新しい空のレコードを追加
      return [...old, newEmptyRecord];
    });

    // DOM更新後に新規カードの利用者選択フィールドにフォーカスを設定し、画面を一番下にスクロール
    setTimeout(() => {
      try {
        // 新規追加されたカードを探す
        const newCard = document.querySelector(`[data-vital-id="${tempId}"]`);
        if (newCard) {
          console.log('Found new card:', tempId);

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

          // 利用者選択フィールド（Select コンポーネント）を探す
          const residentSelect = newCard.querySelector('[placeholder="利用者選択"]') as HTMLElement;
          if (residentSelect) {
            console.log('Focusing on new vital card resident select:', tempId);
            residentSelect.focus(); // フォーカス設定でプルダウンが自動表示される
          }
        } else {
          console.error('New card not found:', tempId);
        }
      } catch (error) {
        console.error('Failed to focus on new vital card:', error);
      }
    }, 150); // DOM更新完了を待つ時間を他画面と同じ150msに調整
  };

  // フィルタリングロジック
  const getFilteredVitalSigns = () => {
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

    const existingVitals = (vitalSigns as any[]).filter((vital: any) => {
      const vitalDate = format(new Date(vital.recordDate), "yyyy-MM-dd");
      if (vitalDate !== format(selectedDate, "yyyy-MM-dd")) return false;

      if (vital.timing !== selectedTiming) return false;

      // フロアフィルタリング（空のresidentIdの場合は通す）
      if (vital.residentId !== "") {
        const resident = filteredResidents.find(
          (r: any) => r.id === vital.residentId,
        );
        if (!resident) return false;
      }

      return true;
    });

    // 当日以前の日付の場合、すべての利用者のカードを表示（臨時時間帯は除く）
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDateObj <= today && selectedTiming !== "臨時") {
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
    // ユーザー追加カード（isUserAddedフラグ）は常に最後に表示
    const isUserAddedA = a.isUserAdded === true;
    const isUserAddedB = b.isUserAdded === true;

    if (isUserAddedA && !isUserAddedB) return 1;  // Aがユーザー追加 → 後ろ
    if (!isUserAddedA && isUserAddedB) return -1; // Bがユーザー追加 → 前
    if (isUserAddedA && isUserAddedB) {
      // 両方ユーザー追加の場合は追加順（IDベース）
      return a.id.localeCompare(b.id);
    }

    // 新規カード（residentIdが空）は一番下に表示
    const isANew = !a.residentId;
    const isBNew = !b.residentId;

    if (isANew && !isBNew) return 1;  // aが新規カードならbの後
    if (!isANew && isBNew) return -1; // bが新規カードならaの前
    if (isANew && isBNew) return 0;   // 両方新規カードなら順序維持

    // 実レコード同士のみ部屋番号でソート
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('date', format(selectedDate, 'yyyy-MM-dd'));
                params.set('floor', selectedFloor === "全階" ? "all" : selectedFloor.replace("階", ""));
                const dashboardPath = getEnvironmentPath("/");
                const targetUrl = `${dashboardPath}?${params.toString()}`;
                setLocation(targetUrl);
              }}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">バイタル一覧</h1>
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
            />
          </div>

          {/* 時間選択 */}
          <div className="flex items-center space-x-1">
            <select
              value={selectedTiming}
              onChange={(e) => setSelectedTiming(e.target.value)}
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* 記録一覧 */}
      <main className="max-w-4xl mx-auto px-2 pt-2 pb-24 space-y-2">
        {filteredVitalSigns.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <p>選択した条件の記録がありません</p>
          </div>
        ) : (
          filteredVitalSigns.map((vital: any) => (
            <VitalCard
              key={`${vital.residentId || 'new'}-${format(selectedDate, 'yyyy-MM-dd')}-${selectedTiming}`}
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
              localBloodSugar={localBloodSugar}
              setLocalBloodSugar={setLocalBloodSugar}
              updateMutation={updateMutation}
              handleFieldUpdate={handleFieldUpdate}
              handleSaveRecord={handleSaveRecord}
              handleStaffStamp={handleStaffStamp}
              deleteMutation={deleteMutation}
              changeResidentMutation={changeResidentMutation}
              createMutation={createMutation}
              selectedDate={selectedDate}
              currentUser={currentUser}
              onAIButtonClick={(vital) => {
                if (!vital.residentId) return;
                const resident = (residents as any[])?.find((r: any) => r.id === vital.residentId);
                setSelectedResidentForVoice({
                  id: vital.residentId,
                  name: resident?.name || "未選択",
                  vitalId: vital.id,
                });
                setVoiceText("");
                setVoiceDialogOpen(true);

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
                }, 100);
              }}
            />
          ))
        )}
      </main>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-end max-w-lg mx-auto">
          {selectedTiming === "臨時" && (
            <Button
              onClick={addNewRecord}
              className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
              data-testid="button-add-record"
            >
              <Plus className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>

      {/* 確認ダイアログ */}
      <AlertDialog open={showStaffConfirm} onOpenChange={setShowStaffConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記入者の変更確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在「{pendingStaffAction?.currentStaffName}」が記入者として登録されています。
              この記録を変更しますか？
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
                executeStaffStamp(pendingStaffAction.vitalId, pendingStaffAction.residentId);
                setShowStaffConfirm(false);
                setPendingStaffAction(null);
              }
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
    </div>
  );
}