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
import type { MealsMedication, InsertMealsMedication } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

interface MealsMedicationWithResident extends MealsMedication {
  residentName: string;
  roomNumber: string;
  floor: string;
}

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  disableAutoFocus = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disableAutoFocus?: boolean;
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
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);

    // 自動フォーカス移動が有効な場合のみ実行
    if (!disableAutoFocus) {
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
            ref={inputRef}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => {
              setOpen(true);
              setIsFocused(true);
            }}
            onBlur={() => {
              // プルダウンが開いている場合はフォーカスを維持
              if (!open) {
                setTimeout(() => setIsFocused(false), 50);
              }
            }}
            onClick={(e) => e.preventDefault()}
            placeholder={placeholder}
            className={`${className} ${isFocused || open ? '!border-blue-500' : ''} transition-all outline-none`}
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

export default function MealsMedicationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMealTime, setSelectedMealTime] = useState("朝");
  const [selectedFloor, setSelectedFloor] = useState("all");

  // URLパラメータからstate復元
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    const mealTimeParam = params.get('mealTime');
    const floorParam = params.get('floor');

    if (dateParam) {
      setSelectedDate(new Date(dateParam));
    }
    if (mealTimeParam) {
      setSelectedMealTime(mealTimeParam);
    }
    if (floorParam) {
      setSelectedFloor(floorParam);
    }
  }, []);

  // URLパラメータ更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('mealTime', selectedMealTime);
    params.set('floor', selectedFloor);
    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [selectedDate, selectedMealTime, selectedFloor]);

  const { data: mealsMedicationResponse } = useQuery({
    queryKey: ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        floor: selectedFloor,
      });
      const response = await apiRequest(`/api/meals-medication?${params}`);
      return response.json();
    }
  });

  const mealsMedicationData: MealsMedicationWithResident[] = Array.isArray(mealsMedicationResponse) ? mealsMedicationResponse : [];

  const createMutation = useMutation({
    mutationFn: async (data: InsertMealsMedication) => {
      return apiRequest('/api/meals-medication', 'POST', data);
    },
    // 楽観的更新の実装
    onMutate: async (newRecord) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/meals-medication'] });
      
      // 現在のデータのスナップショットを取得
      const previousData = queryClient.getQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor]);
      
      // 楽観的に更新（新規作成）
      queryClient.setQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor], (old: any) => {
        if (!old) return [newRecord];
        
        // 既存の記録があるかチェック
        const existingIndex = old.findIndex((record: any) => 
          record.residentId === newRecord.residentId && record.mealTime === newRecord.mealTime
        );
        
        if (existingIndex >= 0) {
          // 既存レコードを更新
          const updated = [...old];
          updated[existingIndex] = { ...updated[existingIndex], ...newRecord, id: updated[existingIndex].id };
          return updated;
        } else {
          // 新規レコードを追加
          return [...old, { ...newRecord, id: `temp-${Date.now()}` }];
        }
      });
      
      return { previousData };
    },
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor], context.previousData);
      }
      
      toast({
        title: "エラー",
        description: "記録の作成に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
    },
    onSuccess: () => {
      // 成功時はサーバーから最新データを取得して同期
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertMealsMedication }) => {
      return apiRequest(`/api/meals-medication/${id}`, 'PUT', data);
    },
    // 楽観的更新の実装
    onMutate: async ({ id, data }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/meals-medication'] });
      
      // 現在のデータのスナップショットを取得
      const previousData = queryClient.getQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor]);
      
      // 楽観的に更新
      queryClient.setQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor], (old: any) => {
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
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor], context.previousData);
      }
      
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
    },
    onSuccess: () => {
      // 成功時は楽観的更新のみで完了（invalidateしない）
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
  
  // 量の選択肢（水分と同様）
  const amountOptions = ["empty", "300", "250", "200", "150", "100", "50", "0"];
  
  // 合計値を計算するヘルパー関数
  const calculateTotal = (water: string, amount1: string, amount2: string): string => {
    const waterNum = parseFloat(water) || 0;
    const amount1Num = parseFloat(amount1) || 0;
    const amount2Num = parseFloat(amount2) || 0;
    const total = waterNum + amount1Num + amount2Num;
    return total > 0 ? total.toString() : '';
  };

  const handleSaveRecord = (residentId: string, field: string, value: string) => {
    // 自動で記入者情報を設定
    const staffName = (user as any)?.firstName || 'スタッフ';
    
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealTime === selectedMealTime
    );


    // 新しいスキーマに合わせたレコードデータを作成
    const recordData: InsertMealsMedication = {
      residentId,
      recordDate: format(selectedDate, 'yyyy-MM-dd'),
      mealTime: selectedMealTime,
      mainAmount: existingRecord?.mainAmount || '',
      sideAmount: existingRecord?.sideAmount || '',
      waterIntake: existingRecord?.waterIntake || '',
      supplement1: existingRecord?.supplement1 || '',
      amount1: existingRecord?.amount1 || '',
      supplement2: existingRecord?.supplement2 || '',
      amount2: existingRecord?.amount2 || '',
      totalAmount: existingRecord?.totalAmount || '',
      staffName: existingRecord?.staffName || staffName,
      notes: existingRecord?.notes || '',
      createdBy: (user as any)?.id || (user as any)?.claims?.sub || 'unknown',
    };

    // フィールドを更新
    if (field === 'main') {
      recordData.mainAmount = value === "empty" ? "" : value;
    } else if (field === 'side') {
      recordData.sideAmount = value === "empty" ? "" : value;
    } else if (field === 'water') {
      recordData.waterIntake = value === "empty" ? "" : value;
    } else if (field === 'supplement1') {
      recordData.supplement1 = value === "empty" ? "" : value;
    } else if (field === 'amount1') {
      recordData.amount1 = value === "empty" ? "" : value;
    } else if (field === 'supplement2') {
      recordData.supplement2 = value === "empty" ? "" : value;
    } else if (field === 'amount2') {
      recordData.amount2 = value === "empty" ? "" : value;
    } else if (field === 'staffName') {
      recordData.staffName = value;
    }
    
    // 水分、量1、量2の値が変更されたら合計を再計算
    if (['water', 'amount1', 'amount2'].includes(field)) {
      const waterValue = field === 'water' ? (value === 'empty' ? '' : value) : recordData.waterIntake;
      const amount1Value = field === 'amount1' ? (value === 'empty' ? '' : value) : recordData.amount1;
      const amount2Value = field === 'amount2' ? (value === 'empty' ? '' : value) : recordData.amount2;
      recordData.totalAmount = calculateTotal(waterValue || '', amount1Value || '', amount2Value || '');
    }

    // 既存レコードがあるが、一時的なIDの場合は新規作成として扱う
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      createMutation.mutate(recordData);
    }
  };

  // 既存レコードから食事カテゴリデータを取得するヘルパー関数
  const getMealCategoryValue = (record: MealsMedicationWithResident | undefined, category: string): string => {
    if (!record) return "empty";
    
    // 新しいスキーマの専用フィールドから直接取得
    if (category === 'main') {
      return record.mainAmount === "" || record.mainAmount === null || record.mainAmount === undefined ? "empty" : record.mainAmount;
    } else if (category === 'side') {
      return record.sideAmount === "" || record.sideAmount === null || record.sideAmount === undefined ? "empty" : record.sideAmount;
    } else if (category === 'water') {
      return record.waterIntake === "" || record.waterIntake === null || record.waterIntake === undefined ? "empty" : record.waterIntake;
    } else if (category === 'supplement1') {
      return record.supplement1 === "" || record.supplement1 === null || record.supplement1 === undefined ? "empty" : record.supplement1;
    } else if (category === 'amount1') {
      return record.amount1 === "" || record.amount1 === null || record.amount1 === undefined ? "empty" : record.amount1;
    } else if (category === 'supplement2') {
      return record.supplement2 === "" || record.supplement2 === null || record.supplement2 === undefined ? "empty" : record.supplement2;
    } else if (category === 'amount2') {
      return record.amount2 === "" || record.amount2 === null || record.amount2 === undefined ? "empty" : record.amount2;
    } else if (category === 'total') {
      return record.totalAmount === "" || record.totalAmount === null || record.totalAmount === undefined ? "" : record.totalAmount;
    }
    
    return "empty";
  };

  // スタッフ情報を取得するヘルパー関数
  const getStaffInfo = (record: MealsMedicationWithResident | undefined): { name: string; time: string } => {
    if (!record) return { name: '', time: '' };
    
    // 新しいスキーマのstaffNameフィールドから直接取得
    return {
      name: record.staffName || '',
      time: '' // 時刻情報は現在のスキーマにはないので空文字
    };
  };


  // 承認者アイコン機能（バイタル一覧と同じ）
  const handleStaffStamp = (residentId: string) => {
    const staffName = (user as any)?.firstName || 'スタッフ';
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealTime === selectedMealTime
    );
    
    // 現在の記入者名を取得
    const currentStaffName = getStaffInfo(existingRecord).name;
    
    // 記入者が空白の場合はログイン者名を設定、入っている場合はクリア
    const newStaffName = currentStaffName ? '' : staffName;
    
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
      const newRecord: InsertMealsMedication = {
        residentId: targetResident.id,
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        mainAmount: '',
        sideAmount: '',
        waterIntake: '',
        supplement1: '',
        amount1: '',
        supplement2: '',
        amount2: '',
        totalAmount: '',
        staffName: (user as any)?.firstName || 'スタッフ',
        notes: '',
        createdBy: (user as any)?.id || (user as any)?.claims?.sub || 'unknown',
      };
      createMutation.mutate(newRecord);
    }
  };

  const filteredResidents = residents.filter((resident: any) => {
    if (selectedFloor === 'all') return true;

    const residentFloor = resident.floor;
    if (!residentFloor) return false; // null/undefinedをフィルタアウト
    
    // selectedFloorは "1F", "2F" などの形式
    // residentFloorは "1", "2" または "1F", "2F" などの形式
    const selectedFloorNumber = selectedFloor.replace("F", ""); // "1F" -> "1"
    
    // "1F" 形式との比較
    if (residentFloor === selectedFloor) return true;
    
    // "1" 形式との比較
    if (residentFloor === selectedFloorNumber) return true;
    
    // "1階" 形式との比較
    if (residentFloor === `${selectedFloorNumber}階`) return true;
    
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">食事一覧</h1>
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
              disableAutoFocus={true}
            />
          </div>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={(() => {
                const floorOptions = [
                  { value: "all", label: "全階" },
                  { value: "1F", label: "1階" },
                  { value: "2F", label: "2階" },
                  { value: "3F", label: "3階" },
                  { value: "4F", label: "4階" },
                  { value: "5F", label: "5階" }
                ];
                const option = floorOptions.find(opt => opt.value === selectedFloor);
                return option ? option.label : "全階";
              })()}
              options={[
                { value: "all", label: "全階" },
                { value: "1F", label: "1階" },
                { value: "2F", label: "2階" },
                { value: "3F", label: "3階" },
                { value: "4F", label: "4階" },
                { value: "5F", label: "5階" }
              ]}
              onSave={(value) => setSelectedFloor(value)}
              placeholder="フロア選択"
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disableAutoFocus={true}
            />
          </div>
        </div>
      </div>

      {/* 利用者一覧テーブル（極限にコンパクト） */}
      <div className="space-y-0 border rounded-lg overflow-hidden">
        {filteredResidents.map((resident: any, index: number) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealTime === selectedMealTime
          );

          return (
            <div key={resident.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
              <div className="p-1 space-y-1">
                {/* 1行目：部屋番号 + 主/副/水分 + 記入者 */}
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
                      onSave={(value) => handleSaveRecord(resident.id, 'main', value)}
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
                      onSave={(value) => handleSaveRecord(resident.id, 'side', value)}
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
                      onSave={(value) => handleSaveRecord(resident.id, 'water', value)}
                      placeholder="水分"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 合計ラベル */}
                  <div className="text-xs text-gray-600 flex-shrink-0 writing-mode-vertical-rl text-orientation-mixed" style={{writingMode: 'vertical-rl'}}>合計</div>
                  
                  {/* 合計 */}
                  <div className="w-12 flex-shrink-0">
                    <input
                      type="text"
                      value={(() => {
                        const totalValue = getMealCategoryValue(existingRecord, 'total');
                        return totalValue === "empty" ? "" : totalValue;
                      })()}
                      readOnly
                      placeholder="合計"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-gray-100 focus:outline-none cursor-not-allowed"
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
                          const staffName = (user as any)?.firstName || 'スタッフ';
                          handleSaveRecord(resident.id, 'staffName', staffName);
                        }
                      }}
                      onChange={(e) => {
                        // 手動入力も可能にする
                        handleSaveRecord(resident.id, 'staffName', e.target.value);
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

                {/* 2行目：利用者名 + その他1 + 量1 */}
                <div className="flex items-center gap-1">
                  <div className="w-10 text-center flex-shrink-0">
                    <div className="text-xs font-medium whitespace-pre-line leading-tight">
                      {resident.name.replace(/\s+/g, '\n')}
                    </div>
                  </div>
                  
                  {/* その他1 */}
                  <div className="flex-1">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'supplement1');
                        return value === "empty" ? "" : value;
                      })()}
                      options={supplementOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => handleSaveRecord(resident.id, 'supplement1', value)}
                      placeholder="その他1"
                      className="h-6 text-xs w-full px-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 量1 */}
                  <div className="w-12 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'amount1');
                        return value === "empty" ? "" : value;
                      })()}
                      options={amountOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => handleSaveRecord(resident.id, 'amount1', value)}
                      placeholder="量1"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* 3行目：その他2 + 量2 */}
                <div className="flex items-center gap-1">
                  <div className="w-10 text-center flex-shrink-0">
                  </div>
                  
                  {/* その他2 */}
                  <div className="flex-1">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'supplement2');
                        return value === "empty" ? "" : value;
                      })()}
                      options={supplementOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => handleSaveRecord(resident.id, 'supplement2', value)}
                      placeholder="その他2"
                      className="h-6 text-xs w-full px-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 量2 */}
                  <div className="w-12 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const value = getMealCategoryValue(existingRecord, 'amount2');
                        return value === "empty" ? "" : value;
                      })()}
                      options={amountOptions.filter(option => option !== "").map(option => ({
                        value: option,
                        label: option === "empty" ? "" : option
                      }))}
                      onSave={(value) => handleSaveRecord(resident.id, 'amount2', value)}
                      placeholder="量2"
                      className="h-6 text-xs w-full px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={() => setLocation('/medication-list')}
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