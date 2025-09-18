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
import { format, parseISO, startOfMonth, addMonths, subMonths, startOfYear, endOfYear } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WeightRecord, Resident } from "@shared/schema";
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

// 年月選択肢を生成（過去1年から未来6ヶ月）
const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();

  // 過去1年
  for (let i = 12; i >= 1; i--) {
    const date = subMonths(currentDate, i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "yyyy年M月", { locale: ja }),
    });
  }

  // 現在月
  options.push({
    value: format(currentDate, "yyyy-MM"),
    label: format(currentDate, "yyyy年M月", { locale: ja }),
  });

  // 未来6ヶ月
  for (let i = 1; i <= 6; i++) {
    const date = addMonths(currentDate, i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "yyyy年M月", { locale: ja }),
    });
  }

  return options;
};

// 年度選択肢を生成（過去5年度）
const generateYearOptions = () => {
  const options = [];
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = Jan, 3 = Apr)

  // 現在月が4月以前なら前年度、4月以降なら当年度
  const currentFiscalYear = currentMonth < 3 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

  // 過去5年度分を生成
  for (let i = 0; i < 5; i++) {
    const year = currentFiscalYear - i;
    options.push({
      value: year.toString(),
      label: `${year}年度`,
    });
  }

  return options;
};

// 年月から年度を算出する関数
const getYearFromYearMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  // 4月以降なら当年度、3月以前なら前年度
  const fiscalYear = month >= 4 ? year : year - 1;
  return fiscalYear.toString();
};

// 年度から期間を取得する関数（4月〜翌年3月）
const getFiscalYearRange = (fiscalYear: string) => {
  const year = parseInt(fiscalYear);
  const startDate = new Date(year, 3, 1); // 4月1日
  const endDate = new Date(year + 1, 2, 31); // 翌年3月31日
  return { startDate, endDate };
};

// 月の日本語表示を取得
const getMonthLabel = (monthIndex: number): string => {
  const months = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
  return months[monthIndex];
};

// 年度と月インデックスから年月表示を取得
const getYearMonthLabel = (fiscalYear: string, monthIndex: number): string => {
  const year = parseInt(fiscalYear);
  const months = [
    `${year}年4月`, `${year}年5月`, `${year}年6月`, `${year}年7月`,
    `${year}年8月`, `${year}年9月`, `${year}年10月`, `${year}年11月`,
    `${year}年12月`, `${year + 1}年1月`, `${year + 1}年2月`, `${year + 1}年3月`
  ];
  return months[monthIndex];
};

// グラフ用の色を取得
const getChartColors = () => [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#d35400',
  '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad',
  '#16a085', '#d68910', '#2c3e50', '#7f8c8d', '#a93226'
];

// 体重の前月比を算出し、2kg以上の差があるかチェック
const isWeightChangeSignificant = (currentWeight: number | null, previousWeight: number | null): boolean => {
  if (!currentWeight || !previousWeight) return false;
  return Math.abs(currentWeight - previousWeight) >= 2;
};


// 全角数字を半角数字に変換するユーティリティ関数
const convertZenkakuToHankaku = (text: string): string => {
  return text.replace(/[０-９．]/g, (char) => {
    const zenkakuNums = '０１２３４５６７８９．';
    const hankakuNums = '0123456789.';
    const index = zenkakuNums.indexOf(char);
    return index !== -1 ? hankakuNums[index] : char;
  });
};

// 体重入力値のバリデーションとフォーマット
const validateAndFormatWeight = (input: string): string => {
  if (!input || input.trim() === '') return '';

  // 全角を半角に変換
  let formatted = convertZenkakuToHankaku(input.trim());

  // 数字と小数点以外を除去
  formatted = formatted.replace(/[^0-9.]/g, '');

  // 小数点が複数ある場合は最初の一つだけ残す
  const parts = formatted.split('.');
  if (parts.length > 2) {
    formatted = parts[0] + '.' + parts.slice(1).join('');
  }

  // 先頭の0を除去（ただし "0." や "0" は保持）
  if (formatted.length > 1 && formatted[0] === '0' && formatted[1] !== '.') {
    formatted = formatted.substring(1);
  }

  return formatted;
};

