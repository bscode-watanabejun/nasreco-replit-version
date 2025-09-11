import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, endOfDay, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MedicationRecord, Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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

export default function MedicationCheckList() {
  const [, navigate] = useLocation();
  
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
  const [selectedTiming, setSelectedTiming] = useState("all");
  const { toast } = useToast();

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

  // 服薬記録データの取得（日付範囲で取得）
  const { data: medicationRecords = [], isLoading } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["medication-records-all", dateFrom, dateTo],
    queryFn: async () => {
      // 日付範囲内の全ての服薬記録を取得
      const allRecords: MedicationRecordWithResident[] = [];
      
      // 日付をループして各日のデータを取得
      let currentDate = parseISO(dateFrom);
      const endDate = parseISO(dateTo);
      
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        
        try {
          const response = await fetch(`/api/medication-records?recordDate=${dateStr}&timing=all&floor=all`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const dayRecords = await response.json();
            allRecords.push(...dayRecords);
          }
        } catch (error) {
          console.error(`Error fetching records for ${dateStr}:`, error);
        }
        
        // 次の日へ
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return allRecords;
    },
    staleTime: 0,
    gcTime: 0,
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    let filtered = medicationRecords;

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

    // 服薬時間帯フィルタ
    if (selectedTiming !== "all") {
      filtered = filtered.filter(record => record.timing === selectedTiming);
    }

    return filtered;
  }, [medicationRecords, selectedFloor, selectedResident, selectedTiming, residents]);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (selectedFloor !== "all") params.set("floor", selectedFloor);
            if (dateFrom !== format(new Date(), "yyyy-MM-dd")) params.set("date", dateFrom);
            navigate(`/check-list-menu${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">服薬チェック一覧</h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 表示期間 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">表示期間:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="h-8 text-sm border rounded px-2"
            />
            <span>〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="h-8 text-sm border rounded px-2"
            />
          </div>

          {/* 服薬時間帯 */}
          <Select value={selectedTiming} onValueChange={setSelectedTiming}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
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

          {/* 利用者 */}
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

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                toast({
                  title: "印刷機能",
                  description: "印刷機能は現在開発中です",
                });
              }}
            >
              <Printer className="h-4 w-4 mr-1" />
              印刷
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                toast({
                  title: "日次チェック機能",
                  description: "日次チェック機能は現在開発中です",
                });
              }}
            >
              日次チェック
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">該当するデータがありません</div>
          </div>
        ) : (
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
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-16">結果</th>
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