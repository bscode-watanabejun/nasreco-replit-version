import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { JournalEntry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// 種別の選択肢
const recordTypeOptions = [
  { value: "all", label: "全種別" },
  { value: "日中", label: "日中" },
  { value: "夜間", label: "夜間" },
  { value: "看護", label: "看護" }
];

export default function JournalCheckList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // URLパラメータから日付と階数を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const floorParam = urlParams.get('floor');

  // 初期値の設定
  const initialDate = dateParam || format(new Date(), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [selectedFloor, setSelectedFloor] = useState(floorParam || "all");
  const [selectedRecordType, setSelectedRecordType] = useState("all");

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

  // 日誌エントリデータの取得
  const { data: journalEntries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal-entries-range", dateFrom, dateTo, selectedRecordType, selectedFloor],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.set('dateFrom', dateFrom);
        params.set('dateTo', dateTo);
        if (selectedRecordType !== "all") {
          params.set('recordType', selectedRecordType);
        }
        if (selectedFloor !== "all") {
          params.set('floor', selectedFloor);
        }

        const response = await fetch(`/api/journal-entries?${params.toString()}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const entries = await response.json();
          return entries;
        } else {
          console.error('Failed to fetch journal entries:', response.statusText);
          return [];
        }
      } catch (error) {
        console.error('Error fetching journal entries:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,    // 5分間はキャッシュから取得
    gcTime: 30 * 60 * 1000,      // 30分間メモリに保持
  });

  // 表示用データの整形
  const displayData = useMemo(() => {
    return journalEntries
      .map(entry => ({
        ...entry,
        recordDateFormatted: format(parseISO(entry.recordDate), "MM月dd日", { locale: ja }),
      }))
      .sort((a, b) => {
        // 記録日でソート（降順）
        const dateCompare = new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime();
        if (dateCompare !== 0) return dateCompare;

        // 種別でソート（日中 → 夜間 → 看護）
        const typeOrder = ["日中", "夜間", "看護"];
        const typeIndexA = typeOrder.indexOf(a.recordType);
        const typeIndexB = typeOrder.indexOf(b.recordType);
        return typeIndexA - typeIndexB;
      });
  }, [journalEntries]);

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
        <h1 className="text-lg font-semibold">日誌チェック一覧</h1>
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

          {/* 種別 */}
          <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              {recordTypeOptions.map(option => (
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
              <SelectItem value="all">全階</SelectItem>
              <SelectItem value="1">1階</SelectItem>
              <SelectItem value="2">2階</SelectItem>
              <SelectItem value="3">3階</SelectItem>
              <SelectItem value="4">4階</SelectItem>
            </SelectContent>
          </Select>
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
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">記録日</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-24">記入者</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">入居者数</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-20">入院者数</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-16">種別</th>
                  <th className="text-xs font-medium border border-gray-300 px-2 py-2 text-center w-16">階数</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((entry, index) => (
                  <tr key={`${entry.id}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.recordDateFormatted}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.enteredBy || ""}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.residentCount}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.hospitalizedCount}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.recordType}
                    </td>
                    <td className="text-xs border border-gray-300 px-2 py-1 text-center">
                      {entry.floor ? `${entry.floor}階` : "全階"}
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