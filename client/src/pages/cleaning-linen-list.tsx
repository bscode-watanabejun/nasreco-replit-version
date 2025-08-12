import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [selectedWeek, setSelectedWeek] = useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 }); // 月曜日始まり
  });
  const [selectedFloor, setSelectedFloor] = useState("全体");

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
  const floors = useMemo(() => {
    const floorSet = new Set(residents.map(r => r.floor).filter(Boolean));
    return ['全体', ...Array.from(floorSet).sort()];
  }, [residents]);

  const filteredResidents = useMemo(() => {
    if (selectedFloor === "全体") return residents;
    return residents.filter(r => r.floor === selectedFloor);
  }, [residents, selectedFloor]);

  const getRecordForDate = (residentId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return cleaningLinenRecords.find(r => r.residentId === residentId && r.recordDate === dateStr);
  };

  const handleCellClick = (residentId: string, date: Date, type: 'cleaning' | 'linen') => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date) === 0 ? 6 : getDay(date) - 1; // 月曜日=0, 日曜日=6
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

  const isScheduledCleaningDay = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 1 || dayOfWeek === 4; // 月曜日、木曜日
  };

  const getCellStyle = (date: Date, type: 'cleaning' | 'linen') => {
    const isScheduled = isScheduledCleaningDay(date);
    if (type === 'cleaning' && isScheduled) {
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold" data-testid="title-cleaning-linen-list">清掃リネン一覧</h1>
          <div className="flex items-center gap-2">
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger 
                className="w-20 h-8 bg-white text-gray-900 text-sm border-gray-300" 
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
        </div>
      </header>

      <div className="p-2">
        {/* 週選択 */}
        <div className="flex items-center justify-between mb-3 bg-white rounded-lg p-2 shadow-sm">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateWeek('prev')}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm" data-testid="text-week-range">
            {format(selectedWeek, 'M/d', { locale: ja })} - {format(addDays(selectedWeek, 6), 'M/d', { locale: ja })}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateWeek('next')}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-1 text-center border border-gray-300 w-16" data-testid="header-room">部屋</th>
                <th className="p-1 text-center border border-gray-300 w-20" data-testid="header-name">氏名</th>
                <th className="p-1 text-center border border-gray-300 w-12" data-testid="header-type">種別</th>
                {weekDays.map((day, index) => {
                  const date = addDays(selectedWeek, index);
                  const isScheduled = isScheduledCleaningDay(date);
                  return (
                    <th 
                      key={day} 
                      className={`p-1 text-center border border-gray-300 w-12 ${isScheduled ? 'bg-pink-100' : ''}`}
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
              {filteredResidents.map((resident) => (
                <>
                  {/* 清掃行 */}
                  <tr key={`cleaning-${resident.id}`} className="border-b border-gray-200">
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs font-medium"
                      rowSpan={3}
                      data-testid={`room-${resident.id}`}
                    >
                      {resident.roomNumber}
                    </td>
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs"
                      rowSpan={3}
                      data-testid={`name-${resident.id}`}
                    >
                      {resident.name}
                    </td>
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs bg-blue-50"
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
                          className={`p-1 text-center border border-gray-300 cursor-pointer ${getCellStyle(date, 'cleaning')}`}
                          onClick={() => handleCellClick(resident.id, date, 'cleaning')}
                          data-testid={`cell-cleaning-${resident.id}-${index}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                  
                  {/* リネン行 */}
                  <tr key={`linen-${resident.id}`} className="border-b border-gray-200">
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs bg-green-50"
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
                          className={`p-1 text-center border border-gray-300 cursor-pointer ${getCellStyle(date, 'linen')}`}
                          onClick={() => handleCellClick(resident.id, date, 'linen')}
                          data-testid={`cell-linen-${resident.id}-${index}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                  
                  {/* 記録行 */}
                  <tr key={`record-${resident.id}`} className="border-b border-gray-200">
                    <td 
                      className="p-1 text-center border border-gray-300 text-xs bg-yellow-50"
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
                          className="p-1 text-center border border-gray-300 cursor-pointer hover:bg-gray-100 text-xs"
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
                </>
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
            <span className="text-pink-600">ピンク背景: 清掃予定日 (月・木)</span>
          </div>
        </div>
      </div>
    </div>
  );
}