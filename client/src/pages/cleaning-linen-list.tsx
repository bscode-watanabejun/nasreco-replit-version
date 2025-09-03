import { useState, useMemo, useRef, useEffect } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CleaningLinenRecord {
  id: string;
  residentId: string;
  recordDate: string;
  dayOfWeek: number;
  cleaningValue?: string;
  linenValue?: string;
  recordNote?: string;
  staffId: string;
  residentName: string;
  residentFloor: string;
  residentRoom: string;
  staffName: string;
}

interface Resident {
  id: string;
  name: string;
  floor: string;
  roomNumber: string;
}

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
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
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly
          onClick={() => setOpen(!open)}
          placeholder={placeholder}
          className={className}
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
  );
}

export default function CleaningLinenList() {
  const [, setLocation] = useLocation();
  
  // URLパラメータから選択された日付を取得
  const urlParams = new URLSearchParams(window.location.search);
  const selectedDateFromUrl = urlParams.get('date');
  
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // URLに日付が指定されている場合はその週を表示
    if (selectedDateFromUrl) {
      const targetDate = new Date(selectedDateFromUrl);
      return startOfWeek(targetDate, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 }); // 月曜日始まり
  });
  const [selectedFloor, setSelectedFloor] = useState("全階");

  useEffect(() => {
    const floorParam = urlParams.get('floor');
    if (floorParam) {
      if (floorParam === 'all') {
        setSelectedFloor('全階');
      } else {
        setSelectedFloor(`${floorParam}階`);
      }
    }
  }, []);
  
  // ポップアップ用の状態
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    residentId: string;
    date: Date;
    currentNote: string;
  } | null>(null);
  const [tempNote, setTempNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["/api/residents"],
  });

  const { data: cleaningLinenRecords = [] } = useQuery<CleaningLinenRecord[]>({
    queryKey: ["/api/cleaning-linen", selectedWeek.toISOString().split('T')[0], selectedFloor],
    queryFn: async () => {
      const response = await fetch(`/api/cleaning-linen?weekStartDate=${selectedWeek.toISOString().split('T')[0]}&floor=${selectedFloor}`);
      if (!response.ok) throw new Error('Failed to fetch cleaning linen records');
      return response.json();
    },
  });

  const upsertRecordMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      recordDate: string;
      dayOfWeek: number;
      cleaningValue?: string;
      linenValue?: string;
      recordNote?: string;
    }) => {
      const response = await fetch('/api/cleaning-linen/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save record');
      return response.json();
    },
    onMutate: async (newRecord) => {
      // 楽観的更新の実装
      const queryKey = ["/api/cleaning-linen", selectedWeek.toISOString().split('T')[0], selectedFloor];
      
      // 進行中のクエリをキャンセル（競合を避けるため）
      await queryClient.cancelQueries({ queryKey });
      
      // 現在のデータを取得（ロールバック用に保存）
      const previousData = queryClient.getQueryData<CleaningLinenRecord[]>(queryKey);
      
      // 楽観的更新を実行
      queryClient.setQueryData<CleaningLinenRecord[]>(queryKey, (oldData) => {
        if (!oldData) return oldData;
        
        // 既存のレコードを探す
        const existingRecordIndex = oldData.findIndex(
          record => record.residentId === newRecord.residentId && record.recordDate === newRecord.recordDate
        );
        
        if (existingRecordIndex >= 0) {
          // 既存レコードを更新
          const updatedData = [...oldData];
          updatedData[existingRecordIndex] = {
            ...updatedData[existingRecordIndex],
            cleaningValue: newRecord.cleaningValue !== undefined ? newRecord.cleaningValue : updatedData[existingRecordIndex].cleaningValue,
            linenValue: newRecord.linenValue !== undefined ? newRecord.linenValue : updatedData[existingRecordIndex].linenValue,
            recordNote: newRecord.recordNote !== undefined ? newRecord.recordNote : updatedData[existingRecordIndex].recordNote,
          };
          return updatedData;
        } else {
          // 新しいレコードを追加
          const resident = residents.find(r => r.id === newRecord.residentId);
          if (!resident) return oldData;
          
          const newRecordEntry: CleaningLinenRecord = {
            id: `temp-${Date.now()}`, // 一時ID
            residentId: newRecord.residentId,
            recordDate: newRecord.recordDate,
            dayOfWeek: newRecord.dayOfWeek,
            cleaningValue: newRecord.cleaningValue || "",
            linenValue: newRecord.linenValue || "",
            recordNote: newRecord.recordNote || "",
            staffId: "", // サーバーから返される
            residentName: resident.name,
            residentFloor: resident.floor,
            residentRoom: resident.roomNumber,
            staffName: "", // サーバーから返される
          };
          
          return [...oldData, newRecordEntry];
        }
      });
      
      // ロールバック用にpreviousDataを返す
      return { previousData, queryKey };
    },
    onError: (err, newRecord, context) => {
      // エラー時にロールバック
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // 成功・失敗に関わらず、サーバーの最新データで同期
      queryClient.invalidateQueries({ 
        queryKey: ["/api/cleaning-linen", selectedWeek.toISOString().split('T')[0], selectedFloor] 
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/cleaning-linen"
      });
    },
  });

  const weekDays = ['月', '火', '水', '木', '金', '土', '日'];
  const floors = ["全階", "1階", "2階", "3階", "4階"];

  const filteredResidents = useMemo(() => {
    if (selectedFloor === "全階") return residents;
    // "1階" -> "1" or "1F" にマッチ
    const floorNumber = selectedFloor.replace('階', '');
    return residents.filter(r => 
      r.floor === floorNumber || 
      r.floor === `${floorNumber}F` || 
      r.floor === selectedFloor
    );
  }, [residents, selectedFloor]);

  const getRecordForDate = (residentId: string, date: Date) => {
    // 日付を正規化してタイムゾーンの問題を回避
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const dateStr = format(localDate, 'yyyy-MM-dd');
    return cleaningLinenRecords.find(r => r.residentId === residentId && r.recordDate === dateStr);
  };

  const handleCellClick = (residentId: string, date: Date, type: 'cleaning' | 'linen') => {
    console.log('Cell clicked:', { residentId, date, type });
    
    // 日付を正規化してタイムゾーンの問題を回避
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const dateStr = format(localDate, 'yyyy-MM-dd');
    const dayOfWeek = getDay(localDate) === 0 ? 6 : getDay(localDate) - 1;
    const existingRecord = getRecordForDate(residentId, localDate);
    
    console.log('Normalized date info:', { originalDate: date, localDate, dateStr, dayOfWeek });
    
    console.log('Existing record:', existingRecord);
    
    let newValue = "";
    if (type === 'cleaning') {
      const currentValue = existingRecord?.cleaningValue || "";
      newValue = currentValue === "" ? "○" : currentValue === "○" ? "2" : currentValue === "2" ? "3" : "";
      console.log('Cleaning value change:', currentValue, '->', newValue);
    } else {
      const currentValue = existingRecord?.linenValue || "";
      newValue = currentValue === "" ? "○" : currentValue === "○" ? "2" : currentValue === "2" ? "3" : "";
      console.log('Linen value change:', currentValue, '->', newValue);
    }

    const updateData = {
      residentId,
      recordDate: dateStr,
      dayOfWeek,
      cleaningValue: type === 'cleaning' ? newValue : existingRecord?.cleaningValue || "",
      linenValue: type === 'linen' ? newValue : existingRecord?.linenValue || "",
      recordNote: existingRecord?.recordNote || "",
    };

    console.log('Update data:', updateData);
    
    upsertRecordMutation.mutate(updateData, {
      onSuccess: (data) => {
        console.log('Mutation successful:', data);
      },
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    });
  };

  // 利用者の清掃・リネン交換日設定を確認する関数
  const isResidentScheduledDay = (resident: any, date: Date, type: 'cleaning' | 'linen') => {
    const dayOfWeek = getDay(date); // 0=日曜日, 1=月曜日, ...
    
    if (type === 'cleaning' || type === 'linen') {
      // 清掃・リネン交換日の設定を確認（どちらも同じ設定を使用）
      switch (dayOfWeek) {
        case 0: return resident.bathingSunday;
        case 1: return resident.bathingMonday;
        case 2: return resident.bathingTuesday;
        case 3: return resident.bathingWednesday;
        case 4: return resident.bathingThursday;
        case 5: return resident.bathingFriday;
        case 6: return resident.bathingSaturday;
        default: return false;
      }
    }
    return false;
  };

  const getCellStyle = (resident: any, date: Date, type: 'cleaning' | 'linen') => {
    const isScheduled = isResidentScheduledDay(resident, date, type);
    if ((type === 'cleaning' || type === 'linen') && isScheduled) {
      return "bg-pink-100 hover:bg-pink-200";
    }
    return "hover:bg-gray-100";
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(selectedWeek, direction === 'prev' ? -7 : 7);
    setSelectedWeek(newWeek);
  };

  // 記録ポップアップの開閉処理
  const handleRecordClick = (residentId: string, date: Date, currentNote: string) => {
    setEditingRecord({ residentId, date, currentNote });
    setTempNote(currentNote);
    setPopoverOpen(true);
    // フォーカスを設定するためにsetTimeoutを使用
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleNoteBlur = () => {
    if (!editingRecord) return;
    
    // 値が変更された場合のみ保存
    if (tempNote !== editingRecord.currentNote) {
      const dateStr = format(editingRecord.date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(editingRecord.date) === 0 ? 6 : getDay(editingRecord.date) - 1;
      const existingRecord = getRecordForDate(editingRecord.residentId, editingRecord.date);
      
      upsertRecordMutation.mutate({
        residentId: editingRecord.residentId,
        recordDate: dateStr,
        dayOfWeek,
        cleaningValue: existingRecord?.cleaningValue || "",
        linenValue: existingRecord?.linenValue || "",
        recordNote: tempNote,
      });
    }
    
    setPopoverOpen(false);
    setEditingRecord(null);
    setTempNote("");
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 shadow-md">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              if (selectedDateFromUrl) params.set('date', selectedDateFromUrl);
              params.set('floor', selectedFloor === "全階" ? "all" : selectedFloor.replace("階", ""));
              const targetUrl = `/?${params.toString()}`;
              setLocation(targetUrl);
            }}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800" data-testid="title-cleaning-linen-list">清掃リネン一覧</h1>
        </div>
      </header>

      <div className="p-2">
        {/* 週選択と階数選択 */}
        <div className="flex items-center justify-between mb-3 bg-white rounded-lg p-2 shadow-sm">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateWeek('prev')}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-xs flex-1 text-center" data-testid="text-week-range">
            {format(selectedWeek, 'M/d', { locale: ja })}-{format(addDays(selectedWeek, 6), 'M/d', { locale: ja })}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateWeek('next')}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <InputWithDropdown
            value={selectedFloor}
            options={floors.map(floor => ({ value: floor, label: floor }))}
            onSave={(value) => setSelectedFloor(value)}
            placeholder="階数選択"
            className="w-20 h-8 text-xs px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ml-2"
          />
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-0.5 text-center border border-gray-300 rounded-tl-lg w-20" colSpan={2} data-testid="header-room-type"></th>
                {weekDays.map((day, index) => {
                  const date = addDays(selectedWeek, index);
                  const isSelectedDate = selectedDateFromUrl && format(date, 'yyyy-MM-dd') === selectedDateFromUrl;
                  const isLastColumn = index === weekDays.length - 1;
                  return (
                    <th 
                      key={day} 
                      className={`p-0.5 text-center border border-gray-300 w-12 ${isSelectedDate ? 'bg-yellow-100' : ''} ${isLastColumn ? 'rounded-tr-lg' : ''}`}
                      data-testid={`header-day-${day}`}
                    >
                      <div>{day}</div>
                      <div className="text-xs text-gray-600">
                        {format(date, 'd', { locale: ja })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredResidents
                .sort((a, b) => {
                  const roomA = parseInt(a.roomNumber || '999999');
                  const roomB = parseInt(b.roomNumber || '999999');
                  return roomA - roomB;
                })
                .flatMap((resident, residentIndex, sortedResidents) => [
                  /* 清掃行 */
                  <tr key={`cleaning-${resident.id}`} className="border-b border-gray-200">
                    <td 
                      className={`p-0.5 text-center border border-gray-300 text-xs font-medium leading-tight w-16 ${residentIndex === sortedResidents.length - 1 ? 'rounded-bl-lg' : ''}`}
                      rowSpan={3}
                      data-testid={`room-${resident.id}`}
                    >
                      <div className="font-bold">{resident.roomNumber}</div>
                      <div className="text-gray-600 text-xs mt-0.5">{resident.name}</div>
                    </td>
                    <td 
                      className="p-0.5 text-center border border-gray-300 text-xs bg-blue-50 w-4"
                      data-testid={`type-cleaning-${resident.id}`}
                    >
                      清掃
                    </td>
                    {weekDays.map((_, index) => {
                      const date = addDays(selectedWeek, index);
                      const record = getRecordForDate(resident.id, date);
                      const value = record?.cleaningValue || "";
                      console.log(`Cell render - Resident: ${resident.name}, Date: ${format(date, 'yyyy-MM-dd')}, Record:`, record, 'Value:', value);
                      return (
                        <td
                          key={`cleaning-${resident.id}-${index}`}
                          className={`p-0.5 text-center border border-gray-300 cursor-pointer text-xs ${getCellStyle(resident, date, 'cleaning')}`}
                          onClick={() => handleCellClick(resident.id, date, 'cleaning')}
                          data-testid={`cell-cleaning-${resident.id}-${index}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>,
                  
                  /* リネン行 */
                  <tr key={`linen-${resident.id}`} className="border-b border-gray-200">
                    <td 
                      className="p-0.5 text-center border border-gray-300 text-xs bg-green-50 w-4"
                      data-testid={`type-linen-${resident.id}`}
                    >
                      リネン
                    </td>
                    {weekDays.map((_, index) => {
                      const date = addDays(selectedWeek, index);
                      const record = getRecordForDate(resident.id, date);
                      const value = record?.linenValue || "";
                      return (
                        <td
                          key={`linen-${resident.id}-${index}`}
                          className={`p-0.5 text-center border border-gray-300 cursor-pointer text-xs ${getCellStyle(resident, date, 'linen')}`}
                          onClick={() => handleCellClick(resident.id, date, 'linen')}
                          data-testid={`cell-linen-${resident.id}-${index}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>,
                  
                  /* 記録行 */
                  <tr key={`record-${resident.id}`} className="border-b-2 border-gray-300">
                    <td 
                      className={`p-0.5 text-center border-l border-r border-t border-gray-300 ${residentIndex === sortedResidents.length - 1 ? 'border-b border-gray-300' : 'border-b-2 border-gray-300'} text-xs bg-yellow-50 w-4`}
                      data-testid={`type-record-${resident.id}`}
                    >
                      記録
                    </td>
                    {weekDays.map((_, index) => {
                      const date = addDays(selectedWeek, index);
                      const record = getRecordForDate(resident.id, date);
                      const note = record?.recordNote || "";
                      const isLastColumn = index === weekDays.length - 1;
                      const isLastRow = residentIndex === sortedResidents.length - 1;
                      return (
                        <Popover
                          key={`record-${resident.id}-${index}`}
                          open={popoverOpen && editingRecord?.residentId === resident.id && 
                                format(editingRecord?.date || new Date(), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')}
                          onOpenChange={(open) => {
                            if (!open) {
                              handleNoteBlur();
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <td
                              className={`p-0.5 text-center border-l border-r border-t border-gray-300 ${isLastRow ? 'border-b border-gray-300' : 'border-b-2 border-gray-300'} cursor-pointer hover:bg-gray-100 text-xs ${isLastRow && isLastColumn ? 'rounded-br-lg' : ''}`}
                              onClick={() => handleRecordClick(resident.id, date, note)}
                              data-testid={`cell-record-${resident.id}-${index}`}
                            >
                              {note.length > 4 ? note.substring(0, 4) + "..." : note}
                            </td>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-72 p-3"
                            align="center"
                            side="top"
                          >
                            <div className="space-y-2">
                              <div className="text-sm font-medium">
                                {resident.roomNumber} {resident.name} - {format(date, 'M/d', { locale: ja })}の記録
                              </div>
                              <textarea
                                ref={textareaRef}
                                value={tempNote}
                                onChange={(e) => setTempNote(e.target.value)}
                                onBlur={handleNoteBlur}
                                placeholder="記録を入力してください"
                                className="w-full h-20 text-sm border border-gray-300 rounded px-2 py-1 resize-none"
                                style={{ minHeight: '80px' }}
                              />
                              <div className="text-xs text-gray-500">
フィールド外をタップで保存
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </tr>
                ])}
            </tbody>
          </table>
        </div>

        {/* 凡例 */}
        <div className="mt-3 bg-white rounded-lg p-2 shadow-sm">
          <div className="text-xs text-gray-600 mb-1">凡例:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span>○: 実施</span>
            <span>2: 2番目</span>
            <span>3: 3番目</span>
            <span className="text-pink-600">ピンク背景: 清掃・リネン交換予定日</span>
          </div>
        </div>
      </div>
    </div>
  );
}