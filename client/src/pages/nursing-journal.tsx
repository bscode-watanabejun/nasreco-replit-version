import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
  
  // フィルタ状態
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedRecordType, setSelectedRecordType] = useState("all");
  const [selectedFloor, setSelectedFloor] = useState("全階");
  
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
    if (!records) return [];
    
    // URLパラメータから選択された記録IDを取得（将来的な実装）
    // 現在は仕様上、「今日の記録一覧」画面でチェックされた記録を表示する想定
    // この実装では全ての記録を対象にして、フィルタで絞り込む
    
    let filtered = records;

    // 記録種別フィルタ
    if (selectedRecordType !== "all") {
      const recordTypeMapping = {
        "日中": ["様子", "服薬", "食事", "清掃リネン", "体重", "排泄"],
        "夜間": ["様子", "服薬", "食事", "清掃リネン", "体重", "排泄"], // 夜間も同じ記録タイプ
        "看護": ["看護記録", "医療記録", "処置", "バイタル", "入浴"]
      };

      const targetTypes = recordTypeMapping[selectedRecordType as keyof typeof recordTypeMapping];
      if (targetTypes) {
        filtered = filtered.filter(record => targetTypes.includes(record.recordType));
      }
    }

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

    return filtered;
  }, [records, selectedRecordType, selectedFloor, residents]);

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
    navigate('/');
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
      const userName = userData?.firstName && userData?.lastName 
        ? `${userData.firstName} ${userData.lastName}`
        : userData?.email || "ログインユーザー";
      setEnteredBy(userName);
    }
  };

  const handlePrint = () => {
    // 印刷機能（一旦ブラウザの印刷ダイアログを表示）
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-slate-800 text-white p-4">
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

      <div className="max-w-full mx-auto p-2">
        {/* フィルタコントロール */}
        <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
          <div className="flex gap-1 sm:gap-2 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-0.5">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousDay}
                  className="h-6 w-5 p-0 hover:bg-blue-100 -mr-px"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-0.5 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white mx-0.5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextDay}
                  className="h-6 w-5 p-0 hover:bg-blue-100 -ml-px"
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
                    { value: "all", label: "全て" },
                    { value: "日中", label: "日中" },
                    { value: "夜間", label: "夜間" },
                    { value: "看護", label: "看護" }
                  ].find(opt => opt.value === selectedRecordType);
                  return option ? option.label : "全て";
                })()}
                options={[
                  { value: "all", label: "全て" },
                  { value: "日中", label: "日中" },
                  { value: "夜間", label: "夜間" },
                  { value: "看護", label: "看護" }
                ]}
                onSave={(value) => setSelectedRecordType(value)}
                placeholder="日誌種別"
                className="w-12 sm:w-24 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-14 sm:w-24 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                enableAutoFocus={false}
              />
            </div>
          </div>
        </div>

        {/* メインエリア */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
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

        {/* 日誌記録エリア（印刷用レイアウト） */}
        <div className="bg-white rounded-lg p-4 shadow-sm print:shadow-none mb-20">
          <div className="text-center py-8">
            <p className="text-slate-600">日誌内容は印刷時に表示されます</p>
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
    </div>
  );
}