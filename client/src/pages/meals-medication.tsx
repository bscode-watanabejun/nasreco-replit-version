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
import { ArrowLeft as ArrowLeftIcon, Calendar as CalendarIcon, User as UserIcon, Clock as ClockIcon, Building as BuildingIcon, Plus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { MealsAndMedication, InsertMealsAndMedication } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

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

    // フォーカス移動が無効化されている場合はスキップ
    if (disableFocusMove || disableAutoFocus) return;

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
        } else {
          // 最後の要素の場合、一時的にフォーカスを無効化してからリセット
          setTimeout(() => {
            setJustSelected(false);
          }, 500);
        }
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
            onFocus={() => !justSelected && setOpen(true)}
            onClick={(e) => {
              if (disableFocusMove) {
                // フィルタ条件項目の場合はクリックでプルダウンを開く
                setOpen(!open);
              } else {
                e.preventDefault();
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
  const [selectedFloor, setSelectedFloor] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const floorParam = params.get('floor');
    if (floorParam) {
      if (floorParam === 'all') return '全階';
      const floorNumber = floorParam.replace('F', '');
      if (!isNaN(Number(floorNumber))) {
        return `${floorNumber}階`;
      }
    }
    return '全階';
  });

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
    params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
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
        floor: selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''),
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
        floor: selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''),
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

  const mealTimes = ["朝", "10時", "昼", "15時", "夕"];
  
  // 主・副の選択肢
  const mainOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  const sideOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  
  // 水分の選択肢
  const waterOptions = ["empty", "300", "250", "200", "150", "100", "50", "0"];
  
  // その他の選択肢
  const supplementOptions = [
    "empty",
    "ラコール 200ml",
    "エンシュア 200ml", 
    "メイバランス 200ml",
    "ツインラインNF 400ml",
    "エンシュア 250ml",
    "イノラス 187.5ml",
    "ラコールＮＦ半固形剤 300g"
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


  // 承認者アイコン機能（バイタル一覧と同じ）
  const handleStaffStamp = (residentId: string) => {
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

  // 新規レコード追加機能（服薬一覧と同じ）
  const handleAddRecord = () => {
    if (!residents || residents.length === 0 || !user) return;

    // フィルタ条件に合致する利用者を取得
    const filteredResidentsList = filteredResidents;
    
    // 既に記録がある利用者のIDを取得
    const recordedResidentIds = mealsMedicationData.map(r => r.residentId);
    
    // 未記録の利用者を探す
    const unrecordedResident = filteredResidentsList.find((resident: any) => 
      !recordedResidentIds.includes(resident.id)
    );
    
    // 未記録の利用者がいる場合は新しいレコードを作成、いない場合は最初の利用者で作成
    const targetResident = unrecordedResident || filteredResidentsList[0];
    
    if (targetResident) {
      const newRecord: InsertMealsAndMedication = {
        residentId: targetResident.id,
        // staffIdはサーバー側で自動設定するため、フロントでは送信しない
        recordDate: selectedDate,
        type: 'meal',
        mealType: selectedMealTime,
        mainAmount: '',
        sideAmount: '',
        waterIntake: '',
        supplement: '',
        staffName: (user as any)?.staffName || (user as any)?.firstName || 'スタッフ',
        notes: '',
      };
      createMutation.mutate(newRecord);
    }
  };

  const filteredResidents = residents.filter((resident: any) => {
    if (selectedFloor === '全階') return true;

    const residentFloor = resident.floor;
    if (!residentFloor) return false;
    
    const selectedFloorNumber = selectedFloor.replace("階", "");
    
    if (residentFloor === selectedFloor) return true; // "1階" === "1階"
    if (residentFloor === selectedFloorNumber) return true; // "1" === "1"
    if (residentFloor === `${selectedFloorNumber}F`) return true; // "1F" === "1F"
    
    return false;
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
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              const targetUrl = `/?${params.toString()}`;
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
              <option value="全階">全階</option>
              <option value="1階">1階</option>
              <option value="2階">2階</option>
              <option value="3階">3階</option>
              <option value="4階">4階</option>
              <option value="5階">5階</option>
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
                
                {/* 下段：記録内容 */}
                <div className="flex items-center gap-1">
                  {/* 左端のスペース調整（チェックボックス分） */}
                  {bulkMode && <div className="w-6 flex-shrink-0"></div>}

                  {/* 記録内容（その他+記入者の幅に合わせる） */}
                  <div className={bulkMode ? "flex-1" : "flex-1 min-w-0"}>
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
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            variant={bulkMode ? "outline" : "default"}
            onClick={bulkMode ? handleCancelBulkMode : handleStartBulkMode}
            data-testid="button-bulk-register"
            className="flex items-center gap-2"
          >
            {bulkMode ? "キャンセル" : "一括登録"}
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              setLocation(`/medication-list?${params.toString()}`);
            }}
            data-testid="button-medication-list"
            className="flex items-center gap-2"
          >
            服薬一覧へ
          </Button>
          {bulkMode ? (
            <Button
              onClick={handleOpenBulkModal}
              className="bg-blue-600 hover:bg-blue-700 w-12 h-12 rounded-full p-0"
              disabled={selectedResidentIds.size === 0}
              data-testid="button-bulk-execute"
            >
              <ClipboardList className="w-6 h-6" />
            </Button>
          ) : (
            <Button
              onClick={handleAddRecord}
              className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
              disabled={createMutation.isPending}
              data-testid="button-add-record"
            >
              <Plus className="w-6 h-6" />
            </Button>
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

        {/* 下部余白 */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}