// 最終的な体重値のフォーマット（保存時）
const finalFormatWeight = (input: string): string => {
  const validated = validateAndFormatWeight(input);
  if (!validated) return '';

  // 末尾の小数点を除去
  if (validated.endsWith('.')) {
    return validated.slice(0, -1);
  }

  // 数値として無効な場合は空文字を返す
  const numValue = parseFloat(validated);
  if (isNaN(numValue) || numValue < 0 || numValue > 999) {
    return '';
  }

  return validated;
};

// 15分間隔の日時選択コンポーネント（体重一覧画面から流用）
function DateTimeSelector({
  value,
  onChange,
  disabled = false,
  className = "",
  defaultMonth = null,
}: {
  value: string | null;
  onChange: (dateTime: string) => void;
  disabled?: boolean;
  className?: string;
  defaultMonth?: string | null; // "yyyy-MM" 形式
}) {
  // 日時を分解（value が null の場合は空欄表示）
  const parseDateTime = (dateTimeStr: string | null) => {
    if (!dateTimeStr) {
      // 未記録の場合は常に空欄を表示（defaultMonthに関係なく）
      return { date: '', time: '', minute: '' };
    }

    try {
      const dt = new Date(dateTimeStr);
      if (isNaN(dt.getTime())) return { date: '', time: '', minute: '' };

      // JSTに変換
      const jstDate = new Date(dt.getTime() + (9 * 60 * 60 * 1000));
      const date = jstDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const hour = jstDate.getUTCHours().toString().padStart(2, '0');
      const minute = jstDate.getUTCMinutes();

      // 分を15分間隔に丸める
      const roundedMinute = Math.round(minute / 15) * 15;
      const finalMinute = roundedMinute >= 60 ? '00' : roundedMinute.toString().padStart(2, '0');

      return {
        date,
        time: hour,
        minute: finalMinute
      };
    } catch (error) {
      return { date: '', time: '', minute: '' };
    }
  };

  const { date, time, minute } = parseDateTime(value);

  // 時刻選択肢（00-23）
  const hourOptions24 = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0')
  }));

  // 分選択肢（15分間隔）
  const minuteOptions15 = [
    { value: '00', label: '00' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
    { value: '45', label: '45' }
  ];

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;

    // 時・分が未設定の場合はデフォルト値を使用
    const defaultTime = time || new Date().getHours().toString().padStart(2, '0');
    const defaultMinute = minute || '00';

    const dateTimeStr = `${newDate}T${defaultTime}:${defaultMinute}:00+09:00`;
    const jstDate = new Date(dateTimeStr);
    onChange(jstDate.toISOString());
  };

  const handleTimeChange = (newTime: string) => {
    if (!newTime) return;

    // 日付・分が未設定の場合はデフォルト値を使用
    const defaultDate = date || new Date().toISOString().slice(0, 10);
    const defaultMinute = minute || '00';

    const dateTimeStr = `${defaultDate}T${newTime}:${defaultMinute}:00+09:00`;
    const jstDate = new Date(dateTimeStr);
    onChange(jstDate.toISOString());
  };

  const handleMinuteChange = (newMinute: string) => {
    if (!newMinute) return;

    // 日付・時が未設定の場合はデフォルト値を使用
    const defaultDate = date || new Date().toISOString().slice(0, 10);
    const defaultTime = time || new Date().getHours().toString().padStart(2, '0');

    const dateTimeStr = `${defaultDate}T${defaultTime}:${newMinute}:00+09:00`;
    const jstDate = new Date(dateTimeStr);
    onChange(jstDate.toISOString());
  };

  return (
    <div className={`flex gap-1 ${className}`}>
      {/* 日付選択 */}
      <input
        type="date"
        value={date}
        onChange={(e) => handleDateChange(e.target.value)}
        className="w-28 h-7 px-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={defaultMonth ? `${defaultMonth}` : ""}
        title={defaultMonth ? `${defaultMonth}の日付を選択してください` : "日付を選択してください"}
        disabled={disabled}
      />

      {/* 時選択 */}
      <InputWithDropdown
        value={time}
        options={hourOptions24}
        onSave={handleTimeChange}
        placeholder="時"
        className="w-8 h-7 px-1 text-xs text-center border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <span className="text-xs text-gray-600 flex items-center">:</span>

      {/* 分選択（15分間隔） */}
      <InputWithDropdown
        value={minute}
        options={minuteOptions15}
        onSave={handleMinuteChange}
        placeholder="分"
        className="w-8 h-7 px-1 text-xs text-center border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// 記録内容用のIME対応リサイズ可能textareaコンポーネント
function ResizableNotesInput({
  recordId,
  initialValue,
  onSave,
  disabled = false,
}: {
  recordId: string;
  initialValue: string;
  onSave: (recordId: string, value: string) => void;
  disabled?: boolean;
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
    if (!isComposing) {
      onSave(recordId, value);
    }
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
      className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 resize-y focus:outline-none focus:border-blue-500 min-h-[32px]"
      rows={1}
      disabled={disabled}
    />
  );
}

// InputWithDropdownコンポーネント（入浴チェック一覧から流用）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  type = "text",
  dropdownWidth,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  type?: "text" | "number";
  dropdownWidth?: string;
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
          className={`absolute z-[9999] bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto`}
          style={{
            [dropdownPosition === 'top' ? 'bottom' : 'top']: '100%',
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px',
            width: dropdownWidth || '50px'
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

export default function WeightCheckList() {
  const [, navigate] = useLocation();

  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const floorParam = urlParams.get('floor');
  const viewModeParam = urlParams.get('viewMode');

  // 初期値の設定
  const initialMonth = dateParam ? format(parseISO(dateParam), "yyyy-MM") : format(new Date(), "yyyy-MM");
  const initialYear = getYearFromYearMonth(initialMonth);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedFloor, setSelectedFloor] = useState(floorParam || "all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [showYearlyGraph, setShowYearlyGraph] = useState(viewModeParam === 'yearly');
  const [localWeightValues, setLocalWeightValues] = useState<Map<string, string>>(new Map());
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

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // 体重記録データの取得（月次）
  const { data: weightRecords = [], isLoading } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight-records"],
    queryFn: () => apiRequest("/api/weight-records"),
    refetchOnMount: true,
    staleTime: 0,
    enabled: !showYearlyGraph,
  });

  // 体重記録データの取得（年次）
  const { data: yearlyWeightRecords = [], isLoading: isYearlyLoading } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight-records", "yearly", selectedYear],
    queryFn: async () => {
      const { startDate, endDate } = getFiscalYearRange(selectedYear);
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return apiRequest(`/api/weight-records?${params.toString()}`);
    },
    refetchOnMount: true,
    staleTime: 0,
    enabled: showYearlyGraph,
  });

  // 体重記録の更新
  const updateWeightMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WeightRecord> }) => {
      if (id.startsWith("temp-")) {
        // 新規作成
        return apiRequest("/api/weight-records", "POST", data);
      } else {
        // 既存レコードの更新
        return apiRequest(`/api/weight-records/${id}`, "PATCH", data);
      }
    },
    onMutate: async ({ id, data }) => {
      // 楽観的更新のためにクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/weight-records"] });

      // 現在のデータを取得
      const previousData = queryClient.getQueryData<WeightRecord[]>(["/api/weight-records"]);

      // 楽観的更新
      if (previousData) {
        if (id.startsWith("temp-")) {
          // 新規作成の場合：一時的レコードを実際のデータで置き換える
          queryClient.setQueryData<WeightRecord[]>(["/api/weight-records"], (old) => {
            if (!old) return old;
            return old.map(record =>
              record.id === id ? { ...record, ...data } : record
            );
          });
        } else {
          // 更新の場合：既存レコードを更新
          queryClient.setQueryData<WeightRecord[]>(["/api/weight-records"], (old) => {
            if (!old) return old;
            return old.map(record =>
              record.id === id ? { ...record, ...data } : record
            );
          });
        }
      }

      // ロールバック用に以前のデータを返す
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
    },
    onError: (error: any, variables, context) => {
      // エラー時は元のデータに戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/weight-records"], context.previousData);
      }

      toast({
        title: "エラー",
        description: error.message || "データの更新に失敗しました",
        variant: "destructive",
      });

      // エラー時もキャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["/api/weight-records"] });
    },
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = weightRecords;

    // 月でフィルタ
    filtered = filtered.filter(record => {
      if (!record.recordDate) return false;
      const recordMonth = format(new Date(record.recordDate), "yyyy-MM");
      return recordMonth === selectedMonth;
    });

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
  }, [weightRecords, selectedMonth, selectedFloor, selectedResident, residents]);

  // 表示用データの生成（記録がない利用者も含む）
  const displayData = useMemo(() => {
    // フィルタリングされた利用者のリスト
    const filteredResidents = residents.filter(resident => {
      if (selectedFloor !== "all" &&
          resident.floor !== selectedFloor &&
          resident.floor !== `${selectedFloor}階`) return false;
      if (selectedResident !== "all" && resident.id !== selectedResident) return false;
      return true;
    });

    // 各利用者に対して記録を検索または空のレコードを作成
    const data = filteredResidents.map(resident => {
      const existingRecord = filteredData.find(record => record.residentId === resident.id);

      if (existingRecord) {
        return {
          ...existingRecord,
          resident,
        };
      } else {
        // 記録がない場合は一時的なIDで空のレコードを作成
        return {
          id: `temp-${resident.id}-${selectedMonth}`,
          residentId: resident.id,
          recordDate: null,
          staffName: null,
          weight: null,
          notes: null,
          resident,
          isTemporary: true,
        };
      }
    });

    // 居室番号でソート
    return data.sort((a, b) => {
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
  }, [filteredData, residents, selectedFloor, selectedResident, selectedMonth]);

  // データの保存
  const handleSave = (recordId: string, residentId: string, field: string, value: any) => {
    const existingRecord = displayData.find(d => d.id === recordId);

    // recordDataの作成
    const recordData: any = {
      residentId,
    };

    // 新規作成か更新かを判定
    const isNewRecord = recordId.startsWith("temp-");

    if (isNewRecord) {
      // 新規作成時：全フィールドを含める
      recordData.staffName = field === 'staffName' ? value : (existingRecord?.staffName || null);
      recordData.weight = field === 'weight' ? value : (existingRecord?.weight || null);
      recordData.notes = field === 'notes' ? value : (existingRecord?.notes || null);

      if (field === 'recordDate') {
        recordData.recordDate = new Date(value);
      } else {
        recordData.recordDate = existingRecord?.recordDate ? new Date(existingRecord.recordDate) : new Date();
      }
    } else {
      // 更新時：変更されたフィールドのみ
      if (field === 'recordDate') {
        recordData.recordDate = new Date(value);
      } else {
        recordData[field] = value;
      }
    }

    // 更新処理を実行
    updateWeightMutation.mutate({ id: recordId, data: recordData });
  };

  // 体重値の保存（特別処理）
  const handleWeightSave = (recordId: string, residentId: string, value: string) => {
    const finalValue = finalFormatWeight(value);
    handleSave(recordId, residentId, 'weight', finalValue || null);

    // ローカル状態をクリア
    setLocalWeightValues(prev => {
      const newMap = new Map(prev);
      newMap.delete(recordId);
      return newMap;
    });
  };

  // 年次グラフ/一覧表示の切り替えハンドラー
  const handleViewToggle = () => {
    const newViewMode = !showYearlyGraph;
    setShowYearlyGraph(newViewMode);

    // URLパラメータを更新
    const params = new URLSearchParams();
    if (selectedFloor !== "all") params.set("floor", selectedFloor);
    if (newViewMode) {
      params.set("viewMode", "yearly");
      if (selectedYear !== getYearFromYearMonth(format(new Date(), "yyyy-MM"))) {
        params.set("year", selectedYear);
      }
    } else {
      if (selectedMonth !== format(new Date(), "yyyy-MM")) {
        const firstDay = format(startOfMonth(parseISO(selectedMonth + "-01")), "yyyy-MM-dd");
        params.set("date", firstDay);
      }
    }

    const newUrl = `/weight-check-list${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  };

  // 印刷ハンドラー
  const handlePrint = () => {
    try {
      const params = new URLSearchParams({
        selectedYear,
        selectedFloor,
        selectedResident
      });
      const printUrl = `/api/weight-records/print?${params.toString()}`;
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

  const monthOptions = generateMonthOptions();
  const yearOptions = generateYearOptions();

  // 年次グラフ用データの処理
  const yearlyGraphData = useMemo(() => {
    if (!showYearlyGraph || !yearlyWeightRecords.length) return [];

    // 利用者別・月別にデータを集約
    const residentMonthlyData: Record<string, Record<string, number | null>> = {};

    // フィルタリングされた利用者のリスト
    const filteredResidents = residents.filter(resident => {
      if (selectedFloor !== "all" &&
          resident.floor !== selectedFloor &&
          resident.floor !== `${selectedFloor}階`) return false;
      if (selectedResident !== "all" && resident.id !== selectedResident) return false;
      return true;
    });

    // データを月別に集約
    filteredResidents.forEach(resident => {
      residentMonthlyData[resident.id] = {};
      for (let i = 0; i < 12; i++) {
        const monthKey = getMonthLabel(i);
        residentMonthlyData[resident.id][monthKey] = null;
      }
    });

    yearlyWeightRecords.forEach(record => {
      if (!record.recordDate || !record.weight) return;

      const resident = residents.find(r => r.id === record.residentId);
      if (!resident) return;

      // フィルタリング
      if (selectedFloor !== "all" &&
          resident.floor !== selectedFloor &&
          resident.floor !== `${selectedFloor}階`) return;
      if (selectedResident !== "all" && record.residentId !== selectedResident) return;

      const recordDate = new Date(record.recordDate);
      const year = recordDate.getFullYear();
      const month = recordDate.getMonth(); // 0-based

      // 年度内の月かチェック
      const fiscalYear = parseInt(selectedYear);
      let monthIndex = -1;

      if (year === fiscalYear && month >= 3) {
        // 4月〜12月
        monthIndex = month - 3;
      } else if (year === fiscalYear + 1 && month <= 2) {
        // 1月〜3月
        monthIndex = month + 9;
      }

      if (monthIndex >= 0 && monthIndex < 12) {
        const monthKey = getMonthLabel(monthIndex);
        residentMonthlyData[record.residentId][monthKey] = parseFloat(record.weight.toString());
      }
    });

    // グラフ用データに変換
    const graphData = [];
    for (let i = 0; i < 12; i++) {
      const monthKey = getMonthLabel(i);
      const yearMonthLabel = getYearMonthLabel(selectedYear, i);
      const dataPoint: any = {
        month: monthKey,
        fullMonth: yearMonthLabel  // ツールチップ用の完全な年月表示
      };

      filteredResidents.forEach((resident, index) => {
        const residentKey = `${resident.roomNumber || 'ー'} ${resident.name}`;
        dataPoint[residentKey] = residentMonthlyData[resident.id][monthKey];
      });

      graphData.push(dataPoint);
    }

    return graphData;
  }, [showYearlyGraph, yearlyWeightRecords, residents, selectedYear, selectedFloor, selectedResident]);

  // 年次テーブル用データの処理
  const yearlyTableData = useMemo(() => {
    if (!showYearlyGraph || !yearlyWeightRecords.length) return [];

    // フィルタリングされた利用者のリスト
    const filteredResidents = residents.filter(resident => {
      if (selectedFloor !== "all" &&
          resident.floor !== selectedFloor &&
          resident.floor !== `${selectedFloor}階`) return false;
      if (selectedResident !== "all" && resident.id !== selectedResident) return false;
      return true;
    });

    return filteredResidents.map(resident => {
      const monthlyWeights: (number | null)[] = new Array(12).fill(null);

      // 該当する体重記録を月別に振り分け
      yearlyWeightRecords
        .filter(record => record.residentId === resident.id)
        .forEach(record => {
          if (!record.recordDate || !record.weight) return;

          const recordDate = new Date(record.recordDate);
          const year = recordDate.getFullYear();
          const month = recordDate.getMonth();

          const fiscalYear = parseInt(selectedYear);
          let monthIndex = -1;

          if (year === fiscalYear && month >= 3) {
            monthIndex = month - 3;
          } else if (year === fiscalYear + 1 && month <= 2) {
            monthIndex = month + 9;
          }

          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyWeights[monthIndex] = parseFloat(record.weight.toString());
          }
        });

      return {
        resident,
        monthlyWeights,
      };
    }).sort((a, b) => {
      const roomA = a.resident?.roomNumber || "";
      const roomB = b.resident?.roomNumber || "";
      const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
      const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

      if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
        return roomNumA - roomNumB;
      }
      return roomA.localeCompare(roomB, undefined, { numeric: true });
    });
  }, [showYearlyGraph, yearlyWeightRecords, residents, selectedYear, selectedFloor, selectedResident]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (selectedFloor !== "all") params.set("floor", selectedFloor);
            if (selectedMonth !== format(new Date(), "yyyy-MM")) {
              const firstDay = format(startOfMonth(parseISO(selectedMonth + "-01")), "yyyy-MM-dd");
              params.set("date", firstDay);
            }
            navigate(`/check-list-menu${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">
          {showYearlyGraph ? '体重チェック一覧 年次グラフ' : '体重チェック一覧'}
        </h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          {showYearlyGraph ? (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          <div className="ml-auto flex items-center gap-2">
            {showYearlyGraph && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-1" />
                印刷
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleViewToggle}
            >
              {showYearlyGraph ? '体重チェック一覧' : '年次グラフ'}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {showYearlyGraph ? (
          // 年次グラフ表示
          (isYearlyLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">データを読み込み中...</div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {/* 年次グラフ */}
              {yearlyGraphData.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h3 className="text-lg font-semibold mb-4">体重推移グラフ ({selectedYear}年度)</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yearlyGraphData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip
                          labelFormatter={(value, payload) => {
                            // payloadから完全な年月表示を取得
                            if (payload && payload.length > 0 && payload[0].payload) {
                              return payload[0].payload.fullMonth || value;
                            }
                            return value;
                          }}
                          formatter={(value: any, name: any) => {
                            if (value === null || value === undefined) {
                              return ['未記録', name];
                            }
                            return [`${value}kg`, name];
                          }}
                        />
                        <Legend />
                        {residents
                          .filter(resident => {
                            if (selectedFloor !== "all" &&
                                resident.floor !== selectedFloor &&
                                resident.floor !== `${selectedFloor}階`) return false;
                            if (selectedResident !== "all" && resident.id !== selectedResident) return false;
                            return true;
                          })
                          .map((resident, index) => {
                            const colors = getChartColors();
                            const residentKey = `${resident.roomNumber || 'ー'} ${resident.name}`;
                            return (
                              <Line
                                key={resident.id}
                                type="monotone"
                                dataKey={residentKey}
                                stroke={colors[index % colors.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                connectNulls={false}
                              />
                            );
                          })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 年次テーブル */}
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-auto">
                  <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-50">
                        <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-2 py-2" style={{ width: '60px' }}>居室</th>
                        <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-2 py-2" style={{ width: '120px' }}>利用者名</th>
                        {Array.from({ length: 12 }, (_, i) => (
                          <th key={i} className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '60px' }}>
                            {getMonthLabel(i)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyTableData.map((item, index) => (
                        <tr key={item.resident.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="text-xs border border-gray-300 sticky left-0 z-10 px-2 py-2 text-center whitespace-nowrap bg-inherit">
                            {item.resident.roomNumber || "-"}
                          </td>
                          <td className="text-xs border border-gray-300 px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.resident.name || "-"}
                          </td>
                          {item.monthlyWeights.map((weight, monthIndex) => {
                            const previousWeight = monthIndex > 0 ? item.monthlyWeights[monthIndex - 1] : null;
                            const isSignificant = weight !== null && isWeightChangeSignificant(weight, previousWeight);

                            return (
                              <td key={monthIndex} className="text-xs border border-gray-300 px-1 py-2 text-center">
                                <span className={isSignificant ? "text-red-600 font-bold" : ""}>
                                  {weight !== null ? weight.toString() : ""}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        ) : (
          // 通常の月次一覧表示
          isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">データを読み込み中...</div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto relative">
              <table className="relative border-collapse w-full" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50">
                  <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2" style={{ width: '50px' }}>居室</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '100px' }}>利用者名</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '220px' }}>記録日時</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '80px' }}>記入者</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '60px' }}>体重</th>
                  <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2">記録内容</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((item, index) => {
                  const record = item as any;
                  const localWeightValue = localWeightValues.get(record.id);

                  // 体重未登録の判定
                  const isWeightEmpty = !record.weight && !localWeightValue;

                  // 行の背景色を決定
                  const rowBgClass = isWeightEmpty ? "bg-pink-200" : (index % 2 === 0 ? "bg-white" : "bg-gray-50");
                  const stickyBgColor = isWeightEmpty ? "rgb(251 207 232)" : (index % 2 === 0 ? "white" : "rgb(249 250 251)");

                  return (
                    <tr key={record.id} className={rowBgClass}>
                      {/* 居室番号（スティッキー、編集不可） */}
                      <td className="text-xs border border-gray-300 sticky left-0 z-10 px-1 py-1 text-center whitespace-nowrap"
                          style={{ backgroundColor: stickyBgColor, width: '50px' }}>
                        {record.resident?.roomNumber || "-"}
                      </td>

                      {/* 利用者名（編集不可） */}
                      <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '100px' }}>
                        {record.resident?.name || "-"}
                      </td>

                      {/* 記録日時 */}
                      <td className="p-1 border border-gray-300" style={{ width: '220px' }}>
                        <DateTimeSelector
                          value={record.recordDate}
                          onChange={(dateTimeISO) => {
                            handleSave(record.id, record.residentId, "recordDate", dateTimeISO);
                          }}
                          className="w-full"
                          defaultMonth={showYearlyGraph ? null : selectedMonth}
                        />
                      </td>


                      {/* 記入者 */}
                      <td className="p-1 border border-gray-300" style={{ width: '80px' }}>
                        <InputWithDropdown
                          value={record.staffName || ""}
                          options={staffNameOptions}
                          onSave={(value) => handleSave(record.id, record.residentId, "staffName", value)}
                          placeholder="記入者"
                          className="w-full"
                          dropdownWidth="120px"
                        />
                      </td>

                      {/* 体重 */}
                      <td className="p-1 border border-gray-300" style={{ width: '60px' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={localWeightValue !== undefined ? localWeightValue : (record.weight?.toString() || "")}
                          onChange={(e) => {
                            const validatedValue = validateAndFormatWeight(e.target.value);
                            setLocalWeightValues(prev => {
                              const newMap = new Map(prev);
                              newMap.set(record.id, validatedValue);
                              return newMap;
                            });
                          }}
                          onBlur={() => {
                            const value = localWeightValue !== undefined ? localWeightValue : (record.weight?.toString() || "");
                            handleWeightSave(record.id, record.residentId, value);
                          }}
                          placeholder="kg"
                          className="w-full h-7 text-xs border border-gray-300 rounded px-1 text-center focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      {/* 記録内容 */}
                      <td className="p-1 border border-gray-300">
                        <ResizableNotesInput
                          recordId={record.id}
                          initialValue={record.notes || ""}
                          onSave={(recordId, value) => handleSave(recordId, record.residentId, "notes", value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </main>
    </div>
  );
}