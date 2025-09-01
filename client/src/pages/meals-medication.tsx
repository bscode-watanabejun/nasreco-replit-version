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
import { ArrowLeft as ArrowLeftIcon, Calendar as CalendarIcon, User as UserIcon, Clock as ClockIcon, Building as BuildingIcon, Plus } from "lucide-react";
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

// 記録内容用のIME対応textareaコンポーネント
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
      className="min-h-[24px] text-xs w-full px-1 py-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      rows={1}
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
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);

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
        }
      }
    }, 200);
  };

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => !disableFocusMove && setOpen(true)}
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

  

  // URLパラメータ更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('mealTime', selectedMealTime);
    params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [selectedDate, selectedMealTime, selectedFloor]);

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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              const targetUrl = `/?${params.toString()}`;
              console.log('食事一覧からトップ画面へ遷移:', targetUrl);
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

      <div className="space-y-4 p-4">

      {/* 日付とフロア選択 */}
      <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
        <div className="flex gap-2 sm:gap-4 items-center justify-center">
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
            <InputWithDropdown
              value={selectedMealTime}
              options={mealTimes.map(time => ({ value: time, label: time }))}
              onSave={(value) => setSelectedMealTime(value)}
              placeholder="時間"
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disableFocusMove={true}
            />
          </div>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedFloor}
              options={[
                { value: "全階", label: "全階" },
                { value: "1階", label: "1階" },
                { value: "2階", label: "2階" },
                { value: "3階", label: "3階" },
                { value: "4階", label: "4階" },
                { value: "5階", label: "5階" }
              ]}
              onSave={(value) => setSelectedFloor(value)}
              placeholder="フロア選択"
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disableFocusMove={true}
            />
          </div>
        </div>
      </div>

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
                {/* 1段目：部屋番号 + 主/副/水分 + 記入者 + 記入者アイコン */}
                <div className="flex items-center gap-1">
                  {/* 部屋番号 */}
                  <div className="w-10 text-center flex-shrink-0">
                    <div className="font-bold text-lg">{resident.roomNumber}</div>
                  </div>
                  
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

                  {/* 記入者 */}
                  <div className="w-20 flex-shrink-0 flex items-center gap-1">
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
                      className="h-6 w-10 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                {/* 2段目：利用者名 + その他 */}
                <div className="flex items-center gap-1">
                  <div className="w-10 text-center flex-shrink-0">
                    <div className="text-xs font-medium whitespace-pre-line leading-tight">
                      {resident.name.replace(/\s+/g, '\n')}
                    </div>
                  </div>
                  
                  {/* その他 */}
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
                </div>
                
                {/* 3段目：記録内容 */}
                <div className="flex items-center gap-1">
                  <div className="w-10 text-center flex-shrink-0">
                  </div>
                  
                  {/* 記録内容 */}
                  <div className="flex-1">
                    <NotesInput
                      residentId={resident.id}
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
            variant="outline" 
            disabled
            data-testid="button-bulk-register"
            className="flex items-center gap-2"
          >
            一括登録
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
          <Button
            onClick={handleAddRecord}
            className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
            disabled={createMutation.isPending}
            data-testid="button-add-record"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* 下部余白 */}
      <div className="h-20"></div>
      </div>
    </div>
  );
}