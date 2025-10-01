import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
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
import { format, parseISO, startOfDay, endOfDay, addMonths, differenceInDays, endOfMonth, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Resident, FacilitySettings, MasterSetting } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { matchFloor } from "@/lib/floorFilterUtils";

// 便状態の選択肢（排泄一覧画面と同じ）
const stoolStateOptions = [
  { value: "", label: "" },
  { value: "普通便", label: "普通便" },
  { value: "水様便", label: "水様便" },
  { value: "軟便", label: "軟便" },
  { value: "硬便", label: "硬便" },
  { value: "未消化便", label: "未消化便" },
];

// 便量の選択肢（排泄一覧画面と同じ）
const stoolAmountOptions = [
  { value: "", label: "" },
  { value: "多", label: "多" },
  { value: "中", label: "中" },
  { value: "小", label: "小" },
  { value: "付", label: "付" },
];

// 尿量の選択肢（排泄一覧画面と同じ）
const urineAmountOptions = [
  { value: "", label: "" },
  { value: "○", label: "○" },
  { value: "×", label: "×" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
];

// 自立便・自立尿の選択肢（テキスト入力用に空配列）
const independentOptions: { value: string; label: string }[] = [];

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
      className="min-h-[64px] text-xs w-full px-2 py-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      rows={2}
    />
  );
}

