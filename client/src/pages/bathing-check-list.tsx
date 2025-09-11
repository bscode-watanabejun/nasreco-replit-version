import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, endOfDay, addDays, addMonths, differenceInDays, endOfMonth, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { BathingRecord, Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// 入浴カテゴリの選択肢
const bathTypeOptions = [
  { value: "", label: "" },
  { value: "入浴", label: "入浴" },
  { value: "シャワー浴", label: "シャワー浴" },
  { value: "清拭", label: "清拭" },
  { value: "×", label: "×" },
];

// 体温の選択肢（35.0〜39.9、0.1刻み）
const temperatureOptions = Array.from({ length: 50 }, (_, i) => {
  const temp = (35.0 + i * 0.1).toFixed(1);
  return { value: temp, label: temp };
});

// 血圧収縮期の選択肢（80〜180）
const systolicBPOptions = Array.from({ length: 101 }, (_, i) => ({
  value: (80 + i).toString(),
  label: (80 + i).toString(),
}));

// 血圧拡張期の選択肢（40〜120）
const diastolicBPOptions = Array.from({ length: 81 }, (_, i) => ({
  value: (40 + i).toString(),
  label: (40 + i).toString(),
}));

// 脈拍の選択肢（40〜160）
const pulseOptions = Array.from({ length: 121 }, (_, i) => ({
  value: (40 + i).toString(),
  label: (40 + i).toString(),
}));

// SpO2の選択肢（80〜100）
const spo2Options = Array.from({ length: 21 }, (_, i) => ({
  value: (80 + i).toString(),
  label: (80 + i).toString(),
}));

// 時のオプション（6時〜23時）
const hourOptions = [
  { value: "", label: "" },
  ...Array.from({ length: 18 }, (_, i) => ({
    value: (6 + i).toString().padStart(2, "0"),
    label: (6 + i).toString().padStart(2, "0"),
  })),
];

// 分のオプション（0, 15, 30, 45分）
const minuteOptions = [
  { value: "", label: "" },
  { value: "00", label: "00" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

// InputWithDropdownコンポーネント
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  type = "text",
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  type?: "text" | "number";
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
    // 数値入力の場合のバリデーション
    if (type === "number" && newValue !== "") {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue)) return;
    }
    setLocalValue(newValue);
  };

  const handleFocus = () => {
    if (options.length > 0) {
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
    }
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
        type={type}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`h-7 text-xs px-1 ${className || ""}`}
      />
      {isOpen && options.length > 0 && (
        <div 
          className={`absolute z-[9999] w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto`}
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

export default function BathingCheckList() {
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
  const [localEdits, setLocalEdits] = useState<Map<string, any>>(new Map());
  const [createdRecordIds, setCreatedRecordIds] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
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


  // 月次モードでのDateTo自動調整
  useEffect(() => {
    if (viewMode === 'monthly' && dateFrom) {
      const from = parseISO(dateFrom);
      
      let newTo: Date;
      if (from.getDate() === 1) {
        // 1日の場合はその月の月末
        newTo = endOfMonth(from);
      } else {
        // 2日以降の場合は翌月の同じ日の前日
        const nextMonthSameDay = addMonths(from, 1);
        newTo = subDays(nextMonthSameDay, 1);
      }
      
      setDateTo(format(newTo, "yyyy-MM-dd"));
    }
  }, [dateFrom, viewMode]);

  // 日付範囲の妥当性チェック
  useEffect(() => {
    if (dateFrom && dateTo) {
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      const daysDiff = differenceInDays(to, from);
      
      if (viewMode === 'monthly') {
        // 月次モードでは最大1ヶ月
        if (daysDiff > 31) {
          let newTo: Date;
          if (from.getDate() === 1) {
            // 1日の場合はその月の月末
            newTo = endOfMonth(from);
          } else {
            // 2日以降の場合は翌月の同じ日の前日
            const nextMonthSameDay = addMonths(from, 1);
            newTo = subDays(nextMonthSameDay, 1);
          }
          setDateTo(format(newTo, "yyyy-MM-dd"));
          toast({
            title: "期間制限",
            description: "月次表示では期間は最大1ヶ月までです。終了日を調整しました。",
          });
        }
      } else {
        // 日次モードでは最大2ヶ月
        if (daysDiff > 60) {
          const newTo = addMonths(from, 2);
          setDateTo(format(newTo, "yyyy-MM-dd"));
          toast({
            title: "期間制限",
            description: "表示期間は最大2ヶ月までです。終了日を調整しました。",
          });
        }
      }
    }
  }, [dateFrom, dateTo, viewMode, toast]);


  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // 入浴記録データの取得
  const { data: bathingData = [], isLoading } = useQuery<BathingRecord[]>({
    queryKey: ["/api/bathing-records"],
    queryFn: async () => {
      const from = startOfDay(parseISO(dateFrom)).toISOString();
      const to = endOfDay(parseISO(dateTo)).toISOString();
      return apiRequest(`/api/bathing-records?from=${from}&to=${to}`);
    },
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });

  // 入浴記録の更新
  const updateBathingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BathingRecord> }) => {
      return apiRequest(`/api/bathing-records/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // 楽観的更新のためにクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/bathing-records"] });
      
      // 現在のデータを取得
      const previousData = queryClient.getQueryData<BathingRecord[]>(["/api/bathing-records"]);
      
      // 楽観的更新
      if (previousData) {
        queryClient.setQueryData<BathingRecord[]>(["/api/bathing-records"], (old) => {
          if (!old) return old;
          return old.map(record => 
            record.id === id ? { ...record, ...data } : record
          );
        });
      }
      
      // ロールバック用に以前のデータを返す
      return { previousData };
    },
    onError: (error, variables, context) => {
      // エラー時は元のデータに戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/bathing-records"], context.previousData);
      }
      toast({
        title: "エラー",
        description: "データの更新に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // 最終的にサーバーと同期
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
  });

  // 入浴記録の作成（入浴一覧画面と同じ楽観的更新）
  const createBathingMutation = useMutation({
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
      // エラー時は invalidate してサーバーの状態と同期させる
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
  });

  // 入浴記録の削除
  const deleteBathingMutation = useMutation({
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
      // 楽観的更新: 削除対象のレコードを即座に非表示にする
      await queryClient.cancelQueries({ queryKey: ["/api/bathing-records"] });
      
      const previousData = queryClient.getQueryData<BathingRecord[]>(["/api/bathing-records"]);
      
      queryClient.setQueryData<BathingRecord[]>(["/api/bathing-records"], (old) => {
        if (!old) return old;
        return old.filter(record => record.id !== id);
      });
      
      return { previousData };
    },
    onSuccess: (data, id) => {
      // 一時的レコードかどうかを判定
      const isTemporary = id && typeof id === 'string' && id.startsWith("temp-");
      
      if (!isTemporary) {
        // 既存レコードの削除成功時のみサーバーデータを更新
        queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
      }
      // 削除完了メッセージは表示しない（静かに削除）
    },
    onError: (error: any, id, context) => {
      // エラー時は元のデータに戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/bathing-records"], context.previousData);
      }
      
      toast({
        title: "エラー",
        description: error?.message || "入浴記録の削除に失敗しました。",
        variant: "destructive",
      });
      
      // エラー時もキャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["/api/bathing-records"] });
    },
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = bathingData;

    // 階数フィルタ
    if (selectedFloor !== "all") {
      filtered = filtered.filter(record => {
        const resident = residents.find(r => r.id === record.residentId);
        return resident?.floor === selectedFloor || 
               resident?.floor === `${selectedFloor}階`;
      });
    }

    // 利用者フィルタ
    if (selectedResident !== "all") {
      filtered = filtered.filter(record => record.residentId === selectedResident);
    }

    return filtered;
  }, [bathingData, selectedFloor, selectedResident, residents]);

  // 日付と利用者でグループ化されたデータ
  const groupedData = useMemo(() => {
    const grouped = new Map<string, { 
      date: string; 
      residentId: string | null; 
      resident: Resident | undefined;
      record: BathingRecord | undefined;
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
    
    // Step 2: 表示対象の利用者を取得（入浴日設定でフィルタ）
    const displayResidents = residents.filter(r => {
      if (selectedFloor !== "all" && 
          r.floor !== selectedFloor && 
          r.floor !== `${selectedFloor}階`) return false;
      if (selectedResident !== "all" && r.id !== selectedResident) return false;
      
      // 入浴日設定の確認
      return dates.some(date => {
        const dayOfWeek = new Date(date).getDay();
        const bathDayFields = [
          'bathSunday',    // 0: 日曜日
          'bathMonday',    // 1: 月曜日  
          'bathTuesday',   // 2: 火曜日
          'bathWednesday', // 3: 水曜日
          'bathThursday',  // 4: 木曜日
          'bathFriday',    // 5: 金曜日
          'bathSaturday'   // 6: 土曜日
        ];
        const bathDayField = bathDayFields[dayOfWeek];
        return r[bathDayField as keyof Resident] === true;
      });
    });
    
    // Step 3: すべての日付×利用者の組み合わせを作成
    dates.forEach(date => {
      const dayOfWeek = new Date(date).getDay();
      const bathDayFields = [
        'bathSunday', 'bathMonday', 'bathTuesday', 'bathWednesday',
        'bathThursday', 'bathFriday', 'bathSaturday'
      ];
      const bathDayField = bathDayFields[dayOfWeek];
      
      displayResidents.forEach(resident => {
        // その日が入浴日の場合のみ追加
        if (resident[bathDayField as keyof Resident] === true) {
          const key = `${date}_${resident.id}`;
          grouped.set(key, {
            date,
            residentId: resident.id,
            resident,
            record: undefined
          });
        }
      });
    });
    
    // Step 4: 既存の入浴記録データをマージ
    filteredData.forEach(record => {
      const dateKey = format(new Date(record.recordDate), "yyyy-MM-dd");
      const key = `${dateKey}_${record.residentId}`;
      
      if (grouped.has(key)) {
        const group = grouped.get(key)!;
        group.record = record;
      } else {
        // 記録があるが入浴日でない場合も表示
        const resident = residents.find(r => r.id === record.residentId);
        if (resident && dates.includes(dateKey)) {
          grouped.set(key, {
            date: dateKey,
            residentId: record.residentId,
            resident,
            record
          });
        }
      }
    });

    // Step 5: ソート
    return Array.from(grouped.values()).sort((a, b) => {
      // 第一ソート: 日付でソート（昇順：若い順）
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // 第二ソート: 居室番号でソート（昇順：若い順）
      const roomA = a.resident?.roomNumber || "";
      const roomB = b.resident?.roomNumber || "";
      
      // 居室番号を数値として比較（文字列の場合は文字列比較）
      const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
      const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);
      
      if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
        return roomNumA - roomNumB; // 数値比較
      }
      
      return roomA.localeCompare(roomB, undefined, { numeric: true }); // 文字列比較（数値考慮）
    });
  }, [filteredData, residents, dateFrom, dateTo, selectedFloor, selectedResident]);


  // データの保存（入浴一覧画面と同じロジック）
  const handleSave = (
    residentId: string,
    date: string,
    field: string,
    value: any
  ) => {
    // レコードキーを作成
    const recordKey = `${residentId}_${date}`;
    const createdId = createdRecordIds.get(recordKey);
    
    const existingRecord = groupedData.find(g => 
      g.residentId === residentId && g.date === date
    )?.record;
    
    // 変更されたフィールドの値
    const fieldValue = value === "empty" ? "" : value;

    // recordDataの作成：更新時は変更フィールドのみ、新規作成時は全フィールド
    const recordData: any = {
      residentId,
      recordDate: new Date(date),
      timing: "午前",
    };

    if (!existingRecord || existingRecord.id?.startsWith('temp-')) {
      // 新規作成時：全フィールドを含める
      recordData.hour = field === 'hour' ? fieldValue : (existingRecord?.hour ?? "");
      recordData.minute = field === 'minute' ? fieldValue : (existingRecord?.minute ?? "");
      recordData.staffName = field === 'staffName' ? fieldValue : (existingRecord?.staffName ?? "");
      recordData.bathType = field === 'bathType' ? fieldValue : (existingRecord?.bathType ?? "");
      recordData.temperature = field === 'temperature' ? fieldValue : (existingRecord?.temperature ?? "");
      recordData.bloodPressureSystolic = field === 'bloodPressureSystolic' ? fieldValue : (existingRecord?.bloodPressureSystolic ?? "");
      recordData.bloodPressureDiastolic = field === 'bloodPressureDiastolic' ? fieldValue : (existingRecord?.bloodPressureDiastolic ?? "");
      recordData.pulseRate = field === 'pulseRate' ? fieldValue : (existingRecord?.pulseRate ?? "");
      recordData.oxygenSaturation = field === 'oxygenSaturation' ? fieldValue : (existingRecord?.oxygenSaturation ?? "");
      recordData.nursingCheck = field === 'nursingCheck' ? fieldValue : (existingRecord?.nursingCheck ?? false);
    } else {
      // 更新時：変更されたフィールドのみ
      recordData[field] = fieldValue;
    }

    // 更新/作成判定：実際のレコードがあれば更新、なければ作成
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      // 実際のDBレコードの場合は更新API使用
      updateBathingMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      // 一時的カードまたは新規カードの場合：サーバー側で既存レコード検索後、更新または作成
      createBathingMutation.mutate(recordData);
    }
  };

  // 月次ボタンのクリックハンドラー
  const handleViewModeToggle = () => {
    setViewMode(viewMode === 'daily' ? 'monthly' : 'daily');
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
        <h1 className="text-lg font-semibold">
          {viewMode === 'monthly' ? '入浴チェック一覧 月次' : '入浴チェック一覧'}
        </h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-sm"
            />
            <span>〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
              onClick={handleViewModeToggle}
            >
              {viewMode === 'monthly' ? '入浴チェック一覧' : '月次'}
            </Button>
            {viewMode === 'monthly' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  toast({
                    title: "印刷機能",
                    description: "印刷機能は現在開発中です",
                  });
                }}
              >
                印刷
              </Button>
            )}
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
            {viewMode === 'daily' ? (
              // 日次表示
              <table className="relative border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50">
                    <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2" style={{ width: '45px' }}>記録日</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '60px' }}>記録時間</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '35px' }}>居室</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-20">利用者名</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-24">入浴</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-20">記入者</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-14">体温</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-20">血圧</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-14">脈拍</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-14">SpO2</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '24px' }}>看</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '24px' }}>削除</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((group, index) => {
                    const record = group.record;
                    const localKey = (field: string) => `${group.residentId}_${group.date}_${field}`;
                    
                    // ローカル編集値を優先して取得
                    const getValue = (field: string) => {
                      const localValue = localEdits.get(localKey(field));
                      if (localValue !== undefined) return localValue;
                      return record?.[field as keyof BathingRecord] || "";
                    };
                    
                    return (
                      <tr key={`${group.date}_${group.residentId}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {/* 記録日列（スティッキー、編集不可） */}
                        <td className="text-xs border border-gray-300 sticky left-0 z-10 px-1 py-1 whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)", width: '45px' }}>
                          {format(parseISO(group.date), "MM月dd日", { locale: ja })}
                        </td>
                        
                        {/* 記録時間列（通常列、編集可能） */}
                        <td className="p-1 border border-gray-300" style={{ width: '60px' }}>
                          <div className="flex items-center gap-1">
                            <InputWithDropdown
                              value={getValue("hour") || ""}
                              options={hourOptions}
                              onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "hour", value)}
                              placeholder=""
                              className="w-12 text-xs"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={getValue("minute") || ""}
                              options={minuteOptions}
                              onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "minute", value)}
                              placeholder=""
                              className="w-12 text-xs"
                            />
                          </div>
                        </td>
                        
                        <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '35px' }}>
                          {group.resident?.roomNumber || "-"}
                        </td>
                        <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                          {group.resident?.name || "-"}
                        </td>
                        
                        {/* 入浴カテゴリ */}
                        <td className="p-1 border border-gray-300">
                          <InputWithDropdown
                            value={String(getValue("bathType") || "")}
                            options={bathTypeOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "bathType", value)}
                            placeholder=""
                            className="w-full"
                          />
                        </td>
                        
                        {/* 記入者 */}
                        <td className="p-1 border border-gray-300">
                          <InputWithDropdown
                            value={String(getValue("staffName") || "")}
                            options={staffNameOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "staffName", value)}
                            placeholder=""
                            className="w-full"
                          />
                        </td>
                        
                        {/* 体温 */}
                        <td className="p-1 border border-gray-300">
                          <InputWithDropdown
                            value={getValue("temperature") ? getValue("temperature").toString() : ""}
                            options={temperatureOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "temperature", value)}
                            placeholder=""
                            className="w-full"
                          />
                        </td>
                        
                        {/* 血圧 */}
                        <td className="p-1 border border-gray-300">
                          <div className="flex items-center gap-0.5">
                            <InputWithDropdown
                              value={getValue("bloodPressureSystolic") ? String(getValue("bloodPressureSystolic")) : ""}
                              options={systolicBPOptions}
                              onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "bloodPressureSystolic", value ? parseInt(value) : null)}
                              placeholder=""
                              className="w-full"
                            />
                            <span className="text-xs">/</span>
                            <InputWithDropdown
                              value={getValue("bloodPressureDiastolic") ? String(getValue("bloodPressureDiastolic")) : ""}
                              options={diastolicBPOptions}
                              onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "bloodPressureDiastolic", value ? parseInt(value) : null)}
                              placeholder=""
                              className="w-full"
                            />
                          </div>
                        </td>
                        
                        {/* 脈拍 */}
                        <td className="p-1 border border-gray-300">
                          <InputWithDropdown
                            value={getValue("pulseRate") ? String(getValue("pulseRate")) : ""}
                            options={pulseOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "pulseRate", value ? parseInt(value) : null)}
                            placeholder=""
                            className="w-full"
                          />
                        </td>
                        
                        {/* SpO2 */}
                        <td className="p-1 border border-gray-300">
                          <InputWithDropdown
                            value={getValue("oxygenSaturation") ? String(getValue("oxygenSaturation")) : ""}
                            options={spo2Options}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "oxygenSaturation", value ? parseFloat(value) : null)}
                            placeholder=""
                            className="w-full"
                          />
                        </td>
                        
                        {/* 看護チェックボックス */}
                        <td className="text-center border border-gray-300 px-1 py-1" style={{ width: '24px' }}>
                          <Checkbox
                            checked={getValue("nursingCheck") === true}
                            disabled
                            className="mx-auto"
                          />
                        </td>
                        
                        {/* 削除アイコン */}
                        <td className="text-center border border-gray-300 px-1 py-1" style={{ width: '24px' }}>
                          {(() => {
                            // 削除可能条件の判定
                            const record = group.record;
                            const isRecordEmpty = !record || 
                              (!record.id || record.id.startsWith('temp-')) &&
                              !record.bathType &&
                              !record.staffName &&
                              !record.hour &&
                              !record.minute &&
                              !record.temperature &&
                              !record.bloodPressureSystolic &&
                              !record.bloodPressureDiastolic &&
                              !record.pulseRate &&
                              !record.oxygenSaturation;
                            
                            // 実際のDBレコードかつ何らかのデータが入力されている場合のみ削除可能
                            const isDeletable = record && record.id && !record.id.startsWith('temp-') && !isRecordEmpty;
                            
                            return (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    className={`rounded text-xs flex items-center justify-center mx-auto ${
                                      isDeletable 
                                        ? "bg-red-500 hover:bg-red-600 text-white cursor-pointer" 
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    }`}
                                    style={{
                                      height: "20px",
                                      width: "20px",
                                      minHeight: "20px",
                                      minWidth: "20px",
                                      maxHeight: "20px",
                                      maxWidth: "20px",
                                    }}
                                    disabled={!isDeletable}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </AlertDialogTrigger>
                                {isDeletable && (
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
                                        onClick={() => record?.id && deleteBathingMutation.mutate(record.id)}
                                      >
                                        削除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                )}
                              </AlertDialog>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              // 月次表示
              (() => {
                // 期間内の日付を取得
                const dates: string[] = [];
                const start = parseISO(dateFrom);
                const end = parseISO(dateTo);
                let currentDate = start;
                
                while (currentDate <= end) {
                  dates.push(format(currentDate, "yyyy-MM-dd"));
                  currentDate = addDays(currentDate, 1);
                }

                // 利用者ごとにグループ化して入浴日の記録を表示
                const monthlyData = residents.filter(resident => {
                  if (selectedFloor !== "all" && 
                      resident.floor !== selectedFloor && 
                      resident.floor !== `${selectedFloor}階`) return false;
                  if (selectedResident !== "all" && resident.id !== selectedResident) return false;
                  
                  // 入浴日設定の確認
                  return dates.some(date => {
                    const dayOfWeek = new Date(date).getDay();
                    const bathDayFields = [
                      'bathSunday', 'bathMonday', 'bathTuesday', 'bathWednesday',
                      'bathThursday', 'bathFriday', 'bathSaturday'
                    ];
                    const bathDayField = bathDayFields[dayOfWeek];
                    return resident[bathDayField as keyof Resident] === true;
                  });
                }).sort((a, b) => {
                  const roomA = a.roomNumber || "";
                  const roomB = b.roomNumber || "";
                  const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
                  const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);
                  
                  if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
                    return roomNumA - roomNumB;
                  }
                  return roomA.localeCompare(roomB, undefined, { numeric: true });
                });

                return (
                  <table className="relative border-collapse w-full">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-50">
                        <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2 w-12">居室</th>
                        <th className="text-xs font-medium border border-gray-300 sticky left-12 bg-gray-50 z-30 px-1 py-2 w-20">利用者名</th>
                        {dates.map(date => {
                          const day = parseISO(date);
                          const dayStr = format(day, "dd", { locale: ja });
                          const weekDay = format(day, "E", { locale: ja });
                          return (
                            <th key={date} className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-8 text-center">
                              <div>{dayStr}</div>
                              <div>{weekDay}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((resident, index) => (
                        <tr key={resident.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="text-xs border border-gray-300 text-center px-1 py-1 sticky left-0 z-10 w-12" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)" }}>
                            {resident.roomNumber || "-"}
                          </td>
                          <td className="text-xs border border-gray-300 px-1 py-1 sticky left-12 z-10 w-20 overflow-hidden text-ellipsis whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)" }}>
                            {resident.name}
                          </td>
                          {dates.map(date => {
                            const dayOfWeek = new Date(date).getDay();
                            const bathDayFields = [
                              'bathSunday', 'bathMonday', 'bathTuesday', 'bathWednesday',
                              'bathThursday', 'bathFriday', 'bathSaturday'
                            ];
                            const bathDayField = bathDayFields[dayOfWeek];
                            const isBathDay = resident[bathDayField as keyof Resident] === true;
                            
                            // その日の入浴記録を検索
                            const bathRecord = filteredData.find(record => 
                              record.residentId === resident.id && 
                              format(new Date(record.recordDate), "yyyy-MM-dd") === date
                            );
                            
                            let displayText = "";
                            if (bathRecord) {
                              switch (bathRecord.bathType) {
                                case "入浴":
                                  displayText = "入浴";
                                  break;
                                case "シャワー浴":
                                  displayText = "シャワー";
                                  break;
                                case "清拭":
                                  displayText = "清拭";
                                  break;
                                case "×":
                                  displayText = "×";
                                  break;
                                default:
                                  displayText = "";
                              }
                            }
                            
                            return (
                              <td key={`${resident.id}-${date}`} className="text-xs border border-gray-300 text-center px-1 py-1 w-8">
                                {isBathDay || bathRecord ? displayText : ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        )}
      </main>
    </div>
  );
}