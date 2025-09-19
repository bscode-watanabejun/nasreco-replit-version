import React, { useState, useEffect, useRef } from "react";
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
  const dateParam = urlParams.get('date');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  });
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || 'all');
  
  // 今日の日付を取得（日本語表示）
  const displayDate = format(selectedDate, 'M月d日', { locale: ja });

  // ご利用者一覧を取得（階数でフィルタリング）
  const { data: allResidents = [] } = useQuery<Resident[]>({
    queryKey: ['/api/residents'],
  });

  // 選択された階数に基づいてフィルタリングし、居室番号順でソート
  const residents = allResidents
    .filter(resident => {
      if (selectedFloor === 'all') return true;
      // データベースの「1階」「2階」形式と選択値「1」「2」を比較
      return resident.floor === `${selectedFloor}階` || 
             resident.floor === selectedFloor || 
             resident.floor === `${selectedFloor}F`;
    })
    .sort((a, b) => {
      // 居室番号を数値として比較（文字列の場合は文字列比較）
      const roomA = a.roomNumber || '';
      const roomB = b.roomNumber || '';
      
      // 数値部分を抽出して比較
      const numA = parseInt(roomA.replace(/[^\d]/g, '')) || 0;
      const numB = parseInt(roomB.replace(/[^\d]/g, '')) || 0;
      
      if (numA !== numB) {
        return numA - numB;
      }
      
      // 数値が同じ場合は文字列として比較
      return roomA.localeCompare(roomB);
    });

  // ラウンド記録を取得（選択された日付の記録のみ、フィルタリングは後で適用）
  const { data: allRoundRecords = [], isLoading } = useQuery<RoundRecord[]>({
    queryKey: ['/api/round-records', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await fetch(`/api/round-records?recordDate=${format(selectedDate, 'yyyy-MM-dd')}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // 選択された階数の利用者IDを取得
  const residentIds = residents.map(r => r.id);
  
  // ラウンド記録を選択された階数の利用者に絞り込み
  const roundRecords = Array.isArray(allRoundRecords) ? allRoundRecords.filter(record => 
    residentIds.includes(record.residentId)
  ) : [];

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
          staffName: (() => {
            // 職員ログインの場合
            if ((user as any)?.staffName) {
              return (user as any).staffName.charAt(0);
            }
            // Replitユーザーの場合
            if ((user as any)?.firstName) {
              return (user as any).firstName.charAt(0);
            }
            return '?';
          })(),
        }),
      });
      return response.json();
    },
    onMutate: async (newRecord) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/round-records', format(selectedDate, 'yyyy-MM-dd')] });

      // 現在のデータのスナップショットを取得
      const queryKey = ['/api/round-records', format(selectedDate, 'yyyy-MM-dd')];
      const previousData = queryClient.getQueryData(queryKey);
      
      // 楽観的に新規レコードを追加
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        // 新しいラウンド記録を作成（一時的なIDを付与）
        const optimisticRecord = {
          id: `temp-${Date.now()}`,
          residentId: newRecord.residentId,
          recordDate: selectedDate,
          hour: newRecord.hour,
          recordType: newRecord.recordType,
          positionValue: newRecord.positionValue,
          staffName: (() => {
            if ((user as any)?.staffName) {
              return (user as any).staffName.charAt(0);
            }
            if ((user as any)?.firstName) {
              return (user as any).firstName.charAt(0);
            }
            return '?';
          })(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        return [...old, optimisticRecord];
      });
      
      return { previousData };
    },
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(['/api/round-records', format(selectedDate, 'yyyy-MM-dd')], context.previousData);
      }
    },
    onSuccess: (serverRecord, variables, context) => {
      // 成功時は一時的なレコードを実際のサーバーレコードに置き換え
      queryClient.setQueryData(['/api/round-records', format(selectedDate, 'yyyy-MM-dd')], (old: any) => {
        if (!old) return old;
        
        return old.map((record: any) => {
          // 一時IDのレコードを実際のサーバーレコードに置き換え
          if (record.id?.startsWith('temp-') && 
              record.residentId === variables.residentId && 
              record.hour === variables.hour &&
              record.recordType === variables.recordType) {
            return serverRecord;
          }
          return record;
        });
      });
    },
  });

  // ラウンド記録削除のミューテーション
  const deleteRoundMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/round-records/${id}`, { method: 'DELETE' });
      return response.json();
    },
    onMutate: async (deletedId) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/round-records', format(selectedDate, 'yyyy-MM-dd')] });

      // 現在のデータのスナップショットを取得
      const queryKey = ['/api/round-records', format(selectedDate, 'yyyy-MM-dd')];
      const previousData = queryClient.getQueryData(queryKey);
      
      // 楽観的に削除
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((record: any) => record.id !== deletedId);
      });
      
      return { previousData };
    },
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(['/api/round-records', format(selectedDate, 'yyyy-MM-dd')], context.previousData);
      }
    },
    onSuccess: () => {
      // 削除が成功したので何もしない（楽観的更新で既に削除済み）
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
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('floor', selectedFloor);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [selectedDate, selectedFloor]);

  // 時間軸（0-23時）
  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-2">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* ヘッダー - Fixed */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sticky top-0 z-50">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', format(selectedDate, 'yyyy-MM-dd'));
              params.set('floor', selectedFloor);
              const targetUrl = `/?${params.toString()}`;
              setLocation(targetUrl);
            }}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">ラウンド一覧</h1>
        </div>
      </div>

      {/* Filter Controls - Fixed */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全階</option>
                <option value="1">1階</option>
                <option value="2">2階</option>
                <option value="3">3階</option>
                <option value="4">4階</option>
                <option value="5">5階</option>
              </select>
            </div>


          </div>
      </div>

      <div className="flex-1 overflow-hidden px-1 pb-1 flex flex-col">
        {/* ラウンド記録テーブル */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            <div className="h-full overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky top-0 left-0 z-30 bg-gray-100 border-r border-gray-200 px-0.5 py-0.5 text-left min-w-[70px]">
                    </th>
                    <th className="sticky top-0 left-[70px] z-20 bg-gray-100 border-r border-gray-200 px-0.5 py-0.5 min-w-[30px]"></th>
                    {hours.map(hour => (
                      <th key={hour} className="sticky top-0 z-10 bg-gray-100 border-r border-gray-200 px-0.5 py-0.5 min-w-[30px]">
                        <div className="text-sm font-bold text-gray-700">{hour}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {residents.map(resident => [
                      /* 巡回行 */
                      <tr key={`${resident.id}-patrol`} className="border-b border-gray-200 hover:bg-gray-50 h-8">
                        <td rowSpan={2} className="sticky left-0 bg-white border-r border-gray-200 px-0.5 py-0.5 z-20 h-16">
                          <div className="text-sm font-bold">{resident.roomNumber}</div>
                          <div className="text-sm text-gray-700 leading-tight font-bold">
                            <div>{resident.name?.split(' ')[0]}</div>
                            <div>{resident.name?.split(' ')[1]}</div>
                          </div>
                        </td>
                        <td className="sticky left-[70px] bg-blue-50 border-r border-gray-200 px-0.5 py-0.5 z-10">
                          <div className="text-[10px] text-blue-700 font-medium h-[32px] flex items-center">巡回</div>
                        </td>
                        {hours.map(hour => {
                          const patrolRecord = gridData[resident.id]?.[hour]?.patrol;
                          return (
                            <td
                              key={hour}
                              className="border-r border-gray-200 px-0.5 py-0.5 text-center cursor-pointer hover:bg-blue-50 h-8"
                              onClick={() => handlePatrolClick(resident.id, hour)}
                            >
                              {patrolRecord && (
                                <span className="text-lg font-bold text-blue-700">
                                  {patrolRecord.staffName}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>,
                      
                      /* 体位交換行 */
                      <tr key={`${resident.id}-position`} className="border-b-2 border-gray-300 hover:bg-gray-50 h-8">
                        <td className="sticky left-[70px] bg-green-50 border-r border-gray-200 px-0.5 py-0.5 z-10">
                          <div className="text-[10px] text-green-700 font-medium h-[32px] flex items-center">体交</div>
                        </td>
                        {hours.map(hour => {
                          const positionRecord = gridData[resident.id]?.[hour]?.positionChange;
                          return (
                            <td
                              key={hour}
                              className="border-r border-gray-200 px-0.5 py-0.5 text-center relative group h-8"
                            >
                              {positionRecord ? (
                                <span
                                  className="text-lg font-bold text-green-700 cursor-pointer"
                                  onClick={() => handlePositionClick(resident.id, hour)}
                                >
                                  {positionRecord.positionValue}
                                </span>
                              ) : (
                                <div className="opacity-0 group-hover:opacity-100">
                                  <Select onValueChange={(value) => handlePositionClick(resident.id, hour, value)}>
                                    <SelectTrigger className="h-4 w-6 border-none p-0 text-lg">
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
        <div className="mt-2 text-[10px] text-gray-600 space-y-0.5">
          <div>• 巡回：セルをクリックするとスタッフ名がスタンプされます</div>
          <div>• 体交：セルをホバーして体位（右/左/仰）を選択してください</div>
          <div>• 記録をクリックすると削除されます</div>
        </div>
      </div>
    </div>
  );
}