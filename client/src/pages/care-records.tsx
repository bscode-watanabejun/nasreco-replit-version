import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Edit, ClipboardList, Activity, Utensils, Pill, Baby, FileText, ArrowLeft, Save, Check, X, MoreHorizontal, Info, Search, Paperclip, Trash2, Building } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const careRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
  notes: z.string().optional(),
});

type CareRecordForm = z.infer<typeof careRecordSchema>;

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  id,
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  disableFocusMove = false,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
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

  // アクティブ要素を監視してフォーカス状態を更新
  useEffect(() => {
    const checkFocus = () => {
      if (inputRef.current) {
        setIsFocused(document.activeElement === inputRef.current);
      }
    };

    // 初回チェック
    checkFocus();

    // フォーカス変更を監視
    const handleFocusChange = () => {
      checkFocus();
    };

    // document全体でfocus/blurイベントを監視
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    setInputValue(selectedValue);
    onSave(selectedValue);
    setOpen(false);

    // disableFocusMoveがtrueの場合は自動フォーカス移動を無効化
    if (!disableFocusMove) {
      // 特定の遅延後にフォーカス移動を実行
      setTimeout(() => {
        if (inputRef.current) {
          const allInputs = Array.from(
            document.querySelectorAll("input, textarea, select, button"),
          ).filter(
            (el) =>
              el !== inputRef.current &&
              !el.hasAttribute("disabled") &&
              (el as HTMLElement).offsetParent !== null,
          ) as HTMLElement[];

          const currentElement = inputRef.current;
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
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (disabled) return;
    onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter") {
      onSave(inputValue);
      setOpen(false);
    } else if (e.key === "Escape") {
      setInputValue(value);
      setOpen(false);
    }
  };

  // クリックによるフォーカスかどうかを追跡
  const [isClickFocus, setIsClickFocus] = useState(false);

  const handleFocus = () => {
    if (disabled || isClickFocus) return;
  };

  return (
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={(e) => {
              e.preventDefault();
              setIsClickFocus(true);
              setOpen(!open);
              // フラグをリセット
              setTimeout(() => {
                setIsClickFocus(false);
              }, 200);
            }}
            placeholder={placeholder}
            className={className}
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

// インライン編集用のコンポーネント
function InlineEditableField({ 
  value, 
  onSave, 
  type = "text", 
  placeholder = "", 
  multiline = false,
  options = [] 
}: {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "datetime-local" | "select" | "time";
  placeholder?: string;
  multiline?: boolean;
  options?: { value: string; label: string; }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (currentValue !== value) {
      setIsSaving(true);
      await onSave(currentValue);
      setIsSaving(false);
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <div 
        className="cursor-pointer hover:bg-slate-50 p-2 rounded border-2 border-transparent hover:border-slate-200 transition-colors relative group"
        onClick={() => setIsEditing(true)}
      >
        {type === "datetime-local" && value ? (
          format(new Date(value), "PPP HH:mm", { locale: ja })
        ) : type === "select" && options.length > 0 ? (
          options.find(opt => opt.value === value)?.label || value
        ) : (
          value || <span className="text-slate-400">{placeholder}</span>
        )}
        <Edit className="w-3 h-3 absolute top-1 right-1 opacity-0 group-hover:opacity-50 transition-opacity" />
        {isSaving && <Check className="w-3 h-3 absolute top-1 right-1 text-green-600" />}
      </div>
    );
  }

  if (type === "select") {
    return (
      <Select value={currentValue} onValueChange={setCurrentValue} onOpenChange={(open) => !open && handleBlur()}>
        <SelectTrigger className="h-auto min-h-[2.5rem]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (multiline) {
    return (
      <Textarea
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-full min-h-[5rem] resize-none"
        autoFocus
      />
    );
  }

  return (
    <Input
      type={type === "time" ? "time" : type}
      value={currentValue}
      onChange={(e) => setCurrentValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="h-auto min-h-[2.5rem]"
      autoFocus
    />
  );
}

export default function CareRecords() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [newRecordBlocks, setNewRecordBlocks] = useState<any[]>([]);
  // URLパラメータから日付とフロアの初期値を取得
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
  const [selectedFloor, setSelectedFloor] = useState<string>(urlParams.get('floor') || "all");

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: careRecords = [], isLoading } = useQuery({
    queryKey: ["/api/care-records"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Debug: ユーザー情報をコンソールに出力
  useEffect(() => {
    console.log("Current User:", currentUser);
  }, [currentUser]);

  // Debug: selectedResident情報をコンソールに出力
  useEffect(() => {
    if (selectedResident) {
      console.log("Selected Resident:", selectedResident);
      console.log("Selected Resident Gender:", selectedResident.gender);
      console.log("Selected Resident Gender Type:", typeof selectedResident.gender);
    }
  }, [selectedResident]);

  // 性別判定のヘルパー関数
  const getGenderDisplay = (gender: string | null | undefined): string => {
    if (!gender) return "未設定";
    
    const genderStr = gender.toString().toLowerCase().trim();
    
    // 英語の性別表記
    if (genderStr === 'male' || genderStr === 'man' || genderStr === 'm') return '男性';
    if (genderStr === 'female' || genderStr === 'woman' || genderStr === 'f') return '女性';
    
    // 日本語の性別表記
    if (genderStr === '男性' || genderStr === '男' || genderStr === 'おとこ') return '男性';
    if (genderStr === '女性' || genderStr === '女' || genderStr === 'おんな') return '女性';
    
    // その他の可能性のある表記
    if (genderStr.includes('male') || genderStr.includes('男')) return '男性';
    if (genderStr.includes('female') || genderStr.includes('女')) return '女性';
    
    // どれにも該当しない場合は元の値を返すか「未設定」
    return gender.toString() || "未設定";
  };

  const form = useForm<CareRecordForm>({
    resolver: zodResolver(careRecordSchema),
    defaultValues: {
      residentId: selectedResident?.id || "",
      recordDate: new Date(format(selectedDate, 'yyyy-MM-dd') + "T" + new Date().toTimeString().slice(0, 8)).toISOString().slice(0, 16),
      category: "",
      description: "",
      notes: "",
    },
  });

  // selectedDateが変更された時にフォームのデフォルト値を更新
  useEffect(() => {
    const currentTime = new Date().toTimeString().slice(0, 8);
    const newRecordDate = new Date(format(selectedDate, 'yyyy-MM-dd') + "T" + currentTime).toISOString().slice(0, 16);
    
    form.reset({
      residentId: selectedResident?.id || "",
      recordDate: newRecordDate,
      category: "",
      description: "",
      notes: "",
    });
  }, [selectedDate, selectedResident?.id, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CareRecordForm) => {
      // recordDateがISO形式になるよう確保
      const recordDate = data.recordDate.includes('T') 
        ? data.recordDate 
        : data.recordDate + 'T' + new Date().toTimeString().slice(0, 8);
      
      const requestData = {
        ...data,
        recordDate: recordDate, // ISO形式の文字列で送信
        notes: data.notes && data.notes.trim() ? data.notes : undefined, // 空の場合はundefinedにする
      };
      const response = await apiRequest("/api/care-records", "POST", requestData);
      return response;
    },
    onMutate: async (newData) => {
      // フォームをリセットしてモーダルを閉じる
      form.reset({
        residentId: selectedResident?.id || "",
        recordDate: new Date(format(selectedDate, 'yyyy-MM-dd') + "T" + new Date().toTimeString().slice(0, 8)).toISOString().slice(0, 16),
        category: "",
        description: "",
        notes: "",
      });
      setOpen(false);
    },
    onError: (error: any, newData, context) => {
      console.error("❌ Care record creation failed:", error);
      // モーダルを再度開く
      setOpen(true);
      console.error("介護記録の作成エラー:", error);
    },
    onSettled: () => {
      // 最終的にサーバーから最新データを取得（バックグラウンドで）
      queryClient.invalidateQueries({ queryKey: ["/api/care-records"] });
      if (selectedResident) {
        queryClient.invalidateQueries({ queryKey: ["/api/care-records", selectedResident.id] });
      }
    },
    onSuccess: () => {
      // トースト表示を削除
    },
  });

  // 記録更新用ミューテーション（一覧画面用）
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/care-records/${id}`, "PATCH", updateData);
    },
    onMutate: async (newData: { id: string; field: string; value: any }) => {
      // recordDateの更新時は楽観的更新によるキャッシュ操作を行わない
      if (newData.field === 'recordDate') {
        return;
      }
      // クエリのキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/care-records'] });

      // 以前のデータをスナップショット
      const previousCareRecords = queryClient.getQueryData(['/api/care-records']);

      // キャッシュを楽観的に更新
      queryClient.setQueryData(['/api/care-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === newData.id ? { ...record, [newData.field]: newData.value } : record
        );
      });

      // コンテキストオブジェクトで以前のデータを返す
      return { previousCareRecords };
    },
    onError: (err, newData, context) => {
      // description更新時のロールバック
      if (context?.previousCareRecords) {
        queryClient.setQueryData(['/api/care-records'], context.previousCareRecords);
      }
      // recordDate更新エラー時にローカルstateを元に戻す
      if (newData.field === 'recordDate') {
        setLocalRecordDates(prev => {
          const newState = { ...prev };
          delete newState[newData.id];
          return newState;
        });
      }
      console.error("記録の更新エラー");
    },
    onSettled: (data, error, variables) => {
      // description更新時のみローカルstateをクリア
      if (variables.field === 'description') {
        setLocalRecordDescriptions({});
      }
    },
  });

  // 詳細画面専用の記録更新ミューテーション
  const updateDetailMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      return apiRequest(`/api/care-records/${id}`, "PATCH", updateData);
    },
    onMutate: async (newData: { id: string; field: string; value: any }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/care-records'] });
      const previousCareRecords = queryClient.getQueryData(['/api/care-records']);
      queryClient.setQueryData(['/api/care-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === newData.id ? { ...record, [newData.field]: newData.value } : record
        );
      });
      return { previousCareRecords };
    },
    onError: (err, newData, context) => {
      if (context?.previousCareRecords) {
        queryClient.setQueryData(['/api/care-records'], context.previousCareRecords);
      }
      console.error("記録の更新エラー");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-records'] });
    },
  });

  // 一括登録用のmutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (data: { residentIds: string[], recordData: Omit<CareRecordForm, 'residentId'> }) => {
      const results = await Promise.all(
        data.residentIds.map(residentId =>
          apiRequest("/api/care-records", "POST", {
            ...data.recordData,
            residentId
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-records"] });
      // 一括登録モードをリセット
      setBulkMode(false);
      setSelectedResidentIds(new Set());
      setBulkInputModalOpen(false);
      setBulkInputData({
        recordDate: selectedDate,
        hour: format(new Date(), 'HH'),
        minute: Math.floor(parseInt(format(new Date(), 'mm')) / 15) * 15,
        description: ''
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "一括登録に失敗しました。",
        variant: "destructive",
      });
    }
  });

  // 記録削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/care-records/${id}`, "DELETE");
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/care-records'] });
      const previousCareRecords = queryClient.getQueryData(['/api/care-records']);
      
      // 楽観的更新: 削除対象の記録を除外
      queryClient.setQueryData(['/api/care-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.filter(record => record.id !== id);
      });
      
      return { previousCareRecords };
    },
    onError: (err, id, context) => {
      // エラー時は元のデータに戻す
      if (context?.previousCareRecords) {
        queryClient.setQueryData(['/api/care-records'], context.previousCareRecords);
      }
      console.error("記録の削除エラー");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-records'] });
    },
  });

  const onSubmit = (data: CareRecordForm) => {
    createMutation.mutate(data);
  };

  // 新規追加ブロック作成
  const addNewRecordBlock = () => {
    if (!selectedResident && view === 'detail') {
      console.error("利用者が選択されていません");
      return;
    }
    
    // 現在時刻を取得
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 分のオプション（0, 15, 30, 45）から最も近いものを選択
    const minuteOptions = [0, 15, 30, 45];
    const closestMinute = minuteOptions.reduce((prev, curr) => {
      return Math.abs(curr - currentMinute) < Math.abs(prev - currentMinute) ? curr : prev;
    });
    
    // 選択された日付に現在時刻を設定してrecordDateを作成
    const recordDate = new Date(selectedDate);
    recordDate.setHours(currentHour);
    recordDate.setMinutes(closestMinute);
    recordDate.setSeconds(0);
    recordDate.setMilliseconds(0);
    
    const newBlock = {
      id: `${selectedResident.id}-${Date.now()}`,
      residentId: selectedResident.id,
      category: "",
      recordDate: recordDate.toISOString(),
      description: "",
      notes: "",
    };
    setNewRecordBlocks(prev => [...prev, newBlock]);
  };

  // 新規記録ブロック削除
  const removeNewRecordBlock = (blockId: string) => {
    setNewRecordBlocks(prev => prev.filter(block => block.id !== blockId));
    // ローカル状態もクリア
    setLocalNewBlockDescriptions(prev => {
      const newDescriptions = { ...prev };
      delete newDescriptions[blockId];
      return newDescriptions;
    });
  };

  // 一括登録モード関連の関数
  const handleStartBulkMode = () => {
    setBulkMode(true);
    setSelectedResidentIds(new Set());
  };

  const handleCancelBulkMode = () => {
    setBulkMode(false);
    setSelectedResidentIds(new Set());
  };

  const toggleResidentSelection = (residentId: string) => {
    setSelectedResidentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(residentId)) {
        newSet.delete(residentId);
      } else {
        newSet.add(residentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedResidentIds.size === filteredResidents.length) {
      setSelectedResidentIds(new Set());
    } else {
      setSelectedResidentIds(new Set(filteredResidents.map(r => r.id)));
    }
  };

  const handleOpenBulkModal = () => {
    if (selectedResidentIds.size === 0) {
      toast({
        title: "利用者を選択してください",
        description: "一括登録する利用者を選択してください。",
        variant: "destructive",
      });
      return;
    }
    setBulkInputModalOpen(true);
  };

  const handleBulkRegister = () => {
    const { recordDate, hour, minute, description } = bulkInputData;

    if (!description.trim()) {
      toast({
        title: "記録内容を入力してください",
        description: "記録内容は必須項目です。",
        variant: "destructive",
      });
      return;
    }

    // 日時を組み立て
    const recordDateTime = new Date(recordDate);
    recordDateTime.setHours(parseInt(hour));
    recordDateTime.setMinutes(parseInt(minute.toString()));
    recordDateTime.setSeconds(0);
    recordDateTime.setMilliseconds(0);

    const recordData = {
      recordDate: recordDateTime.toISOString(),
      category: '介護記録',
      description: description,
      notes: '',
    };

    bulkCreateMutation.mutate({
      residentIds: Array.from(selectedResidentIds),
      recordData
    });
  };

  // インライン新規記録作成ハンドラー
  const handleNewRecordEdit = (blockId: string, field: string, value: string) => {
    setNewRecordBlocks(prev => 
      prev.map(block => 
        block.id === blockId 
          ? { ...block, [field]: value }
          : block
      )
    );

    // 更新されたブロックを取得
    const updatedBlocks = newRecordBlocks.map(block => 
      block.id === blockId 
        ? { ...block, [field]: value }
        : block
    );
    
    const updatedBlock = updatedBlocks.find(block => block.id === blockId);
    if (!updatedBlock) return;

    // 必須フィールドがすべて入力されたら自動保存
    const hasRequiredFields = updatedBlock.description && selectedResident;

    if (hasRequiredFields) {
      const submitData = {
        ...updatedBlock,
        residentId: selectedResident.id,
        category: '介護記録', // デフォルトカテゴリ
      };
      
      createMutation.mutate(submitData);
      // 保存後にブロックを削除
      setNewRecordBlocks(prev => prev.filter(block => block.id !== blockId));
    }
  };

  const categoryOptions = [
    { value: "daily_care", label: "日常介護" },
    { value: "assistance", label: "介助" },
    { value: "observation", label: "観察" },
    { value: "medication", label: "服薬" },
    { value: "meal", label: "食事" },
    { value: "excretion", label: "排泄" },
    { value: "bath", label: "入浴" },
    { value: "vital", label: "バイタル" },
    { value: "round", label: "ラウンド" },
    { value: "other", label: "その他" },
  ];

  // 時分選択用のオプション（バイタル一覧画面と同じ）
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, "0"),
  }));
  const minuteOptions = [
    { value: "0", label: "00" },
    { value: "15", label: "15" },
    { value: "30", label: "30" },
    { value: "45", label: "45" },
  ];

  // 利用者詳細の記録を取得（既存のcareRecordsを利用）
  const residentRecords = (careRecords as any[]).filter((record: any) => 
    selectedResident ? record.residentId === selectedResident.id : false
  );

  // 新規記録ブロックも利用者でフィルタリング
  const filteredNewRecordBlocks = newRecordBlocks.filter(block => 
    selectedResident ? block.residentId === selectedResident.id : false
  );

  // ソート済みの既存記録（初期処理と日付変更時のみソート）
  const sortedCareRecords = useMemo(() => {
    return (careRecords as any[])
      .filter((record: any) => {
        if (!selectedResident || record.residentId !== selectedResident.id) return false;
        const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
        return recordDate === format(selectedDate, "yyyy-MM-dd");
      })
      .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
  }, [careRecords, selectedResident, selectedDate]);

  // 階数のオプションを生成（利用者データから）
  const floorOptions = [
    { value: "all", label: "全階" },
    ...Array.from(new Set((residents as any[]).map(r => {
      // "1F", "2F" などのF文字を除去して数値のみ取得
      const floor = r.floor?.toString().replace('F', '');
      return floor ? parseInt(floor) : null;
    }).filter(Boolean)))
      .sort((a, b) => (a || 0) - (b || 0))
      .map(floor => ({ value: floor?.toString() || '', label: `${floor}階` }))
  ];

  // フィルター適用済みの利用者一覧
  const filteredResidents = (residents as any[]).filter((resident: any) => {
    // 階数フィルター
    if (selectedFloor !== "all") {
      // 利用者のfloor値も正規化（"1F" → "1"）
      const residentFloor = resident.floor?.toString().replace('F', '');
      if (residentFloor !== selectedFloor) {
        return false;
      }
    }
    
    // 日付フィルター（入所日・退所日による絞り込み）
    const filterDate = selectedDate;
    const admissionDate = resident.admissionDate ? new Date(resident.admissionDate) : null;
    const retirementDate = resident.retirementDate ? new Date(resident.retirementDate) : null;
    
    // 入所日がある場合、選択した日付が入所日以降である必要がある
    if (admissionDate && filterDate < admissionDate) {
      return false;
    }
    
    // 退所日がある場合、選択した日付が退所日以前である必要がある
    if (retirementDate && filterDate > retirementDate) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    const roomA = parseInt(a.roomNumber || '999999');
    const roomB = parseInt(b.roomNumber || '999999');
    return roomA - roomB;
  });

  // 選択された日付の利用者の介護記録数を取得
  const getResidentCareRecordCountForDate = (residentId: string) => {
    return (careRecords as any[]).filter((record: any) => {
      if (record.residentId !== residentId) return false;
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      return recordDate === format(selectedDate, "yyyy-MM-dd");
    }).length;
  };

  // 利用者名のフォント色を決定
  const getResidentNameColor = (resident: any) => {
    // 入院中の場合は青字（優先）
    if (resident.isAdmitted) {
      return "text-blue-600";
    }
    // その日の介護記録が1件もない場合は赤字
    if (getResidentCareRecordCountForDate(resident.id) === 0) {
      return "text-red-600";
    }
    // デフォルト
    return "text-gray-900 dark:text-gray-100";
  };

  const { data: vitals = [] } = useQuery({
    queryKey: ["/api/vital-signs", selectedResident?.id],
    queryFn: async () => {
      if (!selectedResident?.id) return [];
      const response = await fetch(`/api/vital-signs?residentId=${selectedResident.id}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch vitals");
      return response.json();
    },
    enabled: !!selectedResident,
  });

  const { data: mealRecords = [] } = useQuery({
    queryKey: ["/api/meal-records", selectedResident?.id],
    queryFn: async () => {
      if (!selectedResident?.id) return [];
      // meals-and-medication APIを使用し、フロントエンドで利用者IDでフィルタ
      const response = await fetch(`/api/meals-medication`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch meal records");
      const allRecords = await response.json();
      // 選択された利用者の記録のみを返す
      return allRecords.filter((record: any) => record.residentId === selectedResident.id);
    },
    enabled: !!selectedResident,
  });

  // 記録内容全文表示用のstate
  const [selectedRecordContent, setSelectedRecordContent] = useState<string>("");
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  
  // 画像拡大表示用のstate
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [selectedImageInfo, setSelectedImageInfo] = useState<{recordId: string; fileIndex: number; url: string; name: string} | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  
  // 記録詳細画面用のstate
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  
  // 既存記録の編集用ローカル状態
  const [localRecordDescriptions, setLocalRecordDescriptions] = useState<Record<string, string>>({});
  const [localRecordDates, setLocalRecordDates] = useState<Record<string, string>>({});
  
  // 新規記録ブロックの編集用ローカル状態
  const [localNewBlockDescriptions, setLocalNewBlockDescriptions] = useState<Record<string, string>>({});
  
  // 詳細画面専用のstate
  const [editedDescription, setEditedDescription] = useState("");
  const [editedDate, setEditedDate] = useState(new Date());

  // 一括登録モード用のstate
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedResidentIds, setSelectedResidentIds] = useState<Set<string>>(new Set());
  const [bulkInputModalOpen, setBulkInputModalOpen] = useState(false);
  const [bulkInputData, setBulkInputData] = useState({
    recordDate: selectedDate,
    hour: format(new Date(), 'HH'),
    minute: Math.floor(parseInt(format(new Date(), 'mm')) / 15) * 15,
    description: ''
  });

  // selectedDateが変更されたときにbulkInputDataを更新
  useEffect(() => {
    setBulkInputData(prev => ({
      ...prev,
      recordDate: selectedDate
    }));
  }, [selectedDate]);

  // 選択された記録が変更されたら、編集用のstateを初期化
  const { id: recordId, description: recordDescription, recordDate: initialRecordDate } = selectedRecordForDetail || {};
  useEffect(() => {
    if (selectedRecordForDetail) {
      setEditedDescription(recordDescription || "");
      setEditedDate(initialRecordDate ? new Date(initialRecordDate) : new Date());
    } else {
      // 新規レコードの場合
      setEditedDescription("");
      setEditedDate(new Date());
    }
  }, [recordId, recordDescription, initialRecordDate]);
  
  
  
  // ファイルアップロード用state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; type: string }>>([]);
  const [recordAttachments, setRecordAttachments] = useState<Record<string, Array<{ name: string; url: string; type: string }>>>({});

  // ファイルアップロード処理（介護記録詳細画面用）
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const currentFiles = getDetailAttachments();
      const newFiles: Array<{ name: string; url: string; type: string }> = [];
      
      Array.from(files).forEach(file => {
        // 最大3つまでの制限をチェック
        if (currentFiles.length + newFiles.length < 3) {
          const url = URL.createObjectURL(file);
          newFiles.push({
            name: file.name,
            url: url,
            type: file.type
          });
        }
      });
      
      if (newFiles.length > 0) {
        setDetailAttachments([...currentFiles, ...newFiles]);
      }
    }
    // ファイル選択をリセット
    event.target.value = '';
  };

  // 記録別ファイルアップロード処理
  const handleRecordFileUpload = (recordId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const currentAttachments = recordAttachments[recordId] || [];
      const newFiles: Array<{ name: string; url: string; type: string }> = [];
      
      Array.from(files).forEach(file => {
        // 最大3つまでの制限をチェック
        if (currentAttachments.length + newFiles.length < 3) {
          const url = URL.createObjectURL(file);
          newFiles.push({
            name: file.name,
            url: url,
            type: file.type
          });
        }
      });
      
      if (newFiles.length > 0) {
        setRecordAttachments(prev => ({
          ...prev,
          [recordId]: [...currentAttachments, ...newFiles]
        }));
      }
    }
    // ファイル選択をリセット
    event.target.value = '';
  };

  // ファイル削除処理
  const removeRecordAttachment = (recordId: string, fileIndex: number) => {
    setRecordAttachments(prev => ({
      ...prev,
      [recordId]: (prev[recordId] || []).filter((_, index) => index !== fileIndex)
    }));
  };

  // 新規ブロックの記録内容を取得するヘルパー関数（食事一覧と同じパターン）
  const getNewBlockDescription = (blockId: string): string => {
    // ローカル状態があればそれを使用
    if (localNewBlockDescriptions[blockId] !== undefined) {
      return localNewBlockDescriptions[blockId];
    }
    
    // 新規ブロックから取得
    const block = newRecordBlocks.find(b => b.id === blockId);
    return block?.description || '';
  };

  

  // 介護記録詳細画面用のファイル管理（利用者別）
  const getDetailAttachments = () => {
    const recordId = selectedRecordForDetail?.id || 'new';
    const residentKey = selectedResident ? `${selectedResident.id}-${recordId}` : recordId;
    return recordAttachments[residentKey] || [];
  };

  const setDetailAttachments = (files: Array<{ name: string; url: string; type: string }>) => {
    const recordId = selectedRecordForDetail?.id || 'new';
    const residentKey = selectedResident ? `${selectedResident.id}-${recordId}` : recordId;
    setRecordAttachments(prev => ({
      ...prev,
      [residentKey]: files
    }));
  };

  

  // 詳細画面表示の条件分岐
  if (showRecordDetail && selectedResident) {
    const currentRecord = selectedRecordForDetail || {
      id: 'new',
      recordDate: new Date().toISOString(),
      description: '',
      notes: ''
    };
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">介護記録詳細</h1>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident?.roomNumber || "未設定"}: {selectedResident?.name}　　
              <span className="text-sm font-normal">
                {getGenderDisplay(selectedResident?.gender)} {selectedResident?.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident?.careLevel || '未設定'}
              </span>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4">
          {/* 記録情報カード */}
          <div className="bg-white border border-slate-200 p-2 shadow-sm mb-4">
            <div className="flex items-center gap-2 h-20">
              {/* 左側：時間、カテゴリ、記録者を縦並び */}
              <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                {/* 時間 */}
                <div className="flex items-center gap-0.5">
                  <InputWithDropdown
                    id="hour-input-detail"
                    value={format(editedDate, "HH", { locale: ja })}
                    options={hourOptions}
                    onSave={(value) => {
                      const newDate = new Date(editedDate);
                      newDate.setHours(parseInt(value));
                      setEditedDate(newDate);

                      if (currentRecord.id !== 'new') {
                        updateDetailMutation.mutate(
                          { id: currentRecord.id, field: 'recordDate', value: newDate.toISOString() },
                          {
                            onSuccess: () => {
                              setSelectedRecordForDetail((prev: any) => ({ ...prev, recordDate: newDate.toISOString() }));
                              // 詳細画面では自動フォーカス移動を無効化
                            }
                          }
                        );
                      }
                      // 詳細画面では自動フォーカス移動を無効化
                    }}
                    placeholder="--"
                    className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={false}
                    disableFocusMove={true}
                  />
                  <span className="text-xs">:</span>
                  <InputWithDropdown
                    id="minute-input-detail"
                    value={format(editedDate, "mm", { locale: ja })}
                    options={minuteOptions}
                    onSave={(value) => {
                      const newDate = new Date(editedDate);
                      newDate.setMinutes(parseInt(value));
                      setEditedDate(newDate);

                      if (currentRecord.id !== 'new') {
                        updateDetailMutation.mutate(
                          { id: currentRecord.id, field: 'recordDate', value: newDate.toISOString() },
                          {
                            onSuccess: () => {
                              setSelectedRecordForDetail((prev: any) => ({ ...prev, recordDate: newDate.toISOString() }));
                              // 詳細画面では自動フォーカス移動を無効化
                            }
                          }
                        );
                      }
                      // 詳細画面では自動フォーカス移動を無効化
                    }}
                    placeholder="--"
                    className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={false}
                    disableFocusMove={true}
                  />
                </div>
                
                {/* カテゴリ */}
                <div>
                  <input
                    type="text"
                    value="様子"
                    readOnly
                    className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                  />
                </div>
                
                {/* 記録者 */}
                <div>
                  <input
                    type="text"
                    value={(() => {
                      // 職員ログインの場合
                      if ((currentUser as any)?.staffName) {
                        return (currentUser as any).staffName;
                      }
                      // Replitユーザーの場合
                      if ((currentUser as any)?.firstName) {
                        return (currentUser as any).firstName;
                      }
                      if ((currentUser as any)?.email) {
                        return (currentUser as any).email.split('@')[0];
                      }
                      return "不明";
                    })()}
                    readOnly
                    className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                  />
                </div>
              </div>

              {/* 記録内容 */}
              <div className="flex-1">
                <textarea
                  id="description-textarea-detail"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={(e) => {
                    const originalDescription = selectedRecordForDetail?.description || "";
                    if (e.target.value !== originalDescription) {
                      if (currentRecord.id !== 'new') {
                        updateDetailMutation.mutate(
                          {
                            id: currentRecord.id,
                            field: 'description',
                            value: e.target.value
                          },
                          {
                            onSuccess: () => {
                              // 詳細画面の元データであるselectedRecordForDetailも更新する
                              setSelectedRecordForDetail((prev: any) => ({
                                ...prev,
                                description: e.target.value
                              }));
                            }
                          }
                        );
                      } else {
                        // 新規記録の場合は作成
                        if (e.target.value.trim()) {
                          createMutation.mutate({
                            residentId: selectedResident?.id,
                            recordDate: currentRecord.recordDate,
                            category: '介護記録',
                            description: e.target.value,
                            notes: '',
                          });
                        }
                      }
                    }
                  }}
                  className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                  placeholder="記録内容を入力..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* ファイル添付エリア */}
          <div className="bg-white border border-slate-200 p-4 shadow-sm">
            <h3 className="text-lg font-medium text-slate-800 mb-4">添付ファイル</h3>
            
            {/* アップロードされたファイル表示 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {getDetailAttachments().map((file, index) => (
                <div key={index} className="border border-slate-200 p-4 rounded-lg bg-slate-50 relative">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-32 object-contain rounded mb-2" />
                  ) : (
                    <div className="w-full h-32 bg-slate-200 rounded mb-2 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <p className="text-xs text-slate-600 truncate">{file.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-red-500 hover:bg-red-50"
                    onClick={() => {
                      const newFiles = getDetailAttachments().filter((_, i) => i !== index);
                      setDetailAttachments(newFiles);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {/* ファイルアップロードエリア */}
              {getDetailAttachments().length < 3 && (
                <label className="border-2 border-dashed border-slate-300 p-4 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 flex flex-col items-center justify-center h-32">
                  <Paperclip className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-600">ファイルを追加</span>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>

            {/* ページングドット */}
            <div className="flex justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
            </div>
          </div>
        </main>

        {/* 戻るボタン */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-start max-w-lg mx-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRecordDetail(false);
                setSelectedRecordForDetail(null);
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedResident) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">介護記録</h1>
          </div>
          <div className="bg-white p-3 shadow-sm border-b">
            <div className="flex gap-2 sm:gap-4 items-center justify-center">
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
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident.roomNumber || "未設定"}: {selectedResident.name}　　
              <span className="text-sm font-normal">
                {getGenderDisplay(selectedResident.gender)} {selectedResident.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident.careLevel || '未設定'}
              </span>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4 pb-20">
          {/* 利用者一覧テーブル（食事一覧と同じレイアウト） */}
          <div className="space-y-0 border rounded-lg overflow-hidden">
            {/* 新規記録ブロック */}
            {filteredNewRecordBlocks.map((block, index) => (
              <div key={block.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
                <div className="p-2">
                  {/* 1行目：時間 + 記録内容 + アクションボタン */}
                  <div className="flex items-center gap-2 h-20">
                    {/* 左側：時間、カテゴリ、記録者を縦並び */}
                    <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                      {/* 時間 */}
                      <div className="flex items-center gap-0.5">
                        <InputWithDropdown
                          value={format(new Date(block.recordDate), "HH", { locale: ja })}
                          options={hourOptions}
                          onSave={(value) => {
                            const currentDate = new Date(block.recordDate);
                            currentDate.setHours(parseInt(value));
                            const newDateString = currentDate.toISOString();
                            
                            // 即座に画面に反映
                            setNewRecordBlocks(prev => 
                              prev.map(b => 
                                b.id === block.id 
                                  ? { ...b, recordDate: newDateString }
                                  : b
                              )
                            );
                            
                            // バックグラウンドで保存処理（非同期）
                            if (block.description.trim() && selectedResident) {
                              const submitData = {
                                residentId: selectedResident.id,
                                recordDate: currentDate.toISOString(),
                                category: '介護記録',
                                description: block.description,
                                notes: '',
                              };
                              createMutation.mutate(submitData);
                              // 保存後にブロックを削除
                              setNewRecordBlocks(prev => prev.filter(b => b.id !== block.id));
                            }
                          }}
                          placeholder="--"
                          className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs">:</span>
                        <InputWithDropdown
                          value={format(new Date(block.recordDate), "mm", { locale: ja })}
                          options={minuteOptions}
                          onSave={(value) => {
                            const currentMinute = format(new Date(block.recordDate), "mm", { locale: ja });
                            
                            // 値が実際に変更された場合のみ処理を実行
                            if (value !== currentMinute) {
                              const currentDate = new Date(block.recordDate);
                              currentDate.setMinutes(parseInt(value));
                              const newDateString = currentDate.toISOString();
                              
                              // 即座に画面に反映
                              setNewRecordBlocks(prev => 
                                prev.map(b => 
                                  b.id === block.id 
                                    ? { ...b, recordDate: newDateString }
                                    : b
                                )
                              );
                              
                              // バックグラウンドで保存処理（非同期）
                              if (block.description.trim() && selectedResident) {
                                const submitData = {
                                  residentId: selectedResident.id,
                                  recordDate: currentDate.toISOString(),
                                  category: '介護記録',
                                  description: block.description,
                                  notes: '',
                                };
                                createMutation.mutate(submitData);
                                // 保存後にブロックを削除
                                setNewRecordBlocks(prev => prev.filter(b => b.id !== block.id));
                              }
                              
                              // 分選択後に記録内容をアクティブにする（値が変更された場合のみ）
                              setTimeout(() => {
                                const targetTextarea = document.querySelector(`textarea[data-block-id="${block.id}"]`) as HTMLTextAreaElement;
                                if (targetTextarea) {
                                  targetTextarea.focus();
                                }
                              }, 200);
                            }
                          }}
                          placeholder="--"
                          className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      {/* カテゴリ */}
                      <div>
                        <input
                          type="text"
                          value="様子"
                          readOnly
                          className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                        />
                      </div>
                      
                      {/* 記録者 */}
                      <div>
                        <input
                          type="text"
                          value={(() => {
                            // 職員ログインの場合
                            if ((currentUser as any)?.staffName) {
                              return (currentUser as any).staffName;
                            }
                            // Replitユーザーの場合
                            if ((currentUser as any)?.firstName) {
                              return (currentUser as any).firstName;
                            }
                            if ((currentUser as any)?.email) {
                              return (currentUser as any).email.split('@')[0];
                            }
                            return "不明";
                          })()}
                          readOnly
                          className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                        />
                      </div>
                    </div>

                    {/* 記録内容（高さいっぱい） */}
                    <div className="flex-1">
                      <textarea
                        value={getNewBlockDescription(block.id)}
                        onChange={(e) => {
                          // 食事一覧画面と同じパターン：ローカル状態のみ更新
                          setLocalNewBlockDescriptions(prev => ({
                            ...prev,
                            [block.id]: e.target.value
                          }));
                        }}
                        onBlur={(e) => {
                          // カーソルアウト時に保存処理
                          if (e.target.value.trim() && selectedResident) {
                            const submitData = {
                              residentId: selectedResident.id,
                              recordDate: new Date(block.recordDate).toISOString(),
                              category: '介護記録',
                              description: e.target.value,
                              notes: '',
                            };
                            
                            // 保存処理を実行（ブロック削除は成功後に行う）
                            createMutation.mutate(submitData, {
                              onSuccess: () => {
                                // 保存成功後にブロックを削除
                                setNewRecordBlocks(prev => prev.filter(b => b.id !== block.id));
                                // ローカル状態もクリア
                                setLocalNewBlockDescriptions(prev => {
                                  const newState = { ...prev };
                                  delete newState[block.id];
                                  return newState;
                                });
                              }
                            });
                          } else {
                            // 空の場合はローカル状態のみクリア
                            setLocalNewBlockDescriptions(prev => {
                              const newState = { ...prev };
                              delete newState[block.id];
                              return newState;
                            });
                          }
                        }}
                        placeholder="記録内容を入力してください"
                        className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                        rows={4}
                        data-block-id={block.id}
                      />
                    </div>

                    {/* アイコンボタン - 3つ縦並び */}
                    <div className="flex flex-col justify-center gap-6 sm:-space-y-4 flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        className="text-gray-400 hover:bg-gray-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0 cursor-not-allowed"
                        disabled
                      >
                        <Info className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="text-gray-400 hover:bg-gray-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0 cursor-not-allowed"
                        disabled
                      >
                        <Search className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="text-red-600 hover:bg-red-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0"
                        onClick={() => removeNewRecordBlock(block.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* 既存の記録 */}
            {sortedCareRecords
              .map((record: any, index: number) => {
                const adjustedIndex = index + filteredNewRecordBlocks.length; // 新規ブロック分のインデックス調整
                const displayDate = localRecordDates[record.id] || record.recordDate;
                
                return (
                  <div key={record.id} className={`${(adjustedIndex > 0 || filteredNewRecordBlocks.length > 0) ? 'border-t' : ''} bg-white`}>
                    <div className="p-2">
                      {/* 1行目：時間 + 記録内容 + アクションボタン */}
                      <div className="flex items-center gap-2 h-24">
                        {/* 左側：時間、カテゴリ、記録者を縦並び */}
                        <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                          {/* 時間 */}
                          <div className="flex items-center gap-0.5">
                            <InputWithDropdown
                              value={format(new Date(displayDate), "HH", { locale: ja })}
                              options={hourOptions}
                              onSave={(value) => {
                                // 有効な日時を確実に取得
                                const baseDate = new Date(record.recordDate);
                                if (isNaN(baseDate.getTime())) {
                                  console.error("Invalid base date:", record.recordDate);
                                  return;
                                }
                                baseDate.setHours(parseInt(value));
                                const newDateString = baseDate.toISOString();
                                setLocalRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                updateMutation.mutate({
                                  id: record.id,
                                  field: 'recordDate',
                                  value: newDateString
                                });
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={format(new Date(displayDate), "mm", { locale: ja })}
                              options={minuteOptions}
                              onSave={(value) => {
                                const currentMinute = format(new Date(displayDate), "mm", { locale: ja });

                                // 値が実際に変更された場合のみ処理を実行
                                if (value !== currentMinute) {
                                  // 有効な日時を確実に取得
                                  const baseDate = new Date(record.recordDate);
                                  if (isNaN(baseDate.getTime())) {
                                    console.error("Invalid base date:", record.recordDate);
                                    return;
                                  }
                                  baseDate.setMinutes(parseInt(value));
                                  const newDateString = baseDate.toISOString();
                                  setLocalRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                  updateMutation.mutate({
                                    id: record.id,
                                    field: 'recordDate',
                                    value: newDateString
                                  });

                                  // 分選択後に記録内容をアクティブにする（値が変更された場合のみ）
                                  setTimeout(() => {
                                    const targetTextarea = document.querySelector(`textarea[data-record-id="${record.id}"]`) as HTMLTextAreaElement;
                                    if (targetTextarea) {
                                      targetTextarea.focus();
                                    }
                                  }, 200);
                                }
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* カテゴリ */}
                          <div>
                            <input
                              type="text"
                              value="様子"
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                          
                          {/* 記録者 */}
                          <div>
                            <input
                              type="text"
                              value={(() => {
                                // 職員ログインの場合
                                if ((currentUser as any)?.staffName) {
                                  return (currentUser as any).staffName;
                                }
                                // Replitユーザーの場合
                                if ((currentUser as any)?.firstName) {
                                  return (currentUser as any).firstName;
                                }
                                if ((currentUser as any)?.email) {
                                  return (currentUser as any).email.split('@')[0];
                                }
                                return "不明";
                              })()}
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                        </div>

                        {/* 記録内容（高さいっぱい） */}
                        <div className="flex-1">
                          <textarea
                            value={localRecordDescriptions[record.id] !== undefined ? localRecordDescriptions[record.id] : record.description}
                            onChange={(e) => {
                              // 即座に画面に反映（保存はしない）
                              setLocalRecordDescriptions(prev => ({
                                ...prev,
                                [record.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              // 変更がない場合は何もしない
                              if (e.target.value === record.description) {
                                // ローカル状態もクリア
                                setLocalRecordDescriptions(prev => {
                                  const newState = { ...prev };
                                  delete newState[record.id];
                                  return newState;
                                });
                                return;
                              }
                              // カーソルアウト時に保存処理を実行
                              updateMutation.mutate({ id: record.id, field: 'description', value: e.target.value });
                            }}
                            className="h-24 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                            placeholder="記録を入力..."
                            rows={4}
                            data-record-id={record.id}
                          />
                        </div>

                        {/* アイコンボタン - 3つ縦並び */}
                        <div className="flex flex-col justify-center gap-6 sm:-space-y-4 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            className="text-blue-600 hover:bg-blue-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0"
                            onClick={() => {
                              setSelectedRecordForDetail(record);
                              setShowRecordDetail(true);
                            }}
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="text-blue-600 hover:bg-blue-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0"
                            onClick={() => {
                              setSelectedRecordContent(record.description);
                              setContentDialogOpen(true);
                            }}
                          >
                            <Search className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="text-red-600 hover:bg-red-50 !p-0 sm:!p-1 !h-3 !w-3 sm:!h-6 sm:!w-6 !min-h-0 !min-w-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>記録削除の確認</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この介護記録を削除してもよろしいですか？この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    deleteMutation.mutate(record.id);
                                  }}
                                  className="bg-red-600 hover:bg-red-700"
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
                );
              })}
          </div>

          {/* 記録がない場合のメッセージ */}
          {sortedCareRecords.length === 0 && filteredNewRecordBlocks.length === 0 && (
            <div className="text-center py-8 text-slate-600">
              <p>選択した日付の介護記録がありません</p>
            </div>
          )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Button 
              variant="outline" 
              onClick={() => setView('list')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
            <Button
              onClick={addNewRecordBlock}
              className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* 記録内容全文表示ダイアログ */}
        <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>記録内容</DialogTitle>
              <DialogDescription>記録の詳細内容を表示しています</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="p-4 bg-slate-50 rounded-lg border">
                <p className="text-slate-800 whitespace-pre-wrap">{selectedRecordContent}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 画像拡大表示ダイアログ */}
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            {/* 削除ボタンを上部中央に配置 */}
            {selectedImageInfo && (
              <div className="flex justify-center p-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:bg-red-50 border-red-300"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      削除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>画像削除の確認</AlertDialogTitle>
                      <AlertDialogDescription>
                        この添付画像を削除してもよろしいですか？この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (selectedImageInfo) {
                            removeRecordAttachment(selectedImageInfo.recordId, selectedImageInfo.fileIndex);
                            setImageDialogOpen(false);
                            setSelectedImageInfo(null);
                          }
                        }}
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            <div className="flex justify-center items-center p-4">
              {selectedImageUrl && (
                <img 
                  src={selectedImageUrl} 
                  alt="拡大画像" 
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 w-full">
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
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">介護記録　利用者一覧</h1>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
          {/* 一括登録モード時の全選択チェックボックス */}
          {bulkMode && (
            <div className="flex items-center mr-2">
              <input
                type="checkbox"
                checked={selectedResidentIds.size === filteredResidents.length && filteredResidents.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="flex gap-2 items-center">
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
              <InputWithDropdown
                value={(() => {
                  const option = floorOptions.find(opt => opt.value === selectedFloor);
                  return option ? option.label : "全階";
                })()}
                options={floorOptions}
                onSave={(value) => setSelectedFloor(value)}
                placeholder="フロア選択"
                className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-2 pb-2">
        {/* Residents Selection Grid */}
        <div className="mb-8">
          {filteredResidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">利用者情報がありません</p>
                <p className="text-sm text-slate-500 mt-2">利用者情報画面から利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {filteredResidents.map((resident: any) => (
                <Card
                  key={resident.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-1.5 sm:p-2">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        {/* 一括登録モード時のチェックボックス */}
                        {bulkMode && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedResidentIds.has(resident.id)}
                              onChange={() => toggleResidentSelection(resident.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        <div className="text-center min-w-[40px] sm:min-w-[50px]">
                          <div className="text-sm sm:text-lg font-bold text-blue-600">
                            {resident.roomNumber || "未設定"}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold text-sm sm:text-base truncate ${getResidentNameColor(resident)}`}>{resident.name}</div>
                        </div>
                        <div className="text-center min-w-[60px] sm:min-w-[80px]">
                          <div className="text-xs sm:text-sm font-medium text-slate-700">
                            {resident.careLevel || "未設定"}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1 px-2 sm:px-3 text-xs sm:text-sm"
                        onClick={() => {
                          if (!bulkMode) {
                            setSelectedResident(resident);
                            setView('detail');
                            form.setValue('residentId', resident.id);
                          }
                        }}
                        disabled={bulkMode}
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">記録</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フッダー */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            variant={bulkMode ? "outline" : "default"}
            onClick={bulkMode ? handleCancelBulkMode : handleStartBulkMode}
            className="flex items-center gap-2"
          >
            {bulkMode ? "キャンセル" : "一括登録"}
          </Button>
          {bulkMode && (
            <Button
              onClick={handleOpenBulkModal}
              className="bg-blue-600 hover:bg-blue-700 w-12 h-12 rounded-full p-0"
              disabled={selectedResidentIds.size === 0}
            >
              <ClipboardList className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>

      {/* 一括登録ポップアップ */}
      <Dialog open={bulkInputModalOpen} onOpenChange={setBulkInputModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>一括登録</DialogTitle>
            <DialogDescription>
              選択した{selectedResidentIds.size}名の利用者に介護記録を一括登録します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 記録日時 - 1行に配置 */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">記録日</label>
                <input
                  type="date"
                  value={format(bulkInputData.recordDate, 'yyyy-MM-dd')}
                  onChange={(e) => setBulkInputData(prev => ({ ...prev, recordDate: new Date(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="w-20">
                <label className="text-sm font-medium text-gray-700">時</label>
                <InputWithDropdown
                  value={bulkInputData.hour}
                  options={hourOptions}
                  onSave={(value) => setBulkInputData(prev => ({ ...prev, hour: value }))}
                  placeholder="時"
                  className="w-full px-2 py-2 border rounded-md text-center"
                />
              </div>
              <div className="w-20">
                <label className="text-sm font-medium text-gray-700">分</label>
                <InputWithDropdown
                  value={bulkInputData.minute.toString()}
                  options={minuteOptions}
                  onSave={(value) => setBulkInputData(prev => ({ ...prev, minute: parseInt(value) }))}
                  placeholder="分"
                  className="w-full px-2 py-2 border rounded-md text-center"
                />
              </div>
            </div>

            {/* 記録内容 */}
            <div>
              <label className="text-sm font-medium text-gray-700">記録内容</label>
              <Textarea
                value={bulkInputData.description}
                onChange={(e) => setBulkInputData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="記録内容を入力してください"
                className="w-full min-h-[100px] bg-white"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setBulkInputModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleBulkRegister}
              disabled={!bulkInputData.description.trim() || bulkCreateMutation.isPending}
            >
              {bulkCreateMutation.isPending ? '登録中...' : '登録実行'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 下部余白 */}
      <div className="h-20"></div>
    </div>
  );
}
