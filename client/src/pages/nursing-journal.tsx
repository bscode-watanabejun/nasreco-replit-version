import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getEnvironmentPath } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { matchFloor } from "@/lib/floorFilterUtils";
import type { MasterSetting } from "@shared/schema";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState<Date>(urlParams.get('date') ? new Date(urlParams.get('date')!) : new Date());
  const [selectedRecordType, setSelectedRecordType] = useState("日中");
  const [selectedFloor, setSelectedFloor] = useState(
    urlParams.get('floor') || 'all'
  );
  
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
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // 日誌チェックボックス状態を取得
  const { data: journalCheckboxes = [] } = useQuery({
    queryKey: ["/api/journal-checkboxes", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest(`/api/journal-checkboxes/${format(selectedDate, 'yyyy-MM-dd')}`);
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
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // 記録データを取得（「今日の記録一覧」画面と同様）
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/daily-records", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('date', format(selectedDate, 'yyyy-MM-dd'));

      const response = await apiRequest(`/api/daily-records?${params.toString()}`);
      return response as DailyRecord[];
    },
    enabled: !!isAuthenticated && !!selectedDate,
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });

  // 階数オプション（マスタ設定から動的に生成）
  const floorOptions = useMemo(() => {
    return floorMasterSettings
      .filter(setting => setting.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((setting) => {
        const optionValue = setting.value === "全階" ? "all" : setting.value;
        return { value: optionValue, label: setting.label };
      });
  }, [floorMasterSettings]);

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
    if (selectedFloor !== "all") {
      filtered = filtered.filter(record => {
        const resident = residents.find(r => r.id === record.residentId);
        if (!resident || !resident.floor) return false;

        return matchFloor(resident.floor, selectedFloor);
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
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('floor', selectedFloor);
    const dashboardPath = getEnvironmentPath("/");
    const targetUrl = `${dashboardPath}?${params.toString()}`;
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

  // 日誌エントリデータを取得
  const { data: journalEntry } = useQuery({
    queryKey: ['/api/journal-entries', format(selectedDate, 'yyyy-MM-dd'), selectedRecordType, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('dateFrom', format(selectedDate, 'yyyy-MM-dd'));
      params.set('dateTo', format(selectedDate, 'yyyy-MM-dd'));
      params.set('recordType', selectedRecordType);
      if (selectedFloor !== 'all') {
        params.set('floor', selectedFloor);
      }

      const response = await apiRequest(`/api/journal-entries?${params.toString()}`);
      const entries = response as any[];

      // 該当する日誌エントリを探す
      return entries.find(e =>
        e.recordDate === format(selectedDate, 'yyyy-MM-dd') &&
        e.recordType === selectedRecordType &&
        (selectedFloor === 'all' ? true : matchFloor(e.floor, selectedFloor))
      ) || null;
    },
    enabled: !!isAuthenticated && !!selectedDate && !!selectedRecordType,
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // 日誌エントリが取得されたら記入者を設定
  useEffect(() => {
    if (journalEntry) {
      setEnteredBy(journalEntry.enteredBy || "");
    } else {
      setEnteredBy("");
    }
  }, [journalEntry]);

  // 日付変更関数
  const changeDateBy = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(currentDate);
  };

  const goToPreviousDay = () => changeDateBy(-1);
  const goToNextDay = () => changeDateBy(1);

  // 日誌エントリの保存/更新用Mutation
  const upsertJournalEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/journal-entries/upsert', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
    },
    onError: (error) => {
      console.error('日誌エントリの保存に失敗しました:', error);
      toast({
        title: "エラー",
        description: "日誌エントリの保存に失敗しました",
        variant: "destructive",
      });
    }
  });

  // 記入者設定/クリア
  const handleToggleEnteredBy = async () => {
    const userData = user as any;
    const userId = userData?.id || userData?.sub || null;

    if (enteredBy) {
      // 記入者をクリア（NULLに設定）
      setEnteredBy("");

      // DBを更新
      await upsertJournalEntryMutation.mutateAsync({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        recordType: selectedRecordType,
        enteredBy: null, // NULLに設定
        residentCount: residentStats.totalResidents,
        hospitalizedCount: residentStats.hospitalizedCount,
        floor: selectedFloor === 'all' ? null : selectedFloor,
        createdBy: userId
      });
    } else {
      // ログイン者の名前を設定
      const userName = userData?.staffName ||
        (userData?.firstName && userData?.lastName
          ? `${userData.lastName} ${userData.firstName}`
          : userData?.email || "スタッフ");
      setEnteredBy(userName);

      // DBを更新
      await upsertJournalEntryMutation.mutateAsync({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        recordType: selectedRecordType,
        enteredBy: userName,
        residentCount: residentStats.totalResidents,
        hospitalizedCount: residentStats.hospitalizedCount,
        floor: selectedFloor === 'all' ? null : selectedFloor,
        createdBy: userId
      });
    }
  };

  const handlePrint = () => {
    // データがない場合のチェック
    if (filteredJournalRecords.length === 0) {
      alert('印刷する記録がありません。');
      return;
    }

    try {
      const params = new URLSearchParams({
        date: format(selectedDate, 'yyyy-MM-dd'),
        recordType: selectedRecordType,
        floor: selectedFloor,
        enteredBy: enteredBy || ''
      });
      const printUrl = `/api/nursing-journal/print?${params.toString()}`;
      window.open(printUrl, '_blank');
    } catch (error) {
      console.error('印刷処理エラー:', error);
      toast({
        title: "エラー",
        description: "印刷用データの生成に失敗しました。しばらく待ってから再度お試しください。",
        variant: "destructive",
      });
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
      <div className="bg-white py-1.5 px-3 shadow-sm border-b sticky top-16 z-40">
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
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="px-1 py-0 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white mx-0.5"
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
              <select
                value={selectedRecordType}
                onChange={(e) => setSelectedRecordType(e.target.value)}
                className="w-14 sm:w-16 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="日中">日中</option>
                <option value="夜間">夜間</option>
                <option value="看護">看護</option>
              </select>
            </div>

          </div>
      </div>

      <div className="max-w-full mx-auto px-2 pb-2">
        {/* メインエリア */}
        <div className="bg-white p-3 shadow-sm border-b">
          {/* 記入者と階数 */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 min-w-[60px]">記入者</label>
              <input
                type="text"
                value={enteredBy}
                readOnly
                className="w-32 px-2 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-700 text-sm"
                placeholder="記入者名"
              />
              <button
                className={`rounded text-xs flex items-center justify-center ${
                  filteredJournalRecords.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                style={{
                  height: "32px",
                  width: "32px",
                  minHeight: "32px",
                  minWidth: "32px",
                  maxHeight: "32px",
                  maxWidth: "32px",
                }}
                onClick={filteredJournalRecords.length === 0 ? undefined : handleToggleEnteredBy}
                disabled={filteredJournalRecords.length === 0}
              >
                <User className="w-3 h-3" />
              </button>
            </div>

            {/* 階数選択 */}
            <div className="flex items-center gap-2">
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {floorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
        <div className="mb-20">
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

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
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