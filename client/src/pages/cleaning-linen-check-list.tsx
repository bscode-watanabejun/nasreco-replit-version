import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfDay, endOfDay, addDays, differenceInDays, addMonths, endOfMonth, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Resident } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// 時のオプション（6時〜23時）
const hourOptions = [
  { value: "", label: "" },
  ...Array.from({ length: 18 }, (_, i) => ({
    value: (6 + i).toString().padStart(2, "0"),
    label: (6 + i).toString().padStart(2, "0"),
  })),
];

// 分のオプション（0, 15, 30, 45分）
const minuteOptions = [
  { value: "", label: "" },
  { value: "00", label: "00" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

// recordTimeから最も近いプルダウン選択肢を取得する関数
const getClosestTimeFromRecordTime = (recordTime: string | Date | null) => {
  if (!recordTime) return { hour: "", minute: "" };

  const date = new Date(recordTime);
  const actualHour = date.getHours();
  const actualMinute = date.getMinutes();

  // 時のオプション（6-23時）から最も近いものを選択
  const validHour = actualHour >= 6 && actualHour <= 23 ? actualHour : "";

  // 分のオプション（0, 15, 30, 45）から最も近いものを選択
  const minuteOptions = [0, 15, 30, 45];
  const closestMinute = minuteOptions.reduce((prev, curr) => {
    return Math.abs(curr - actualMinute) < Math.abs(prev - actualMinute) ? curr : prev;
  });

  return {
    hour: validHour ? validHour.toString().padStart(2, "0") : "",
    minute: closestMinute.toString().padStart(2, "0")
  };
};

// 記録内容用のIME対応リサイズ可能textareaコンポーネント
function ResizableNotesInput({
  recordId,
  initialValue,
  onLocalChange,
  onSave,
}: {
  recordId: string;
  initialValue: string;
  onLocalChange: (recordId: string, value: string) => void;
  onSave: (recordId: string, value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    // リアルタイムでローカル状態を更新
    onLocalChange(recordId, newValue);
  };

  const handleBlur = () => {
    // カーソルアウト時にAPI更新
    onSave(recordId, value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setValue(newValue);
    onLocalChange(recordId, newValue);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder="記録内容を入力..."
      className="min-h-[32px] text-xs w-full px-2 py-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      rows={1}
    />
  );
}

// InputWithDropdownコンポーネント
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  dropdownWidth,
  type = "text",
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  dropdownWidth?: string;
  type?: "text" | "number";
}) {
  const [localValue, setLocalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [isSelecting, setIsSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // 数値入力の場合のバリデーション
    if (type === "number" && newValue !== "") {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue)) return;
    }
    setLocalValue(newValue);
  };

  const handleFocus = () => {
    if (options.length > 0) {
      setIsOpen(true);
      // プルダウンの位置を計算
      setTimeout(() => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();

          // スクロール可能な親要素を探す
          let scrollParent = inputRef.current.parentElement;
          while (scrollParent) {
            const overflow = window.getComputedStyle(scrollParent).overflow;
            const overflowY = window.getComputedStyle(scrollParent).overflowY;
            if (overflow === 'auto' || overflow === 'scroll' ||
                overflowY === 'auto' || overflowY === 'scroll') {
              break;
            }
            scrollParent = scrollParent.parentElement;
          }

          // スクロールコンテナまたはビューポートの境界を取得
          const containerRect = scrollParent ?
            scrollParent.getBoundingClientRect() :
            { top: 0, bottom: window.innerHeight };

          const spaceBelow = containerRect.bottom - rect.bottom;
          const spaceAbove = rect.top - containerRect.top;
          const dropdownHeight = 200; // プルダウンの高さ

          // 下に十分なスペースがなく、上に十分なスペースがある場合は上に表示
          if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
            setDropdownPosition('top');
          } else {
            setDropdownPosition('bottom');
          }
        }
      }, 10);
    }
  };

  const handleBlur = () => {
    // 選択中でない場合のみ（手動入力時のみ）保存
    if (localValue !== value && !isSelecting) {
      onSave(localValue);
    }
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleSelect = (selectedValue: string) => {
    setIsSelecting(true);  // 選択中フラグを立てる
    setLocalValue(selectedValue);
    onSave(selectedValue);
    setIsOpen(false);
    // inputのフォーカスを明示的に外す
    if (inputRef.current) {
      inputRef.current.blur();
    }
    // 少し遅延してフラグをリセット（blurイベントが完了するまで待つ）
    setTimeout(() => setIsSelecting(false), 300);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`h-7 text-xs px-1 ${className || ""}`}
      />
      {isOpen && options.length > 0 && (
        <div
          className={`absolute z-[9999] w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto`}
          style={{
            [dropdownPosition === 'top' ? 'bottom' : 'top']: '100%',
            [dropdownPosition === 'top' ? 'marginBottom' : 'marginTop']: '4px',
            ...(dropdownWidth && { width: dropdownWidth })
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option.value)}
              className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CleaningLinenCheckList() {
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
  const [localNotes, setLocalNotes] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ログインユーザー名の取得（記入者プルダウン用）
  const staffNameOptions = useMemo(() => {
    const userName = (user as any)?.staffName || "";
    if (userName) {
      return [{ value: userName, label: userName }];
    }
    return [];
  }, [user]);

  // 月次モードでdateFromが変更された場合、1ヶ月間の期間を自動設定
  useEffect(() => {
    if (viewMode === 'monthly' && dateFrom) {
      const from = parseISO(dateFrom);

      let newTo: Date;
      const nextMonthSameDay = addMonths(from, 1);
      const nextMonthLastDay = endOfMonth(nextMonthSameDay);

      // 来月の同じ日が存在しない場合（例：1月31日→2月）
      if (nextMonthSameDay.getDate() !== from.getDate()) {
        newTo = subDays(nextMonthSameDay, nextMonthSameDay.getDate());
      } else {
        newTo = subDays(nextMonthSameDay, 1);
      }

      setDateTo(format(newTo, "yyyy-MM-dd"));
    }
  }, [dateFrom, viewMode]);

  // 日付範囲の妥当性チェック
  useEffect(() => {
    if (dateFrom && dateTo) {
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      const daysDiff = differenceInDays(to, from);

      if (viewMode === 'monthly') {
        // 月次モードでは最大1ヶ月
        if (daysDiff > 31) {
          let newTo: Date;
          const nextMonthSameDay = addMonths(from, 1);
          const nextMonthLastDay = endOfMonth(nextMonthSameDay);

          if (nextMonthSameDay.getDate() !== from.getDate()) {
            newTo = subDays(nextMonthSameDay, nextMonthSameDay.getDate());
          } else {
            newTo = subDays(nextMonthSameDay, 1);
          }
          setDateTo(format(newTo, "yyyy-MM-dd"));
          toast({
            title: "期間制限",
            description: "月次表示では期間は最大1ヶ月までです。終了日を調整しました。",
          });
        }
      } else {
        // 日次モードでは最大2ヶ月
        if (daysDiff > 60) {
          const newTo = addMonths(from, 2);
          setDateTo(format(newTo, "yyyy-MM-dd"));
          toast({
            title: "期間制限",
            description: "表示期間は最大2ヶ月までです。終了日を調整しました。",
          });
        }
      }
    }
  }, [dateFrom, dateTo, viewMode, toast]);

  // 入居者データの取得
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
  });

  // 清掃リネンデータの取得
  const { data: cleaningLinenData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/cleaning-linen", dateFrom, dateTo, selectedFloor],
    queryFn: async () => {
      const from = startOfDay(parseISO(dateFrom)).toISOString();
      const to = endOfDay(parseISO(dateTo)).toISOString();
      return apiRequest(`/api/cleaning-linen?startDate=${from}&endDate=${to}&floor=${selectedFloor}`);
    },
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });

  // フィルタリングされたデータ（階数フィルタはサーバー側で処理済み）
  const filteredData = useMemo(() => {
    let filtered = cleaningLinenData;

    // 利用者フィルタのみクライアント側で処理
    if (selectedResident !== "all") {
      filtered = filtered.filter(record => record.residentId === selectedResident);
    }

    return filtered;
  }, [cleaningLinenData, selectedResident]);

  // 実際のデータレコードのみを表示用に変換
  const groupedData = useMemo(() => {
    return filteredData.map(record => {
      const resident = residents.find(r => r.id === record.residentId);
      return {
        date: format(new Date(record.recordDate), "yyyy-MM-dd"),
        residentId: record.residentId,
        resident,
        record
      };
    }).sort((a, b) => {
      // 第一ソート: 日付でソート（昇順：若い順）
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;

      // 第二ソート: 居室番号でソート（昇順：若い順）
      const roomA = a.resident?.roomNumber || "";
      const roomB = b.resident?.roomNumber || "";

      // 居室番号を数値として比較（文字列の場合は文字列比較）
      const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
      const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

      if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
        return roomNumA - roomNumB;
      } else {
        return roomA.localeCompare(roomB, undefined, { numeric: true });
      }
    });
  }, [filteredData, residents]);

  // 清掃リネン記録の更新・作成（既存画面と同じupsert APIを使用）
  const upsertCleaningLinenMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      recordDate: string;
      dayOfWeek: number;
      cleaningValue?: string;
      linenValue?: string;
      recordNote?: string;
      recordTime?: string;
      staffName?: string;
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
      // 楽観的更新のためにクエリをキャンセル
      const queryKey = ["/api/cleaning-linen", dateFrom, dateTo, selectedFloor];
      await queryClient.cancelQueries({ queryKey });

      // 現在のデータを取得
      const previousData = queryClient.getQueryData<any[]>(queryKey);

      // 楽観的更新
      if (previousData) {
        queryClient.setQueryData<any[]>(queryKey, (oldData) => {
          if (!oldData) return oldData;

          // 既存のレコードを探す
          const existingRecordIndex = oldData.findIndex(
            record => record.residentId === newRecord.residentId &&
                     format(new Date(record.recordDate), 'yyyy-MM-dd') === newRecord.recordDate
          );

          if (existingRecordIndex >= 0) {
            // 既存レコードを更新
            const updatedData = [...oldData];
            updatedData[existingRecordIndex] = {
              ...updatedData[existingRecordIndex],
              ...newRecord,
              recordDate: new Date(newRecord.recordDate).toISOString()
            };
            return updatedData;
          } else {
            // 新しいレコードを追加
            const resident = residents.find(r => r.id === newRecord.residentId);
            if (!resident) return oldData;

            const newRecordEntry = {
              id: `temp-${Date.now()}`,
              residentId: newRecord.residentId,
              recordDate: new Date(newRecord.recordDate).toISOString(),
              dayOfWeek: newRecord.dayOfWeek,
              cleaningValue: newRecord.cleaningValue || "",
              linenValue: newRecord.linenValue || "",
              recordNote: newRecord.recordNote || "",
              recordTime: newRecord.recordTime ? new Date(newRecord.recordTime).toISOString() : undefined,
              staffName: newRecord.staffName || "",
              residentName: resident.name,
              residentFloor: resident.floor,
              residentRoom: resident.roomNumber,
            };

            return [...oldData, newRecordEntry];
          }
        });
      }

      return { previousData, queryKey };
    },
    onError: (err, newRecord, context) => {
      // エラー時にロールバック
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast({
        title: "エラー",
        description: "データの保存に失敗しました",
        variant: "destructive",
      });
      // エラー時はサーバーから最新データを取得
      queryClient.invalidateQueries({
        queryKey: ["/api/cleaning-linen", dateFrom, dateTo, selectedFloor]
      });
    },
    onSuccess: () => {
      // 楽観的更新の結果をそのまま使用し、即座にUI反映
      // サーバー同期はエラー時のみ実行
    },
  });

  // 清掃リネン記録の削除
  const deleteCleaningLinenMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/cleaning-linen/${id}`, "DELETE");
    },
    onMutate: async (id) => {
      // 楽観的更新のためにクエリをキャンセル
      const queryKey = ["/api/cleaning-linen", dateFrom, dateTo, selectedFloor];
      await queryClient.cancelQueries({ queryKey });

      // 現在のデータを取得
      const previousData = queryClient.getQueryData<any[]>(queryKey);

      // 楽観的更新（削除）
      if (previousData) {
        queryClient.setQueryData<any[]>(queryKey, (old) => {
          if (!old) return old;
          return old.filter(record => record.id !== id);
        });
      }

      return { previousData };
    },
    onError: (error, id, context) => {
      // エラー時は元のデータに戻す
      const queryKey = ["/api/cleaning-linen", dateFrom, dateTo, selectedFloor];
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "エラー",
        description: "データの削除に失敗しました",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "削除完了",
        description: "記録を削除しました",
      });
    },
    onSettled: () => {
      // 最終的にサーバーと同期
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning-linen"] });
    },
  });

  // データの保存
  const handleSave = (
    residentId: string,
    date: string,
    field: string,
    value: any
  ) => {
    const existingRecord = groupedData.find(g =>
      g.residentId === residentId && g.date === date
    )?.record;

    // 変更されたフィールドの値
    const fieldValue = value === "empty" ? "" : value;

    // dayOfWeekの計算（月曜日=0、日曜日=6）
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;

    // recordTimeの更新処理
    let updatedRecordTime = existingRecord?.recordTime ? new Date(existingRecord.recordTime) : new Date();
    if (field === 'hour' || field === 'minute') {
      // 現在のrecordTimeから時・分を取得
      const currentTime = existingRecord?.recordTime ? new Date(existingRecord.recordTime) : new Date(`${date}T12:00:00`);
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();

      // 変更された時または分を適用
      let newHour = currentHour;
      let newMinute = currentMinute;

      if (field === 'hour') {
        newHour = fieldValue === "" ? 12 : parseInt(fieldValue); // 空白の場合は12時をデフォルト
      } else if (field === 'minute') {
        newMinute = fieldValue === "" ? 0 : parseInt(fieldValue); // 空白の場合は0分をデフォルト
      }

      // 新しいrecordTimeを生成
      updatedRecordTime = new Date(`${date}T${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}:00`);
    }

    // upsert用のデータ作成
    const upsertData = {
      residentId,
      recordDate: date, // upsertAPIは日付文字列を期待
      dayOfWeek,
      cleaningValue: field === 'cleaningValue' ? fieldValue : (existingRecord?.cleaningValue ?? ""),
      linenValue: field === 'linenValue' ? fieldValue : (existingRecord?.linenValue ?? ""),
      recordNote: field === 'recordNote' ? fieldValue : (existingRecord?.recordNote ?? ""),
      recordTime: updatedRecordTime.toISOString(),
      staffName: field === 'staffName' ? fieldValue : (existingRecord?.staffName ?? ""),
    };

    // upsert APIを使用（既存画面と同じ）
    upsertCleaningLinenMutation.mutate(upsertData);
  };

  // 清掃・リネンのクリック時の値切り替え処理
  const handleCleaningLinenClick = (
    residentId: string,
    date: string,
    type: 'cleaningValue' | 'linenValue'
  ) => {
    const existingRecord = groupedData.find(g =>
      g.residentId === residentId && g.date === date
    )?.record;

    const currentValue = existingRecord?.[type] || "";
    let newValue = "";

    // 空白→○→2→3→空白の循環
    if (currentValue === "") {
      newValue = "○";
    } else if (currentValue === "○") {
      newValue = "2";
    } else if (currentValue === "2") {
      newValue = "3";
    } else {
      newValue = "";
    }

    handleSave(residentId, date, type, newValue);
  };

  // 記録内容のローカル変更ハンドラ
  const handleNotesLocalChange = (recordId: string, value: string) => {
    setLocalNotes(prev => new Map(prev.set(recordId, value)));
  };

  // 記録内容の保存ハンドラ
  const handleNotesSave = (recordId: string, value: string) => {
    const [residentId, date] = recordId.split('_');
    if (residentId && date) {
      handleSave(residentId, date, "recordNote", value);
    }
  };

  // 削除ハンドラ
  const handleDelete = (recordId: string) => {
    if (recordId && !recordId.startsWith('temp-')) {
      deleteCleaningLinenMutation.mutate(recordId);
    }
  };

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
        <h1 className="text-lg font-semibold">
          {viewMode === 'monthly' ? '清掃リネンチェック一覧 月次' : '清掃リネンチェック一覧'}
        </h1>
      </header>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-sm"
            />
            <span>〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全階</SelectItem>
              <SelectItem value="1階">1階</SelectItem>
              <SelectItem value="2階">2階</SelectItem>
              <SelectItem value="3階">3階</SelectItem>
              <SelectItem value="4階">4階</SelectItem>
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

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setViewMode(viewMode === 'daily' ? 'monthly' : 'daily')}
            >
              {viewMode === 'monthly' ? '清掃リネンチェック一覧' : '月次'}
            </Button>
            {viewMode === 'monthly' && (
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
                印刷
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto relative">
            {viewMode === 'daily' ? (
              // 日次表示
              <table className="relative border-collapse w-full">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50">
                    <th className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2" style={{ width: '84px' }}>記録日</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '85px' }}>記録時間</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '50px' }}>居室</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '84px' }}>利用者名</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '84px' }}>記入者</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>清掃</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '70px' }}>リネン</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2">記録内容</th>
                    <th className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2" style={{ width: '40px' }}>削除</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((group, index) => {
                    const record = group.record;

                  return (
                    <tr key={`${group.date}_${group.residentId}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {/* 記録日列（スティッキー、編集不可） */}
                      <td className="text-xs border border-gray-300 sticky left-0 z-10 px-1 py-1 whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)", width: '84px' }}>
                        {format(parseISO(group.date), "MM月dd日", { locale: ja })}
                      </td>

                      {/* 記録時間列（編集可能） */}
                      <td className="p-1 border border-gray-300" style={{ width: '85px' }}>
                        <div className="flex items-center gap-1 justify-center">
                          {(() => {
                            const timeValues = getClosestTimeFromRecordTime(record?.recordTime);
                            return (
                              <>
                                <InputWithDropdown
                                  value={timeValues.hour}
                                  options={hourOptions}
                                  onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "hour", value)}
                                  placeholder=""
                                  className="w-12 text-xs"
                                />
                                <span className="text-xs">:</span>
                                <InputWithDropdown
                                  value={timeValues.minute}
                                  options={minuteOptions}
                                  onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "minute", value)}
                                  placeholder=""
                                  className="w-12 text-xs"
                                />
                              </>
                            );
                          })()}
                        </div>
                      </td>

                      <td className="text-xs border border-gray-300 text-center px-1 py-1 whitespace-nowrap" style={{ width: '50px' }}>
                        {group.resident?.roomNumber || "-"}
                      </td>
                      <td className="text-xs border border-gray-300 px-1 py-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '84px' }}>
                        {group.resident?.name || "-"}
                      </td>

                      {/* 記入者 */}
                      <td className="p-1 border border-gray-300" style={{ width: '84px' }}>
                        <InputWithDropdown
                          value={record?.staffName || ""}
                          options={staffNameOptions}
                          onSave={(value) => group.residentId && handleSave(group.residentId, group.date, "staffName", value)}
                          placeholder=""
                          className="w-full"
                        />
                      </td>

                      {/* 清掃 */}
                      <td
                        className="text-xs border border-gray-300 text-center px-1 py-1 cursor-pointer hover:bg-gray-100"
                        style={{ width: '70px' }}
                        onClick={() => group.residentId && handleCleaningLinenClick(group.residentId, group.date, 'cleaningValue')}
                      >
                        {record?.cleaningValue || ""}
                      </td>

                      {/* リネン */}
                      <td
                        className="text-xs border border-gray-300 text-center px-1 py-1 cursor-pointer hover:bg-gray-100"
                        style={{ width: '70px' }}
                        onClick={() => group.residentId && handleCleaningLinenClick(group.residentId, group.date, 'linenValue')}
                      >
                        {record?.linenValue || ""}
                      </td>

                      {/* 記録内容 */}
                      <td className="p-1 border border-gray-300">
                        <ResizableNotesInput
                          recordId={`${group.residentId}_${group.date}`}
                          initialValue={localNotes.get(`${group.residentId}_${group.date}`) ?? record?.recordNote ?? ""}
                          onLocalChange={handleNotesLocalChange}
                          onSave={handleNotesSave}
                        />
                      </td>

                      {/* 削除アイコン */}
                      <td className="p-1 border border-gray-300 text-center" style={{ width: '40px' }}>
                        {record && record.id && !record.id.startsWith('temp-') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この操作は取り消せません。記録が完全に削除されます。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(record.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              // 月次表示
              (() => {
                // 期間内の日付を取得
                const dates: string[] = [];
                const start = parseISO(dateFrom);
                const end = parseISO(dateTo);
                let currentDate = start;

                while (currentDate <= end) {
                  dates.push(format(currentDate, "yyyy-MM-dd"));
                  currentDate = addDays(currentDate, 1);
                }

                // 利用者ごとにグループ化
                const monthlyData = residents.filter(resident => {
                  if (selectedFloor !== "all" &&
                      resident.floor !== selectedFloor &&
                      resident.floor !== `${selectedFloor}階`) return false;
                  if (selectedResident !== "all" && resident.id !== selectedResident) return false;
                  return true;
                }).sort((a, b) => {
                  // 居室番号でソート
                  const roomA = a.roomNumber || "";
                  const roomB = b.roomNumber || "";
                  const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
                  const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

                  if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
                    return roomNumA - roomNumB;
                  }
                  return roomA.localeCompare(roomB, undefined, { numeric: true });
                });

                return (
                  <table className="relative border-collapse w-full">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-50">
                        <th rowSpan={2} className="text-xs font-medium border border-gray-300 sticky left-0 bg-gray-50 z-30 px-1 py-2 w-12">居室</th>
                        <th rowSpan={2} className="text-xs font-medium border border-gray-300 sticky left-12 bg-gray-50 z-30 px-1 py-2 w-20">利用者名</th>
                        <th rowSpan={2} className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-16">項目</th>
                        {dates.map(date => {
                          const day = parseISO(date);
                          const dayStr = format(day, "dd", { locale: ja });
                          const weekDay = format(day, "E", { locale: ja });
                          return (
                            <th key={date} className="text-xs font-medium border border-gray-300 bg-gray-50 px-1 py-2 w-8 text-center">
                              <div>{dayStr}</div>
                              <div>{weekDay}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((resident, index) => (
                        <React.Fragment key={resident.id}>
                          {/* 清掃行 */}
                          <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td rowSpan={2} className="text-xs border border-gray-300 text-center px-1 py-1 sticky left-0 z-10 w-12" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)" }}>
                              {resident.roomNumber || "-"}
                            </td>
                            <td rowSpan={2} className="text-xs border border-gray-300 px-1 py-1 sticky left-12 z-10 w-20 overflow-hidden text-ellipsis whitespace-nowrap" style={{ backgroundColor: index % 2 === 0 ? "white" : "rgb(249 250 251)" }}>
                              {resident.name}
                            </td>
                            <td className="text-xs border border-gray-300 px-1 py-1 w-16">清掃</td>
                            {dates.map(date => {
                              const record = filteredData.find(r =>
                                r.residentId === resident.id &&
                                format(new Date(r.recordDate), "yyyy-MM-dd") === date
                              );
                              return (
                                <td key={`${resident.id}-${date}-cleaning`} className="text-xs border border-gray-300 text-center px-1 py-1 w-8">
                                  {record?.cleaningValue || ""}
                                </td>
                              );
                            })}
                          </tr>
                          {/* リネン行 */}
                          <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="text-xs border border-gray-300 px-1 py-1 w-16">リネン</td>
                            {dates.map(date => {
                              const record = filteredData.find(r =>
                                r.residentId === resident.id &&
                                format(new Date(r.recordDate), "yyyy-MM-dd") === date
                              );
                              return (
                                <td key={`${resident.id}-${date}-linen`} className="text-xs border border-gray-300 text-center px-1 py-1 w-8">
                                  {record?.linenValue || ""}
                                </td>
                              );
                            })}
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        )}
      </main>
    </div>
  );
}