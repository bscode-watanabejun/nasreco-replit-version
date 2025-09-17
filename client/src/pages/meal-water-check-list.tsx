import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, endOfDay, addDays, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MealsAndMedication, Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// 主食・副食の選択肢
const mainFoodOptions = [
  { value: "10", label: "10" },
  { value: "9", label: "9" },
  { value: "8", label: "8" },
  { value: "7", label: "7" },
  { value: "6", label: "6" },
  { value: "5", label: "5" },
  { value: "4", label: "4" },
  { value: "3", label: "3" },
  { value: "2", label: "2" },
  { value: "1", label: "1" },
  { value: "0", label: "0" },
  { value: "×", label: "×" },
  { value: "欠", label: "欠" },
];

// 水分の選択肢（食事一覧画面と同じ）
const waterOptions = [
  { value: "", label: "" },
  { value: "300", label: "300" },
  { value: "250", label: "250" },
  { value: "200", label: "200" },
  { value: "150", label: "150" },
  { value: "100", label: "100" },
  { value: "50", label: "50" },
  { value: "0", label: "0" },
];

// その他の選択肢（食事一覧画面と同じ）
const supplementOptions = [
  { value: "", label: "" },
  { value: "ラコール 200ml", label: "ラコール 200ml" },
  { value: "エンシュア 200ml", label: "エンシュア 200ml" },
  { value: "メイバランス 200ml", label: "メイバランス 200ml" },
  { value: "ツインラインNF 400ml", label: "ツインラインNF 400ml" },
  { value: "エンシュア 250ml", label: "エンシュア 250ml" },
  { value: "イノラス 187.5ml", label: "イノラス 187.5ml" },
  { value: "ラコールＮＦ半固形剤 300g", label: "ラコールＮＦ半固形剤 300g" },
];

// WaterTotalDisplayコンポーネント - トータル水分量の表示専用
function WaterTotalDisplay({
  residentId,
  date,
  meals,
  localEdits,
}: {
  residentId: string;
  date: string;
  meals: { [key: string]: MealsAndMedication | undefined };
  localEdits: Map<string, string>;
}) {
  const total = useMemo(() => {
    let sum = 0;
    ["朝", "昼", "夕", "10時", "15時"].forEach(mealType => {
      const localKey = `${residentId}_${date}_${mealType}_waterIntake`;
      const localValue = localEdits.get(localKey);

      if (localValue !== undefined) {
        // ローカル編集値を使用
        const value = parseInt(localValue);
        if (!isNaN(value)) {
          sum += value;
        }
      } else {
        // 既存データを使用
        const meal = meals[mealType];
        if (meal?.waterIntake) {
          const value = parseInt(meal.waterIntake);
          if (!isNaN(value)) {
            sum += value;
          }
        }
      }
    });
    return sum;
  }, [residentId, date, meals, localEdits]);

  return <span>{total > 0 ? total : ""}</span>;
}

