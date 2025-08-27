import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus,
  Trash2,
  ArrowLeft as ArrowLeftIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Building as BuildingIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { apiRequest } from "@/lib/queryClient";
import type { MedicationRecord, InsertMedicationRecord, Resident } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

const timingOptions = [
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


const typeOptions = [
  { value: "服薬", label: "服薬" },
  { value: "点眼", label: "点眼" }
];

const resultOptions = [
  { value: "空欄", label: "空欄" },
  { value: "○", label: "○" },
  { value: "−", label: "−" },
  { value: "拒否", label: "拒否" },
  { value: "外出", label: "外出" }
];

interface MedicationRecordWithResident extends MedicationRecord {
  residentName?: string;
  roomNumber?: string;
  floor?: string;
}

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
  isTimingField = false,
  disabled = false,
  disableFocusMove = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  isTimingField?: boolean;
  disabled?: boolean;
  disableFocusMove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);

    // フォーカス移動が無効化されている場合はスキップ
    if (disableFocusMove) return;
    
    // 特定の遅延後にフォーカス移動を実行
    setTimeout(() => {
      if (inputRef.current) {
        const currentElement = inputRef.current;
        
        // 服薬タイミングフィールドの場合は記録欄（notes）に移動
        if (isTimingField) {
          // 同じカード内の記録欄を探す（2段目の最初の項目）
          const cardElement = currentElement.closest('.bg-white');
          if (cardElement) {
            // 2段目のdivを探す（"2段目：記録・種類・結果・削除アイコン"のコメントがある部分）
            const secondRowDiv = cardElement.querySelector('.space-y-2 > div:nth-child(2)');
            if (secondRowDiv) {
              // flex-1のクラスを持つdiv内のinputを探す（記録欄）
              const notesInput = secondRowDiv.querySelector('.flex-1 input') as HTMLInputElement;
              if (notesInput) {
                notesInput.focus();
                return;
              }
            }
          }
        }
        
        // 通常のフォーカス移動
        const allElements = Array.from(
          document.querySelectorAll("input, textarea, select, button"),
        ).filter(
          (el) =>
            !el.hasAttribute("disabled") &&
            (el as HTMLElement).offsetParent !== null,
        ) as HTMLElement[];

        const currentIndex = allElements.indexOf(currentElement);
        if (currentIndex >= 0 && currentIndex < allElements.length - 1) {
          allElements[currentIndex + 1].focus();
        }
      }
    }, 200);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly
          onFocus={() => !disabled && !disableFocusMove && setOpen(true)}
          onClick={(e) => {
            if (disableFocusMove && !disabled) {
              // フィルタ条件項目の場合はクリックでプルダウンを開く
              setOpen(!open);
            } else {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className={`${className} ${disabled ? 'cursor-not-allowed bg-slate-100' : ''}`}
          disabled={disabled}
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

export default function MedicationList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // フィルタ状態
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTiming, setSelectedTiming] = useState(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 7) return "起床後";
    if (currentHour < 9) return "朝前";
    if (currentHour < 11) return "朝後";
    if (currentHour < 13) return "昼前";
    if (currentHour < 16) return "昼後";
    if (currentHour < 19) return "夕前";
    if (currentHour < 21) return "夕後";
    return "眠前";
  });
  const [selectedFloor, setSelectedFloor] = useState("all");
  
  // ローカル状態管理（編集中のメモ）
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  // savedTempRecordsは不要になったので削除

  // 利用者データ取得
  const { data: residents } = useQuery<Resident[]>({
    queryKey: ["/api/residents"]
  });


  // 服薬記録データ取得
  const { data: medicationRecords = [], isLoading, error } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: selectedDate,
        timing: selectedTiming,
        floor: selectedFloor
      });
      const response = await fetch(`/api/medication-records?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Medication records fetched:', data);
      return data;
    }
  });

  // 表示用の服薬記録データを作成（既存レコードのみ表示）
  const displayMedicationRecords = (() => {
    // 既存レコードのみを表示（自動的に全利用者分のカードは作成しない）
    return medicationRecords;
  })();

  // 新規記録作成ミューテーション（食事一覧と同じシンプルなアプローチ）
  const createMutation = useMutation({
    mutationFn: (data: InsertMedicationRecord) => {
      console.log('Creating medication record:', data);
      return apiRequest("/api/medication-records", "POST", data);
    },
    onMutate: async (newRecord) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/medication-records'] });
      
      // 現在のデータのスナップショットを取得
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      const previousData = queryClient.getQueryData(queryKey);
      
      // 楽観的に更新（新規作成）
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return [newRecord];
        
        // 既存の記録があるかチェック
        const existingIndex = old.findIndex((record: any) => 
          record.residentId === newRecord.residentId && record.timing === newRecord.timing
        );
        
        if (existingIndex >= 0) {
          // 既存レコードを更新
          const updated = [...old];
          updated[existingIndex] = { ...updated[existingIndex], ...newRecord, id: updated[existingIndex].id };
          return updated;
        } else {
          // 新規レコードを追加
          return [...old, { ...newRecord, id: `temp-${Date.now()}` }];
        }
      });
      
      return { previousData };
    },
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/medication-records", selectedDate, selectedTiming, selectedFloor], context.previousData);
      }
      
      toast({
        title: "エラー",
        description: "記録の作成に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ['/api/medication-records'] });
    },
    onSuccess: () => {
      // 成功時は楽観的更新のみで完了（invalidateしない）
      // queryClient.invalidateQueries({ queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] });
    },
  });

  // 記録更新ミューテーション（食事一覧と同じシンプルなアプローチ）
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertMedicationRecord> }) => {
      console.log('Updating medication record:', id, data);
      return apiRequest(`/api/medication-records/${id}`, "PUT", data);
    },
    onMutate: async ({ id, data }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/medication-records'] });
      
      // 現在のデータのスナップショットを取得
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      const previousData = queryClient.getQueryData(queryKey);
      
      // 楽観的に更新
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        return old.map((record: any) => {
          if (record.id === id) {
            return { ...record, ...data };
          }
          return record;
        });
      });
      
      return { previousData };
    },
    onError: (_, __, context) => {
      // エラー時に前の状態に戻す
      if (context?.previousData) {
        queryClient.setQueryData(["/api/medication-records", selectedDate, selectedTiming, selectedFloor], context.previousData);
      }
      
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました。変更を元に戻しました。",
        variant: "destructive",
      });
      
      // エラー時のみサーバーから最新データを取得
      queryClient.invalidateQueries({ queryKey: ['/api/medication-records'] });
    },
    onSuccess: () => {
      // 成功時は楽観的更新のみで完了（invalidateしない）
    },
  });

  // 記録削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      console.log('Sending DELETE request for record:', id);
      return apiRequest(`/api/medication-records/${id}`, "DELETE");
    },
    onSuccess: (_, variables) => {
      console.log('Delete successful for record:', variables);
      // 削除時は現在の表示条件で再取得（削除されたレコードを画面から除去するため）
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
      queryClient.refetchQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
    },
    onError: (error, variables) => {
      console.error('Delete failed for record:', variables, error);
    }
  });

  // saveTemporaryRecord関数は不要になったので削除

  // 新規カード追加 - 空のカード（利用者未選択、服薬タイミングのみセット）
  const handleAddRecord = () => {
    if (!user) return;

    // 一時的なIDを生成（タイムスタンプベース）
    const tempId = `temp-new-${Date.now()}`;
    
    // 楽観的更新で空のカードを即座に追加
    queryClient.setQueryData(["/api/medication-records", selectedDate, selectedTiming, selectedFloor], (old: any) => {
      if (!old) return old;
      
      // 新しい空のレコードを作成（利用者未選択、服薬タイミングのみセット）
      const newEmptyRecord = {
        id: tempId,
        residentId: "", // 空の状態に設定
        residentName: "",
        roomNumber: "",
        floor: "",
        recordDate: selectedDate,
        timing: selectedTiming, // ヘッダーで選択されている服薬タイミングをセット
        type: "服薬",
        confirmer1: "",
        confirmer2: "",
        notes: "",
        result: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "",
        isTemporary: true,
      };
      
      // 既存のレコードに新しい空のレコードを追加
      return [...old, newEmptyRecord];
    });
  };

  // 特定の利用者の既存データを取得する関数
  const fetchExistingDataForResident = async (residentId: string) => {
    try {
      const params = new URLSearchParams({
        recordDate: selectedDate,
        timing: selectedTiming,
        floor: 'all', // 利用者変更時は階数フィルタを無視
        residentId: residentId
      });
      const response = await fetch(`/api/medication-records?${params}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        return data.length > 0 ? data[0] : null; // 最初のレコードを返す
      }
    } catch (error) {
      console.error('Failed to fetch existing data for resident:', error);
    }
    return null;
  };

  // フィールド保存（食事一覧と同じアプローチ）
  const handleSaveRecord = (residentId: string, field: string, value: string) => {
    console.log(`handleSaveRecord called:`, {
      residentId,
      field, 
      value,
      selectedTiming,
      selectedDate
    });
    
    const existingRecord = medicationRecords.find(
      (record: MedicationRecordWithResident) => 
        record.residentId === residentId && record.timing === selectedTiming
    );
    
    console.log('Existing record found:', existingRecord);
    
    // レコードデータを作成
    const recordData: InsertMedicationRecord = {
      residentId,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
      type: existingRecord?.type || 'medication',
      confirmer1: existingRecord?.confirmer1 || '',
      confirmer2: existingRecord?.confirmer2 || '',
      notes: existingRecord?.notes || '',
      result: existingRecord?.result || '',
      createdBy: (user as any)?.claims?.sub || 'unknown'
    };
    
    // フィールドを更新
    if (field === 'timing') {
      recordData.timing = value;
    } else if (field === 'type') {
      recordData.type = value;
    } else if (field === 'confirmer1') {
      recordData.confirmer1 = value;
    } else if (field === 'confirmer2') {
      recordData.confirmer2 = value;
    } else if (field === 'notes') {
      recordData.notes = value;
    } else if (field === 'result') {
      recordData.result = value;
    }
    
    console.log('Record data to save:', recordData);
    
    // 既存レコードがあるか確認
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      console.log('Updating existing record with ID:', existingRecord.id);
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      console.log('Creating new record');
      createMutation.mutate(recordData);
    }
  };

  // フィールド更新（一時レコード用）
  const handleFieldUpdate = async (recordId: string, field: keyof InsertMedicationRecord, value: any) => {
    console.log(`Updating field ${field} for record ${recordId} with value:`, value);
    
    // 利用者変更時の特別処理
    if (field === 'residentId') {
      // 利用者情報を追加して楽観的更新
      const resident = residents?.find(r => r.id === value);
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((record: any) => {
          if (record.id === recordId) {
            return { 
              ...record, 
              residentId: value,
              residentName: resident?.name || '',
              roomNumber: resident?.roomNumber || '',
              floor: resident?.floor || ''
            };
          }
          return record;
        });
      });
      
      // 利用者選択時には既存の記録があるかチェックして自動でデータを設定
      if (value && resident) {
        const existingData = await fetchExistingDataForResident(value);
        if (existingData) {
          queryClient.setQueryData(queryKey, (old: any) => {
            if (!old) return old;
            return old.map((record: any) => {
              if (record.id === recordId) {
                return { ...record, ...existingData, id: recordId };
              }
              return record;
            });
          });
        }
      }
      return;
    }
    
    // 一時的なIDの場合は楽観的更新のみ
    if (recordId && recordId.startsWith('temp-')) {
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((record: any) => {
          if (record.id === recordId) {
            return { ...record, [field]: value };
          }
          return record;
        });
      });
      
      // 利用者IDが設定されている場合は自動保存
      const currentData = queryClient.getQueryData(queryKey) as any[];
      const updatedRecord = currentData?.find((r: any) => r.id === recordId);
      if (updatedRecord?.residentId && updatedRecord.residentId !== '') {
        console.log('Auto-saving record with residentId:', updatedRecord.residentId);
        handleSaveRecord(updatedRecord.residentId, field, value);
      }
    } else if (recordId && !recordId.startsWith('temp-')) {
      // 実レコードの場合は通常更新
      const updateData = { [field]: value };
      console.log('Updating existing record:', updateData);
      updateMutation.mutate({
        id: recordId,
        data: updateData
      });
    }
  };

  // 確認者設定（食事一覧の記入者と完全に同じ仕様）
  const handleConfirmerStamp = (residentId: string, confirmerField: "confirmer1" | "confirmer2") => {
    if (!user) return;
    
    const staffName = (user as any)?.firstName || 'スタッフ';
    
    // 現在のレコードを取得（食事一覧と同じパターン - 生のAPIデータから検索）
    const existingRecord = medicationRecords.find(
      (record: MedicationRecordWithResident) => 
        record.residentId === residentId && record.timing === selectedTiming
    );
    
    console.log('Existing record found:', existingRecord);
    console.log('All medication records:', medicationRecords.map(r => ({ id: r.id, residentId: r.residentId, timing: r.timing })));
    
    // 現在の確認者名を取得
    const currentConfirmer = existingRecord?.[confirmerField] || '';
    
    // 確認者が空白の場合はログイン者名を設定、入っている場合はクリア
    const newConfirmer = currentConfirmer ? '' : staffName;
    
    // レコードデータを準備（食事一覧と同じフォーマット）
    const recordData: InsertMedicationRecord = {
      residentId,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
      type: existingRecord?.type || "服薬",
      confirmer1: confirmerField === 'confirmer1' ? newConfirmer : (existingRecord?.confirmer1 || ''),
      confirmer2: confirmerField === 'confirmer2' ? newConfirmer : (existingRecord?.confirmer2 || ''),
      notes: existingRecord?.notes || '',
      result: existingRecord?.result || '',
      createdBy: (user as any)?.claims?.sub || 'unknown',
    };
    
    console.log('Record data to save:', recordData);
    console.log('Will use existing record:', !!existingRecord);
    
    // 既存レコードがあるが、一時的なIDの場合は新規作成として扱う
    if (existingRecord && existingRecord.id && !existingRecord.id.startsWith('temp-')) {
      console.log('Updating existing record with ID:', existingRecord.id);
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      console.log('Creating new record');
      createMutation.mutate(recordData);
    }
  };

  // 利用者が選択されているかどうかを判定する関数
  const isResidentSelected = (record: MedicationRecordWithResident) => {
    return record.residentId && record.residentId !== "";
  };

  // 削除
  const handleDelete = (recordId: string) => {
    console.log('Deleting record:', recordId);
    
    // 一時的なIDの場合は楽観的削除
    if (recordId && recordId.startsWith('temp-')) {
      console.log('Removing temp record from display');
      // 楽観的に削除
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((record: any) => record.id !== recordId);
      });
      return;
    }
    
    // 実際のレコードの場合は削除実行（AlertDialogで確認済み）
    console.log('Proceeding with delete');
    deleteMutation.mutate(recordId);
  };


  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/meals-medication">
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              data-testid="button-back"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-slate-800">服薬一覧</h1>
        </div>
      </div>

      <div className="space-y-4 p-4">

      {/* 日付とフロア選択 */}
      <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
        <div className="flex gap-2 sm:gap-4 items-center justify-center">
          {/* 日付選択 */}
          <div className="flex items-center space-x-1">
            <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              data-testid="input-date"
            />
          </div>

          {/* 服薬タイミング選択 */}
          <div className="flex items-center space-x-1">
            <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={selectedTiming}
              options={timingOptions}
              onSave={(value) => setSelectedTiming(value)}
              placeholder="タイミング"
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disableFocusMove={true}
            />
          </div>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <InputWithDropdown
              value={(() => {
                const floorOptions = [
                  { value: "all", label: "全階" },
                  { value: "1F", label: "1階" },
                  { value: "2F", label: "2階" },
                  { value: "3F", label: "3階" },
                  { value: "4F", label: "4階" },
                  { value: "5F", label: "5階" }
                ];
                const option = floorOptions.find(opt => opt.value === selectedFloor);
                return option ? option.label : "全階";
              })()}
              options={[
                { value: "all", label: "全階" },
                { value: "1F", label: "1階" },
                { value: "2F", label: "2階" },
                { value: "3F", label: "3階" },
                { value: "4F", label: "4階" },
                { value: "5F", label: "5階" }
              ]}
              onSave={(value) => setSelectedFloor(value)}
              placeholder="フロア選択"
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disableFocusMove={true}
            />
          </div>
        </div>
      </div>

      {/* 利用者一覧（服薬記録用） */}
      <div className="space-y-0 border rounded-lg overflow-hidden">
        {error && (
          <div className="bg-red-50 border-red-200 p-4 text-center rounded-lg mb-4">
            <p className="text-red-600 text-lg mb-2">エラーが発生しました</p>
            <p className="text-sm text-red-500">{error.message}</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-600">服薬記録を読み込み中...</p>
          </div>
        ) : !error && displayMedicationRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            該当する利用者がいません
          </div>
        ) : !error ? (
          displayMedicationRecords
            .sort((a: MedicationRecordWithResident, b: MedicationRecordWithResident) => {
              const roomA = parseInt(a.roomNumber || "0");
              const roomB = parseInt(b.roomNumber || "0");
              return roomA - roomB;
            })
            .map((record: MedicationRecordWithResident, index: number) => (
            <div key={record.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
              <div className="p-2 space-y-2">
                {/* 1段目：居室番号・利用者名・服薬タイミング・確認者1・確認者2 */}
                <div className="flex items-center gap-1">
                  {/* 居室番号 */}
                  <div className="w-12 flex-shrink-0">
                    <div className="h-6 px-1 border border-gray-300 rounded-md bg-gray-50 text-center font-bold text-xs flex items-center justify-center">
                      {record.roomNumber}
                    </div>
                  </div>
                  
                  {/* 利用者名 */}
                  <div className="w-16 flex-shrink-0">
                    <InputWithDropdown
                      value={(() => {
                        const name = residents?.find(r => r.id === record.residentId)?.name || record.residentName || "";
                        return name.replace(/\s+/g, '\n');
                      })()}
                      options={residents?.map((resident) => ({
                        value: resident.id,
                        label: resident.name
                      })) || []}
                      onSave={(selectedId) => {
                        if (!record.id) return;
                        console.log('Resident changed for record', record.id, 'to:', selectedId);
                        handleFieldUpdate(record.id, "residentId", selectedId);
                        // 一時的なレコードの自動保存は無効化
                      }}
                      placeholder="利用者"
                      className="h-6 w-full px-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-line leading-tight text-center"
                    />
                  </div>
                  
                  {/* 服薬タイミング */}
                  <div className="w-16 flex-shrink-0">
                    <InputWithDropdown
                      value={record.timing}
                      options={timingOptions}
                      onSave={(value) => {
                        if (!record.id) return;
                        console.log('Timing changed for record', record.id, 'to:', value);
                        handleFieldUpdate(record.id, "timing", value);
                        // 一時的なレコードの自動保存は無効化
                      }}
                      placeholder="タイミング"
                      className="h-6 w-full px-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      isTimingField={true}
                      disabled={false} // 服薬タイミングは常に変更可能
                    />
                  </div>
                  
                  {/* 確認者1 */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="text"
                      value={record.confirmer1 || ''}
                      onClick={() => record.id && handleConfirmerStamp(record.residentId, "confirmer1")}
                      onChange={(e) => {
                        // 手動入力も可能にする
                        record.id && handleFieldUpdate(record.id, 'confirmer1', e.target.value);
                      }}
                      placeholder="確認者1"
                      className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={false}
                    />
                  </div>
                  
                  {/* 確認者2 */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="text"
                      value={record.confirmer2 || ''}
                      onClick={() => record.id && handleConfirmerStamp(record.residentId, "confirmer2")}
                      onChange={(e) => {
                        // 手動入力も可能にする
                        record.id && handleFieldUpdate(record.id, 'confirmer2', e.target.value);
                      }}
                      placeholder="確認者2"
                      className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={false}
                    />
                  </div>
                </div>

                {/* 2段目：記録・種類・結果・削除アイコン */}
                <div className="flex items-center gap-1">
                  {/* 記録 */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={localNotes[record.id] !== undefined ? localNotes[record.id] : (record.notes || "")}
                      onChange={(e) => {
                        setLocalNotes(prev => ({
                          ...prev,
                          [record.id]: e.target.value
                        }));
                      }}
                      onBlur={(e) => {
                        handleFieldUpdate(record.id, "notes", e.target.value);
                        setLocalNotes(prev => {
                          const newState = { ...prev };
                          delete newState[record.id];
                          return newState;
                        });
                        // 一時的なレコードの自動保存は無効化
                      }}
                      className="h-6 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1"
                      placeholder="記録を入力..."
                      data-testid={`input-notes-${record.id}`}
                      disabled={false}
                    />
                  </div>
                  
                  {/* 種類 */}
                  <div className="w-12 flex-shrink-0">
                    <InputWithDropdown
                      value={record.type}
                      options={typeOptions}
                      onSave={(value) => {
                        if (!record.id) return;
                        console.log('Type changed for record', record.id, 'to:', value);
                        handleFieldUpdate(record.id, "type", value);
                        // 一時的なレコードの自動保存は無効化
                      }}
                      placeholder="種類"
                      className="h-6 w-full px-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      disabled={false}
                    />
                  </div>
                  
                  {/* 結果 */}
                  <div className="w-12 flex-shrink-0">
                    <InputWithDropdown
                      value={record.result || ""}
                      options={resultOptions.map(option => ({
                        ...option,
                        label: option.value === "空欄" ? "" : option.label
                      }))}
                      onSave={(value) => {
                        if (!record.id) return;
                        console.log('Result changed for record', record.id, 'to:', value);
                        const actualValue = value === "空欄" ? "" : value;
                        handleFieldUpdate(record.id, "result", actualValue);
                        // 一時的なレコードの自動保存は無効化
                      }}
                      placeholder="結果"
                      className="h-6 w-full px-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      disabled={false}
                    />
                  </div>
                  
                  {/* 削除アイコン */}
                  <div className="w-6 flex-shrink-0 flex justify-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="rounded text-xs flex items-center justify-center bg-red-500 hover:bg-red-600 text-white"
                          style={{
                            height: "24px",
                            width: "24px",
                            minHeight: "24px",
                            minWidth: "24px",
                            maxHeight: "24px",
                            maxWidth: "24px",
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${record.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>記録削除の確認</AlertDialogTitle>
                          <AlertDialogDescription>
                            この記録を削除してもよろしいですか？この操作は取り消せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(record.id)}
                          >
                            削除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div></div>
          <Link href="/meals-medication">
            <Button variant="outline" className="flex items-center gap-2">
              食事一覧へ
            </Button>
          </Link>
          <Button
            onClick={handleAddRecord}
            className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
            disabled={createMutation.isPending}
            data-testid="button-add-record"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* 下部余白 */}
      <div className="h-20"></div>
      </div>
    </div>
  );
}