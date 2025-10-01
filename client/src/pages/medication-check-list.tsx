import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getEnvironmentPath, apiRequest } from "@/lib/queryClient";
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
import { format, parseISO, startOfDay, endOfDay, addMonths, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MedicationRecord, Resident, InsertMedicationRecord, MasterSetting } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { matchFloor } from "@/lib/floorFilterUtils";

// 服薬時間帯の選択肢
const timingOptions = [
  { value: "all", label: "全時間帯" },
  { value: "起床後", label: "起床後" },
  { value: "朝前", label: "朝前" },
  { value: "朝後", label: "朝後" },
  { value: "昼前", label: "昼前" },
  { value: "昼後", label: "昼後" },
  { value: "夕前", label: "夕前" },
  { value: "夕後", label: "夕後" },
  { value: "眠前", label: "眠前" },
  { value: "頓服", label: "頓服" }
];

interface MedicationRecordWithResident extends MedicationRecord {
  residentName?: string;
  roomNumber?: string;
  floor?: string;
}

// InputWithDropdownコンポーネント（入浴チェック一覧と同じ）
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
          className={`absolute z-[9999] w-32 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto`}
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


export default function MedicationCheckList() {
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
  
  // 表示モード（standard: 通常、daily: 日別表示）
  const [viewMode, setViewMode] = useState<'standard' | 'daily'>('standard');
  
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [selectedFloor, setSelectedFloor] = useState(floorParam || "all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [selectedTiming, setSelectedTiming] = useState("all");

  // ログインユーザー名の取得（確認者プルダウン用）
  const staffNameOptions = useMemo(() => {
    const userName = (user as any)?.staffName || "";
    if (userName) {
      return [{ value: userName, label: userName }];
    }
    return [];
  }, [user]);

  // 日付範囲のバリデーション（最大1ヶ月）
  const validateDateRange = (from: string, to: string): boolean => {
    const startDate = parseISO(from);
    const endDate = parseISO(to);
    const maxEndDate = addMonths(startDate, 1);
    
    if (endDate > maxEndDate) {
      toast({
        title: "期間が長すぎます",
        description: "表示期間は最大1ヶ月までに設定してください。",
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
  };

  // 終了日変更ハンドラー
  const handleDateToChange = (value: string) => {
    if (validateDateRange(dateFrom, value)) {
      setDateTo(value);
    }
  };

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });

  // 服薬記録データの取得（日付範囲で一括取得）
  const { data: medicationRecords = [], isLoading } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["medication-records-range", dateFrom, dateTo],
    queryFn: async () => {
      try {
        const data = await apiRequest(`/api/medication-records?dateFrom=${dateFrom}&dateTo=${dateTo}&timing=all&floor=all`, 'GET');
        return data || [];
      } catch (error) {
        console.error('Error fetching medication records:', error);
        return [];
      }
    },
    staleTime: 0,                // 常に最新データを取得
    gcTime: 30 * 60 * 1000,      // 30分間メモリに保持
    refetchOnMount: true,        // マウント時に必ず再取得
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = medicationRecords;

    // 階数フィルタ
    if (selectedFloor !== "all") {
      filtered = filtered.filter(record => {
        const resident = residents.find(r => r.id === record.residentId);
        return matchFloor(resident?.floor, selectedFloor);
      });
    }

    // 利用者フィルタ
    if (selectedResident !== "all") {
      filtered = filtered.filter(record => record.residentId === selectedResident);
    }

    // 服薬時間帯フィルタ
    if (selectedTiming !== "all") {
      filtered = filtered.filter(record => record.timing === selectedTiming);
    }

    return filtered;
  }, [medicationRecords, selectedFloor, selectedResident, selectedTiming, residents]);

  // ミューテーション処理
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertMedicationRecord> }) => {
      return apiRequest(`/api/medication-records/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-records-range"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertMedicationRecord) => {
      return apiRequest("/api/medication-records", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-records-range"] });
    },
  });

  // 日別モード用のデータ整形
  const dailyDisplayData = useMemo(() => {
    if (viewMode !== 'daily' || !filteredData.length) return [];
    
    // 利用者ごと、日付ごとにグループ化
    const groupedData = new Map<string, Map<string, MedicationRecordWithResident[]>>();
    
    filteredData.forEach(record => {
      const residentKey = record.residentId;
      const dateKey = record.recordDate;
      
      if (!groupedData.has(residentKey)) {
        groupedData.set(residentKey, new Map());
      }
      
      const residentData = groupedData.get(residentKey)!;
      if (!residentData.has(dateKey)) {
        residentData.set(dateKey, []);
      }
      
      residentData.get(dateKey)!.push(record);
    });
    
    // 表示用のデータ構造に変換
    const result: any[] = [];
    
    groupedData.forEach((dateMap, residentId) => {
      const resident = residents?.find(r => r.id === residentId);
      
      dateMap.forEach((records, date) => {
        const rowData = {
          residentId,
          residentName: resident?.name || '',
          roomNumber: resident?.roomNumber || '',
          recordDate: date,
          records: {} as any,
          resident: resident
        };
        
        // 各時間帯のレコードを整理
        timingOptions.filter(t => t.value !== 'all').forEach(timing => {
          const record = records.find(r => r.timing === timing.value);
          rowData.records[timing.value] = record || null;
        });
        
        result.push(rowData);
      });
    });
    
    // 部屋番号と日付でソート
    result.sort((a, b) => {
      const roomCompare = (parseInt(a.roomNumber) || 0) - (parseInt(b.roomNumber) || 0);
      if (roomCompare !== 0) return roomCompare;
      return a.recordDate.localeCompare(b.recordDate);
    });
    
    return result;
  }, [filteredData, residents, viewMode]);

  // 日別モード用の更新処理
  const handleDailyUpdate = (residentId: string, recordDate: string, timing: string, field: string, value: string) => {

    // 既存レコードを探す
    const existingRecord = filteredData.find(
      r => r.residentId === residentId && r.recordDate === recordDate && r.timing === timing
    );
    
    console.log('🔄 handleDailyUpdate:', {
      residentId,
      recordDate,
      timing,
      field,
      value,
      existingRecord: existingRecord ? {
        id: existingRecord.id,
        isPlaceholder: existingRecord.id?.startsWith('placeholder-')
      } : null
    });
    
    // 実際のDB IDを持つ既存レコードの場合は更新、そうでなければ新規作成
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('placeholder-')) {
      const updateData = { [field]: value };
      updateMutation.mutate(
        { id: existingRecord.id, data: updateData },
        {
          onSuccess: () => {
            // 成功時はReact Queryが自動でキャッシュを更新する
          },
          onError: () => {
            toast({
              title: "更新に失敗しました",
              description: "もう一度お試しください",
              variant: "destructive",
            });
          }
        }
      );
    } else {
      console.log('🆕 Creating new record');
      // 新規レコードを作成
      const newRecord: InsertMedicationRecord = {
        residentId,
        recordDate: new Date(recordDate),
        timing,
        type: '服薬',
        confirmer1: field === 'confirmer1' ? value : '',
        confirmer2: field === 'confirmer2' ? value : '',
        notes: '',
        result: field === 'result' ? value : ''
      };
      createMutation.mutate(newRecord, {
        onSuccess: () => {
          // 成功時はReact Queryが自動でキャッシュを更新する
        },
        onError: () => {
          toast({
            title: "作成に失敗しました", 
            description: "もう一度お試しください",
            variant: "destructive",
          });
        }
      });
    }
  };



  // 表示用データの整形（利用者情報を追加してソート）
  const displayData = useMemo(() => {
    return filteredData
      .map(record => {
        const resident = residents.find(r => r.id === record.residentId);
        return {
          ...record,
          residentName: resident?.name || "-",
          roomNumber: resident?.roomNumber || "-",
          floor: resident?.floor || "-",
        };
      })
      .sort((a, b) => {
        // 記録日でソート（昇順）
        const dateCompare = new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        // 居室番号でソート（昇順）
        const roomA = parseInt(a.roomNumber || "0");
        const roomB = parseInt(b.roomNumber || "0");
        if (roomA !== roomB) return roomA - roomB;
        
        // 服薬時間帯の順序でソート
        const timingOrder = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
        const timingIndexA = timingOrder.indexOf(a.timing);
        const timingIndexB = timingOrder.indexOf(b.timing);
        return timingIndexA - timingIndexB;
      });
  }, [filteredData, residents]);

  // 印刷処理
  const handlePrint = () => {
    try {
      // APIパラメータをURLエンコード
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        selectedTiming,
        selectedFloor,
        selectedResident
      });

      // 新しいタブで印刷用ページを表示
      const printUrl = `/api/medication-records/print?${params.toString()}`;
      window.open(printUrl, '_blank');

    } catch (error) {
      console.error('印刷処理エラー:', error);
      toast({
        title: "印刷エラー",
        description: "印刷用ページの表示に失敗しました。",
        variant: "destructive"
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
          {viewMode === 'daily' ? '服薬チェック一覧 日別' : '服薬チェック一覧'}
        </h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 表示期間 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              placeholder="開始日"
              className="h-8 text-sm border rounded px-2"
            />
            <span>〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              placeholder="終了日"
              className="h-8 text-sm border rounded px-2"
            />
          </div>

          {/* 服薬時間帯 */}
          <Select value={selectedTiming} onValueChange={setSelectedTiming}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="服薬時間帯" />
            </SelectTrigger>
            <SelectContent>
              {timingOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 階数 */}
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="階数" />
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

          {/* 利用者 */}
          <Select value={selectedResident} onValueChange={setSelectedResident}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="利用者" />
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
            {viewMode === 'standard' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-1" />
                印刷
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setViewMode(viewMode === 'standard' ? 'daily' : 'standard')}
            >
              {viewMode === 'daily' ? '服薬チェック一覧' : '日別'}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : viewMode === 'daily' ? (
          // 日別モードの表示
          dailyDisplayData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">該当するデータがありません</div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="border-collapse bg-white" style={{ minWidth: '1200px' }}>
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th rowSpan={2} className="border px-2 py-1 text-xs font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-50 z-20" style={{ minWidth: '50px' }}>
                      記録日
                    </th>
                    <th rowSpan={2} className="border px-2 py-1 text-xs font-medium text-gray-700 whitespace-nowrap sticky bg-gray-50 z-20" style={{ left: '50px', minWidth: '60px' }}>
                      居室番号
                    </th>
                    <th rowSpan={2} className="border px-2 py-1 text-xs font-medium text-gray-700 whitespace-nowrap sticky bg-gray-50 z-20" style={{ left: '110px', minWidth: '80px' }}>
                      利用者名
                    </th>
                    {timingOptions.filter(t => t.value !== 'all' && t.value !== '頓服').map(timing => (
                      <th key={timing.value} colSpan={3} className="border px-2 py-1 text-xs font-medium text-gray-700">
                        {timing.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {timingOptions.filter(t => t.value !== 'all' && t.value !== '頓服').map(timing => (
                      <>
                        <th key={`${timing.value}-confirmer1`} className="border px-1 py-1 text-xs font-medium text-gray-600" style={{ minWidth: '64px' }}>確認者1</th>
                        <th key={`${timing.value}-confirmer2`} className="border px-1 py-1 text-xs font-medium text-gray-600" style={{ minWidth: '64px' }}>確認者2</th>
                        <th key={`${timing.value}-result`} className="border px-1 py-1 text-xs font-medium text-gray-600" style={{ minWidth: '80px' }}>結果</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyDisplayData.map((row, rowIndex) => {
                    const resident = row.resident;
                    const resultOptions = [
                      { value: "空欗", label: "" },
                      { value: "○", label: "○" },
                      { value: "−", label: "−" },
                      { value: "拒否", label: "拒否" },
                      { value: "外出", label: "外出" }
                    ];
                    
                    return (
                      <tr key={`${row.residentId}-${row.recordDate}-${rowIndex}`} className="hover:bg-gray-50">
                        <td className="border px-2 py-1 text-xs text-center whitespace-nowrap sticky left-0 bg-white z-10" style={{ minWidth: '50px' }}>
                          {format(parseISO(row.recordDate), 'MM/dd')}
                        </td>
                        <td className="border px-2 py-1 text-xs text-center font-semibold sticky bg-white z-10" style={{ left: '50px', minWidth: '60px' }}>
                          {row.roomNumber}
                        </td>
                        <td className="border px-2 py-1 text-xs whitespace-nowrap sticky bg-white z-10" style={{ left: '110px', minWidth: '80px' }}>
                          {row.residentName}
                        </td>
                        {timingOptions.filter(t => t.value !== 'all' && t.value !== '頓服').map(timing => {
                          const record = row.records[timing.value];
                          
                          const isEnabled = (() => {
                            if (!resident) return false;
                            switch(timing.value) {
                              case '起床後': return resident?.medicationWakeup;
                              case '朝前': return resident?.medicationMorningBefore;
                              case '朝後': return resident?.medicationMorning;
                              case '昼前': return resident?.medicationNoonBefore;
                              case '昼後': return resident?.medicationBedtime;
                              case '夕前': return resident?.medicationEveningBefore;
                              case '夕後': return resident?.medicationEvening;
                              case '眠前': return resident?.medicationSleep;
                              default: return false;
                            }
                          })();
                          
                          return (
                            <>
                              <td key={`${timing.value}-confirmer1`} className={`border px-1 py-0 ${!isEnabled ? 'bg-white' : 'bg-pink-200'}`} style={{ minWidth: '64px' }}>
                                {isEnabled ? (
                                  <InputWithDropdown
                                    value={record?.confirmer1 ?? ''}
                                    options={staffNameOptions}
                                    onSave={(value) => handleDailyUpdate(row.residentId, row.recordDate, timing.value, 'confirmer1', value)}
                                    placeholder=""
                                    className="text-center"
                                  />
                                ) : (
                                  <div className="text-center text-xs text-gray-500 py-1">
                                    {record?.confirmer1 || ''}
                                  </div>
                                )}
                              </td>
                              <td key={`${timing.value}-confirmer2`} className={`border px-1 py-0 ${!isEnabled ? 'bg-white' : 'bg-pink-200'}`} style={{ minWidth: '64px' }}>
                                {isEnabled ? (
                                  <InputWithDropdown
                                    value={record?.confirmer2 ?? ''}
                                    options={staffNameOptions}
                                    onSave={(value) => handleDailyUpdate(row.residentId, row.recordDate, timing.value, 'confirmer2', value)}
                                    placeholder=""
                                    className="text-center"
                                  />
                                ) : (
                                  <div className="text-center text-xs text-gray-500 py-1">
                                    {record?.confirmer2 || ''}
                                  </div>
                                )}
                              </td>
                              <td key={`${timing.value}-result`} className={`border px-1 py-0 ${!isEnabled ? 'bg-white' : 'bg-pink-200'}`} style={{ minWidth: '80px' }}>
                                {isEnabled ? (
                                  <InputWithDropdown
                                    value={record?.result ?? ''}
                                    options={[
                                      { value: "○", label: "○" },
                                      { value: "−", label: "−" },
                                      { value: "拒否", label: "拒否" },
                                      { value: "外出", label: "外出" }
                                    ]}
                                    onSave={(value) => handleDailyUpdate(row.residentId, row.recordDate, timing.value, 'result', value)}
                                    placeholder=""
                                    className="text-center"
                                  />
                                ) : (
                                  <div className="text-center text-xs text-gray-500 py-1">
                                    {record?.result || ''}
                                  </div>
                                )}
                              </td>
                            </>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : displayData.length === 0 ? (
          // 通常モード - データなし
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">該当するデータがありません</div>
          </div>
        ) : (
          // 通常モード - データあり
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-left w-20">記録日</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-16">居室番号</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-left w-24">利用者名</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">服薬時間帯</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">確認者1</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">確認者2</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-24">結果</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-16">分類</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((record, index) => (
                  <tr key={`${record.id}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="text-xs border border-gray-300 px-2 py-1">
                      {format(new Date(record.recordDate), "MM月dd日", { locale: ja })}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.roomNumber}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1">
                      {record.residentName}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.timing}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.confirmer1 || ""}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.confirmer2 || ""}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.result || ""}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {record.type || "服薬"}
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