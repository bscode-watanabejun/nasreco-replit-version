import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

// グラフ用カラーパレット
const colors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
  '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#d35400',
  '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad',
  '#16a085', '#d68910', '#2c3e50', '#7f8c8d', '#a93226'
];

// バイタル項目の単位を取得する関数
const getVitalUnit = (vitalType: string) => {
  switch (vitalType) {
    case '体温': return '℃';
    case '収縮期血圧':
    case '拡張期血圧': return 'mmHg';
    case '脈拍': return 'bpm';
    case 'SpO2': return '%';
    case '血糖': return 'mg/dl';
    case '呼吸': return '/min';
    default: return '';
  }
};

// 線の種類を判定する関数
const getLineStyle = (vitalType: string) => {
  switch (vitalType) {
    case '収縮期血圧': return '破線';
    case '拡張期血圧': return '点線';
    case '体温':
    case '脈拍':
    case 'SpO2':
    case '血糖':
    case '呼吸':
    default: return '実線';
  }
};

// 線の種類を視覚的に表示する関数
const getLineStyleSymbol = (vitalType: string) => {
  switch (vitalType) {
    case '収縮期血圧': return '━ ━ ━'; // 破線
    case '拡張期血圧': return '· · · ·'; // 点線
    default: return '━━━━'; // 実線
  }
};

// 期間内の全日付を生成する関数
const generateDateRange = (from: string, to: string) => {
  const dates: string[] = [];
  const start = parseISO(from);
  const end = parseISO(to);
  let currentDate = start;
  
  while (currentDate <= end) {
    dates.push(format(currentDate, "MM/dd"));
    currentDate = addDays(currentDate, 1);
  }
  
  return dates;
};

