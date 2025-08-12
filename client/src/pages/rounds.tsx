import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Building } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { RoundRecord, Resident } from "@shared/schema";

interface RoundGridData {
  [residentId: string]: {
    [hour: number]: {
      patrol?: RoundRecord;
      positionChange?: RoundRecord;
    };
  };
}

export default function Rounds() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || 'all');
  
  // 今日の日付を取得（日本語表示）
  const displayDate = format(new Date(selectedDate), 'M月d日', { locale: ja });

  // ご利用者一覧を取得（階数でフィルタリング）
  const { data: allResidents = [] } = useQuery<Resident[]>({
    queryKey: ['/api/residents'],
  });

  // 選択された階数に基づいてフィルタリング
  const residents = allResidents.filter(resident => {
    if (selectedFloor === 'all') return true;
    // 数値と文字列（"1F", "2F"など）の両方に対応
    return resident.floor === selectedFloor || 
           resident.floor === `${selectedFloor}F` ||
           resident.floor === selectedFloor.toString();
  });

  // ラウンド記録を取得（選択された日付の記録のみ、フィルタリングは後で適用）
  const { data: allRoundRecords = [], isLoading } = useQuery<RoundRecord[]>({
    queryKey: ['/api/round-records', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/round-records?recordDate=${selectedDate}`);
      return response.json();
    },
  });

  // 選択された階数の利用者IDを取得
  const residentIds = residents.map(r => r.id);
  
  // ラウンド記録を選択された階数の利用者に絞り込み
  const roundRecords = allRoundRecords.filter(record => 
    residentIds.includes(record.residentId)
  );

  // ラウンド記録作成のミューテーション
  const createRoundMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      hour: number;
      recordType: 'patrol' | 'position_change';
      positionValue?: string;
    }) => {
      const response = await fetch('/api/round-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          recordDate: selectedDate,
          staffName: (user as any)?.firstName?.charAt(0) || '?',
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/round-records', selectedDate] });
    },
  });

  // ラウンド記録削除のミューテーション
  const deleteRoundMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/round-records/${id}`, { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/round-records', selectedDate] });
    },
  });

  // データをグリッド形式に変換
  const gridData: RoundGridData = {};
  if (Array.isArray(roundRecords)) {
    roundRecords.forEach((record: RoundRecord) => {
      if (!gridData[record.residentId]) {
        gridData[record.residentId] = {};
      }
      if (!gridData[record.residentId][record.hour]) {
        gridData[record.residentId][record.hour] = {};
      }
      if (record.recordType === 'patrol') {
        gridData[record.residentId][record.hour].patrol = record;
      } else {
        gridData[record.residentId][record.hour].positionChange = record;
      }
    });
  }

  // 巡回記録をクリック
  const handlePatrolClick = (residentId: string, hour: number) => {
    const existingRecord = gridData[residentId]?.[hour]?.patrol;
    if (existingRecord) {
      deleteRoundMutation.mutate(existingRecord.id);
    } else {
      createRoundMutation.mutate({
        residentId,
        hour,
        recordType: 'patrol',
      });
    }
  };

  // 体位交換記録をクリック
  const handlePositionClick = (residentId: string, hour: number, positionValue?: string) => {
    const existingRecord = gridData[residentId]?.[hour]?.positionChange;
    if (existingRecord && !positionValue) {
      deleteRoundMutation.mutate(existingRecord.id);
    } else if (positionValue) {
      if (existingRecord) {
        deleteRoundMutation.mutate(existingRecord.id);
      }
      createRoundMutation.mutate({
        residentId,
        hour,
        recordType: 'position_change',
        positionValue,
      });
    }
  };

  // 日付や階数が変更されたときにURLパラメータを更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    params.set('floor', selectedFloor);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [selectedDate, selectedFloor]);

  // 時間軸（0-23時）
  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 p-2">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 p-2">
      <div className="max-w-full mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800">ラウンド一覧</h1>
          </div>
        </div>

        {/* 日付とフロア選択 */}
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
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="フロア選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全階</SelectItem>
                  <SelectItem value="1">1階</SelectItem>
                  <SelectItem value="2">2階</SelectItem>
                  <SelectItem value="3">3階</SelectItem>
                  <SelectItem value="4">4階</SelectItem>
                  <SelectItem value="5">5階</SelectItem>
                </SelectContent>
              </Select>
            </div>


          </div>
        </div>

        {/* ラウンド記録テーブル */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 bg-gray-100 border-r border-gray-200 p-1 text-left min-w-[80px] z-20">
                      <div className="text-[10px] text-gray-600">部屋</div>
                      <div className="text-[10px] text-gray-600">名前</div>
                    </th>
                    <th className="sticky left-[80px] bg-gray-100 border-r border-gray-200 p-1 min-w-[35px] z-10"></th>
                    {hours.map(hour => (
                      <th key={hour} className="border-r border-gray-200 p-1 min-w-[35px]">
                        <div className="text-[10px] text-gray-600">{hour}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {residents.map(resident => [
                      /* 巡回行 */
                      <tr key={`${resident.id}-patrol`} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="sticky left-0 bg-white border-r border-gray-200 p-1 z-20">
                          <div className="text-[11px] font-medium">{resident.roomNumber}</div>
                          <div className="text-[10px] text-gray-600 leading-tight">{resident.name?.split(' ')[0]} {resident.name?.split(' ')[1]}</div>
                        </td>
                        <td className="sticky left-[80px] bg-blue-50 border-r border-gray-200 p-1 z-10">
                          <div className="text-[10px] text-blue-700 font-medium">巡回</div>
                        </td>
                        {hours.map(hour => {
                          const patrolRecord = gridData[resident.id]?.[hour]?.patrol;
                          return (
                            <td
                              key={hour}
                              className="border-r border-gray-200 p-1 text-center cursor-pointer hover:bg-blue-50"
                              onClick={() => handlePatrolClick(resident.id, hour)}
                            >
                              {patrolRecord && (
                                <span className="text-[10px] font-bold text-blue-700">
                                  {patrolRecord.staffName}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>,
                      
                      /* 体位交換行 */
                      <tr key={`${resident.id}-position`} className="border-b-2 border-gray-300 hover:bg-gray-50">
                        <td className="sticky left-0 bg-white border-r border-gray-200 p-1 z-20"></td>
                        <td className="sticky left-[80px] bg-green-50 border-r border-gray-200 p-1 z-10">
                          <div className="text-[10px] text-green-700 font-medium">体交</div>
                        </td>
                        {hours.map(hour => {
                          const positionRecord = gridData[resident.id]?.[hour]?.positionChange;
                          return (
                            <td
                              key={hour}
                              className="border-r border-gray-200 p-1 text-center relative group"
                            >
                              {positionRecord ? (
                                <span
                                  className="text-[10px] font-bold text-green-700 cursor-pointer"
                                  onClick={() => handlePositionClick(resident.id, hour)}
                                >
                                  {positionRecord.positionValue}
                                </span>
                              ) : (
                                <div className="opacity-0 group-hover:opacity-100">
                                  <Select onValueChange={(value) => handlePositionClick(resident.id, hour, value)}>
                                    <SelectTrigger className="h-5 w-8 border-none p-0 text-[10px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="右">右</SelectItem>
                                      <SelectItem value="左">左</SelectItem>
                                      <SelectItem value="仰">仰</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ])}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 説明 */}
        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <div>• 巡回：セルをクリックするとスタッフ名がスタンプされます</div>
          <div>• 体交：セルをホバーして体位（右/左/仰）を選択してください</div>
          <div>• 記録をクリックすると削除されます</div>
        </div>
      </div>
    </div>
  );
}