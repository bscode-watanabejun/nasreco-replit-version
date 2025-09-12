import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, endOfDay, addDays, addMonths, differenceInDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

// 呼吸の選択肢（10〜40）
const respirationOptions = Array.from({ length: 31 }, (_, i) => ({
  value: (10 + i).toString(),
  label: (10 + i).toString(),
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

// 時間帯の選択肢
const timingOptions = [
  { value: "all", label: "全時間帯" },
  { value: "午前", label: "午前" },
  { value: "午後", label: "午後" },
  { value: "臨時", label: "臨時" },
];

// 記録内容用のIME対応リサイズ可能textareaコンポーネント
function ResizableNotesInput({
  recordId,
  initialValue,
  onLocalChange,
  onSave,
}: {
  recordId: string;
  initialValue: string;
  onLocalChange: (recordId: string, value: string) => void;
  onSave: (recordId: string, value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    // リアルタイムでローカル状態を更新
    onLocalChange(recordId, newValue);
  };

  const handleBlur = () => {
    // カーソルアウト時にAPI更新
    onSave(recordId, value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setValue(newValue);
    onLocalChange(recordId, newValue);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder="記録内容を入力..."
      className="min-h-[32px] text-xs w-full px-2 py-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      rows={1}
    />
  );
}

// InputWithDropdownコンポーネント
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  dropdownWidth,
  type = "text",
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  dropdownWidth?: string;
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
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px',
            ...(dropdownWidth && { width: dropdownWidth })
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

export default function VitalCheckList() {
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
  const [selectedTiming, setSelectedTiming] = useState("all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [localEdits, setLocalEdits] = useState<Map<string, any>>(new Map());
  const [localNotes, setLocalNotes] = useState<Map<string, string>>(new Map());
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

  // 日付範囲の妥当性チェック（最大2ヶ月）
  useEffect(() => {
    if (dateFrom && dateTo) {
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      const daysDiff = differenceInDays(to, from);
      
      if (daysDiff > 60) {
        const newTo = addMonths(from, 2);
        setDateTo(format(newTo, "yyyy-MM-dd"));
        toast({
          title: "期間制限",
          description: "表示期間は最大2ヶ月までです。終了日を調整しました。",
        });
      }
    }
  }, [dateFrom, dateTo, toast]);

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // バイタルサインデータの取得
  const { data: vitalData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vital-signs"],
    queryFn: async () => {
      const from = startOfDay(parseISO(dateFrom)).toISOString();
      const to = endOfDay(parseISO(dateTo)).toISOString();
      return apiRequest(`/api/vital-signs?from=${from}&to=${to}`);
    },
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = vitalData;

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
  }, [vitalData, selectedFloor, selectedResident, residents]);

  // 日付と利用者でグループ化されたデータ（午前・午後で2行表示）
  const groupedData = useMemo(() => {
    const grouped = new Map<string, { 
      date: string; 
      residentId: string | null; 
      resident: Resident | undefined;
      timing: string;
      record: any | undefined;
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
    
    // Step 3: すべての日付×利用者×時間帯の組み合わせを作成
    dates.forEach(date => {
      displayResidents.forEach(resident => {
        // 選択された時間帯に応じて行を作成
        if (selectedTiming === "all") {
          // 全時間帯の場合は午前と午後の2行を作成
          ["午前", "午後"].forEach(timing => {
            const key = `${date}_${resident.id}_${timing}`;
            grouped.set(key, {
              date,
              residentId: resident.id,
              resident,
              timing,
              record: undefined
            });
          });
        } else {
          // 特定の時間帯が選択されている場合は、その時間帯のみ作成
          const key = `${date}_${resident.id}_${selectedTiming}`;
          grouped.set(key, {
            date,
            residentId: resident.id,
            resident,
            timing: selectedTiming,
            record: undefined
          });
        }
      });
    });
    
    // Step 4: 既存のバイタル記録データをマージ
    filteredData.forEach(record => {
      const dateKey = format(new Date(record.recordDate), "yyyy-MM-dd");
      
      // 時間帯フィルタを適用
      if (selectedTiming !== "all" && record.timing !== selectedTiming) {
        return; // フィルタに合わない記録はスキップ
      }
      
      const key = `${dateKey}_${record.residentId}_${record.timing}`;
      
      if (grouped.has(key)) {
        const group = grouped.get(key)!;
        group.record = record;
      } else if (dates.includes(dateKey)) {
        // 記録があるが該当する利用者・時間帯の組み合わせがない場合も表示
        const resident = residents.find(r => r.id === record.residentId);
        if (resident) {
          grouped.set(key, {
            date: dateKey,
            residentId: record.residentId,
            resident,
            timing: record.timing,
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
        const roomCompare = roomNumA - roomNumB;
        if (roomCompare !== 0) return roomCompare;
      } else {
        const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true });
        if (roomCompare !== 0) return roomCompare;
      }
      
      // 第三ソート: 時間帯でソート（午前が上、午後が下）
      const timingOrder: Record<string, number> = { "午前": 0, "午後": 1, "臨時": 2 };
      const aOrder = timingOrder[a.timing] ?? 3;
      const bOrder = timingOrder[b.timing] ?? 3;
      return aOrder - bOrder;  // 小さい値（午前:0）が先に来る
    });
  }, [filteredData, residents, dateFrom, dateTo, selectedFloor, selectedResident, selectedTiming]);

  // バイタル記録の更新
  const updateVitalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<any> }) => {
      return apiRequest(`/api/vital-signs/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // 楽観的更新のためにクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/vital-signs"] });
      
      // 現在のデータを取得
      const previousData = queryClient.getQueryData<any[]>(["/api/vital-signs"]);
      
      // 楽観的更新
      if (previousData) {
        queryClient.setQueryData<any[]>(["/api/vital-signs"], (old) => {
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
        queryClient.setQueryData(["/api/vital-signs"], context.previousData);
      }
      toast({
        title: "エラー",
        description: "データの更新に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // 最終的にサーバーと同期
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
    },
  });

  // バイタル記録の作成
  const createVitalMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/vital-signs", "POST", data),
    onSuccess: (serverResponse, variables) => {
      const queryKey = ["/api/vital-signs"];
      
      // 一時レコードを実際のIDに置き換える
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        let foundMatch = false;
        const updated = old.map((record: any) => {
          const dateMatch = format(new Date(record.recordDate), 'yyyy-MM-dd') === format(new Date(variables.recordDate), 'yyyy-MM-dd');
          const condition = record.id?.startsWith('temp-') && 
              record.residentId === variables.residentId && 
              record.timing === variables.timing &&
              dateMatch;
          
          if (condition) {
            foundMatch = true;
            return { 
              ...record, 
              ...serverResponse, 
              id: serverResponse.id,
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
      console.error("バイタル記録作成エラー:", error);
      
      toast({
        title: "エラー",
        description: error.message || "バイタル記録の作成に失敗しました。",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
    },
  });

  // データの保存
  const handleSave = (
    residentId: string,
    date: string,
    timing: string,
    field: string,
    value: any
  ) => {
    const existingRecord = groupedData.find(g => 
      g.residentId === residentId && g.date === date && g.timing === timing
    )?.record;
    
    // 変更されたフィールドの値
    const fieldValue = value === "empty" ? "" : value;

    // recordDataの作成：更新時は変更フィールドのみ、新規作成時は全フィールド
    const recordData: any = {
      residentId,
      recordDate: new Date(date),
      timing,
    };

    if (!existingRecord || existingRecord.id?.startsWith('temp-')) {
      // 新規作成時：全フィールドを含める
      recordData.hour = field === 'hour' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.hour ?? null);
      recordData.minute = field === 'minute' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.minute ?? null);
      recordData.staffName = field === 'staffName' ? fieldValue : (existingRecord?.staffName ?? null);
      recordData.temperature = field === 'temperature' ? (fieldValue === "" ? null : parseFloat(fieldValue)) : (existingRecord?.temperature ?? null);
      recordData.bloodPressureSystolic = field === 'bloodPressureSystolic' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.bloodPressureSystolic ?? null);
      recordData.bloodPressureDiastolic = field === 'bloodPressureDiastolic' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.bloodPressureDiastolic ?? null);
      recordData.pulseRate = field === 'pulseRate' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.pulseRate ?? null);
      recordData.respirationRate = field === 'respirationRate' ? (fieldValue === "" ? null : parseInt(fieldValue)) : (existingRecord?.respirationRate ?? null);
      recordData.oxygenSaturation = field === 'oxygenSaturation' ? (fieldValue === "" ? null : parseFloat(fieldValue)) : (existingRecord?.oxygenSaturation ?? null);
      recordData.bloodSugar = field === 'bloodSugar' ? (fieldValue === "" ? null : fieldValue) : (existingRecord?.bloodSugar ?? null);
      recordData.notes = field === 'notes' ? fieldValue : (existingRecord?.notes ?? null);
    } else {
      // 更新時：変更されたフィールドのみ
      if (field === 'hour') {
        recordData.hour = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'minute') {
        recordData.minute = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'staffName') {
        recordData.staffName = fieldValue;
      } else if (field === 'temperature') {
        recordData.temperature = fieldValue === "" ? null : parseFloat(fieldValue);
      } else if (field === 'bloodPressureSystolic') {
        recordData.bloodPressureSystolic = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'bloodPressureDiastolic') {
        recordData.bloodPressureDiastolic = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'pulseRate') {
        recordData.pulseRate = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'respirationRate') {
        recordData.respirationRate = fieldValue === "" ? null : parseInt(fieldValue);
      } else if (field === 'oxygenSaturation') {
        recordData.oxygenSaturation = fieldValue === "" ? null : parseFloat(fieldValue);
      } else if (field === 'bloodSugar') {
        recordData.bloodSugar = fieldValue === "" ? null : fieldValue;
      } else if (field === 'notes') {
        recordData.notes = fieldValue;
      }
    }

    // 更新/作成判定：実際のレコードがあれば更新、なければ作成
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      // 実際のDBレコードの場合は更新API使用
      updateVitalMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      // 一時的カードまたは新規カードの場合：サーバー側で既存レコード検索後、更新または作成
      createVitalMutation.mutate(recordData);
    }
  };

  // 記録内容のローカル変更ハンドラ
  const handleNotesLocalChange = (recordId: string, value: string) => {
    setLocalNotes(prev => new Map(prev.set(recordId, value)));
  };

  // 記録内容の保存ハンドラ
  const handleNotesSave = (recordId: string, value: string) => {
    const [residentId, date, timing] = recordId.split('_');
    if (residentId && date && timing) {
      handleSave(residentId, date, timing, "notes", value);
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
        <h1 className="text-lg font-semibold">バイタルチェック一覧</h1>
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

          <Select value={selectedTiming} onValueChange={setSelectedTiming}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timingOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              onClick={() => {
                toast({
                  title: "印刷機能",
                  description: "印刷機能は現在開発中です",
                });
              }}
            >
              印刷
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                toast({
                  title: "バイタルグラフ機能",
                  description: "バイタルグラフ機能は現在開発中です",
                });
              }}
            >
              バイタルグラフ
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
                  <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2" style={{ width: '84px' }}>記録日</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '50px' }}>時間帯</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '85px' }}>記録時間</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '50px' }}>居室</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '84px' }}>利用者名</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '84px' }}>記入者</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>体温</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '110px' }}>血圧</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>脈拍</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>SpO2</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>血糖</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>呼吸</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2">記録内容</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.map((group, index) => {
                  const record = group.record;
                  
                  return (
                    <tr key={`${group.date}_${group.residentId}_${group.timing}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {/* 記録日列（スティッキー、編集不可） */}
                      <td className="text-xs border border-gray-300 sticky left-0 z-10 px-1 py-1 whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)", width: '84px' }}>
                        {format(parseISO(group.date), "MM月dd日", { locale: ja })}
                      </td>
                      
                      {/* 時間帯列（編集不可） */}
                      <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '50px' }}>
                        {group.timing}
                      </td>
                      
                      {/* 記録時間列（編集可能） */}
                      <td className="p-1 border border-gray-300" style={{ width: '85px' }}>
                        <div className="flex items-center gap-1 justify-center">
                          <InputWithDropdown
                            value={record?.hour ? record.hour.toString().padStart(2, "0") : ""}
                            options={hourOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "hour", value)}
                            placeholder=""
                            className="w-12 text-xs"
                          />
                          <span className="text-xs">:</span>
                          <InputWithDropdown
                            value={record?.minute ? record.minute.toString().padStart(2, "0") : ""}
                            options={minuteOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "minute", value)}
                            placeholder=""
                            className="w-12 text-xs"
                          />
                        </div>
                      </td>
                      
                      <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '50px' }}>
                        {group.resident?.roomNumber || "-"}
                      </td>
                      <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '84px' }}>
                        {group.resident?.name || "-"}
                      </td>
                      
                      {/* 記入者 */}
                      <td className="p-1 border border-gray-300" style={{ width: '84px' }}>
                        <InputWithDropdown
                          value={record?.staffName || ""}
                          options={staffNameOptions}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "staffName", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>
                      
                      {/* 体温 */}
                      <td className="p-1 border border-gray-300" style={{ width: '70px' }}>
                        <InputWithDropdown
                          value={record?.temperature ? parseFloat(record.temperature.toString()).toFixed(1) : ""}
                          options={temperatureOptions}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "temperature", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>
                      
                      {/* 血圧 */}
                      <td className="p-1 border border-gray-300" style={{ width: '110px' }}>
                        <div className="flex items-center gap-0.5">
                          <InputWithDropdown
                            value={record?.bloodPressureSystolic ? String(record.bloodPressureSystolic) : ""}
                            options={systolicBPOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "bloodPressureSystolic", value)}
                            placeholder=""
                            className="w-full"
                            dropdownWidth="90px"
                          />
                          <span className="text-xs">/</span>
                          <InputWithDropdown
                            value={record?.bloodPressureDiastolic ? String(record.bloodPressureDiastolic) : ""}
                            options={diastolicBPOptions}
                            onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "bloodPressureDiastolic", value)}
                            placeholder=""
                            className="w-full"
                            dropdownWidth="90px"
                          />
                        </div>
                      </td>
                      
                      {/* 脈拍 */}
                      <td className="p-1 border border-gray-300" style={{ width: '70px' }}>
                        <InputWithDropdown
                          value={record?.pulseRate ? String(record.pulseRate) : ""}
                          options={pulseOptions}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "pulseRate", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>
                      
                      {/* SpO2 */}
                      <td className="p-1 border border-gray-300" style={{ width: '70px' }}>
                        <InputWithDropdown
                          value={record?.oxygenSaturation ? String(record.oxygenSaturation) : ""}
                          options={spo2Options}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "oxygenSaturation", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>
                      
                      {/* 血糖 */}
                      <td className="p-1 border border-gray-300" style={{ width: '70px' }}>
                        {(() => {
                          const recordKey = `${group.residentId}_${group.date}_${group.timing}_bloodSugar`;
                          const localValue = localEdits.get(recordKey);
                          const displayValue = localValue !== undefined ? localValue : (record?.bloodSugar || "");
                          
                          return (
                            <Input
                              type="text"
                              value={displayValue}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setLocalEdits(prev => new Map(prev.set(recordKey, newValue)));
                              }}
                              onBlur={(e) => {
                                const newValue = e.target.value;
                                if (group.residentId && newValue !== (record?.bloodSugar || "")) {
                                  handleSave(group.residentId, group.date, group.timing, "bloodSugar", newValue);
                                }
                                // ローカル編集をクリア
                                setLocalEdits(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(recordKey);
                                  return newMap;
                                });
                              }}
                              placeholder=""
                              className="h-7 text-xs px-1 w-full"
                            />
                          );
                        })()}
                      </td>
                      
                      {/* 呼吸 */}
                      <td className="p-1 border border-gray-300" style={{ width: '70px' }}>
                        <InputWithDropdown
                          value={record?.respirationRate ? String(record.respirationRate) : ""}
                          options={respirationOptions}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, group.timing, "respirationRate", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>
                      
                      {/* 記録内容 */}
                      <td className="p-1 border border-gray-300">
                        <ResizableNotesInput
                          recordId={`${group.residentId}_${group.date}_${group.timing}`}
                          initialValue={localNotes.get(`${group.residentId}_${group.date}_${group.timing}`) ?? record?.notes ?? ""}
                          onLocalChange={handleNotesLocalChange}
                          onSave={handleNotesSave}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}