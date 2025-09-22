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
import { apiRequest, getEnvironmentPath } from "@/lib/queryClient";
import type { MedicationRecord, InsertMedicationRecord, Resident } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

// 記録内容用のIME対応textareaコンポーネント（入浴一覧と同じ）
function NotesInput({
  initialValue,
  onSave,
  disabled = false,
  className = "",
}: {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    // カーソルアウト時に保存
    onSave(value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    setValue(e.currentTarget.value);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder="記録内容"
      className={`w-full min-w-0 border rounded px-2 py-1 text-xs resize-none text-left align-top transition-colors focus:border-blue-500 focus:outline-none ${className}`}
      rows={1}
      style={{ minHeight: "32px", maxHeight: "64px", overflow: "auto" }}
      disabled={disabled}
    />
  );
}

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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const checkFocus = () => {
      if (inputRef.current) {
        setIsFocused(document.activeElement === inputRef.current);
      }
    };
    document.addEventListener('focusin', checkFocus);
    document.addEventListener('focusout', checkFocus);
    return () => {
      document.removeEventListener('focusin', checkFocus);
      document.removeEventListener('focusout', checkFocus);
    };
  }, []);

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
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
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
    </div>
  );
}

export default function MedicationList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // フィルタ状態
  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || format(new Date(), "yyyy-MM-dd");
  });
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
  // 確認ダイアログ用の状態
  const [showConfirmerConfirm, setShowConfirmerConfirm] = useState(false);
  const [pendingConfirmerAction, setPendingConfirmerAction] = useState<{
    recordId: string;
    confirmerField: "confirmer1" | "confirmer2";
    currentConfirmerName: string;
  } | null>(null);

  const [selectedFloor, setSelectedFloor] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const floorParam = params.get('floor');
    if (floorParam) {
      if (floorParam === 'all') return '全階';
      const floorNumber = floorParam.replace('F', '');
      if (!isNaN(Number(floorNumber))) {
        return `${floorNumber}階`;
      }
    }
    return '全階';
  });
  
  // ローカル状態管理は不要（NotesInputコンポーネントが内部管理）
  // savedTempRecordsは不要になったので削除

  // 利用者データ取得
  const { data: residents } = useQuery<Resident[]>({
    queryKey: ["/api/residents"]
  });

  // 服薬記録データ取得
  const { data: medicationRecords = [], isLoading, error, refetch } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: selectedDate,
        timing: selectedTiming,
        floor: selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', '')
      });
      const response = await fetch(`/api/medication-records?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0, // キャッシュを即座に古いものとする
    gcTime: 1000 * 60, // 1分後にガベージコレクション（旧cacheTime）
    refetchOnMount: 'always', // マウント時に必ずリフェッチ
  });

  // フィルタ条件変更時の強制リフレッシュ
  useEffect(() => {
    // フィルタ条件が変更されたら必ずリフェッチ
    refetch();
  }, [selectedDate, selectedTiming, selectedFloor, refetch]);

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
      
      // 楽観的に更新（新規作成、プレースホルダー対応）
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return [newRecord];
        
        // 既存の記録があるかチェック（プレースホルダー含む）
        const existingIndex = old.findIndex((record: any) => 
          record.residentId === newRecord.residentId && record.timing === newRecord.timing
        );
        
        if (existingIndex >= 0) {
          // 既存レコード（プレースホルダー含む）を実レコードで置き換え
          const updated = [...old];
          const existingRecord = updated[existingIndex];
          
          // プレースホルダーまたは既存レコードを新しいデータで更新
          updated[existingIndex] = { 
            ...existingRecord,
            ...newRecord, 
            id: existingRecord.id && !existingRecord.id.startsWith('temp-')
              ? existingRecord.id  // 既存のID（プレースホルダー含む）を保持
              : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`  // temp-IDの場合のみ新しい一時IDを生成
          };
          return updated;
        } else {
          // 新規レコードを追加
          return [...old, { ...newRecord, id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }];
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
    onSuccess: (response, variables) => {
      // 新規作成成功時に実際のDBレコードIDでキャッシュを更新
      if (response && response.id) {
        const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;

          // temp-IDのレコードを実IDのレコードに置き換え
          return old.map((record: any) => {
            // 同じ利用者・タイミングの temp- レコードを探して実IDに更新
            if (record.residentId === variables.residentId &&
                record.timing === variables.timing &&
                record.id && record.id.startsWith('temp-')) {
              console.log(`Updating temp record ${record.id} to real ID ${response.id}`);
              return {
                ...record,
                id: response.id,
                // isUserAddedフラグを維持
                isUserAdded: record.isUserAdded || false
              };
            }
            return record;
          });
        });
      }

      // 成功時は楽観的更新のみで完了（invalidateしない）
      queryClient.invalidateQueries({ queryKey: ['/api/daily-records'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/daily-records'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/daily-records'] });
    },
    onError: (error, variables) => {
      console.error('Delete failed for record:', variables, error);
    }
  });

  // saveTemporaryRecord関数は不要になったので削除

  // 新規カード追加 - 空のカード（利用者未選択、服薬タイミングのみセット）
  const handleAddRecord = () => {
    if (!user) return;

    // 一時的なIDを生成（ユニークなIDを保証）
    const tempId = `temp-new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
        isUserAdded: true, // 新規追加カードのフラグを追加
      };
      
      // 既存のレコードに新しい空のレコードを追加
      return [...old, newEmptyRecord];
    });

    // DOM更新後に新規カードの利用者選択フィールドにフォーカスを設定し、画面を一番下にスクロール
    setTimeout(() => {
      try {
        // 新規追加されたカードを探す
        const newCard = document.querySelector(`[data-record-id="${tempId}"]`);
        if (newCard) {
          console.log('Found new card:', tempId);

          // 画面を一番下にスクロール（複数の方法を試行）
          try {
            // 方法1: スムーズスクロール
            newCard.scrollIntoView({ behavior: 'smooth', block: 'end' });

            // 方法2: 画面全体を最下部にスクロール（フォールバック）
            setTimeout(() => {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 200);
          } catch (scrollError) {
            console.error('Scroll error:', scrollError);
            // 方法3: 強制的に最下部にスクロール
            window.scrollTo(0, document.body.scrollHeight);
          }

          // 利用者選択フィールド（InputWithDropdownのinput）を探す
          const residentInput = newCard.querySelector('input[placeholder="利用者"]') as HTMLInputElement;
          if (residentInput) {
            console.log('Focusing on new card resident input:', tempId);
            residentInput.focus(); // フォーカス設定でプルダウンが自動表示される
          }
        } else {
          console.error('New card not found:', tempId);
        }
      } catch (error) {
        console.error('Failed to focus on new card:', error);
      }
    }, 150); // DOM更新完了を待つ時間を入浴一覧と同じ150msに調整
  };

  // fetchExistingDataForResident関数は削除（使用されなくなったため）

  // フィールド保存（プレースホルダーカード対応版）
  const handleSaveRecord = (residentId: string, field: string, value: string) => {
    console.log(`handleSaveRecord called:`, {
      residentId,
      field, 
      value,
      selectedTiming,
      selectedDate
    });
    
    // 現在のキャッシュデータから既存レコードを検索
    const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
    const currentCacheData = queryClient.getQueryData(queryKey) as any[];
    
    const existingRecord = currentCacheData?.find(
      (record: any) => 
        record.residentId === residentId && record.timing === selectedTiming
    );
    
    console.log('Existing record found in cache:', existingRecord);
    console.log('All current cache data:', currentCacheData?.map(r => ({
      id: r.id,
      residentId: r.residentId, 
      timing: r.timing,
      isPlaceholder: r.id?.startsWith('placeholder-'),
      isTemp: r.id?.startsWith('temp-')
    })));
    
    // レコードデータを作成
    const recordData: InsertMedicationRecord = {
      residentId,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
      type: existingRecord?.type || '服薬',
      confirmer1: existingRecord?.confirmer1 || '',
      confirmer2: existingRecord?.confirmer2 || '',
      notes: existingRecord?.notes || '',
      result: existingRecord?.result || ''
      // createdByはサーバー側で自動設定するため、フロントでは送信しない
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
    
    // 既存レコードがあるか確認（プレースホルダーや一時レコード以外の実レコード）
    if (existingRecord && existingRecord.id && 
        !existingRecord.id.startsWith('temp-') && 
        !existingRecord.id.startsWith('placeholder-')) {
      console.log('Updating existing record with ID:', existingRecord.id);
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      console.log('Creating new record (from placeholder or temp)');
      createMutation.mutate(recordData);
    }
  };

  // フィールド更新（プレースホルダーカード対応版）
  const handleFieldUpdate = async (recordId: string, field: keyof InsertMedicationRecord, value: any) => {
    console.log(`Updating field ${field} for record ${recordId} with value:`, value);
    
    // 利用者変更時の特別処理
    if (field === 'residentId') {
      // 利用者情報を追加して楽観的更新
      const resident = residents?.find(r => r.id === value);
      const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        // データを更新
        const updatedData = old.map((record: any) => {
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

        // ソートを無効化して現在の順番を維持（入浴一覧画面と同じ動作）
        return updatedData;
      });
      
      // 新規カードでは既存データの自動設定は行わない
      // （既存データの自動設定は削除）
      // この処理により、同じ利用者の既存レコードがあっても新規カードには影響しない
      return;
    }
    
    // プレースホルダーカードの場合は楽観的更新
    if (recordId && recordId.startsWith('placeholder-')) {
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
      
      // プレースホルダーからresidentIdを抽出（UUID対応）
      const residentId = recordId.replace(/^placeholder-([^-]+(?:-[^-]+)*)-[^-]+$/, '$1');
      
      // プレースホルダーカードでは自動保存を無効化（明示的な保存操作のみ）
      // handleSaveRecordの呼び出しを削除して、重複レコード作成を防ぐ
      console.log(`Placeholder field ${field} updated for resident ${residentId} - no auto-save`);
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
      
      // 自動保存は無効化 - 明示的な保存操作のみ実行
      // ここで自動保存するとフィールドごとに新規レコードが作成される
      console.log('Field update completed - no auto-save to prevent duplicates');
    } else if (recordId && !recordId.startsWith('temp-') && !recordId.startsWith('placeholder-')) {
      // 実レコードの場合は通常更新
      const updateData = { [field]: value };
      console.log('Updating existing record:', updateData);
      updateMutation.mutate({
        id: recordId,
        data: updateData
      });
    }
  };

  // 確認者設定（直接フィールド更新のみ）
  // 確認者印の実際の処理を実行する関数
  const executeConfirmerStamp = (recordId: string, confirmerField: "confirmer1" | "confirmer2") => {
    if (!user) return;

    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';
    const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
    const currentCacheData = queryClient.getQueryData(queryKey) as any[];

    // IDでレコードを検索
    const existingRecord = currentCacheData?.find(
      (record: any) => record.id === recordId
    );

    if (!existingRecord) {
      console.error("Record not found for stamping:", recordId);
      toast({ title: "エラー", description: "対象の記録が見つかりません。", variant: "destructive" });
      return;
    }

    // 現在の確認者名を取得
    const currentConfirmer = existingRecord?.[confirmerField] || '';

    // 確認者が空白の場合はログイン者名を設定、入っている場合はクリア
    const newConfirmer = currentConfirmer ? '' : staffName;

    console.log(`Setting ${confirmerField} to: ${newConfirmer} for record ${recordId}`);

    // 既存レコード（一時的・プレースホルダー以外）があるか確認
    if (existingRecord.id &&
        !existingRecord.id.startsWith('temp-') &&
        !existingRecord.id.startsWith('placeholder-')) {
      // 既存レコードを更新
      const updateData = { [confirmerField]: newConfirmer };
      console.log('Updating existing record confirmer:', existingRecord.id, updateData);
      updateMutation.mutate({ id: existingRecord.id, data: updateData });
    } else {
      // 新規レコード（一時的またはプレースホルダー）の場合
      // プレースホルダーカードの場合は常に利用者が設定されている
      if (existingRecord.residentId) {
        // 利用者が選択されていれば、レコードを作成
        let actualResidentId = existingRecord.residentId;
        
        // プレースホルダーカードの場合はIDから利用者IDを抽出（UUID対応）
        if (recordId.startsWith('placeholder-')) {
          actualResidentId = recordId.replace(/^placeholder-([^-]+(?:-[^-]+)*)-[^-]+$/, '$1');
          console.log('Extracted residentId from placeholder:', actualResidentId);
        }
        
        const recordData: InsertMedicationRecord = {
          residentId: actualResidentId,
          recordDate: new Date(selectedDate),
          timing: selectedTiming,
          type: existingRecord?.type || '服薬',
          confirmer1: confirmerField === 'confirmer1' ? newConfirmer : (existingRecord?.confirmer1 || ''),
          confirmer2: confirmerField === 'confirmer2' ? newConfirmer : (existingRecord?.confirmer2 || ''),
          notes: existingRecord?.notes || '',
          result: existingRecord?.result || ''
        };
        console.log('Creating new record for confirmer stamp:', recordData);
        createMutation.mutate(recordData);
      } else {
        // 利用者が未選択の場合は、キャッシュ内のレコードを直接更新
        console.log('Updating temp record in cache:', recordId);
        queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
          if (!old) return [];
          return old.map(record => 
            record.id === recordId 
              ? { ...record, [confirmerField]: newConfirmer }
              : record
          );
        });
      }
    }
  };

  // 確認者アイコン機能（確認ダイアログ付き）
  const handleConfirmerStamp = (recordId: string, confirmerField: "confirmer1" | "confirmer2") => {
    if (!user) return;

    const staffName = (user as any)?.staffName || (user as any)?.firstName || 'スタッフ';
    const queryKey = ["/api/medication-records", selectedDate, selectedTiming, selectedFloor];
    const currentCacheData = queryClient.getQueryData(queryKey) as any[];

    // IDでレコードを検索
    const existingRecord = currentCacheData?.find(
      (record: any) => record.id === recordId
    );

    if (!existingRecord) {
      console.error("Record not found for stamping:", recordId);
      toast({ title: "エラー", description: "対象の記録が見つかりません。", variant: "destructive" });
      return;
    }

    // 現在の確認者名を取得
    const currentConfirmer = existingRecord?.[confirmerField] || '';

    // 確認者が入力されていて、かつ自分以外の場合は確認
    if (currentConfirmer && currentConfirmer !== staffName) {
      setPendingConfirmerAction({
        recordId,
        confirmerField,
        currentConfirmerName: currentConfirmer
      });
      setShowConfirmerConfirm(true);
      return;
    }

    // それ以外は即座に実行
    executeConfirmerStamp(recordId, confirmerField);
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            data-testid="button-back"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', selectedDate);
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              setLocation(`/?${params.toString()}`);
            }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">服薬一覧</h1>
        </div>
      </div>

      {/* フィルタ項目 */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
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
            <select
              value={selectedTiming}
              onChange={(e) => setSelectedTiming(e.target.value)}
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="全階">全階</option>
              <option value="1階">1階</option>
              <option value="2階">2階</option>
              <option value="3階">3階</option>
              <option value="4階">4階</option>
              <option value="5階">5階</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-1 pb-1">
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
          (() => {
            console.log('Rendering displayMedicationRecords:', JSON.stringify(displayMedicationRecords, null, 2));

            // 既に表示されている利用者のIDリストを作成
            const existingResidentIds = displayMedicationRecords
              .filter((record: MedicationRecordWithResident) => record.residentId && record.residentId !== "")
              .map((record: MedicationRecordWithResident) => record.residentId);

            return displayMedicationRecords
            .sort((a: MedicationRecordWithResident, b: MedicationRecordWithResident) => {
              // ユーザー追加カード（isUserAddedフラグ）は常に最後に表示
              const isUserAddedA = (a as any).isUserAdded === true;
              const isUserAddedB = (b as any).isUserAdded === true;

              if (isUserAddedA && !isUserAddedB) return 1;  // Aがユーザー追加 → 後ろ
              if (!isUserAddedA && isUserAddedB) return -1; // Bがユーザー追加 → 前
              if (isUserAddedA && isUserAddedB) {
                // 両方ユーザー追加の場合は追加順（IDベース）
                return a.id.localeCompare(b.id);
              }

              // 利用者未選択の一時カード（temp-）のみ最後に表示
              const isATempWithoutResident = a.id.startsWith('temp-') && !a.residentId;
              const isBTempWithoutResident = b.id.startsWith('temp-') && !b.residentId;

              if (isATempWithoutResident && !isBTempWithoutResident) return 1;  // aが利用者未選択の一時カードならbの後
              if (!isATempWithoutResident && isBTempWithoutResident) return -1; // bが利用者未選択の一時カードならaの前
              if (isATempWithoutResident && isBTempWithoutResident) return 0;   // 両方が利用者未選択の一時カードなら順序維持

              // 実レコード同士のみ部屋番号でソート
              const roomA = parseInt(a.roomNumber || "0");
              const roomB = parseInt(b.roomNumber || "0");
              return roomA - roomB;
            })
            .map((record: MedicationRecordWithResident, index: number) => (
            <div key={record.id} className={`${index > 0 ? 'border-t' : ''} bg-white`} data-record-id={record.id}> 
              <div className="p-2 space-y-2">
                {/* 1段目：居室番号・利用者名・服薬タイミング・確認者1・確認者2 */}
                <div className="flex items-center gap-1">
                  {/* 居室番号 */}
                  <div className="w-10 text-center flex-shrink-0">
                    <div className="text-lg font-bold text-blue-600">{record.roomNumber}</div>
                  </div>
                  
                  {/* 利用者名 */}
                  <div className="w-24 flex-shrink-0">
                    {record.id && record.id.startsWith('temp-') ? (
                      // 新規追加カードの場合は利用者選択可能
                      <InputWithDropdown
                        value={(() => {
                          const name = residents?.find(r => r.id === record.residentId)?.name || record.residentName || "";
                          return name.replace(/\s+/g, '\n');
                        })()}
                        options={residents
                          ?.filter((resident) => {
                            // 新規カード（temp-）の場合のみ、既存の利用者を除外
                            if (record.id && record.id.startsWith('temp-') && existingResidentIds) {
                              return !existingResidentIds.includes(resident.id);
                            }
                            // 既存レコードの場合は全て表示
                            return true;
                          })
                          .sort((a, b) => {
                            const roomA = parseInt(a.roomNumber || "0");
                            const roomB = parseInt(b.roomNumber || "0");
                            return roomA - roomB;
                          })
                          .map((resident) => ({
                            value: resident.id,
                            label: resident.name
                          })) || []}
                        onSave={(selectedId) => {
                          if (!record.id) return;
                          console.log('Resident changed for record', record.id, 'to:', selectedId);
                          handleFieldUpdate(record.id, "residentId", selectedId);
                        }}
                        placeholder="利用者"
                        className="h-6 w-full px-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-line leading-tight text-center"
                      />
                    ) : (
                      // 既存レコードの場合は読み取り専用表示（食事一覧と同じスタイル）
                      <div className="font-medium text-sm truncate text-slate-800">
                        {residents?.find(r => r.id === record.residentId)?.name || record.residentName || ""}
                      </div>
                    )}
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
                      className={`h-6 w-full px-1 text-xs border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        true ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'
                      }`}
                      isTimingField={true}
                      disabled={true} // 服薬タイミングは常に変更不可
                    />
                  </div>
                  
                  {/* スペーサー（確認者を右寄せ） */}
                  <div className="flex-1"></div>
                  
                  {/* 確認者1 */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="text"
                      value={record.confirmer1 || ''}
                      onClick={() => record.id && handleConfirmerStamp(record.id, "confirmer1")}
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
                      onClick={() => record.id && handleConfirmerStamp(record.id, "confirmer2")}
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
                <div className="flex items-center gap-0.5">
                  {/* 記録 */}
                  <div className="flex-grow min-w-0" style={{ flex: '999 1 0%' }}>
                    <NotesInput
                      initialValue={record.notes || ""}
                      onSave={(value) => {
                        handleFieldUpdate(record.id, "notes", value);
                        // メモが入力された場合は保存を実行（プレースホルダーカード以外）
                        if (value && value.trim() && record.residentId && !record.id.startsWith('placeholder-')) {
                          console.log('Saving notes on blur:', value);
                          handleSaveRecord(record.residentId, "notes", value);
                        } else if (record.id.startsWith('placeholder-') && value && value.trim()) {
                          // プレースホルダーカードの場合は、正しいresidentIdを抽出して保存
                          const actualResidentId = record.id.replace(/^placeholder-([^-]+(?:-[^-]+)*)-[^-]+$/, '$1');
                          console.log('Saving placeholder notes on blur:', value, 'for resident:', actualResidentId);
                          handleSaveRecord(actualResidentId, "notes", value);
                        }
                      }}
                      disabled={false}
                    />
                  </div>
                  
                  {/* 種類 */}
                  <div className="w-10 flex-shrink-0">
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
                  <div className="w-10 flex-shrink-0">
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
                        // 結果が選択された場合は保存を実行（プレースホルダーカード以外）
                        if (actualValue && record.residentId && !record.id.startsWith('placeholder-')) {
                          console.log('Saving result on change:', actualValue);
                          handleSaveRecord(record.residentId, "result", actualValue);
                        } else if (record.id.startsWith('placeholder-') && actualValue) {
                          // プレースホルダーカードの場合は、正しいresidentIdを抽出して保存
                          const actualResidentId = record.id.replace(/^placeholder-([^-]+(?:-[^-]+)*)-[^-]+$/, '$1');
                          console.log('Saving placeholder result on change:', actualValue, 'for resident:', actualResidentId);
                          handleSaveRecord(actualResidentId, "result", actualValue);
                        }
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
          ));
          })()
        ) : null}
      </div>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div></div>
          <Button variant="outline" className="flex items-center gap-2" onClick={() => {
            const params = new URLSearchParams();
            params.set('date', selectedDate);
            params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
            const mealsPath = getEnvironmentPath("/meals-medication");
            setLocation(`${mealsPath}?${params.toString()}`);
          }}>
            食事一覧へ
          </Button>
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

        {/* 確認者変更確認ダイアログ */}
        <AlertDialog open={showConfirmerConfirm} onOpenChange={setShowConfirmerConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確認者の変更確認</AlertDialogTitle>
              <AlertDialogDescription>
                現在「{pendingConfirmerAction?.currentConfirmerName}」が{
                  pendingConfirmerAction?.confirmerField === "confirmer1" ? "確認者1" : "確認者2"
                }として登録されています。
                <br />
                この確認者をクリアしてもよろしいですか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowConfirmerConfirm(false);
                setPendingConfirmerAction(null);
              }}>
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (pendingConfirmerAction) {
                  executeConfirmerStamp(
                    pendingConfirmerAction.recordId,
                    pendingConfirmerAction.confirmerField
                  );
                }
                setShowConfirmerConfirm(false);
                setPendingConfirmerAction(null);
              }}>
                変更する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 下部余白 */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}
