import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { ArrowLeft as ArrowLeftIcon, Calendar as CalendarIcon, User as UserIcon, Clock as ClockIcon, Building as BuildingIcon, ClipboardList, Sparkles, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, getEnvironmentPath } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { MealsAndMedication, InsertMealsAndMedication, MasterSetting } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { matchFloor } from "@/lib/floorFilterUtils";

interface MealsMedicationWithResident extends MealsAndMedication {
  residentName: string;
  roomNumber: string;
  floor: string;
}

// 記録内容用のIME対応textareaコンポーネント（他画面と統一）
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
      className={`flex-1 min-w-0 border rounded px-2 py-1 text-xs resize-none text-left align-top transition-colors focus:border-blue-500 focus:outline-none ${className}`}
      rows={1}
      style={{ minHeight: "32px", maxHeight: "64px", overflow: "auto" }}
      disabled={disabled}
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
  disableAutoFocus = false,
  disableFocusMove = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disableAutoFocus?: boolean;
  disableFocusMove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
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
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
    setJustSelected(true);

    // フォーカス移動が無効化されている場合はjustSelectedをリセット
    if (disableFocusMove || disableAutoFocus) {
      setTimeout(() => {
        setJustSelected(false);
      }, 300);
      return;
    }

    // 自動フォーカス移動を実行
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
        // justSelectedフラグを確実にリセット
        setJustSelected(false);
      }
    }, 200);
  };

  return (
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => {
              if (!justSelected) {
                setOpen(true);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              if (disableFocusMove) {
                // フィルタ条件項目の場合はクリックでプルダウンを開く
                setOpen(!open);
              } else {
                // 通常の入力項目の場合もクリックでプルダウンを開く
                if (!justSelected) {
                  setOpen(true);
                }
              }
            }}
            placeholder={placeholder}
            className={className}
          />
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0.5" align="center">
          <div className="space-y-0 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="w-full text-left px-1.5 py-0 text-xs hover:bg-slate-100 leading-tight min-h-[1.5rem]"
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

export default function MealsMedicationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  });
  const [selectedMealTime, setSelectedMealTime] = useState(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 9) return "朝";
    if (currentHour < 12) return "10時";
    if (currentHour < 15) return "昼";
    if (currentHour < 17) return "15時";
    return "夕";
  });
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedFloor, setSelectedFloor] = useState(
    urlParams.get('floor') || 'all'
  );

  // 一括登録モード用のstate（介護記録一覧と統一）
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedResidentIds, setSelectedResidentIds] = useState<Set<string>>(new Set());
  const [bulkInputModalOpen, setBulkInputModalOpen] = useState(false);
  const [bulkInputData, setBulkInputData] = useState({
    mealTime: selectedMealTime,
    mainAmount: '',
    sideAmount: '',
    waterIntake: '',
    supplement: ''
  });

  

  // URLパラメータ更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('mealTime', selectedMealTime);
    params.set('floor', selectedFloor);
    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [selectedDate, selectedMealTime, selectedFloor]);

  // bulkInputDataのmealTimeを同期
  useEffect(() => {
    setBulkInputData(prev => ({
      ...prev,
      mealTime: selectedMealTime
    }));
  }, [selectedMealTime]);

  // チェックボックス制御関数（介護記録一覧と統一）
  const handleStartBulkMode = () => {
    setBulkMode(true);
    setSelectedResidentIds(new Set());
  };

  const handleCancelBulkMode = () => {
    setBulkMode(false);
    setSelectedResidentIds(new Set());
  };

  const toggleResidentSelection = (residentId: string) => {
    setSelectedResidentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(residentId)) {
        newSet.delete(residentId);
      } else {
        newSet.add(residentId);
      }
      return newSet;
    });
  };

  // 確認ダイアログ用の状態
  const [showStaffConfirm, setShowStaffConfirm] = useState(false);
  const [pendingStaffAction, setPendingStaffAction] = useState<{
    residentId: string;
    currentStaffName: string;
  } | null>(null);

  // 音声認識ダイアログ用の状態
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [selectedResidentForVoice, setSelectedResidentForVoice] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const recognitionRef = useRef<any>(null);

  const handleSelectAll = () => {
    if (selectedResidentIds.size === filteredResidents.length) {
      setSelectedResidentIds(new Set());
    } else {
      setSelectedResidentIds(new Set(filteredResidents.map(r => r.id)));
    }
  };

  const handleOpenBulkModal = () => {
    if (selectedResidentIds.size === 0) {
      toast({
        title: "利用者を選択してください",
        description: "一括登録する利用者を選択してください。",
        variant: "destructive",
      });
      return;
    }
    setBulkInputModalOpen(true);
  };

  const { data: mealsMedicationResponse } = useQuery({
    queryKey: ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        floor: selectedFloor,
      });
      const response = await apiRequest(`/api/meals-medication?${params}`);
      console.log('食事一覧 API レスポンス:', response);
      return response;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const mealsMedicationData: MealsMedicationWithResident[] = Array.isArray(mealsMedicationResponse) ? mealsMedicationResponse : [];
  
  console.log('食事一覧データ:', mealsMedicationData);

  const createMutation = useMutation({
    mutationFn: async (data: InsertMealsAndMedication) => {
      return apiRequest('/api/meals-medication', 'POST', data);
    },
    onMutate: async (newData) => {
      // 楽観的更新用の現在のデータスナップショット取得
      const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
      const previousData = queryClient.getQueryData(queryKey);
      return { previousData };
    },
    onSuccess: (serverResponse, variables, context) => {
      // サーバーからの実際のレスポンスでキャッシュを更新
      const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        // tempIdのレコードを実際のIDに置き換え
        return old.map((record: any) => {
          if (record.id?.startsWith('temp-') && 
              record.residentId === variables.residentId && 
              record.mealType === variables.mealType) {
            return { ...record, ...serverResponse, id: serverResponse.id };
          }
          return record;
        });
      });
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      toast({
        title: "エラー",
        description: error.message || "記録の作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // 一括登録用のmutation（既存データは更新、新規データは作成）
  const bulkCreateMutation = useMutation({
    mutationFn: async (data: { residentIds: string[], mealData: any }) => {
      // APIから最新データを直接取得して確実に最新のデータを使用
      const params = new URLSearchParams({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        floor: selectedFloor,
      });
      const freshData = await apiRequest(`/api/meals-medication?${params}`);
      const currentData: MealsMedicationWithResident[] = Array.isArray(freshData) ? freshData : [];

      // デバッグ情報を出力
      console.log('🔍 一括登録開始:', {
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: data.mealData.mealTime,
        residentIds: data.residentIds,
        totalRecords: currentData.length,
        dataSource: 'fresh API data'
      });

      const results = await Promise.all(
        data.residentIds.map(async (residentId) => {
          // 詳細なデバッグログ
          console.log(`🔍 検索開始 - 利用者ID: ${residentId}`);

          // 既存データの詳細を確認（最新のキャッシュデータを使用）
          const allRecordsForResident = currentData.filter(record =>
            record.residentId === residentId
          );
          console.log(`📋 該当利用者の全レコード:`, allRecordsForResident.map(r => ({
            id: r.id,
            recordDate: r.recordDate,
            formattedDate: r.recordDate ? format(new Date(r.recordDate), 'yyyy-MM-dd') : 'null',
            mealType: r.mealType,
            type: r.type
          })));

          // 既存レコード検索（最新のキャッシュデータを使用）
          const existingRecord = currentData.find(
            record => {
              // 条件を個別に評価（typeチェックは削除）
              const isResidentMatch = record.residentId === residentId;
              const dateMatch = record.recordDate &&
                format(new Date(record.recordDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isMealTypeMatch = record.mealType === data.mealData.mealTime;

              // デバッグ用に各条件を出力
              if (isResidentMatch && record.recordDate) {
                console.log(`🔍 レコード詳細チェック:`, {
                  recordId: record.id,
                  residentMatch: isResidentMatch,
                  recordDate: record.recordDate,
                  formattedRecordDate: format(new Date(record.recordDate), 'yyyy-MM-dd'),
                  searchDate: format(selectedDate, 'yyyy-MM-dd'),
                  dateMatch,
                  recordMealType: record.mealType,
                  searchMealType: data.mealData.mealTime,
                  mealTypeMatch: isMealTypeMatch,
                  recordType: record.type,
                  allConditionsMatch: isResidentMatch && dateMatch && isMealTypeMatch
                });
              }

              return isResidentMatch && dateMatch && isMealTypeMatch;
            }
          );

          console.log(`🎯 検索結果:`, existingRecord ?
            `既存レコード発見 ID: ${existingRecord.id}` : '既存レコードなし');

          const recordData = {
            residentId,
            recordDate: selectedDate,
            type: 'meal' as const,
            mealType: data.mealData.mealTime,
            mainAmount: data.mealData.mainAmount === 'empty' ? '' : data.mealData.mainAmount,
            sideAmount: data.mealData.sideAmount === 'empty' ? '' : data.mealData.sideAmount,
            waterIntake: data.mealData.waterIntake === 'empty' ? '' : data.mealData.waterIntake,
            supplement: data.mealData.supplement === 'empty' ? '' : data.mealData.supplement,
            staffName: (user as any)?.staffName || (user as any)?.firstName || 'スタッフ',
            notes: existingRecord?.notes || ''
          };

          // 処理の判定
          if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
            console.log(`🔄 更新処理実行: ${existingRecord.id}`);
            return apiRequest(`/api/meals-medication/${existingRecord.id}`, "PUT", recordData);
          } else {
            console.log(`📝 新規登録実行: ${residentId}`);
            return apiRequest("/api/meals-medication", "POST", recordData);
          }
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
      // 一括登録モードをリセット
      setBulkMode(false);
      setSelectedResidentIds(new Set());
      setBulkInputModalOpen(false);
      setBulkInputData({
        mealTime: selectedMealTime,
        mainAmount: '',
        sideAmount: '',
        waterIntake: '',
        supplement: ''
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "一括登録に失敗しました。",
        variant: "destructive",
      });
    }
  });

  const handleBulkRegister = () => {
    // 確認ダイアログを表示
    const confirmMessage = `選択した${selectedResidentIds.size}名の利用者に一括登録を実行します。\n\n※ 既に登録済みのデータは上書きされます。\n\n実行しますか？`;

    if (window.confirm(confirmMessage)) {
      bulkCreateMutation.mutate({
        residentIds: Array.from(selectedResidentIds),
        mealData: bulkInputData
      });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertMealsAndMedication }) => {
      return apiRequest(`/api/meals-medication/${id}`, 'PUT', data);
    },
    onMutate: async ({ id, data }) => {
      // 楽観的更新用の現在のデータスナップショット取得
      const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
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
        const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      toast({
        title: "エラー",
        description: error.message || "記録の更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const { data: residents = [] } = useQuery({
    queryKey: ['/api/residents'],
  }) as { data: any[] };

  // マスタ設定から「その他項目」を取得
  const { data: otherItemsSettings = [] } = useQuery({
    queryKey: ['/api/master-settings', 'other_items'],
    queryFn: async () => {
      return await apiRequest('/api/master-settings?categoryKey=other_items', 'GET');
    },
  });

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });

  const mealTimes = ["朝", "10時", "昼", "15時", "夕"];

  // 主・副の選択肢
  const mainOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  const sideOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];

  // 水分の選択肢
  const waterOptions = ["empty", "300", "250", "200", "150", "100", "50", "0"];

  // その他の選択肢（マスタ設定から動的に生成）
  const supplementOptions = [
    "empty",
    ...otherItemsSettings
      .filter((item: any) => item.isActive) // 有効な項目のみ
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)) // sortOrderでソート
      .map((item: any) => item.value) // valueを使用
  ];

  // 記録保存時に適切な時間を決定する関数
  const getRecordMealTime = (): string => {
    if (selectedMealTime !== 'all') {
      return selectedMealTime;
    }
    
    // フィルタが'all'の場合は現在時刻に基づいて適切な時間を決定
    const currentHour = new Date().getHours();
    if (currentHour < 9) return "朝";
    if (currentHour < 12) return "10時";
    if (currentHour < 15) return "昼";
    if (currentHour < 17) return "15時";
    return "夕";
  };

  // フィールド更新（楽観的更新のみ）
  const handleFieldUpdate = (residentId: string, field: string, value: string) => {
    console.log(`🔥 handleFieldUpdate called:`, {
      residentId,
      field,
      value,
      selectedMealTime,
      selectedDate: format(selectedDate, 'yyyy-MM-dd')
    });
    
    const recordMealTime = getRecordMealTime();
    const queryKey = ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor];
    
    // 楽観的更新
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      
      // 既存のレコードを探す
      const existingIndex = old.findIndex((record: any) => 
        record.residentId === residentId && record.mealType === recordMealTime
      );
      
      if (existingIndex >= 0) {
        // 既存レコードを更新
        const updated = [...old];
        const fieldMapping: Record<string, string> = {
          'main': 'mainAmount',
          'side': 'sideAmount', 
          'water': 'waterIntake',
          'supplement': 'supplement',
          'staffName': 'staffName',
          'notes': 'notes'
        };
        
        const dbField = fieldMapping[field] || field;
        updated[existingIndex] = {
          ...updated[existingIndex],
          [dbField]: value === "empty" ? "" : value
        };
        return updated;
      } else {
        // 新規レコードを追加
        const newRecord = {
          id: `temp-${Date.now()}`,
          residentId,
          residentName: '',
          roomNumber: '',
          floor: '',
          staffId: null, // null値で作成し、サーバー側で適切なスタッフIDを設定
          recordDate: selectedDate,
          type: 'meal',
          mealType: recordMealTime === 'all' ? '朝' : recordMealTime,
          mainAmount: field === 'main' ? (value === "empty" ? "" : value) : '',
          sideAmount: field === 'side' ? (value === "empty" ? "" : value) : '',
          waterIntake: field === 'water' ? (value === "empty" ? "" : value) : '',
          supplement: field === 'supplement' ? (value === "empty" ? "" : value) : '',
          staffName: field === 'staffName' ? (value === "empty" ? "" : value) : '',
          notes: field === 'notes' ? value : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return [...old, newRecord];
      }
    });
    
    // 自動保存は無効化 - 重複登録を防ぐため
    // if (value && value !== "empty") {
    //   console.log('Auto-saving record after field update');
    //   handleSaveRecord(residentId, field, value);
    // }
  };

  const handleSaveRecord = (residentId: string, field: string, value: string) => {
    console.log(`💾 handleSaveRecord called:`, {
      residentId,
      field,
      value,
      selectedMealTime,
      selectedDate: format(selectedDate, 'yyyy-MM-dd')
    });
    
    const recordMealTime = getRecordMealTime();
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealType === recordMealTime
    );
    
    console.log(`📋 Existing record found:`, existingRecord);

    // 新しいスキーマに合わせたレコードデータを作成
    const recordData: InsertMealsAndMedication = {
      residentId,
      // staffIdはサーバー側で自動設定するため、フロントでは送信しない
      recordDate: selectedDate,
      type: 'meal',
      mealType: recordMealTime === 'all' ? '朝' : recordMealTime,
      mainAmount: existingRecord?.mainAmount || '',
      sideAmount: existingRecord?.sideAmount || '',
      waterIntake: existingRecord?.waterIntake || '',
      supplement: existingRecord?.supplement || '',
      staffName: existingRecord?.staffName || '',
      notes: existingRecord?.notes || '',
    };

    // フィールドを更新
    if (field === 'main') {
      recordData.mainAmount = value === "empty" ? "" : value;
    } else if (field === 'side') {
      recordData.sideAmount = value === "empty" ? "" : value;
    } else if (field === 'water') {
      recordData.waterIntake = value === "empty" ? "" : value;
    } else if (field === 'supplement') {
      recordData.supplement = value === "empty" ? "" : value;
    } else if (field === 'staffName') {
      recordData.staffName = value === "empty" ? "" : value;
    } else if (field === 'notes') {
      recordData.notes = value;
    }

    console.log(`💾 Record data to save:`, JSON.stringify(recordData, null, 2));
    
    // 既存レコードがあるが、一時的なIDの場合は新規作成として扱う
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      console.log(`🔄 Updating existing record with ID:`, existingRecord.id);
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      console.log(`➕ Creating new record`);
      createMutation.mutate(recordData);
    }
  };

  // 既存レコードから食事カテゴリデータを取得するヘルパー関数
  const getMealCategoryValue = (record: MealsMedicationWithResident | undefined, category: string): string => {
    if (!record) return "empty";
    
    if (category === 'notes') {
      return record.notes === "" || record.notes === null || record.notes === undefined ? "" : record.notes;
    }
    
    // 通常のカラムから直接取得
    if (category === 'main') {
      const value = record.mainAmount;
      return value === "" || value === null || value === undefined ? "empty" : value;
    } else if (category === 'side') {
      const value = record.sideAmount;
      return value === "" || value === null || value === undefined ? "empty" : value;
    } else if (category === 'water') {
      const value = record.waterIntake;
      return value === "" || value === null || value === undefined ? "empty" : value;
    } else if (category === 'supplement') {
      const value = record.supplement;
      return value === "" || value === null || value === undefined ? "empty" : value;
    }
    
    return "empty";
  };

  // スタッフ情報を取得するヘルパー関数
  const getStaffInfo = (record: MealsMedicationWithResident | undefined): { name: string; time: string } => {
    if (!record) return { name: '', time: '' };
    
    // 直接カラムからスタッフ名を取得
    return {
      name: record.staffName || '',
      time: '' // 時刻情報は現在のスキーマにはないので空文字
    };
  };


  // スタッフ印の実際の処理を実行する関数
  const executeStaffStamp = (residentId: string) => {
    // セッション職員情報があるか確認
    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) =>
        record.residentId === residentId && record.mealType === selectedMealTime
    );

    // 現在の記入者名を取得
    const currentStaffName = getStaffInfo(existingRecord).name;

    // 記入者が空白の場合はログイン者名を設定、入っている場合はクリア
    const newStaffName = currentStaffName ? '' : staffName;

    // スタッフ名を保存
    handleSaveRecord(residentId, 'staffName', newStaffName);
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
  const handleAIButtonClick = (resident: any) => {
    setSelectedResidentForVoice({
      id: resident.id,
      name: resident.name,
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
          handleFieldUpdate(selectedResidentForVoice.id, 'notes', response.processedText);
          handleSaveRecord(selectedResidentForVoice.id, 'notes', response.processedText);
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

  // 承認者アイコン機能（確認ダイアログ付き）
  const handleStaffStamp = (residentId: string) => {
    // セッション職員情報があるか確認
    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) =>
        record.residentId === residentId && record.mealType === selectedMealTime
    );

    // 現在の記入者名を取得
    const currentStaffName = getStaffInfo(existingRecord).name;

    // 記入者が入力されていて、かつ自分以外の場合は確認
    if (currentStaffName && currentStaffName !== staffName) {
      setPendingStaffAction({ residentId, currentStaffName });
      setShowStaffConfirm(true);
      return;
    }

    // それ以外は即座に実行
    executeStaffStamp(residentId);
  };


  const filteredResidents = residents.filter((resident: any) => {
    if (selectedFloor === 'all') return true;
    return matchFloor(resident.floor, selectedFloor);
  }).sort((a: any, b: any) => {
    // 居室番号で並べ替え（数値として比較）
    const roomA = parseInt(a.roomNumber) || 0;
    const roomB = parseInt(b.roomNumber) || 0;
    return roomA - roomB;
  });

  

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor);
              const dashboardPath = getEnvironmentPath("/");
              const targetUrl = `${dashboardPath}?${params.toString()}`;
              setLocation(targetUrl);
            }}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">食事一覧</h1>
        </div>
      </div>

      {/* フィルタ項目 */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 sm:gap-4 items-center justify-center">
          {/* 一括登録モード時の全選択チェックボックス */}
          {bulkMode && (
            <div className="flex items-center mr-2">
              <input
                type="checkbox"
                checked={selectedResidentIds.size === filteredResidents.length && filteredResidents.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          )}
          {/* 日付選択 */}
          <div className="flex items-center space-x-1">
            <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              data-testid="input-date"
            />
          </div>

          {/* 食事時間選択 */}
          <div className="flex items-center space-x-1">
            <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <select
              value={selectedMealTime}
              onChange={(e) => setSelectedMealTime(e.target.value)}
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="朝">朝</option>
              <option value="10時">10時</option>
              <option value="昼">昼</option>
              <option value="15時">15時</option>
              <option value="夕">夕</option>
            </select>
          </div>

          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {/* マスタ設定から取得した階数データで動的生成 */}
              {floorMasterSettings
                .filter(setting => setting.isActive !== false) // 有効な項目のみ
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) // ソート順に並べる
                .map((setting) => {
                  // "全階"の場合はvalue="all"、それ以外はvalueを使用
                  const optionValue = setting.value === "全階" ? "all" : setting.value;
                  return (
                    <option key={setting.id} value={optionValue}>
                      {setting.label}
                    </option>
                  );
                })
              }
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-1 pb-1">
        {/* 利用者一覧テーブル（極限にコンパクト） */}
      <div className="space-y-0 border rounded-lg overflow-hidden">
        {filteredResidents.map((resident: any, index: number) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealType === selectedMealTime
          );

          return (
            <div key={resident.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
              <div className="p-1 space-y-1">
                {/* 上段：チェックボックス + 居室番号 + 利用者名 + 主 + 副 + 水分 */}
                <div className="flex items-center gap-1">
                  {/* チェックボックス（一括モード時のみ） */}
                  {bulkMode && (
                    <div className="w-6 flex items-center justify-center flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedResidentIds.has(resident.id)}
                        onChange={() => toggleResidentSelection(resident.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* 居室番号 */}
                  <div className="w-10 text-center flex-shrink-0">
                    <div className="text-lg font-bold text-blue-600">{resident.roomNumber}</div>
                  </div>

                  {/* 利用者名 */}
                  <div className="w-24 text-center flex-shrink-0">
                    <div className="font-medium text-sm truncate text-slate-800">
                      {resident.name}
                    </div>
                  </div>
                  
                  {/* 食事項目を右寄せ */}
                  <div className="flex-1"></div>

                  {/* 主 */}
                  <div className="w-10 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'main');
                        return value === "empty" ? "" : value;
                      })()}
                      options={mainOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => {
                        handleFieldUpdate(resident.id, 'main', value);
                        if (value && value !== "empty") {
                          handleSaveRecord(resident.id, 'main', value);
                        }
                      }}
                      placeholder="主"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* / ラベル */}
                  <div className="text-xs text-gray-500 flex-shrink-0">/</div>

                  {/* 副 */}
                  <div className="w-10 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'side');
                        return value === "empty" ? "" : value;
                      })()}
                      options={sideOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => {
                        handleFieldUpdate(resident.id, 'side', value);
                        if (value && value !== "empty") {
                          handleSaveRecord(resident.id, 'side', value);
                        }
                      }}
                      placeholder="副"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 水分 */}
                  <div className="w-12 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'water');
                        return value === "empty" ? "" : value;
                      })()}
                      options={waterOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => {
                        handleFieldUpdate(resident.id, 'water', value);
                        if (value && value !== "empty") {
                          handleSaveRecord(resident.id, 'water', value);
                        }
                      }}
                      placeholder="水分"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 中段：その他 + 記入者 */}
                <div className="flex items-center gap-1">
                  {/* 左端のスペース調整（チェックボックス分） */}
                  {bulkMode && <div className="w-6 flex-shrink-0"></div>}

                  {/* その他（横幅を最大限に拡張） */}
                  <div className="flex-1">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'supplement');
                        return value === "empty" ? "" : value;
                      })()}
                      options={supplementOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => {
                        handleFieldUpdate(resident.id, 'supplement', value);
                        if (value && value !== "empty") {
                          handleSaveRecord(resident.id, 'supplement', value);
                        }
                      }}
                      placeholder="その他"
                      className="h-6 text-xs w-full px-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 記入者 + アイコン（スマホ対応で縮小） */}
                  <div className="w-24 flex-shrink-0 flex items-center gap-1">
                    <input
                      type="text"
                      value={(() => {
                        const staffInfo = getStaffInfo(existingRecord);
                        return staffInfo.name || '';
                      })()}
                      onClick={(e) => {
                        const currentValue = e.currentTarget.value;
                        if (!currentValue.trim()) {
                          const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';
                          handleFieldUpdate(resident.id, 'staffName', staffName);
                        }
                      }}
                      onChange={(e) => {
                        // 手動入力も可能にする
                        handleFieldUpdate(resident.id, 'staffName', e.target.value);
                      }}
                      onBlur={(e) => {
                        // カーソルアウト時に保存
                        const value = e.target.value;
                        if (value && value.trim()) {
                          handleSaveRecord(resident.id, 'staffName', value);
                        }
                      }}
                      placeholder="記入者"
                      className="h-6 w-14 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      onClick={() => handleStaffStamp(resident.id)}
                      data-testid={`button-stamp-${resident.id}`}
                    >
                      <UserIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                {/* 下段：記録内容 + AIアイコン */}
                <div className="flex items-center gap-1">
                  {/* 左端のスペース調整（チェックボックス分） */}
                  {bulkMode && <div className="w-6 flex-shrink-0"></div>}

                  {/* 記録内容 */}
                  <div className="flex-1 min-w-0">
                    <NotesInput
                      initialValue={(() => {
                        const value = getMealCategoryValue(existingRecord, 'notes');
                        return value === "empty" ? "" : value;
                      })()}
                      onSave={(value) => {
                        handleFieldUpdate(resident.id, 'notes', value);
                        if (value && value.trim()) {
                          handleSaveRecord(resident.id, 'notes', value);
                        }
                      }}
                      className="w-full"
                    />
                  </div>

                  {/* AIアイコン */}
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
                    onClick={() => handleAIButtonClick(resident)}
                    title="音声認識"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {filteredResidents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          該当する利用者がいません
        </div>
      )}

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-center max-w-lg mx-auto relative">
          <div className="absolute left-0">
            <Button
              variant={bulkMode ? "outline" : "default"}
              onClick={bulkMode ? handleCancelBulkMode : handleStartBulkMode}
              data-testid="button-bulk-register"
              className="flex items-center gap-2"
            >
              {bulkMode ? "キャンセル" : "一括登録"}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor);
              const medicationPath = getEnvironmentPath("/medication-list");
              setLocation(`${medicationPath}?${params.toString()}`);
            }}
            data-testid="button-medication-list"
            className="flex items-center gap-2"
          >
            服薬一覧へ
          </Button>

          {bulkMode && (
            <div className="absolute right-0">
              <Button
                onClick={handleOpenBulkModal}
                className="bg-blue-600 hover:bg-blue-700 w-12 h-12 rounded-full p-0"
                disabled={selectedResidentIds.size === 0}
                data-testid="button-bulk-execute"
              >
                <ClipboardList className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 一括登録ポップアップ */}
      <Dialog open={bulkInputModalOpen} onOpenChange={setBulkInputModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>一括登録</DialogTitle>
            <DialogDescription>
              選択した{selectedResidentIds.size}名の利用者に食事記録を一括登録します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 時間帯（表示のみ、変更不可） */}
            <div>
              <label className="text-sm font-medium text-gray-700">時間帯</label>
              <input
                type="text"
                value={bulkInputData.mealTime}
                readOnly
                className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
              />
            </div>

            {/* 主・副・水分（横並び） */}
            <div className="grid grid-cols-3 gap-3">
              {/* 主 */}
              <div>
                <label className="text-sm font-medium text-gray-700">主</label>
                <InputWithDropdown
                  value={bulkInputData.mainAmount}
                  options={mainOptions.map(option => ({
                    value: option,
                    label: option === "empty" ? "" : option
                  }))}
                  onSave={(value) => setBulkInputData(prev => ({ ...prev, mainAmount: value }))}
                  placeholder="主食摂取量"
                  className="w-full px-2 py-2 border rounded-md text-sm"
                />
              </div>

              {/* 副 */}
              <div>
                <label className="text-sm font-medium text-gray-700">副</label>
                <InputWithDropdown
                  value={bulkInputData.sideAmount}
                  options={sideOptions.map(option => ({
                    value: option,
                    label: option === "empty" ? "" : option
                  }))}
                  onSave={(value) => setBulkInputData(prev => ({ ...prev, sideAmount: value }))}
                  placeholder="副食摂取量"
                  className="w-full px-2 py-2 border rounded-md text-sm"
                />
              </div>

              {/* 水分 */}
              <div>
                <label className="text-sm font-medium text-gray-700">水分</label>
                <InputWithDropdown
                  value={bulkInputData.waterIntake}
                  options={waterOptions.map(option => ({
                    value: option,
                    label: option === "empty" ? "" : option
                  }))}
                  onSave={(value) => setBulkInputData(prev => ({ ...prev, waterIntake: value }))}
                  placeholder="水分摂取量"
                  className="w-full px-2 py-2 border rounded-md text-sm"
                />
              </div>
            </div>

            {/* その他 */}
            <div>
              <label className="text-sm font-medium text-gray-700">その他</label>
              <InputWithDropdown
                value={bulkInputData.supplement}
                options={supplementOptions.map(option => ({
                  value: option,
                  label: option === "empty" ? "" : option
                }))}
                onSave={(value) => setBulkInputData(prev => ({ ...prev, supplement: value }))}
                placeholder="その他の摂取"
                className="w-full px-3 py-2 border rounded-md"
                disableFocusMove={true}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setBulkInputModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleBulkRegister}
              disabled={bulkCreateMutation?.isPending}
            >
              {bulkCreateMutation?.isPending ? '登録中...' : '登録実行'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                executeStaffStamp(pendingStaffAction.residentId);
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

        {/* 下部余白 */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}