// InputWithDropdownコンポーネント
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [isSelecting, setIsSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  };

  const handleFocus = () => {
    setIsOpen(true);
    // プルダウンの位置を計算
    setTimeout(() => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        
        // スクロール可能な親要素を探す
        let scrollParent = inputRef.current.parentElement;
        while (scrollParent) {
          const overflow = window.getComputedStyle(scrollParent).overflow;
          const overflowY = window.getComputedStyle(scrollParent).overflowY;
          if (overflow === 'auto' || overflow === 'scroll' || 
              overflowY === 'auto' || overflowY === 'scroll') {
            break;
          }
          scrollParent = scrollParent.parentElement;
        }
        
        // スクロールコンテナまたはビューポートの境界を取得
        const containerRect = scrollParent ? 
          scrollParent.getBoundingClientRect() : 
          { top: 0, bottom: window.innerHeight };
        
        const spaceBelow = containerRect.bottom - rect.bottom;
        const spaceAbove = rect.top - containerRect.top;
        const dropdownHeight = 200; // プルダウンの高さ
        
        // 下に十分なスペースがなく、上に十分なスペースがある場合は上に表示
        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }, 10);
  };

  const handleBlur = () => {
    // 選択中でない場合のみ（手動入力時のみ）保存
    if (localValue !== value && !isSelecting) {
      onSave(localValue);
    }
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleSelect = (selectedValue: string) => {
    setIsSelecting(true);  // 選択中フラグを立てる
    setLocalValue(selectedValue);
    onSave(selectedValue);
    setIsOpen(false);
    // inputのフォーカスを明示的に外す
    if (inputRef.current) {
      inputRef.current.blur();
    }
    // 少し遅延してフラグをリセット（blurイベントが完了するまで待つ）
    setTimeout(() => setIsSelecting(false), 300);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`h-7 text-xs px-1 ${className || ""}`}
      />
      {isOpen && options.length > 0 && (
        <div 
          className={`absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto`}
          style={{
            [dropdownPosition === 'top' ? 'bottom' : 'top']: '100%',
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option.value)}
              className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MealWaterCheckList() {
  const [, navigate] = useLocation();
  
  // URLパラメータから日付と階数を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const floorParam = urlParams.get('floor');
  
  // 初期値の設定
  const initialDate = dateParam || format(new Date(), "yyyy-MM-dd");
  
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [selectedFloor, setSelectedFloor] = useState(floorParam || "all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [localEdits, setLocalEdits] = useState<Map<string, string>>(new Map());
  const [createdRecordIds, setCreatedRecordIds] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // ログインユーザー名の取得（記入者プルダウン用）
  const staffNameOptions = useMemo(() => {
    const userName = (user as any)?.staffName || "";
    if (userName) {
      return [{ value: userName, label: userName }];
    }
    return [];
  }, [user]);

  // 日付範囲のバリデーション（最大2ヶ月）
  const validateDateRange = (from: string, to: string): boolean => {
    const startDate = parseISO(from);
    const endDate = parseISO(to);
    const maxEndDate = addMonths(startDate, 2);
    
    if (endDate > maxEndDate) {
      toast({
        title: "期間が長すぎます",
        description: "表示期間は最大2ヶ月までに設定してください。",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // 開始日変更ハンドラー
  const handleDateFromChange = (value: string) => {
    if (validateDateRange(value, dateTo)) {
      setDateFrom(value);
    }
    // バリデーションエラーの場合は元の値を維持
  };

  // 終了日変更ハンドラー
  const handleDateToChange = (value: string) => {
    if (validateDateRange(dateFrom, value)) {
      setDateTo(value);
    }
    // バリデーションエラーの場合は元の値を維持
  };

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // 食事データの取得
  const { data: mealsData = [], isLoading } = useQuery<MealsAndMedication[]>({
    queryKey: ["meals-medication", dateFrom, dateTo],
    queryFn: async () => {
      const from = startOfDay(parseISO(dateFrom)).toISOString();
      const to = endOfDay(parseISO(dateTo)).toISOString();
      return apiRequest(`/api/meals-medication?from=${from}&to=${to}&type=meal`);
    },
    refetchOnMount: true, // 画面マウント時に必ず最新データを取得
    staleTime: 0, // データを常に古いものとして扱う
    gcTime: 0, // キャッシュを即座にクリア
  });

  // 食事データの更新
  const updateMealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MealsAndMedication> }) => {
      return apiRequest(`/api/meals-medication/${id}`, "PUT", data);
    },
    onMutate: async ({ id, data }) => {
      // クエリを一時停止して競合状態を防ぐ
      await queryClient.cancelQueries({ queryKey: ["meals-medication"] });

      // 現在のデータのスナップショットを取得
      const previousData = queryClient.getQueryData<MealsAndMedication[]>(["meals-medication", dateFrom, dateTo]);

      // 楽観的更新を実行
      queryClient.setQueryData<MealsAndMedication[]>(["meals-medication", dateFrom, dateTo], (oldData) => {
        if (!oldData) return oldData;

        return oldData.map(meal =>
          meal.id === id ? { ...meal, ...data } : meal
        );
      });

      // ロールバック用のデータを返す
      return { previousData };
    },
    onError: (error, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["meals-medication", dateFrom, dateTo], context.previousData);
      }

      // ローカル編集状態もクリア（エラー時）
      if (variables.data && Object.keys(variables.data).includes('waterIntake')) {
        setLocalEdits(prev => {
          const newMap = new Map(prev);
          // 該当するローカル編集をクリア
          Array.from(newMap.keys()).forEach(key => {
            if (key.includes(variables.id) && key.includes('waterIntake')) {
              newMap.delete(key);
            }
          });
          return newMap;
        });
      }

      toast({
        title: "エラー",
        description: "データの更新に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // 最終的にデータを同期
      queryClient.invalidateQueries({ queryKey: ["meals-medication"] });
    },
  });

  // 食事データの作成
  const createMealMutation = useMutation({
    mutationFn: async (data: Partial<MealsAndMedication>) => {
      return apiRequest("/api/meals-medication", "POST", data);
    },
    onMutate: async (newData) => {
      // クエリを一時停止して競合状態を防ぐ
      await queryClient.cancelQueries({ queryKey: ["meals-medication"] });

      // 現在のデータのスナップショットを取得
      const previousData = queryClient.getQueryData<MealsAndMedication[]>(["meals-medication", dateFrom, dateTo]);

      // 楽観的更新を実行（一時的なIDで新しいレコードを追加）
      queryClient.setQueryData<MealsAndMedication[]>(["meals-medication", dateFrom, dateTo], (oldData) => {
        if (!oldData) return oldData;

        const optimisticRecord = {
          ...newData,
          id: `temp-${Date.now()}`, // 一時的なID
          createdAt: new Date(),
          updatedAt: new Date(),
        } as MealsAndMedication;

        return [...oldData, optimisticRecord];
      });

      // ロールバック用のデータを返す
      return { previousData };
    },
    onSuccess: (serverResponse, variables, context) => {
      // サーバーからの実際のレスポンスでキャッシュを更新
      queryClient.setQueryData<MealsAndMedication[]>(["meals-medication", dateFrom, dateTo], (oldData) => {
        if (!oldData) return oldData;

        // 一時的なレコードを実際のサーバーレスポンスに置き換え
        return oldData.map(meal =>
          meal.id?.toString().startsWith('temp-') &&
          meal.residentId === variables.residentId &&
          meal.mealType === variables.mealType
            ? { ...meal, ...serverResponse, id: serverResponse.id }
            : meal
        );
      });

      // ローカル編集状態をサーバー値に同期（新規登録成功時）
      if (serverResponse && variables.residentId && variables.mealType) {
        // recordDateは既に日付文字列形式（"2025-09-17"）で送信されているため、直接使用
        const dateStr = variables.recordDate ?
          (typeof variables.recordDate === 'string' ? variables.recordDate : format(variables.recordDate, 'yyyy-MM-dd')) :
          format(new Date(), 'yyyy-MM-dd');

        // 各フィールドのローカル編集状態を更新
        setLocalEdits(prev => {
          const newMap = new Map(prev);

          // 水分フィールドのローカル編集を保持（サーバー値で同期）
          if (serverResponse.waterIntake !== undefined) {
            const waterKey = `${variables.residentId}_${dateStr}_${variables.mealType}_waterIntake`;
            newMap.set(waterKey, serverResponse.waterIntake || '');
          }

          return newMap;
        });
      }
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["meals-medication", dateFrom, dateTo], context.previousData);
      }

      // ローカル編集状態もクリア（エラー時）
      if (variables && variables.waterIntake !== undefined &&
          variables.residentId && variables.mealType) {
        setLocalEdits(prev => {
          const newMap = new Map(prev);
          // 該当するローカル編集をクリア
          Array.from(newMap.keys()).forEach(key => {
            if (key.includes(variables.residentId!) &&
                key.includes(variables.mealType!) &&
                key.includes('waterIntake')) {
              newMap.delete(key);
            }
          });
          return newMap;
        });
      }

      toast({
        title: "エラー",
        description: error.message || "データの作成に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: (data, error) => {
      // エラー時のみデータを同期（成功時は楽観的更新で既に同期済み）
      if (error) {
        queryClient.invalidateQueries({ queryKey: ["meals-medication"] });
      }
    },
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = mealsData;

    // 階数フィルタ
    if (selectedFloor !== "all") {
      filtered = filtered.filter(meal => {
        const resident = residents.find(r => r.id === meal.residentId);
        return resident?.floor === selectedFloor || 
               resident?.floor === `${selectedFloor}階`;
      });
    }

    // 利用者フィルタ
    if (selectedResident !== "all") {
      filtered = filtered.filter(meal => meal.residentId === selectedResident);
    }

    return filtered;
  }, [mealsData, selectedFloor, selectedResident, residents]);

  // 日付と利用者でグループ化されたデータ
  const groupedData = useMemo(() => {
    const grouped = new Map<string, { 
      date: string; 
      residentId: string; 
      resident: Resident | undefined;
      meals: { [key: string]: MealsAndMedication | undefined };
    }>();

    // Step 1: 日付範囲を生成
    const dates: string[] = [];
    const start = parseISO(dateFrom);
    const end = parseISO(dateTo);
    let currentDate = start;
    
    while (currentDate <= end) {
      dates.push(format(currentDate, "yyyy-MM-dd"));
      currentDate = addDays(currentDate, 1);
    }
    
    // Step 2: 表示対象の利用者を取得
    const displayResidents = residents.filter(r => {
      if (selectedFloor !== "all" && 
          r.floor !== selectedFloor && 
          r.floor !== `${selectedFloor}階`) return false;
      if (selectedResident !== "all" && r.id !== selectedResident) return false;
      return true;
    });
    
    // Step 3: すべての日付×利用者の組み合わせを作成
    dates.forEach(date => {
      displayResidents.forEach(resident => {
        const key = `${date}_${resident.id}`;
        grouped.set(key, {
          date,
          residentId: resident.id,
          resident,
          meals: {} // 空のオブジェクトで初期化
        });
      });
    });
    
    // Step 4: 既存の食事データをマージ
    filteredData.forEach(meal => {
      const dateKey = format(new Date(meal.recordDate), "yyyy-MM-dd");
      const key = `${dateKey}_${meal.residentId}`;
      
      if (grouped.has(key)) {
        const group = grouped.get(key)!;
        if (meal.mealType) {
          group.meals[meal.mealType] = meal;
        }
      }
    });

    // Step 5: ソート
    return Array.from(grouped.values()).sort((a, b) => {
      // 日付でソート（昇順：若い順）
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // 居室番号でソート（昇順）
      const roomA = a.resident?.roomNumber || "";
      const roomB = b.resident?.roomNumber || "";
      return roomA.localeCompare(roomB);
    });
  }, [filteredData, residents, dateFrom, dateTo, selectedFloor, selectedResident]);


  // 印刷処理
  const handlePrint = () => {
    try {
      // APIパラメータをURLエンコード
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        selectedFloor,
        selectedResident
      });

      // 新しいタブでPDFを表示
      const printUrl = `/api/meals-medication/print?${params.toString()}`;
      window.open(printUrl, '_blank');

    } catch (error) {
      console.error('印刷処理エラー:', error);
      toast({
        title: "エラー",
        description: "PDFの表示に失敗しました。しばらく待ってから再度お試しください。",
        variant: "destructive",
      });
    }
  };

  // 印刷処理（その他含む）
  const handlePrintWithSupplement = () => {
    try {
      // APIパラメータをURLエンコード
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        selectedFloor,
        selectedResident
      });

      // 新しいタブでPDFを表示
      const printUrl = `/api/meals-medication/print-with-supplement?${params.toString()}`;
      window.open(printUrl, '_blank');

    } catch (error) {
      console.error('印刷処理エラー:', error);
      toast({
        title: "エラー",
        description: "PDFの表示に失敗しました。しばらく待ってから再度お試しください。",
        variant: "destructive",
      });
    }
  };

  // データの保存
  const handleSave = async (
    residentId: string,
    date: string,
    mealType: string,
    field: string,
    value: string
  ) => {
    // レコードキーを作成
    const recordKey = `${residentId}_${date}_${mealType}`;
    const createdId = createdRecordIds.get(recordKey);
    
    const existingMeal = groupedData.find(g => 
      g.residentId === residentId && g.date === date
    )?.meals[mealType];
    
    // 水分フィールドの場合、ローカル状態を即座に更新
    if (field === "waterIntake") {
      const localKey = `${residentId}_${date}_${mealType}_${field}`;
      setLocalEdits(prev => {
        const newMap = new Map(prev);
        newMap.set(localKey, value);
        return newMap;
      });
    }

    if (existingMeal) {
      // 既存データの更新
      await updateMealMutation.mutateAsync({
        id: existingMeal.id,
        data: { [field]: value || null }
      });
    } else if (createdId) {
      // 作成済みレコードがある場合は、そのIDで更新
      await updateMealMutation.mutateAsync({
        id: createdId,
        data: { [field]: value || null }
      });
    } else {
      // 新規データの作成 - 全フィールドを初期化
      const mealData: any = {
        residentId,
        recordDate: date, // 日付文字列をそのまま送信してタイムゾーンの問題を回避
        type: "meal",
        mealType,
        staffId: (user as any)?.id || "",
        mainAmount: field === "mainAmount" ? value : null,
        sideAmount: field === "sideAmount" ? value : null,
        waterIntake: field === "waterIntake" ? value : null,
        staffName: field === "staffName" ? value : null,
        supplement: field === "supplement" ? value : null,
      };
      
      try {
        const result = await createMealMutation.mutateAsync(mealData);
        
        // 作成したレコードのIDを保存
        if (result && result.id) {
          setCreatedRecordIds(prev => {
            const newMap = new Map(prev);
            newMap.set(recordKey, result.id);
            return newMap;
          });
        }
      } catch (error) {
        // エラー処理（必要に応じて）
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (selectedFloor !== "all") params.set("floor", selectedFloor);
            if (dateFrom !== format(new Date(), "yyyy-MM-dd")) params.set("date", dateFrom);
            navigate(`/check-list-menu${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">食事・水分チェック一覧</h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="h-8 text-sm"
            />
            <span>〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全階</SelectItem>
              <SelectItem value="1">1階</SelectItem>
              <SelectItem value="2">2階</SelectItem>
              <SelectItem value="3">3階</SelectItem>
              <SelectItem value="4">4階</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedResident} onValueChange={setSelectedResident}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全利用者</SelectItem>
              {residents.map((resident) => (
                <SelectItem key={resident.id} value={resident.id}>
                  {resident.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-1" />
              印刷
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handlePrintWithSupplement}
            >
              <Printer className="h-4 w-4 mr-1" />
              印刷(その他含む)
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto relative">
            <table className="relative border-collapse w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50">
                  <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2 w-16">記録日時</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-10">居室</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-16">利用者名</th>
                  
                  {/* 朝 */}
                  <th className="text-xs font-medium text-center border border-gray-300 bg-blue-50 px-1 py-2 w-10">主(朝)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-blue-50 px-1 py-2 w-10">副(朝)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-blue-50 px-1 py-2 w-12">水分(朝)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-blue-50 px-1 py-2 w-20">記入者(朝)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-blue-50 px-1 py-2 w-32">その他(朝)</th>
                  
                  {/* 昼 */}
                  <th className="text-xs font-medium text-center border border-gray-300 bg-green-50 px-1 py-2 w-10">主(昼)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-green-50 px-1 py-2 w-10">副(昼)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-green-50 px-1 py-2 w-12">水分(昼)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-green-50 px-1 py-2 w-20">記入者(昼)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-green-50 px-1 py-2 w-32">その他(昼)</th>
                  
                  {/* 夕 */}
                  <th className="text-xs font-medium text-center border border-gray-300 bg-orange-50 px-1 py-2 w-10">主(夕)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-orange-50 px-1 py-2 w-10">副(夕)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-orange-50 px-1 py-2 w-12">水分(夕)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-orange-50 px-1 py-2 w-20">記入者(夕)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-orange-50 px-1 py-2 w-32">その他(夕)</th>
                  
                  {/* 間食 */}
                  <th className="text-xs font-medium text-center border border-gray-300 bg-gray-50 px-1 py-2 w-20">水分(10時)</th>
                  <th className="text-xs font-medium text-center border border-gray-300 bg-gray-50 px-1 py-2 w-20">水分(15時)</th>
                  
                  {/* トータル */}
                  <th className="text-xs font-medium text-center border border-gray-300 bg-gray-100 px-1 py-2 w-24">水分(トータル)</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.map((group, index) => (
                  <tr key={`${group.date}_${group.residentId}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="text-xs border border-gray-300 sticky left-0 z-10 px-1 py-1 whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)" }}>
                      {format(parseISO(group.date), "MM月dd日", { locale: ja })}
                    </td>
                    <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap">
                      {group.resident?.roomNumber || "-"}
                    </td>
                    <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {group.resident?.name || "-"}
                    </td>
                    
                    {/* 朝 */}
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["朝"]?.mainAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "朝", "mainAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["朝"]?.sideAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "朝", "sideAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["朝"]?.waterIntake || ""}
                        options={waterOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "朝", "waterIntake", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["朝"]?.staffName || ""}
                        options={staffNameOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "朝", "staffName", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["朝"]?.supplement || ""}
                        options={supplementOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "朝", "supplement", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    
                    {/* 昼 */}
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["昼"]?.mainAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "昼", "mainAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["昼"]?.sideAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "昼", "sideAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["昼"]?.waterIntake || ""}
                        options={waterOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "昼", "waterIntake", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["昼"]?.staffName || ""}
                        options={staffNameOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "昼", "staffName", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["昼"]?.supplement || ""}
                        options={supplementOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "昼", "supplement", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    
                    {/* 夕 */}
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["夕"]?.mainAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "夕", "mainAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["夕"]?.sideAmount || ""}
                        options={mainFoodOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "夕", "sideAmount", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["夕"]?.waterIntake || ""}
                        options={waterOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "夕", "waterIntake", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["夕"]?.staffName || ""}
                        options={staffNameOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "夕", "staffName", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["夕"]?.supplement || ""}
                        options={supplementOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "夕", "supplement", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    
                    {/* 間食 */}
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["10時"]?.waterIntake || ""}
                        options={waterOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "10時", "waterIntake", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <InputWithDropdown
                        value={group.meals["15時"]?.waterIntake || ""}
                        options={waterOptions}
                        onSave={(value) => handleSave(group.residentId, group.date, "15時", "waterIntake", value)}
                        placeholder=""
                        className="w-full"
                      />
                    </td>
                    
                    {/* トータル */}
                    <td className="text-xs text-center font-medium bg-gray-100 border border-gray-300 px-1 py-1">
                      <WaterTotalDisplay
                        residentId={group.residentId}
                        date={group.date}
                        meals={group.meals}
                        localEdits={localEdits}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}