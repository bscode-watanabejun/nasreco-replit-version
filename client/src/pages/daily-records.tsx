import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Calendar, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  excretionDetails?: {
    formattedEntries: string[];
  };
}

const recordTypeColors = {
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
  '処置': 'bg-violet-50 border-violet-200',
};

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
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

export default function DailyRecords() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedRecordType, setSelectedRecordType] = useState("日中");
  const [cardCheckboxes, setCardCheckboxes] = useState<Record<string, string[]>>({});

  // ローカル編集状態
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});

  // 記録更新用のmutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, recordType, content }: { id: string; recordType: string; content: string }) => {
      // 記録タイプに応じたAPIエンドポイントを決定
      let endpoint = '';
      let updateData: any = {};

      switch (recordType) {
        case '介護記録':
        case '様子':
          endpoint = `/api/care-records/${id}`;
          updateData = { description: content };
          break;
        case '食事':
          endpoint = `/api/meals-medication/${id}`;
          updateData = { notes: content };
          break;
        case '服薬':
          endpoint = `/api/medication-records/${id}`;
          updateData = { notes: content };
          break;
        case 'バイタル':
          endpoint = `/api/vital-signs/${id}`;
          updateData = { notes: content };
          break;
        case '排泄':
          endpoint = `/api/excretion-records/${id}`;
          updateData = { notes: content };
          break;
        case '清掃リネン':
          endpoint = `/api/cleaning-linen-records/${id}`;
          updateData = { notes: content };
          break;
        case '入浴':
          endpoint = `/api/bathing-records/${id}`;
          updateData = { notes: content };
          break;
        case '体重':
          endpoint = `/api/weight-records/${id}`;
          updateData = { notes: content };
          break;
        case '看護記録':
        case '医療記録':
        case '処置':
          endpoint = `/api/nursing-records/${id}`;
          updateData = { description: content };
          break;
        default:
          throw new Error(`未対応の記録タイプ: ${recordType}`);
      }

      return await apiRequest(endpoint, 'PATCH', updateData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-records"] });
      // 編集状態をクリア
      setEditingContent(prev => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "更新に失敗しました", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // 記録データを取得
  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["/api/daily-records", selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      
      const response = await apiRequest(`/api/daily-records?${params.toString()}`);
      
      // 排泄記録のデバッグログ
      const excretionRecords = response.filter((record: DailyRecord) => record.recordType === '排泄');
      console.log('💧 排泄記録詳細:', excretionRecords.map((record: DailyRecord) => ({
        id: record.id,
        residentName: record.residentName,
        recordTime: record.recordTime,
        content: record.content,
        hasExcretionDetails: !!record.excretionDetails,
        excretionDetails: record.excretionDetails,
        originalData: record.originalData
      })));

      // データベースの排泄記録を直接確認
      apiRequest(`/api/debug-excretion?date=${selectedDate}`)
        .then(debugData => {
          console.log('🔍 データベース排泄記録:', debugData);
        })
        .catch(err => {
          console.error('デバッグAPI呼び出しエラー:', err);
        });
      
      return response as DailyRecord[];
    },
    enabled: !!isAuthenticated && !!selectedDate,
    staleTime: 0, // キャッシュを無効化
    refetchOnMount: true, // マウント時に必ず最新データを取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時にも最新データを取得
  });

  // フロントエンド側でフィルタリングを実装
  const filteredRecords = useMemo(() => {
    if (!records) return [];

    return records.filter(record => {
      const recordTime = new Date(record.recordTime);
      const hour = recordTime.getHours();
      const minute = recordTime.getMinutes();
      const totalMinutes = hour * 60 + minute;
      
      // 8:31〜17:30 = 日中 (511分〜1050分)
      const isDaytime = totalMinutes >= 511 && totalMinutes <= 1050;
      const isNighttime = !isDaytime;
      
      if (selectedRecordType === "日中") {
        // 日中フィルタ：8:31〜17:30の時間帯で、バイタル・看護記録・処置以外
        return isDaytime && !['バイタル', '看護記録', '処置'].includes(record.recordType);
      } else if (selectedRecordType === "夜間") {
        // 夜間フィルタ：17:31〜8:30の時間帯で、バイタル・看護記録・処置以外
        return isNighttime && !['バイタル', '看護記録', '処置'].includes(record.recordType);
      } else if (selectedRecordType === "看護") {
        // 看護フィルタ：時間に関係なく、バイタル・看護記録・処置のみ
        return ['バイタル', '看護記録', '処置'].includes(record.recordType);
      }
      
      return true;
    });
  }, [records, selectedRecordType]);

  if (!isAuthenticated) {
    return null;
  }

  const handleBack = () => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    // daily-recordsは階数フィルタがないので、URLから取得した階数をそのまま使用
    const floorParam = urlParams.get('floor');
    if (floorParam) params.set('floor', floorParam);
    const targetUrl = `/?${params.toString()}`;
    console.log('今日の記録一覧からトップ画面へ遷移:', targetUrl);
    navigate(targetUrl);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MM/dd HH:mm", { locale: ja });
    } catch {
      return "";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MM月dd日", { locale: ja });
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
          <h1 className="text-lg font-semibold">今日の記録一覧</h1>
        </div>
      </div>

      <div className="max-w-full mx-auto p-2">
        {/* Filter Controls */}
        <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
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
                  className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white mx-0.5"
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

            {/* 記録種別選択 */}
            <div className="flex items-center space-x-1">
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
                placeholder="記録種別"
                className="w-16 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                enableAutoFocus={false}
              />
            </div>
          </div>
        </div>

        {/* 記録一覧 */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">記録を読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">記録の読み込みに失敗しました</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">該当する記録がありません</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <Card 
                key={record.id} 
                className={cn(
                  "border-l-4",
                  recordTypeColors[record.recordType as keyof typeof recordTypeColors] || "bg-slate-50 border-slate-200"
                )}
              >
                <CardContent className="p-2">
                  {/* 上段：居室番号、利用者名、記録時分、記録カテゴリ */}
                  <div className="flex gap-2 mb-2 text-sm items-center">
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
                      <div className="p-1.5 bg-slate-50 rounded border text-sm">
                        {record.originalData.notes}
                      </div>
                    </div>
                  )}

                  {/* バイタル専用：上枠（バイタル数値） */}
                  {record.recordType === 'バイタル' && record.vitalValues && (
                    <div className="mb-2">
                      <div className="p-1.5 bg-slate-50 rounded border text-sm">
                        {record.vitalValues}
                      </div>
                    </div>
                  )}

                  {/* 排泄専用：上枠（排泄データ） */}
                  {record.recordType === '排泄' && (() => {
                    console.log('🔍 排泄カード表示チェック:', {
                      recordId: record.id,
                      hasExcretionDetails: !!record.excretionDetails,
                      formattedEntries: record.excretionDetails?.formattedEntries,
                      entriesLength: record.excretionDetails?.formattedEntries?.length || 0
                    });
                    return record.excretionDetails && record.excretionDetails.formattedEntries.length > 0;
                  })() && (
                    <div className="mb-2">
                      <div className="p-1.5 bg-slate-50 rounded border text-sm">
                        <div className="whitespace-pre-line">
                          {record.excretionDetails.formattedEntries.join('\n')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 下枠：記録内容（全記録タイプ共通） */}
                  <div className="mb-2">
                    <textarea
                      className="w-full p-1.5 bg-white rounded border text-sm min-h-[4rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editingContent[record.id] !== undefined 
                        ? editingContent[record.id]
                        : record.recordType === '処置' 
                          ? (record.originalData?.description || record.originalData?.interventions || '')
                          : record.recordType === 'バイタル' 
                            ? (record.notes || '') // バイタルの場合はnotesのみ表示
                            : (record.content || '')
                      }
                      onChange={(e) => {
                        setEditingContent(prev => ({
                          ...prev,
                          [record.id]: e.target.value
                        }));
                      }}
                      onBlur={(e) => {
                        const newContent = e.target.value;
                        const originalContent = record.recordType === '処置' 
                          ? (record.originalData?.description || record.originalData?.interventions || '')
                          : record.recordType === 'バイタル'
                            ? (record.notes || '') // バイタルの場合はnotesと比較
                            : (record.content || '');
                        
                        if (newContent !== originalContent) {
                          updateRecordMutation.mutate({
                            id: record.id,
                            recordType: record.recordType,
                            content: newContent
                          });
                        } else {
                          // 変更がない場合は編集状態をクリア
                          setEditingContent(prev => {
                            const newState = { ...prev };
                            delete newState[record.id];
                            return newState;
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="記録内容を入力..."
                      disabled={updateRecordMutation.isPending}
                    />
                  </div>

                  {/* 下段：記録者 */}
                  <div className="flex justify-between items-center">
                    <div className="flex gap-4">
                        {(['日中', '夜間', '看護'] as const).map((type) => (
                          <div key={type} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              id={`${record.id}-${type}`}
                              checked={(cardCheckboxes[record.id] || []).includes(type)}
                              onChange={() => {
                                setCardCheckboxes(prev => {
                                  const currentTypes = prev[record.id] || [];
                                  const newTypes = currentTypes.includes(type)
                                    ? currentTypes.filter(t => t !== type)
                                    : [...currentTypes, type];
                                  return {
                                    ...prev,
                                    [record.id]: newTypes
                                  };
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`${record.id}-${type}`} className="text-sm font-medium text-gray-700">
                              {type}
                            </label>
                          </div>
                        ))}
                    </div>
                    <div className="font-medium text-sm text-right">{record.staffName || '-'}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 統計情報 */}
        {filteredRecords.length > 0 && (
          <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-2">記録統計</h3>
            <div className="text-sm text-slate-600">
              表示中の記録件数: {filteredRecords.length}件
            </div>
          </div>
        )}
      </div>
    </div>
  );
}