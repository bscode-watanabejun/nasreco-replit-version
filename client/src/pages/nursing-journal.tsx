import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Calendar, Filter, Building, User, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface DailyRecord {
  id: string;
  recordType: string;
  residentId: string;
  roomNumber: string;
  residentName: string;
  recordTime: string;
  content: string;
  staffName: string;
  createdAt: string;
  originalData?: any;
  vitalValues?: string;
  excretionDetails?: {
    formattedEntries: string[];
  };
  notes?: string;
}

interface Resident {
  id: string;
  name: string;
  roomNumber: string;
  floor: string;
  admissionDate: string | null;
  retirementDate: string | null;
  isAdmitted: boolean;
}

// Input + Popoverコンポーネント（「今日の記録一覧」画面と同じ実装）
function InputWithDropdown({
  id,
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  enableAutoFocus = true,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  enableAutoFocus?: boolean;
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
    if (disabled) return;
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (disabled) return;
    onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter") {
      onSave(inputValue);
      setOpen(false);
    } else if (e.key === "Escape") {
      setInputValue(value);
      setOpen(false);
    }
  };

  // クリックによるフォーカスかどうかを追跡
  const [isClickFocus, setIsClickFocus] = useState(false);

  const handleFocus = () => {
    if (disabled || isClickFocus) return;
  };

  return (
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={(e) => {
              e.preventDefault();
              setIsClickFocus(true);
              setOpen(!open);
              // フラグをリセット
              setTimeout(() => {
                setIsClickFocus(false);
              }, 200);
            }}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
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

export default function NursingJournal() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedRecordType, setSelectedRecordType] = useState("日中");
  const [selectedFloor, setSelectedFloor] = useState(() => {
    const floorParam = urlParams.get('floor');
    if (floorParam === 'all') return '全階';
    if (floorParam) return `${floorParam}階`;
    return '全階';
  });
  
  // 記入者
  const [enteredBy, setEnteredBy] = useState("");

  // 住民データを取得
  const { data: residents = [], isLoading: residentsLoading } = useQuery({
    queryKey: ["/api/residents"],
    queryFn: async () => {
      const response = await apiRequest("/api/residents");
      return response as Resident[];
    },
    enabled: !!isAuthenticated,
  });

  // 日誌チェックボックス状態を取得
  const { data: journalCheckboxes = [] } = useQuery({
    queryKey: ["/api/journal-checkboxes", selectedDate],
    queryFn: async () => {
      const response = await apiRequest(`/api/journal-checkboxes/${selectedDate}`);
      return response as Array<{
        id: string;
        recordId: string;
        recordType: string;
        checkboxType: string;
        isChecked: boolean;
        recordDate: string;
      }>;
    },
    enabled: !!isAuthenticated && !!selectedDate,
  });

  // 記録データを取得（「今日の記録一覧」画面と同様）
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/daily-records", selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      
      const response = await apiRequest(`/api/daily-records?${params.toString()}`);
      return response as DailyRecord[];
    },
    enabled: !!isAuthenticated && !!selectedDate,
    staleTime: 30000, // 30秒間キャッシュ
  });

  // 階数オプション（住民データから動的に生成）
  const floorOptions = useMemo(() => {
    if (!residents) return [{ value: "全階", label: "全階" }];
    
    const floors = new Set<string>();
    residents.forEach((resident) => {
      if (resident.floor) {
        floors.add(resident.floor);
      }
    });
    
    const sortedFloors = Array.from(floors).sort((a, b) => {
      const aNum = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const bNum = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return aNum - bNum;
    });

    return [
      { value: "全階", label: "全階" },
      ...sortedFloors.map(floor => ({ value: floor, label: floor }))
    ];
  }, [residents]);

  // チェックボックスでフィルタされた記録（日中、夜間、看護のチェックが付いた記録のみ）
  const filteredJournalRecords = useMemo(() => {
    if (!records || !journalCheckboxes) return [];
    
    // 選択されたフィルタタイプ（日中、夜間、看護）にチェックが入った記録のみを取得
    const checkedRecordIds = journalCheckboxes
      .filter(checkbox => checkbox.isChecked && checkbox.checkboxType === selectedRecordType)
      .map(checkbox => checkbox.recordId);
    
    // チェックされた記録IDに一致する記録をフィルタ
    let filtered = records.filter(record => checkedRecordIds.includes(record.id));

    // 階数フィルタ
    if (selectedFloor !== "全階") {
      const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
      filtered = filtered.filter(record => {
        const resident = residents.find(r => r.id === record.residentId);
        if (!resident || !resident.floor) return false;
        
        const residentFloorNumber = resident.floor.toString().replace(/[^0-9]/g, "");
        return residentFloorNumber === selectedFloorNumber;
      });
    }

    // 居室番号でソート（数値として比較）
    return filtered.sort((a, b) => {
      const roomA = parseInt(a.roomNumber || '0') || 0;
      const roomB = parseInt(b.roomNumber || '0') || 0;
      return roomA - roomB;
    });
  }, [records, journalCheckboxes, selectedRecordType, selectedFloor, residents]);

  // 入居者数・入院者数・入院者名を計算
  const residentStats = useMemo(() => {
    if (!residents) return { totalResidents: 0, hospitalizedCount: 0, hospitalizedNames: [] };
    
    const today = new Date();
    const currentResidents = residents.filter(resident => {
      // 入居日が今日以前で、退居日が未設定または今日以降の住民
      const admissionDate = resident.admissionDate ? new Date(resident.admissionDate) : null;
      const retirementDate = resident.retirementDate ? new Date(resident.retirementDate) : null;
      
      const isCurrentlyAdmitted = (!admissionDate || admissionDate <= today) && 
                                  (!retirementDate || retirementDate >= today);
      
      return isCurrentlyAdmitted;
    });
    
    const hospitalizedResidents = currentResidents.filter(resident => resident.isAdmitted);
    
    return {
      totalResidents: currentResidents.length,
      hospitalizedCount: hospitalizedResidents.length,
      hospitalizedNames: hospitalizedResidents.map(r => r.name)
    };
  }, [residents]);

  if (!isAuthenticated) {
    return null;
  }

  const handleBack = () => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
    const targetUrl = `/?${params.toString()}`;
    navigate(targetUrl);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "HH:mm", { locale: ja });
    } catch {
      return "";
    }
  };

  // 日付変更関数
  const changeDateBy = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(format(currentDate, "yyyy-MM-dd"));
  };

  const goToPreviousDay = () => changeDateBy(-1);
  const goToNextDay = () => changeDateBy(1);

  // 記入者設定/クリア
  const handleToggleEnteredBy = () => {
    if (enteredBy) {
      setEnteredBy("");
    } else {
      // ログイン者の名前を設定
      const userData = user as any;
      const userName = userData?.staffName || 
        (userData?.firstName && userData?.lastName
          ? `${userData.lastName} ${userData.firstName}`
          : userData?.email || "スタッフ");
      setEnteredBy(userName);
    }
  };

  const handlePrint = () => {
    // データがない場合のチェック
    if (filteredJournalRecords.length === 0) {
      alert('印刷する記録がありません。');
      return;
    }

    // 印刷用コンテンツを表示してブラウザの印刷機能を使用
    const printContent = document.getElementById('print-content');
    if (printContent) {
      // 印刷コンテンツを表示
      printContent.classList.remove('hidden');
      printContent.classList.add('block');
      
      // 通常のコンテンツを非表示
      const normalContent = document.querySelector('.print\\:hidden');
      if (normalContent) {
        normalContent.classList.add('hidden');
      }
      
      // 印刷実行
      setTimeout(() => {
        window.print();
        
        // 印刷後に元の表示に戻す
        setTimeout(() => {
          printContent.classList.add('hidden');
          printContent.classList.remove('block');
          
          if (normalContent) {
            normalContent.classList.remove('hidden');
          }
        }, 100);
      }, 100);
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-slate-800 text-white p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-white hover:bg-blue-700 p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">介護/看護日誌</h1>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-0.5">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousDay}
                  className="h-6 w-8 px-1 hover:bg-blue-100 -mr-px min-w-0"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8 mx-0.5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextDay}
                  className="h-6 w-8 px-1 hover:bg-blue-100 -ml-px min-w-0"
                >
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                </Button>
              </div>
            </div>

            {/* 日誌種別選択 */}
            <div className="flex items-center space-x-0.5">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <InputWithDropdown
                value={(() => {
                  const option = [
                    { value: "日中", label: "日中" },
                    { value: "夜間", label: "夜間" },
                    { value: "看護", label: "看護" }
                  ].find(opt => opt.value === selectedRecordType);
                  return option ? option.label : "日中";
                })()}
                options={[
                  { value: "日中", label: "日中" },
                  { value: "夜間", label: "夜間" },
                  { value: "看護", label: "看護" }
                ]}
                onSave={(value) => setSelectedRecordType(value)}
                placeholder="日誌種別"
                className="w-14 sm:w-16 border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8"
                enableAutoFocus={false}
              />
            </div>

            {/* 階数選択 */}
            <div className="flex items-center space-x-0.5">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <InputWithDropdown
                value={selectedFloor}
                options={floorOptions}
                onSave={(value) => setSelectedFloor(value)}
                placeholder="階数選択"
                className="w-16 sm:w-20 border rounded px-2 py-1 text-xs sm:text-sm h-6 sm:h-8"
                enableAutoFocus={false}
              />
            </div>
          </div>
      </div>

      <div className="max-w-full mx-auto px-2 pb-2">
        {/* メインエリア */}
        <div className="bg-white p-3 shadow-sm border-b">
          {/* 記入者 */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm font-medium text-slate-700 min-w-[60px]">記入者</label>
            <input
              type="text"
              value={enteredBy}
              readOnly
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-700 text-sm"
              placeholder="記入者名"
            />
            <button
              className={`rounded text-xs flex items-center justify-center ${
                enteredBy ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
              style={{
                height: "32px",
                width: "32px",
                minHeight: "32px",
                minWidth: "32px",
                maxHeight: "32px",
                maxWidth: "32px",
              }}
              onClick={handleToggleEnteredBy}
            >
              <User className="w-3 h-3" />
            </button>
          </div>

          {/* 入居者数・入院者情報 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 min-w-[80px]">入居者数</span>
                <span className="text-slate-600">{residentStats.totalResidents}名</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 min-w-[80px]">入院者数</span>
                <span className="text-slate-600">{residentStats.hospitalizedCount}名</span>
              </div>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">入院者名</div>
              <div className="text-slate-600 text-sm leading-relaxed">
                {residentStats.hospitalizedNames.length > 0 
                  ? residentStats.hospitalizedNames.join("、") 
                  : "なし"}
              </div>
            </div>
          </div>
        </div>

        {/* 日誌記録エリア */}
        <div className="space-y-3 mb-20">
          {/* 印刷用レイアウト */}
          <div id="print-content" className="hidden print:block print:space-y-0">
            {/* 印刷用ヘッダー */}
            <div className="text-center mb-4">
              <h1 className="text-xl font-bold">日誌 ー {selectedRecordType}</h1>
            </div>
            
            {/* 日付、記入者、統計情報 */}
            <div className="mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">日付： {format(new Date(selectedDate), "yyyy年MM月dd日 EEEE", { locale: ja })}</div>
                  <div className="mt-2">
                    <div className="inline-block">入居者数：{residentStats.totalResidents}　</div>
                    <div className="inline-block">入院者数：{residentStats.hospitalizedCount}</div>
                  </div>
                  <div className="mt-1">
                    入院者名：{residentStats.hospitalizedNames.length > 0 ? residentStats.hospitalizedNames.join("、") : "なし"}
                  </div>
                </div>
                <div>
                  <div className="text-right">
                    記入者：{enteredBy || "_________________"}
                  </div>
                </div>
              </div>
            </div>

            {/* 記録テーブル */}
            {filteredJournalRecords.length > 0 && (
              <table className="w-full border-collapse border border-black text-sm">
                <thead>
                  <tr>
                    <th className="border border-black p-2 text-center" style={{width: '120px'}}>ご利用者</th>
                    <th className="border border-black p-2 text-center" style={{width: '100px'}}>日時</th>
                    <th className="border border-black p-2 text-center">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJournalRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="border border-black p-2 text-center" style={{width: '120px'}}>
                        <div>{record.roomNumber} {record.residentName}</div>
                      </td>
                      <td className="border border-black p-2 text-center" style={{width: '100px'}}>
                        {format(new Date(selectedDate), "d(E)", { locale: ja })} {formatTime(record.recordTime)}
                      </td>
                      <td className="border border-black p-2 text-left">
                        {record.recordType === '処置' 
                          ? (record.originalData?.description || record.originalData?.interventions || '')
                          : record.recordType === 'バイタル' 
                            ? ((record as any).notes || '')
                            : (record.content || '')
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {filteredJournalRecords.length === 0 && (
              <div className="text-center py-8">
                <p>選択された日誌種別にチェックされた記録がありません</p>
              </div>
            )}
          </div>

          {/* 通常表示用レイアウト */}
          <div className="print:hidden">
            {filteredJournalRecords.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">選択された日誌種別にチェックされた記録がありません</p>
              </div>
            ) : (
              filteredJournalRecords.map((record) => {
                const resident = residents.find(r => r.id === record.residentId);
                
                // 記録タイプ別の色設定（daily-records.tsxと同じ）
                const recordTypeColors: { [key: string]: string } = {
                  '様子': 'bg-blue-50 border-blue-200',
                  '食事': 'bg-orange-50 border-orange-200',
                  '服薬': 'bg-purple-50 border-purple-200',
                  'バイタル': 'bg-red-50 border-red-200',
                  '排泄': 'bg-yellow-50 border-yellow-200',
                  '清掃リネン': 'bg-green-50 border-green-200',
                  '入浴': 'bg-cyan-50 border-cyan-200',
                  '体重': 'bg-pink-50 border-pink-200',
                  '看護記録': 'bg-indigo-50 border-indigo-200',
                  '医療記録': 'bg-teal-50 border-teal-200',
                  '処置': 'bg-violet-50 border-violet-200'
                };
                
                return (
                  <Card 
                    key={record.id} 
                    className={cn(
                      "border-l-4",
                      recordTypeColors[record.recordType as keyof typeof recordTypeColors] || "bg-slate-50 border-slate-200"
                    )}
                  >
                    <CardContent className="p-1.5">
                      {/* 上段：居室番号、利用者名、記録時分、記録カテゴリ */}
                      <div className="flex gap-2 mb-0.5 text-sm items-center">
                        <div className="font-medium text-left w-12 flex-shrink-0">{record.roomNumber || '-'}</div>
                        <div className="font-medium text-left w-20 flex-shrink-0">{record.residentName}</div>
                        <div className="font-medium text-left w-24 flex-shrink-0 whitespace-nowrap">{formatTime(record.recordTime)}</div>
                        <div className="flex-1 text-right">
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-slate-100">
                            {record.recordType}
                          </span>
                        </div>
                      </div>

                      {/* 中段：処置部位（処置の場合のみ）と記録内容 */}
                      {record.recordType === '処置' && record.originalData?.notes && (
                        <div className="mb-1">
                          <div className="p-1 bg-slate-50 rounded border text-sm">
                            {record.originalData.notes}
                          </div>
                        </div>
                      )}

                      {/* バイタル専用：上枠（バイタル数値） */}
                      {record.recordType === 'バイタル' && (record as any).vitalValues && (
                        <div className="mb-0.5">
                          <div className="p-1 bg-slate-50 rounded border text-sm">
                            {(record as any).vitalValues}
                          </div>
                        </div>
                      )}

                      {/* 排泄専用：上枠（排泄データ） */}
                      {record.recordType === '排泄' && (record as any).excretionDetails && (record as any).excretionDetails.formattedEntries?.length > 0 && (
                        <div className="mb-0.5">
                          <div className="p-1 bg-slate-50 rounded border text-sm">
                            <div className="whitespace-pre-line">
                              {(record as any).excretionDetails.formattedEntries.join('\n')}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 下枠：記録内容（全記録タイプ共通） */}
                      <div>
                        <div className="w-full p-1 bg-white rounded border text-sm min-h-[6rem] leading-relaxed">
                          {record.recordType === '処置' 
                            ? (record.originalData?.description || record.originalData?.interventions || '')
                            : record.recordType === 'バイタル' 
                              ? ((record as any).notes || '') // バイタルの場合はnotesのみ表示
                              : (record.content || '')
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 print:hidden">
        <div className="flex items-center justify-end max-w-lg mx-auto">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="w-4 h-4 mr-2" />
            印刷
          </Button>
        </div>
      </div>
      
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* ヘッダー、ナビゲーション、フィルター、フッター等を非表示 */
          .bg-slate-800,
          .sticky,
          .fixed,
          .print\\:hidden,
          .bg-white.p-3.shadow-sm.border-b,
          nav,
          header {
            display: none !important;
          }
          
          /* 印刷用コンテンツのみ表示 */
          #print-content {
            display: block !important;
            width: 100%;
          }
          
          .text-center {
            text-align: center;
          }
          
          .mb-4 {
            margin-bottom: 20px;
          }
          
          .text-xl {
            font-size: 18px;
          }
          
          .font-bold {
            font-weight: bold;
          }
          
          .flex {
            display: flex;
          }
          
          .justify-between {
            justify-content: space-between;
          }
          
          .font-medium {
            font-weight: 500;
          }
          
          .mt-2 {
            margin-top: 8px;
          }
          
          .mt-1 {
            margin-top: 4px;
          }
          
          .inline-block {
            display: inline-block;
          }
          
          .text-right {
            text-align: right;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 20px;
          }
          
          th, td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: top;
            page-break-inside: avoid;
          }
          
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold;
            text-align: center;
          }
          
          th:first-child, td:first-child {
            width: 120px;
            text-align: center;
          }
          
          th:nth-child(2), td:nth-child(2) {
            width: 100px;
            text-align: center;
          }
          
          th:nth-child(3) {
            text-align: center;
          }
          
          td:nth-child(3) {
            text-align: left;
          }
          
          .text-xs {
            font-size: 10px;
          }
          
          .py-8 {
            padding: 40px 0;
          }
        }
      `}</style>
    </div>
  );
}