// 数字専用InputWithDropdownコンポーネント
function NumericInputWithDropdown({
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
    // 数字のみ許可（空文字も許可）
    const numericValue = e.target.value.replace(/[^0-9]/g, '');
    setLocalValue(numericValue);
  };

  const handleFocus = () => {
    // フォーカス時に既存値を全選択（上書き入力しやすく）
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
    
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
    // オプションがない場合（テキスト入力）は即座に保存
    if (options.length === 0 && localValue !== value) {
      onSave(localValue);
    } else if (localValue !== value && !isSelecting) {
      // プルダウンの場合は既存の処理
      onSave(localValue);
    }
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 数字、制御キー（Backspace、Delete、Arrow、Tab、Enter）のみ許可
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Tab', 'Enter', 'Escape', 'Home', 'End'
    ];
    
    if (!allowedKeys.includes(e.key) && !/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (localValue !== value) {
        onSave(localValue);
      }
      // 次のフィールドに移動
      inputRef.current?.blur();
    }
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
    <div className={`relative ${className?.includes('h-full') ? 'h-full' : ''}`}>
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className ? `text-xs px-1 bg-white ${className}` : `h-7 text-xs px-1 bg-white`}
        inputMode="numeric"
        style={{ imeMode: 'disabled' }}
      />
      {isOpen && options.length > 0 && (
        <div 
          className={`absolute z-50 min-w-max bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto`}
          style={{
            [dropdownPosition === 'top' ? 'bottom' : 'top']: '100%',
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px',
            minWidth: '120px'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option.value)}
              className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100 whitespace-nowrap"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    // オプションがない場合（テキスト入力）は即座に保存
    if (options.length === 0 && localValue !== value) {
      onSave(localValue);
    } else if (localValue !== value && !isSelecting) {
      // プルダウンの場合は既存の処理
      onSave(localValue);
    }
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (localValue !== value) {
        onSave(localValue);
      }
      // 次のフィールドに移動
      inputRef.current?.blur();
    }
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
    <div className={`relative ${className?.includes('h-full') ? 'h-full' : ''}`}>
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className ? `text-xs px-1 bg-white ${className}` : `h-7 text-xs px-1 bg-white`}
      />
      {isOpen && options.length > 0 && (
        <div 
          className={`absolute z-50 min-w-max bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto`}
          style={{
            [dropdownPosition === 'top' ? 'bottom' : 'top']: '100%',
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px',
            minWidth: '120px'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option.value)}
              className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100 whitespace-nowrap"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 排泄記録の型定義
interface ExcretionRecord {
  id: string;
  residentId: string;
  recordDate: string;
  hour: number;
  type: 'urine' | 'stool';
  status: 'independent' | 'recorded';
  amount?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function ExcretionCheckList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
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
  const [localRecordIds, setLocalRecordIds] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  // 入居者データの取得
  const { data: residents = [], isLoading: isLoadingResidents, error: residentsError } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: async () => {
      const result = await apiRequest("/api/residents");
      // apiRequestは直接データを返すため、result.dataではなくresultを返す
      return result || [];
    },
  });

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });

  // 施設設定を取得
  const { data: facilitySettings } = useQuery<FacilitySettings>({
    queryKey: ["/api/facility-settings"],
  });

  // 排泄記録データの取得
  const { data: excretionRecords = [], refetch: refetchExcretionRecords } = useQuery<ExcretionRecord[]>({
    queryKey: ["excretion-records", dateFrom, dateTo],
    queryFn: async () => {
      const from = startOfDay(parseISO(dateFrom)).toISOString();
      const to = endOfDay(parseISO(dateTo)).toISOString();
      const result = await apiRequest(`/api/excretion-records?startDate=${from}&endDate=${to}`);
      return result || [];
    },
    enabled: !!dateFrom && !!dateTo,
    refetchOnMount: true, // 画面マウント時に必ず最新データを取得
    staleTime: 0, // データを常に古いものとして扱う
    gcTime: 0, // キャッシュを即座にクリア
  });

  // 排泄記録の更新ミューテーション
  const updateExcretionMutation = useMutation({
    mutationFn: async ({ recordId, data }: { recordId?: string, data: any }) => {
      if (recordId) {
        // 既存のレコードを更新
        return await apiRequest(
          `/api/excretion-records/${recordId}`,
          "PATCH",
          data
        );
      } else {
        // 新規レコードを作成
        return await apiRequest(
          "/api/excretion-records",
          "POST",
          data
        );
      }
    },
    onSuccess: () => {
      refetchExcretionRecords();
      queryClient.invalidateQueries({ queryKey: ["excretion-records"] });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "排泄記録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 日付範囲の妥当性チェック
  useEffect(() => {
    if (dateFrom && dateTo) {
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      const daysDiff = differenceInDays(to, from);
      
      if (viewMode === 'monthly') {
        // 月次モードでは最大1ヶ月
        if (daysDiff > 31) {
          const newTo = addMonths(from, 1);
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

  // 月次モードで日付Fromが変更された場合、1ヶ月間の期間を自動設定
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

  // URLパラメータを更新する関数
  const updateUrlParams = (floor: string) => {
    const params = new URLSearchParams();
    params.set('date', dateFrom);
    params.set('floor', floor);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // 階数フィルタが変更されたときにURLパラメータを更新
  useEffect(() => {
    updateUrlParams(selectedFloor);
  }, [selectedFloor, dateFrom]);

  // フィルタリングされた入居者リスト
  const filteredResidents = useMemo(() => {
    
    let filtered = residents;
    
    if (selectedFloor !== "all") {
      filtered = filtered.filter(r => r.roomNumber?.startsWith(selectedFloor));
    }
    
    if (selectedResident !== "all") {
      filtered = filtered.filter(r => r.id === selectedResident);
    }
    
    const sorted = filtered.sort((a, b) => {
      const roomA = parseInt(a.roomNumber || "0");
      const roomB = parseInt(b.roomNumber || "0");
      return roomA - roomB;
    });
    
    return sorted;
  }, [residents, selectedFloor, selectedResident]);

  // 日付リストの生成
  const dateList = useMemo(() => {
    const dates: Date[] = [];
    const from = parseISO(dateFrom);
    const to = parseISO(dateTo);

    let current = from;
    while (current <= to) {
      dates.push(current);
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }, [dateFrom, dateTo]);

  // 排泄記録データを構造化（時間ベース処理）
  const structuredData = useMemo(() => {
    const data: { [key: string]: any } = {};
    
    excretionRecords.forEach((record: any) => {
      
      const recordDate = new Date(record.recordDate);
      const dateStr = format(recordDate, "yyyy-MM-dd");
      const recordTime = recordDate.getHours();
      
      // 時間ベースでの処理分岐
      if (recordTime === 12) {
        // 12:00のデータは時間に関係ない項目として処理
        
        // 記録内容の処理
        if (record.type === 'general_note' && record.notes) {
          const notesKey = `${record.residentId}-${dateStr}--2`; // hour: -2 で記録内容を表現
          if (!data[notesKey]) {
            data[notesKey] = {};
          }
          data[notesKey].notes = record.notes;
          data[notesKey].generalNoteId = record.id;
        }
        
        // 自立便・自立尿の処理
        if (record.assistance) {
          const assistanceKey = `${record.residentId}-${dateStr}--1`; // hour: -1 で自立データを表現
          if (!data[assistanceKey]) {
            data[assistanceKey] = {};
          }
          if (record.type === 'bowel_movement' || record.type === 'stool') {
            data[assistanceKey].independentStool = record.assistance;
            data[assistanceKey].assistanceStoolId = record.id;
          } else if (record.type === 'urination' || record.type === 'urine') {
            data[assistanceKey].independentUrine = record.assistance;
            data[assistanceKey].assistanceUrineId = record.id;
          }
        }
      } else {
        // 実際の時刻データは時間帯セルに配置
        if (recordTime >= 0 && recordTime <= 23) {
          const key = `${record.residentId}-${dateStr}-${recordTime}`;
          if (!data[key]) {
            data[key] = {};
          }
          
          if (record.type === 'stool' || record.type === 'bowel_movement') {
            data[key].stoolState = record.consistency || '';
            data[key].stoolAmount = record.amount || '';
            data[key].stoolRecordId = record.id;
          } else if (record.type === 'urine' || record.type === 'urination') {
            data[key].urineCC = record.urineVolumeCc?.toString() || '';
            data[key].urineAmount = record.amount || '';
            data[key].urineRecordId = record.id;
          }
        }
      }
    });
    
    return data;
  }, [excretionRecords]);

  // セルの値を取得
  const getCellValue = (residentId: string, date: Date, hour: number, field: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    // 特別なキーの処理
    let key: string;
    if (hour === -1) {
      // 自立便・自立尿
      key = `${residentId}-${dateStr}--1`;
    } else if (hour === -2) {
      // 記録内容
      key = `${residentId}-${dateStr}--2`;
    } else {
      // 通常の時間帯データ
      key = `${residentId}-${dateStr}-${hour}`;
    }
    
    const editKey = `${key}-${field}`;
    
    // ローカル編集がある場合はそれを優先
    if (localEdits.has(editKey)) {
      return localEdits.get(editKey);
    }
    
    // 構造化データから取得
    return structuredData[key]?.[field] || '';
  };

  // 便計を計算
  const calculateStoolCount = (residentId: string, date: Date) => {
    const excretionBaseline = facilitySettings?.excretionBaseline || 3; // デフォルト値3

    let count = 0;
    let smallCount = 0; // 「小」の回数をカウント

    for (let hour = 0; hour < 24; hour++) {
      const amount = getCellValue(residentId, date, hour, 'stoolAmount');
      if (amount === '多' || amount === '中') {
        count++;
      } else if (amount === '小') {
        smallCount++;
      }
    }

    // 「小」の回数を基準値で割った商を追加
    count += Math.floor(smallCount / excretionBaseline);

    // 自立便を追加
    const independentStool = getCellValue(residentId, date, -1, 'independentStool');
    if (independentStool && !isNaN(parseInt(independentStool))) {
      count += parseInt(independentStool);
    }

    return count > 0 ? count.toString() : '';
  };

  // 最終便を計算（最終便からの経過日数）
  const calculateLastStool = (residentId: string, date: Date) => {
    // 対象日から過去に遡って便記録を探す
    let lastStoolDate: Date | null = null;
    
    // dateListを逆順（新しい日付から）で探す - 効率化のため
    const reversedDateList = [...dateList].reverse();
    for (const checkDate of reversedDateList) {
      if (checkDate > date) continue; // 未来の日付はスキップ
      
      // 各時間帯をチェック（最新から古い順）
      for (let hour = 23; hour >= 0; hour--) {
        const amount = getCellValue(residentId, checkDate, hour, 'stoolAmount');
        // 便量が「多」または「中」の場合のみカウント
        if (amount === '多' || amount === '中') {
          lastStoolDate = new Date(checkDate);
          break;
        }
      }
      
      if (lastStoolDate) break;
    }
    
    // excretionRecordsからも探す（dateList範囲外の過去データ）
    if (!lastStoolDate && excretionRecords.length > 0) {
      const residentStoolRecords = excretionRecords
        .filter((r: any) => 
          r.residentId === residentId && 
          r.type === 'bowel_movement' &&
          (r.amount === '多' || r.amount === '中') &&
          new Date(r.recordDate) <= date
        )
        .sort((a: any, b: any) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
      
      if (residentStoolRecords.length > 0) {
        lastStoolDate = new Date(residentStoolRecords[0].recordDate);
      }
    }
    
    // 経過日数を計算（日付のみで比較、時間は無視）
    if (lastStoolDate) {
      // 両方の日付を0:00:00にリセットして日付のみで比較
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const stoolDate = new Date(lastStoolDate);
      stoolDate.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - stoolDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // 負の値にならないようにする（同じ日なら0日）
      return `${Math.max(0, diffDays)}日`;
    }
    
    return '-';
  };

  // 尿計を計算
  const calculateUrineCount = (residentId: string, date: Date) => {
    let count = 0;
    for (let hour = 0; hour < 24; hour++) {
      const amount = getCellValue(residentId, date, hour, 'urineAmount');
      if (amount === '○') {
        count += 1;
      } else if (amount === '×') {
        // カウントしない（何もしない）
      } else if (amount && !isNaN(parseInt(amount))) {
        // "2"〜"6" の場合は数字の値でカウント
        count += parseInt(amount);
      }
    }
    
    // 自立尿を追加
    const independentUrine = getCellValue(residentId, date, -1, 'independentUrine');
    if (independentUrine && !isNaN(parseInt(independentUrine))) {
      count += parseInt(independentUrine);
    }
    
    return count > 0 ? count.toString() : '';
  };

  // 尿量の合計を計算
  const calculateTotalUrineCC = (residentId: string, date: Date) => {
    let total = 0;
    for (let hour = 0; hour < 24; hour++) {
      const cc = getCellValue(residentId, date, hour, 'urineCC');
      if (cc && !isNaN(parseInt(cc))) {
        total += parseInt(cc);
      }
    }
    return total > 0 ? total.toString() : '';
  };

  // セルの値を保存
  const handleCellSave = async (residentId: string, date: Date, hour: number, field: string, value: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    // 特別なキーの処理
    let key: string;
    if (hour === -1) {
      // 自立便・自立尿
      key = `${residentId}-${dateStr}--1`;
    } else if (hour === -2) {
      // 記録内容
      key = `${residentId}-${dateStr}--2`;
    } else {
      // 通常の時間帯データ
      key = `${residentId}-${dateStr}-${hour}`;
    }
    
    const editKey = `${key}-${field}`;
    
    // ローカル編集を更新
    const newEdits = new Map(localEdits);
    newEdits.set(editKey, value);
    setLocalEdits(newEdits);
    
    // APIに保存
    try {
      const existingRecord = structuredData[key];
      
      // ローカルのrecordIdをチェックする関数
      const getRecordId = (recordIdField: string) => {
        const localKey = `${key}-${recordIdField}`;
        return localRecordIds.get(localKey) || existingRecord?.[recordIdField];
      };
      
      if (hour === -1) {
        // 自立便・自立尿の場合
        let type: 'bowel_movement' | 'urination' | undefined;
        let recordIdField: string | undefined;
        
        if (field === 'independentStool') {
          type = 'bowel_movement';
          recordIdField = 'assistanceStoolId';
        } else if (field === 'independentUrine') {
          type = 'urination';
          recordIdField = 'assistanceUrineId';
        }
        
        if (type && recordIdField) {
          // 12:00固定でISO形式の日付を作成（排泄一覧画面と統一）
          const recordDateTime = new Date(date);
          recordDateTime.setHours(12, 0, 0, 0);
          
          const recordId = getRecordId(recordIdField);
          const result = await updateExcretionMutation.mutateAsync({
            recordId,
            data: {
              residentId,
              recordDate: recordDateTime.toISOString(),
              type,
              assistance: value,
              notes: '',
              createdBy: (user as any)?.username || 'unknown',
            },
          });
          
          // 新規作成の場合、IDをローカルに保存
          if (!recordId && result?.id) {
            setLocalRecordIds(prev => {
              const newMap = new Map(prev);
              newMap.set(`${key}-${recordIdField}`, result.id);
              return newMap;
            });
          }
        }
      } else if (hour === -2) {
        // 記録内容の場合
        if (field === 'notes') {
          // 12:00固定でISO形式の日付を作成（排泄一覧画面と統一）
          const recordDateTime = new Date(date);
          recordDateTime.setHours(12, 0, 0, 0);
          
          const recordId = getRecordId('generalNoteId');
          const result = await updateExcretionMutation.mutateAsync({
            recordId,
            data: {
              residentId,
              recordDate: recordDateTime.toISOString(),
              type: 'general_note',
              status: 'recorded',
              notes: value,
              createdBy: (user as any)?.username || 'unknown',
            },
          });
          
          // 新規作成の場合、IDをローカルに保存
          if (!recordId && result?.id) {
            setLocalRecordIds(prev => {
              const newMap = new Map(prev);
              newMap.set(`${key}-generalNoteId`, result.id);
              return newMap;
            });
          }
        }
      } else {
        // 通常の時間帯のデータ
        let type: 'bowel_movement' | 'urination' | undefined;
        let consistency: string | null = null;
        let urineVolumeCc: number | null = null;
        let amount: string | null = null;
        let recordIdField: string | undefined;
        
        if (field === 'stoolState' || field === 'stoolAmount') {
          type = 'bowel_movement';
          recordIdField = 'stoolRecordId';
          // 関連フィールドの現在値を取得（ローカル編集状態も含む）
          const currentStoolState = field === 'stoolState' ? value : getCellValue(residentId, date, hour, 'stoolState');
          const currentStoolAmount = field === 'stoolAmount' ? value : getCellValue(residentId, date, hour, 'stoolAmount');
          
          // 少なくとも1つのフィールドに有効な値がある場合のみ処理
          if (!currentStoolState && !currentStoolAmount) {
            return; // 両方空の場合は何もしない
          }
          
          consistency = currentStoolState || '';
          amount = currentStoolAmount || '';
        } else if (field === 'urineCC' || field === 'urineAmount') {
          type = 'urination';
          recordIdField = 'urineRecordId';
          // 関連フィールドの現在値を取得（ローカル編集状態も含む）
          const currentUrineCC = field === 'urineCC' ? value : getCellValue(residentId, date, hour, 'urineCC');
          const currentUrineAmount = field === 'urineAmount' ? value : getCellValue(residentId, date, hour, 'urineAmount');
          
          // 少なくとも1つのフィールドに有効な値がある場合のみ処理
          if (!currentUrineCC && !currentUrineAmount) {
            return; // 両方空の場合は何もしない
          }
          
          urineVolumeCc = currentUrineCC ? (parseInt(currentUrineCC) || null) : null;
          amount = currentUrineAmount || '';
          // 尿の場合、consistencyはnullにする
          consistency = null;
        }
        
        if (type && recordIdField) {
          // 時間を含む正しいISO形式の日付を作成
          const recordDateTime = new Date(date);
          recordDateTime.setHours(hour, 0, 0, 0);
          
          const recordId = getRecordId(recordIdField);
          const result = await updateExcretionMutation.mutateAsync({
            recordId,
            data: {
              residentId,
              recordDate: recordDateTime.toISOString(),
              type,
              consistency: type === 'bowel_movement' ? (consistency || undefined) : null,
              urineVolumeCc: type === 'urination' ? urineVolumeCc : undefined,
              amount: amount || undefined,
              notes: `${hour}時の${type === 'bowel_movement' ? '便' : '尿'}記録`,
              createdBy: (user as any)?.username || 'unknown',
            },
          });
          
          // 新規作成の場合、IDをローカルに保存
          if (!recordId && result?.id) {
            setLocalRecordIds(prev => {
              const newMap = new Map(prev);
              newMap.set(`${key}-${recordIdField}`, result.id);
              return newMap;
            });
          }
        }
      }
    } catch (error) {
      console.error('保存エラー:', error);
    }
  };

  // 表示モード切り替えのクリック処理
  const handleViewModeToggle = () => {
    setViewMode(viewMode === 'daily' ? 'monthly' : 'daily');
  };

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
      const printUrl = `/api/excretion-records/print?${params.toString()}`;
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            // URLパラメータを保持してチェック一覧メニューに戻る
            const params = new URLSearchParams();
            params.set('date', dateFrom);
            params.set('floor', selectedFloor);
            const menuPath = getEnvironmentPath("/check-list-menu");
            navigate(`${menuPath}?${params.toString()}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">
          {viewMode === 'monthly' ? '排泄チェック一覧 月次' : '排泄チェック一覧'}
        </h1>
      </header>

      {/* フィルタエリア */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 表示期間 */}
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

          {/* 階数 */}
          <div className="flex items-center gap-2">
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* マスタ設定から取得した階数データで動的生成 */}
                {floorMasterSettings
                  .filter(setting => setting.isActive !== false) // 有効な項目のみ
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) // ソート順に並べる
                  .map((setting) => {
                    // "全階"の場合はvalue="all"、それ以外はvalueを使用
                    const optionValue = setting.value === "全階" ? "all" : setting.value;
                    return (
                      <SelectItem key={setting.id} value={optionValue}>
                        {setting.label}
                      </SelectItem>
                    );
                  })
                }
              </SelectContent>
            </Select>
          </div>

          {/* 利用者 */}
          <div className="flex items-center gap-2">
            <Select value={selectedResident} onValueChange={setSelectedResident}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全員</SelectItem>
                {residents.map((resident) => (
                  <SelectItem key={resident.id} value={resident.id}>
                    {resident.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 表示モード切り替えボタン */}
          <Button
            onClick={handleViewModeToggle}
            variant="outline"
            className="ml-auto"
          >
            {viewMode === 'monthly' ? '排泄チェック一覧' : '月次'}
          </Button>

          {/* 印刷ボタン（月次モード時のみ表示） */}
          {viewMode === 'monthly' && (
            <Button
              onClick={handlePrint}
              variant="outline"
            >
              印刷
            </Button>
          )}
        </div>
      </div>

      {/* テーブルエリア */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {isLoadingResidents && (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>入居者データを読み込み中...</p>
          </div>
        )}
        {residentsError && (
          <div className="p-4 text-center text-red-600">
            入居者データの取得に失敗しました
          </div>
        )}
        {!isLoadingResidents && residents.length === 0 && (
          <div className="p-4 text-center text-gray-600">
            入居者データがありません
          </div>
        )}
        {!isLoadingResidents && filteredResidents.length === 0 && residents.length > 0 && (
          <div className="p-4 text-center text-gray-600">
            フィルタ条件に該当する入居者がいません
          </div>
        )}
        <table className="border-collapse text-xs w-full">
          {viewMode === 'daily' ? (
            // 日次表示用ヘッダー
            <thead className="sticky top-0 bg-gray-100 z-10 border-b-2 border-b-gray-400">
              <tr>
                <th rowSpan={3} className="border px-1 py-1 text-center" style={{ width: '80px' }}>記録日</th>
                <th rowSpan={3} className="border px-1 py-1 text-center" style={{ width: '48px' }}>居室</th>
                <th rowSpan={3} className="border px-1 py-1 text-center" style={{ width: '96px' }}>利用者名</th>
                <th className="border px-1 py-1 text-center" style={{ width: '32px' }}>便</th>
                <th className="border px-1 py-1 text-center" style={{ width: '48px' }}>尿</th>
                <th rowSpan={3} className="border px-1 py-1 text-center border-r-2 border-r-gray-400" style={{ minWidth: '150px' }}>記録内容</th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} colSpan={2} className={`border px-1 py-1 text-center ${i > 0 ? 'border-l-2 border-l-gray-400' : ''} ${i === 23 ? 'border-r-2 border-r-gray-400' : ''}`}>
                    {`${i}:00`}
                  </th>
                ))}
                <th className="border px-1 py-1 text-center" style={{ width: '64px' }}>自立</th>
              </tr>
              <tr>
                <th className="border px-1 py-1 text-center" style={{ width: '32px' }}>便計</th>
                <th className="border px-1 py-1 text-center border-r-2 border-r-gray-400" style={{ width: '48px' }}>尿計</th>
                {Array.from({ length: 24 }, (_, i) => (
                  <>
                    <th key={`stool-state-${i}`} className={`border px-1 py-1 text-center ${i > 0 ? 'border-l-2 border-l-gray-400' : ''}`} style={{ width: '48px' }}>便状態</th>
                    <th key={`stool-amount-${i}`} className={`border px-1 py-1 text-center ${i === 23 ? 'border-r-2 border-r-gray-400' : ''}`} style={{ width: '32px' }}>便量</th>
                  </>
                ))}
                <th className="border px-1 py-1 text-center" style={{ width: '64px' }}>自立便</th>
              </tr>
              <tr>
                <th className="border px-1 py-1 text-center" style={{ width: '32px' }}>最終便</th>
                <th className="border px-1 py-1 text-center border-r-2 border-r-gray-400" style={{ width: '48px' }}>尿量</th>
                {Array.from({ length: 24 }, (_, i) => (
                  <>
                    <th key={`urine-cc-${i}`} className={`border px-1 py-1 text-center ${i > 0 ? 'border-l-2 border-l-gray-400' : ''}`} style={{ width: '48px' }}>尿CC</th>
                    <th key={`urine-amount-${i}`} className={`border px-1 py-1 text-center ${i === 23 ? 'border-r-2 border-r-gray-400' : ''}`} style={{ width: '32px' }}>尿量</th>
                  </>
                ))}
                <th className="border px-1 py-1 text-center" style={{ width: '64px' }}>自立尿</th>
              </tr>
            </thead>
          ) : (
            // 月次表示用ヘッダー
            <thead className="sticky top-0 bg-gray-100 z-10 border-b-2 border-b-gray-400">
              <tr>
                <th rowSpan={4} className="border px-1 py-1 text-center" style={{ width: '48px' }}>居室</th>
                <th rowSpan={4} className="border px-1 py-1 text-center" style={{ width: '96px' }}>利用者名</th>
                <th rowSpan={4} className="border px-1 py-1 text-center" style={{ width: '60px' }}>項目</th>
                {dateList.map((date) => (
                  <th key={format(date, "yyyy-MM-dd")} className="border px-1 py-1 text-center" style={{ width: '32px' }}>
                    {format(date, "d", { locale: ja })}
                  </th>
                ))}
              </tr>
              <tr>
                {dateList.map((date) => (
                  <th key={format(date, "yyyy-MM-dd")} className="border px-1 py-1 text-center" style={{ width: '32px' }}>
                    {format(date, "EEE", { locale: ja })}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {viewMode === 'daily' ? (
              // 日次表示用ボディ
              dateList.map((date) => (
                filteredResidents.map((resident) => (
                  <>
                    {/* 1行目 - 上段のデータ */}
                    <tr className="hover:bg-gray-50">
                      <td rowSpan={2} className="border px-1 py-1 text-center font-bold">
                        {format(date, "M月d日", { locale: ja })}
                      </td>
                      <td rowSpan={2} className="border px-1 py-1 text-center font-bold">
                        {resident.roomNumber}
                      </td>
                      <td rowSpan={2} className="border px-1 py-1 font-bold">
                        {resident.name}
                      </td>
                      <td className="border px-1 py-1 text-center bg-gray-50">
                        {calculateStoolCount(resident.id, date)}
                      </td>
                      <td className="border px-1 py-1 text-center bg-gray-50">
                        {calculateUrineCount(resident.id, date)}
                      </td>
                      <td rowSpan={2} className="border px-1 py-1 border-r-2 border-r-gray-400">
                        <ResizableNotesInput
                          recordId={`${resident.id}-${format(date, "yyyy-MM-dd")}-notes`}
                          initialValue={getCellValue(resident.id, date, -2, 'notes')}
                          onLocalChange={(recordId, value) => {
                            // ローカル状態の更新（リアルタイム表示用）
                            const newEdits = new Map(localEdits);
                            const editKey = `${resident.id}-${format(date, "yyyy-MM-dd")}--2-notes`;
                            newEdits.set(editKey, value);
                            setLocalEdits(newEdits);
                          }}
                          onSave={(recordId, value) => handleCellSave(resident.id, date, -2, 'notes', value)}
                        />
                      </td>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <>
                          <td key={`stool-state-${hour}`} className={`border px-0 py-0 bg-white ${hour > 0 ? 'border-l-2 border-l-gray-400' : ''}`}>
                            <InputWithDropdown
                              value={getCellValue(resident.id, date, hour, 'stoolState')}
                              options={stoolStateOptions}
                              onSave={(value) => handleCellSave(resident.id, date, hour, 'stoolState', value)}
                              placeholder=""
                              className="w-full border-0"
                            />
                          </td>
                          <td key={`stool-amount-${hour}`} className="border px-0 py-0 bg-white">
                            <InputWithDropdown
                              value={getCellValue(resident.id, date, hour, 'stoolAmount')}
                              options={stoolAmountOptions}
                              onSave={(value) => handleCellSave(resident.id, date, hour, 'stoolAmount', value)}
                              placeholder=""
                              className="w-full border-0"
                            />
                          </td>
                        </>
                      ))}
                      <td className="border px-0 py-0 bg-white border-l-2 border-l-gray-400">
                        <NumericInputWithDropdown
                          value={getCellValue(resident.id, date, -1, 'independentStool')}
                          options={independentOptions}
                          onSave={(value) => handleCellSave(resident.id, date, -1, 'independentStool', value)}
                          placeholder=""
                          className="w-full border-0"
                        />
                      </td>
                    </tr>
                    {/* 2行目 - 下段のデータ */}
                    <tr className="hover:bg-gray-50 border-b-2 border-b-gray-400">
                      <td className="border px-1 py-1 text-center bg-gray-50">
                        {calculateLastStool(resident.id, date)}
                      </td>
                      <td className="border px-1 py-1 text-center bg-gray-50">
                        {calculateTotalUrineCC(resident.id, date)}
                      </td>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <>
                          <td key={`urine-cc-${hour}`} className={`border px-0 py-0 bg-white ${hour > 0 ? 'border-l-2 border-l-gray-400' : ''}`}>
                            <NumericInputWithDropdown
                              value={getCellValue(resident.id, date, hour, 'urineCC')}
                              options={[]}
                              onSave={(value) => handleCellSave(resident.id, date, hour, 'urineCC', value)}
                              placeholder=""
                              className="w-full border-0"
                            />
                          </td>
                          <td key={`urine-amount-${hour}`} className="border px-0 py-0 bg-white">
                            <InputWithDropdown
                              value={getCellValue(resident.id, date, hour, 'urineAmount')}
                              options={urineAmountOptions}
                              onSave={(value) => handleCellSave(resident.id, date, hour, 'urineAmount', value)}
                              placeholder=""
                              className="w-full border-0"
                            />
                          </td>
                        </>
                      ))}
                      <td className="border px-0 py-0 bg-white border-l-2 border-l-gray-400">
                        <NumericInputWithDropdown
                          value={getCellValue(resident.id, date, -1, 'independentUrine')}
                          options={independentOptions}
                          onSave={(value) => handleCellSave(resident.id, date, -1, 'independentUrine', value)}
                          placeholder=""
                          className="w-full border-0"
                        />
                      </td>
                    </tr>
                  </>
                ))
              ))
            ) : (
              // 月次表示用ボディ
              filteredResidents.map((resident) => (
                <>
                  {/* 尿計行 */}
                  <tr className="hover:bg-gray-50">
                    <td rowSpan={3} className="border px-1 py-1 text-center font-bold">
                      {resident.roomNumber}
                    </td>
                    <td rowSpan={3} className="border px-1 py-1 font-bold">
                      {resident.name}
                    </td>
                    <td className="border px-1 py-1 text-center bg-blue-50 font-bold">
                      尿計
                    </td>
                    {dateList.map((date) => (
                      <td key={format(date, "yyyy-MM-dd")} className="border px-1 py-1 text-center bg-gray-50">
                        {calculateUrineCount(resident.id, date)}
                      </td>
                    ))}
                  </tr>
                  {/* 尿量行 */}
                  <tr className="hover:bg-gray-50">
                    <td className="border px-1 py-1 text-center bg-green-50 font-bold">
                      尿量
                    </td>
                    {dateList.map((date) => (
                      <td key={format(date, "yyyy-MM-dd")} className="border px-1 py-1 text-center bg-gray-50">
                        {calculateTotalUrineCC(resident.id, date)}
                      </td>
                    ))}
                  </tr>
                  {/* 便計行 */}
                  <tr className="hover:bg-gray-50 border-b-2 border-b-gray-400">
                    <td className="border px-1 py-1 text-center bg-orange-50 font-bold">
                      便計
                    </td>
                    {dateList.map((date) => (
                      <td key={format(date, "yyyy-MM-dd")} className="border px-1 py-1 text-center bg-gray-50">
                        {calculateStoolCount(resident.id, date)}
                      </td>
                    ))}
                  </tr>
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}