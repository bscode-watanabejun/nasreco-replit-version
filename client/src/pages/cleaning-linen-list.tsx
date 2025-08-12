import { useState, useMemo } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning-linen"] });
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
    const dateStr = format(date, 'yyyy-MM-dd');
    return cleaningLinenRecords.find(r => r.residentId === residentId && r.recordDate === dateStr);
  };

  const handleCellClick = (residentId: string, date: Date, type: 'cleaning' | 'linen') => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date) === 0 ? 6 : getDay(date) - 1;
    const existingRecord = getRecordForDate(residentId, date);
    
    let newValue = "";
    if (type === 'cleaning') {
      const currentValue = existingRecord?.cleaningValue || "";
      newValue = currentValue === "" ? "○" : currentValue === "○" ? "2" : currentValue === "2" ? "3" : "";
    } else {
      const currentValue = existingRecord?.linenValue || "";
      newValue = currentValue === "" ? "○" : currentValue === "○" ? "2" : currentValue === "2" ? "3" : "";
    }

    const updateData = {
      residentId,
      recordDate: dateStr,
      dayOfWeek,
      cleaningValue: type === 'cleaning' ? newValue : existingRecord?.cleaningValue || "",
      linenValue: type === 'linen' ? newValue : existingRecord?.linenValue || "",
      recordNote: existingRecord?.recordNote || "",
    };

    upsertRecordMutation.mutate(updateData);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-2 shadow-md">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="h-8 w-8 p-0 text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold" data-testid="title-cleaning-linen-list">清掃リネン一覧</h1>
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
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger 
              className="w-20 h-8 bg-white text-gray-900 text-xs border-gray-300 ml-2" 
              data-testid="select-floor"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {floors.map(floor => (
                <SelectItem key={floor} value={floor} data-testid={`floor-option-${floor}`}>
                  {floor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-1 text-center border border-gray-300 w-14" data-testid="header-room">部屋/氏名</th>
                <th className="p-1 text-center border border-gray-300 w-10" data-testid="header-type">種別</th>
                {weekDays.map((day, index) => {
                  const date = addDays(selectedWeek, index);
                  const isSelectedDate = selectedDateFromUrl && format(date, 'yyyy-MM-dd') === selectedDateFromUrl;
                  return (
                    <th 
                      key={day} 
                      className={`p-0.5 text-center border border-gray-300 w-10 ${isSelectedDate ? 'bg-yellow-100' : ''}`}
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
                .map((resident) => (
                <React.Fragment key={resident.id}>
                  {/* 清掃行 */}
                  <tr className="border-b border-gray-200">
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs font-medium leading-tight"
                      rowSpan={3}
                      data-testid={`room-${resident.id}`}
                    >
                      <div className="font-bold">{resident.roomNumber}</div>
                      <div className="text-gray-600 text-xs mt-0.5">{resident.name}</div>
                    </td>
                    <td 
                      className="p-0.5 text-center border border-gray-300 text-xs bg-blue-50"
                      data-testid={`type-cleaning-${resident.id}`}
                    >
                      清掃
                    </td>
                    {weekDays.map((_, index) => {
                      const date = addDays(selectedWeek, index);
                      const record = getRecordForDate(resident.id, date);
                      const value = record?.cleaningValue || "";
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
                  </tr>
                  
                  {/* リネン行 */}
                  <tr className="border-b border-gray-200">
                    <td 
                      className="p-0.5 text-center border border-gray-300 text-xs bg-green-50"
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
                  </tr>
                  
                  {/* 記録行 */}
                  <tr className="border-b border-gray-200">
                    <td 
                      className="p-0.5 text-center border border-gray-300 text-xs bg-yellow-50"
                      data-testid={`type-record-${resident.id}`}
                    >
                      記録
                    </td>
                    {weekDays.map((_, index) => {
                      const date = addDays(selectedWeek, index);
                      const record = getRecordForDate(resident.id, date);
                      const note = record?.recordNote || "";
                      return (
                        <td
                          key={`record-${resident.id}-${index}`}
                          className="p-0.5 text-center border border-gray-300 cursor-pointer hover:bg-gray-100 text-xs"
                          onClick={() => {
                            const newNote = prompt("記録を入力してください", note);
                            if (newNote !== null) {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const dayOfWeek = getDay(date) === 0 ? 6 : getDay(date) - 1;
                              upsertRecordMutation.mutate({
                                residentId: resident.id,
                                recordDate: dateStr,
                                dayOfWeek,
                                cleaningValue: record?.cleaningValue || "",
                                linenValue: record?.linenValue || "",
                                recordNote: newNote,
                              });
                            }
                          }}
                          data-testid={`cell-record-${resident.id}-${index}`}
                        >
                          {note.length > 4 ? note.substring(0, 4) + "..." : note}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
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