// カスタムTooltipコンポーネント
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-medium text-sm mb-2">{`日付: ${label}`}</p>
        {payload.map((entry: any, index: number) => {
          const [residentName, vitalType] = entry.dataKey.split('_');
          let value = entry.value;
          
          // 体温、SpO2、血糖は小数点１桁まで表示
          if (vitalType === '体温' || vitalType === 'SpO2' || vitalType === '血糖') {
            value = Number(value).toFixed(1);
          } else {
            // その他は整数表示
            value = Math.round(Number(value));
          }
          
          const lineStyle = getLineStyle(vitalType);
          const lineSymbol = getLineStyleSymbol(vitalType);
          
          return (
            <div key={index} className="text-sm mb-1">
              <div className="flex items-center gap-2">
                <span style={{ color: entry.color, fontFamily: 'monospace', fontSize: '12px' }}>
                  {lineSymbol}
                </span>
                <span style={{ color: entry.color }}>
                  {`${residentName} ${vitalType}: ${value}${getVitalUnit(vitalType)}`}
                </span>
              </div>
              <div className="text-xs text-gray-500 ml-6">
                {`線種: ${lineStyle}`}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

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
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [visibleLines, setVisibleLines] = useState({
    temperature: true,
    bloodPressure: true,
    pulseRate: true,
    oxygenSaturation: true,
    bloodSugar: true,
    respirationRate: true,
  });
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

  // グラフモード時の期間自動調整
  useEffect(() => {
    if (viewMode === 'graph' && dateFrom) {
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
      
      if (viewMode === 'graph') {
        // グラフモードでは最大1ヶ月
        if (daysDiff > 31) {
          let newTo: Date;
          if (from.getDate() === 1) {
            newTo = endOfMonth(from);
          } else {
            const nextMonthSameDay = addMonths(from, 1);
            newTo = subDays(nextMonthSameDay, 1);
          }
          setDateTo(format(newTo, "yyyy-MM-dd"));
          toast({
            title: "期間制限",
            description: "グラフ表示では期間は最大1ヶ月までです。終了日を調整しました。",
          });
        }
      } else {
        // リストモードでは最大2ヶ月
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

  // バイタルサインデータの取得
  const { data: vitalData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vital-signs", dateFrom, dateTo],
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

  // グラフ用データの準備（利用者別）
  const { graphData, residentDataKeys } = useMemo(() => {
    if (viewMode !== 'graph') return { graphData: [], residentDataKeys: {} };

    // 日付ごとにデータを集約
    const dataByDate = new Map<string, any>();
    const residentDataKeys: Record<string, string[]> = {
      体温: [],
      収縮期血圧: [],
      拡張期血圧: [],
      脈拍: [],
      SpO2: [],
      血糖: [],
      呼吸: []
    };

    // 期間内の全日付を事前に生成
    const allDates = generateDateRange(dateFrom, dateTo);
    allDates.forEach(dateKey => {
      dataByDate.set(dateKey, { date: dateKey });
    });

    // 実際のデータを上記に追加
    filteredData.forEach(record => {
      const dateKey = format(new Date(record.recordDate), "MM/dd");
      const resident = residents.find(r => r.id === record.residentId);
      const residentName = resident?.name || "不明";
      
      const data = dataByDate.get(dateKey);
      if (!data) return; // 期間外のデータはスキップ
      
      // 各バイタル項目ごとに利用者別データを保存
      if (record.temperature) {
        const key = `${residentName}_体温`;
        data[key] = parseFloat(record.temperature.toString());
        if (!residentDataKeys.体温.includes(key)) {
          residentDataKeys.体温.push(key);
        }
      }
      if (record.bloodPressureSystolic) {
        const key = `${residentName}_収縮期血圧`;
        data[key] = parseInt(record.bloodPressureSystolic.toString());
        if (!residentDataKeys.収縮期血圧.includes(key)) {
          residentDataKeys.収縮期血圧.push(key);
        }
      }
      if (record.bloodPressureDiastolic) {
        const key = `${residentName}_拡張期血圧`;
        data[key] = parseInt(record.bloodPressureDiastolic.toString());
        if (!residentDataKeys.拡張期血圧.includes(key)) {
          residentDataKeys.拡張期血圧.push(key);
        }
      }
      if (record.pulseRate) {
        const key = `${residentName}_脈拍`;
        data[key] = parseInt(record.pulseRate.toString());
        if (!residentDataKeys.脈拍.includes(key)) {
          residentDataKeys.脈拍.push(key);
        }
      }
      if (record.oxygenSaturation) {
        const key = `${residentName}_SpO2`;
        data[key] = parseFloat(record.oxygenSaturation.toString());
        if (!residentDataKeys.SpO2.includes(key)) {
          residentDataKeys.SpO2.push(key);
        }
      }
      if (record.bloodSugar) {
        const key = `${residentName}_血糖`;
        data[key] = parseFloat(record.bloodSugar.toString());
        if (!residentDataKeys.血糖.includes(key)) {
          residentDataKeys.血糖.push(key);
        }
      }
      if (record.respirationRate) {
        const key = `${residentName}_呼吸`;
        data[key] = parseInt(record.respirationRate.toString());
        if (!residentDataKeys.呼吸.includes(key)) {
          residentDataKeys.呼吸.push(key);
        }
      }
    });

    // 日付順にソート（既に順序は正しいが明示的にソート）
    const graphData = Array.from(dataByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    return { graphData, residentDataKeys };
  }, [filteredData, viewMode, residents, dateFrom, dateTo]);

  // バイタル記録の更新
  const updateVitalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<any> }) => {
      return apiRequest(`/api/vital-signs/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // 楽観的更新のためにクエリをキャンセル
      const queryKey = ["/api/vital-signs", dateFrom, dateTo];
      await queryClient.cancelQueries({ queryKey });
      
      // 現在のデータを取得
      const previousData = queryClient.getQueryData<any[]>(queryKey);
      
      // 楽観的更新
      if (previousData) {
        queryClient.setQueryData<any[]>(queryKey, (old) => {
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
      const queryKey = ["/api/vital-signs", dateFrom, dateTo];
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
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
      const queryKey = ["/api/vital-signs", dateFrom, dateTo];
      
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

  // 印刷処理
  const handlePrint = () => {
    try {
      // APIパラメータをURLエンコード
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        selectedFloor,
        selectedResident,
        selectedTiming
      });

      // 新しいタブでHTML印刷ページを表示
      const printUrl = `/api/vital-signs/print?${params.toString()}`;
      window.open(printUrl, '_blank');

    } catch (error) {
      console.error('印刷処理エラー:', error);
      toast({
        title: "エラー",
        description: "印刷ページの表示に失敗しました。しばらく待ってから再度お試しください。",
        variant: "destructive",
      });
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
            const menuPath = getEnvironmentPath("/check-list-menu");
            navigate(`${menuPath}${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">
          {viewMode === 'graph' ? 'バイタルグラフ' : 'バイタルチェック一覧'}
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
            {viewMode === 'list' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handlePrint}
              >
                印刷
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setViewMode(viewMode === 'graph' ? 'list' : 'graph')}
            >
              {viewMode === 'graph' ? 'バイタルチェック一覧' : 'バイタルグラフ'}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : viewMode === 'graph' ? (
          // グラフ表示
          <div className="flex-1 p-4">
            {/* 固定エリア - チェックボックス + グラフ */}
            <div>
              {/* グラフ表示切り替えチェックボックス */}
              <div className="flex gap-4 mb-4 bg-white p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="temperature"
                  checked={visibleLines.temperature}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, temperature: checked as boolean }))}
                />
                <label htmlFor="temperature" className="text-sm cursor-pointer">体温</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bloodPressure"
                  checked={visibleLines.bloodPressure}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, bloodPressure: checked as boolean }))}
                />
                <label htmlFor="bloodPressure" className="text-sm cursor-pointer">血圧</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pulseRate"
                  checked={visibleLines.pulseRate}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, pulseRate: checked as boolean }))}
                />
                <label htmlFor="pulseRate" className="text-sm cursor-pointer">脈拍</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="oxygenSaturation"
                  checked={visibleLines.oxygenSaturation}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, oxygenSaturation: checked as boolean }))}
                />
                <label htmlFor="oxygenSaturation" className="text-sm cursor-pointer">SpO2</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bloodSugar"
                  checked={visibleLines.bloodSugar}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, bloodSugar: checked as boolean }))}
                />
                <label htmlFor="bloodSugar" className="text-sm cursor-pointer">血糖</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="respirationRate"
                  checked={visibleLines.respirationRate}
                  onCheckedChange={(checked) => 
                    setVisibleLines(prev => ({ ...prev, respirationRate: checked as boolean }))}
                />
                <label htmlFor="respirationRate" className="text-sm cursor-pointer">呼吸</label>
              </div>
            </div>

            {/* 利用者数の警告メッセージ */}
            {(() => {
              const totalResidents = new Set([
                ...residentDataKeys.体温,
                ...residentDataKeys.収縮期血圧,
                ...residentDataKeys.拡張期血圧,
                ...residentDataKeys.脈拍,
                ...residentDataKeys.SpO2,
                ...residentDataKeys.血糖,
                ...residentDataKeys.呼吸
              ].map(key => key.split('_')[0])).size;
              
              if (totalResidents > 5) {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ 表示対象の利用者が{totalResidents}名います。グラフが見づらい場合は、特定の利用者や階を選択して絞り込むことをお勧めします。
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* 折れ線グラフ */}
            <div className="bg-white p-4 rounded-lg border mb-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="temp" orientation="left" label={{ value: '体温(℃)', angle: -90, position: 'insideLeft' }} domain={[35, 40]} />
                  <YAxis yAxisId="bp" orientation="right" label={{ value: '血圧/脈拍/SpO2/血糖/呼吸', angle: 90, position: 'insideRight' }} domain={[40, 180]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {/* 体温 */}
                  {visibleLines.temperature && residentDataKeys.体温.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="temp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[index % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name={key.replace('_体温', '')}
                    />
                  ))}
                  
                  {/* 収縮期血圧 */}
                  {visibleLines.bloodPressure && residentDataKeys.収縮期血圧.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[index % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      strokeDasharray="5 5"
                      name={key.replace('_収縮期血圧', ' 収縮期')}
                    />
                  ))}
                  
                  {/* 拡張期血圧 */}
                  {visibleLines.bloodPressure && residentDataKeys.拡張期血圧.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[index % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      strokeDasharray="2 2"
                      name={key.replace('_拡張期血圧', ' 拡張期')}
                    />
                  ))}
                  
                  {/* 脈拍 */}
                  {visibleLines.pulseRate && residentDataKeys.脈拍.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[(index + 5) % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name={key.replace('_脈拍', ' 脈拍')}
                    />
                  ))}
                  
                  {/* SpO2 */}
                  {visibleLines.oxygenSaturation && residentDataKeys.SpO2.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[(index + 8) % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name={key.replace('_SpO2', ' SpO2')}
                    />
                  ))}
                  
                  {/* 血糖 */}
                  {visibleLines.bloodSugar && residentDataKeys.血糖.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[(index + 11) % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name={key.replace('_血糖', ' 血糖')}
                    />
                  ))}
                  
                  {/* 呼吸 */}
                  {visibleLines.respirationRate && residentDataKeys.呼吸.map((key, index) => (
                    <Line 
                      key={key}
                      yAxisId="bp" 
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[(index + 14) % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name={key.replace('_呼吸', ' 呼吸')}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>

            {/* スクロールエリア - データテーブル（読み取り専用） */}
            <div className="px-4 pb-4">
              <div className="bg-white border overflow-auto" style={{ height: 'calc(100vh - 570px)' }}>
                <table className="relative border-collapse w-full">
                  <thead className="sticky top-0 z-50">
                    <tr className="bg-gray-50">
                      <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-60 px-1 py-2" style={{ width: '84px' }}>記録日</th>
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
                          {/* 記録日列 */}
                          <td className="text-xs border border-gray-300 sticky left-0 z-40 px-1 py-1 whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)", width: '84px' }}>
                            {format(parseISO(group.date), "MM月dd日", { locale: ja })}
                          </td>
                          
                          {/* 時間帯列 */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '50px' }}>
                            {group.timing}
                          </td>
                          
                          {/* 記録時間列（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '85px' }}>
                            {record?.hour && record?.minute ? 
                              `${record.hour.toString().padStart(2, "0")}:${record.minute.toString().padStart(2, "0")}` : 
                              "-"
                            }
                          </td>
                      
                          {/* 居室番号 */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '50px' }}>
                            {group.resident?.roomNumber || "-"}
                          </td>
                          
                          {/* 利用者名 */}
                          <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '84px' }}>
                            {group.resident?.name || "-"}
                          </td>
                          
                          {/* 記入者（読み取り専用） */}
                          <td className="text-xs border border-gray-300 px-1 py-1" style={{ width: '84px' }}>
                            {record?.staffName || "-"}
                          </td>
                          
                          {/* 体温（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '70px' }}>
                            {record?.temperature ? parseFloat(record.temperature.toString()).toFixed(1) : "-"}
                          </td>
                          
                          {/* 血圧（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '110px' }}>
                            {record?.bloodPressureSystolic && record?.bloodPressureDiastolic ? 
                              `${record.bloodPressureSystolic}/${record.bloodPressureDiastolic}` : 
                              "-"
                            }
                          </td>
                          
                          {/* 脈拍（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '70px' }}>
                            {record?.pulseRate || "-"}
                          </td>
                          
                          {/* SpO2（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '70px' }}>
                            {record?.oxygenSaturation || "-"}
                          </td>
                          
                          {/* 血糖（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '70px' }}>
                            {record?.bloodSugar || "-"}
                          </td>
                          
                          {/* 呼吸（読み取り専用） */}
                          <td className="text-xs border border-gray-300 text-center px-1 py-1" style={{ width: '70px' }}>
                            {record?.respirationRate || "-"}
                          </td>
                          
                          {/* 記録内容（読み取り専用） */}
                          <td className="text-xs border border-gray-300 px-1 py-1">
                            {record?.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          // リスト表示（既存のコード）
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