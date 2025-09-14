import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, startOfDay, endOfDay, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RoundRecord, Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// 記録内容用のIME対応リサイズ可能textareaコンポーネント
function ResizableNotesInput({
  recordKey,
  initialValue,
  onLocalChange,
  onSave,
}: {
  recordKey: string;
  initialValue: string;
  onLocalChange: (recordKey: string, value: string) => void;
  onSave: (recordKey: string, value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onLocalChange(recordKey, newValue);
  };

  const handleBlur = () => {
    if (!isComposing) {
      onSave(recordKey, value);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setValue(newValue);
    onLocalChange(recordKey, newValue);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className="w-full min-h-[4rem] p-2 border rounded resize-y text-sm"
      placeholder="記録内容を入力してください"
    />
  );
}

export default function RoundCheckList() {
  const [, navigate] = useLocation();

  // URLパラメータから日付と階数を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const floorParam = urlParams.get('floor');

  // 初期値の設定
  const initialDate = dateParam || format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedFloor, setSelectedFloor] = useState(floorParam || "all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [localNotesEdits, setLocalNotesEdits] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // ラウンド記録データの取得
  const { data: roundRecords = [], isLoading } = useQuery<RoundRecord[]>({
    queryKey: ["/api/round-records", selectedDate],
    queryFn: async () => {
      return apiRequest(`/api/round-records?recordDate=${selectedDate}`);
    },
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });

  // ラウンド記録の更新
  const updateRoundMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoundRecord> }) => {
      return apiRequest(`/api/round-records/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/round-records", selectedDate] });

      // 現在のデータのスナップショットを取得
      const queryKey = ["/api/round-records", selectedDate];
      const previousData = queryClient.getQueryData(queryKey);

      // 楽観的に更新
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return old.map((record: any) =>
          record.id === id ? { ...record, ...data, updatedAt: new Date().toISOString() } : record
        );
      });

      return { previousData };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/round-records", selectedDate], context.previousData);
      }

      toast({
        title: "エラー",
        description: "データの更新に失敗しました",
        variant: "destructive",
      });
    },
    onSuccess: (serverRecord, { id }) => {
      // 成功時はサーバーレコードで置き換え
      queryClient.setQueryData(["/api/round-records", selectedDate], (old: any) => {
        if (!old) return old;

        return old.map((record: any) =>
          record.id === id ? serverRecord : record
        );
      });
    },
  });

  // ラウンド記録の作成
  const createRoundMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      hour: number;
      recordType: 'patrol' | 'position_change' | 'notes';
      positionValue?: string;
      staffName?: string;
      notes?: string;
    }) => {
      return apiRequest("/api/round-records", "POST", {
        ...data,
        recordDate: selectedDate,
        staffName: data.staffName || (() => {
          if ((user as any)?.staffName) {
            return (user as any).staffName.charAt(0);
          }
          if ((user as any)?.firstName) {
            return (user as any).firstName.charAt(0);
          }
          return '?';
        })(),
        createdBy: (user as any)?.id || 'unknown',
      });
    },
    onMutate: async (newRecord) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/round-records", selectedDate] });

      // 現在のデータのスナップショットを取得
      const queryKey = ["/api/round-records", selectedDate];
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
          notes: newRecord.notes,
          staffName: newRecord.staffName || (() => {
            if ((user as any)?.staffName) {
              return (user as any).staffName.charAt(0);
            }
            if ((user as any)?.firstName) {
              return (user as any).firstName.charAt(0);
            }
            return '?';
          })(),
          createdBy: (user as any)?.id || 'unknown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return [...old, optimisticRecord];
      });

      return { previousData };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/round-records", selectedDate], context.previousData);
      }

      toast({
        title: "エラー",
        description: "記録の作成に失敗しました",
        variant: "destructive",
      });
    },
    onSuccess: (serverRecord, variables, context) => {
      // 成功時は一時的なレコードを実際のサーバーレコードに置き換え
      queryClient.setQueryData(["/api/round-records", selectedDate], (old: any) => {
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

  // ラウンド記録の削除
  const deleteRoundMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/round-records/${id}`, "DELETE");
    },
    onMutate: async (deletedId) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/round-records", selectedDate] });

      // 現在のデータのスナップショットを取得
      const queryKey = ["/api/round-records", selectedDate];
      const previousData = queryClient.getQueryData(queryKey);

      // 楽観的に削除
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((record: any) => record.id !== deletedId);
      });

      return { previousData };
    },
    onError: (error: any, variables, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/round-records", selectedDate], context.previousData);
      }

      toast({
        title: "エラー",
        description: "記録の削除に失敗しました",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // 削除が成功したので何もしない（楽観的更新で既に削除済み）
    },
  });

  // フィルタリングされたデータ
  const filteredResidents = useMemo(() => {
    let filtered = residents;

    // 階数フィルタ
    if (selectedFloor !== "all") {
      filtered = filtered.filter(resident => {
        return resident.floor === selectedFloor ||
               resident.floor === `${selectedFloor}階` ||
               resident.floor === `${selectedFloor}F`;
      });
    }

    // 利用者フィルタ
    if (selectedResident !== "all") {
      filtered = filtered.filter(resident => resident.id === selectedResident);
    }

    // 居室番号順でソート
    return filtered.sort((a, b) => {
      const roomA = a.roomNumber || '';
      const roomB = b.roomNumber || '';
      const numA = parseInt(roomA.replace(/[^\d]/g, '')) || 0;
      const numB = parseInt(roomB.replace(/[^\d]/g, '')) || 0;

      if (numA !== numB) {
        return numA - numB;
      }
      return roomA.localeCompare(roomB);
    });
  }, [residents, selectedFloor, selectedResident]);

  // データをグリッド形式に変換
  const gridData: { [residentId: string]: { [hour: number]: { patrol?: RoundRecord; positionChange?: RoundRecord; notes?: RoundRecord } } } = {};

  roundRecords.forEach((record: RoundRecord) => {
    if (!gridData[record.residentId]) {
      gridData[record.residentId] = {};
    }
    if (!gridData[record.residentId][record.hour]) {
      gridData[record.residentId][record.hour] = {};
    }
    if (record.recordType === 'patrol') {
      gridData[record.residentId][record.hour].patrol = record;
    } else if (record.recordType === 'position_change') {
      gridData[record.residentId][record.hour].positionChange = record;
    } else if (record.recordType === 'notes') {
      gridData[record.residentId][record.hour].notes = record;
    }
  });

  // 時間軸（0-23時）
  const hours = Array.from({ length: 24 }, (_, i) => i);

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

  // 記録内容のローカル変更
  const handleLocalNotesChange = (recordKey: string, value: string) => {
    setLocalNotesEdits(prev => {
      const newMap = new Map(prev);
      newMap.set(recordKey, value);
      return newMap;
    });
  };

  // 記録内容の保存
  const handleNotesSave = (recordKey: string, value: string) => {
    const [residentId, hourStr] = recordKey.split('_');
    const hour = parseInt(hourStr);

    // 既存の記録レコードを探す
    const notesRecord = gridData[residentId]?.[hour]?.notes;

    if (notesRecord) {
      if (value.trim()) {
        // 記録レコードが存在し、値がある場合は更新
        updateRoundMutation.mutate({ id: notesRecord.id, data: { notes: value } });
      } else {
        // 記録レコードが存在し、値が空の場合は削除
        deleteRoundMutation.mutate(notesRecord.id);
      }
    } else if (value.trim()) {
      // 記録レコードが存在せず、値がある場合は新規作成
      createRoundMutation.mutate({
        residentId,
        hour,
        recordType: 'notes',
        staffName: (() => {
          if ((user as any)?.staffName) {
            return (user as any).staffName.charAt(0);
          }
          if ((user as any)?.firstName) {
            return (user as any).firstName.charAt(0);
          }
          return '?';
        })(),
        notes: value,
      });
    }
  };

  // 記録内容の表示値を取得
  const getNotesValue = (residentId: string, hour: number) => {
    const recordKey = `${residentId}_${hour}`;
    const localValue = localNotesEdits.get(recordKey);
    if (localValue !== undefined) return localValue;

    const notesRecord = gridData[residentId]?.[hour]?.notes;
    return notesRecord?.notes || "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (selectedFloor !== "all") params.set("floor", selectedFloor);
            if (selectedDate !== format(new Date(), "yyyy-MM-dd")) params.set("date", selectedDate);
            navigate(`/check-list-menu${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">ラウンドチェック一覧</h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

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
              <SelectItem value="5">5階</SelectItem>
            </SelectContent>
          </Select>

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
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                <th className="bg-gray-100 border-r border-gray-200 px-0.5 py-0.5 text-left w-[96px]">
                  利用者
                </th>
                <th className="bg-gray-100 border-r border-gray-200 px-0.5 py-0.5 w-[40px]">
                  種別
                </th>
                {hours.map(hour => (
                  <th key={hour} className="border-r border-gray-200 px-0.5 py-0.5 min-w-[30px]">
                    <div className="text-sm font-bold text-gray-700">{hour}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map(resident => [
                // 巡回行
                <tr key={`${resident.id}-patrol`} className="border-b border-gray-200 hover:bg-gray-50 h-8">
                  <td rowSpan={3} className="bg-white border-r border-gray-200 px-0.5 py-0.5 h-24">
                    <div className="text-sm font-bold">{resident.roomNumber}</div>
                    <div className="text-sm text-gray-700 leading-tight font-bold">
                      {resident.name}
                    </div>
                  </td>
                  <td className="bg-blue-50 border-r border-gray-200 px-0.5 py-0.5">
                    <div className="text-sm text-blue-700 font-medium h-[32px] flex items-center">巡回</div>
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

                // 体位交換行
                <tr key={`${resident.id}-position`} className="border-b border-gray-200 hover:bg-gray-50 h-8">
                  <td className="bg-green-50 border-r border-gray-200 px-0.5 py-0.5">
                    <div className="text-sm text-green-700 font-medium h-[32px] flex items-center">体交</div>
                  </td>
                  {hours.map(hour => {
                    const positionRecord = gridData[resident.id]?.[hour]?.positionChange;
                    return (
                      <td
                        key={hour}
                        className="border-r border-gray-200 px-0.5 py-0.5 text-center relative h-8 hover:bg-green-50"
                      >
                        {positionRecord ? (
                          <span
                            className="text-lg font-bold text-green-700 cursor-pointer"
                            onClick={() => handlePositionClick(resident.id, hour)}
                          >
                            {positionRecord.positionValue}
                          </span>
                        ) : (
                          <Select onValueChange={(value) => handlePositionClick(resident.id, hour, value)}>
                            <SelectTrigger className="w-full h-full border-none p-0 text-lg cursor-pointer [&>svg]:hidden hover:bg-green-50">
                              <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="右">右</SelectItem>
                              <SelectItem value="左">左</SelectItem>
                              <SelectItem value="仰">仰</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    );
                  })}
                </tr>,

                // 記録行
                <tr key={`${resident.id}-notes`} className="border-b-2 border-gray-300 hover:bg-gray-50 h-8">
                  <td className="bg-yellow-50 border-r border-gray-200 px-0.5 py-0.5">
                    <div className="text-sm text-yellow-700 font-medium h-[32px] flex items-center">記録</div>
                  </td>
                  {hours.map(hour => {
                    const notesValue = getNotesValue(resident.id, hour);
                    const recordKey = `${resident.id}_${hour}`;
                    return (
                      <td
                        key={hour}
                        className="border-r border-gray-200 text-center h-8 hover:bg-yellow-50"
                      >
                        {notesValue ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="w-full h-full text-xs hover:bg-yellow-50 truncate">
                                {notesValue.slice(0, 2)}{notesValue.length > 2 ? '...' : ''}
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>
                                  記録内容 - {resident.name} ({hour}時)
                                </DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <ResizableNotesInput
                                  recordKey={recordKey}
                                  initialValue={notesValue}
                                  onLocalChange={handleLocalNotesChange}
                                  onSave={handleNotesSave}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="w-full h-full text-xs opacity-0 hover:opacity-100 hover:bg-yellow-50">
                                +
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>
                                  記録内容 - {resident.name} ({hour}時)
                                </DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <ResizableNotesInput
                                  recordKey={recordKey}
                                  initialValue=""
                                  onLocalChange={handleLocalNotesChange}
                                  onSave={handleNotesSave}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ])}
            </tbody>
          </table>
        </div>

        {/* 説明 */}
        <div className="mt-2 p-4 text-[10px] text-gray-600 space-y-0.5">
          <div>• 巡回：セルをクリックするとスタッフ名がスタンプされます</div>
          <div>• 体交：セルをホバーして体位（右/左/仰）を選択してください</div>
          <div>• 記録：セルをクリックして記録内容を入力してください</div>
          <div>• 記録をクリックすると削除されます</div>
        </div>
      </main>
    </div>
  );
}