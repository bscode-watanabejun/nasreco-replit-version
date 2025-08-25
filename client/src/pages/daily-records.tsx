import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export default function DailyRecords() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  
  // フィルタ状態
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedRecordType, setSelectedRecordType] = useState("all");

  // 記録データを取得
  const { data: records = [], isLoading, error } = useQuery({
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

  // フィルタリングされた記録
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    
    let filtered = records;

    // 記録種別フィルタ
    if (selectedRecordType !== "all") {
      const recordTypeMapping = {
        "日中": ["様子", "服薬", "食事", "清掃リネン", "体重", "排泄"],
        "看護": ["看護記録", "医療記録", "処置", "バイタル"]
      };

      const targetTypes = recordTypeMapping[selectedRecordType as keyof typeof recordTypeMapping];
      if (targetTypes) {
        filtered = filtered.filter(record => targetTypes.includes(record.recordType));
      }
    }

    return filtered;
  }, [records, selectedRecordType]);

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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MM月dd日", { locale: ja });
    } catch {
      return "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">今日の記録一覧</h1>
        </div>
      </div>

      <div className="max-w-full mx-auto p-2">
        {/* Filter Controls */}
        <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>

            {/* 記録種別選択 */}
            <div className="flex items-center space-x-1">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
                <SelectTrigger className="w-16 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="日中">日中</SelectItem>
                  <SelectItem value="看護">看護</SelectItem>
                </SelectContent>
              </Select>
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
                <CardContent className="p-4">
                  {/* 上段：居室番号、利用者名、記録時分、記録カテゴリ */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">居室番号:</span>
                      <div className="font-medium">{record.roomNumber || '-'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">利用者名:</span>
                      <div className="font-medium">{record.residentName}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">記録時分:</span>
                      <div className="font-medium">
                        {formatDate(record.recordTime)} {formatTime(record.recordTime)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">記録カテゴリ:</span>
                      <div className="font-medium">
                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-slate-100">
                          {record.recordType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 中段：記録内容 */}
                  <div className="mb-3">
                    <span className="text-slate-500 text-xs">記録内容:</span>
                    <div className="mt-1 p-2 bg-white rounded border text-sm min-h-[2.5rem]">
                      {record.content || '-'}
                    </div>
                  </div>

                  {/* 下段：記録者 */}
                  <div>
                    <span className="text-slate-500 text-xs">記録者:</span>
                    <div className="font-medium text-sm">{record.staffName || '-'}</div>
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