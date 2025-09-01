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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Edit, ClipboardList, ArrowLeft, Save, Check, X, MoreHorizontal, Info, Search, Building, FileText, Trash2, Paperclip, Download, Eye, File, Image } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const nursingRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
});

type NursingRecordForm = z.infer<typeof nursingRecordSchema>;

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  id,
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
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
    <div className={`relative ${isFocused || open ? 'ring-2 ring-green-200 rounded' : ''} transition-all`}>
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

export default function NursingRecords() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [newRecordBlocks, setNewRecordBlocks] = useState<any[]>([]);
  // URLパラメータから日付とフロアの初期値を取得（1回のみ実行）
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('date') || format(new Date(), "yyyy-MM-dd");
  });
  const [selectedFloor, setSelectedFloor] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('floor') || "all";
  });
  const residentIdFromUrl = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('residentId');
  })();

  // 記録詳細画面用のstate
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);

  // 詳細画面の編集用状態
  const [editedDate, setEditedDate] = useState(new Date());
  const [editedDescription, setEditedDescription] = useState("");
  const [localNewBlockDescriptions, setLocalNewBlockDescriptions] = useState<Record<string, string>>({});

  const [recordAttachments, setRecordAttachments] = useState<Record<string, Array<{ name: string; url: string; type: string }>>>({});

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: nursingRecords = [], isLoading } = useQuery({
    queryKey: ["/api/nursing-records"],
    staleTime: 0, // 常に最新データを取得
    refetchOnMount: true, // マウント時に再取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
  });

  // データ取得完了の確認
  useEffect(() => {
    if (nursingRecords && Array.isArray(nursingRecords)) {
      // 開発時のみログ出力
      if (process.env.NODE_ENV === 'development') {
        console.log("看護記録データを取得:", nursingRecords.length, "件");
      }
    }
  }, [nursingRecords]);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // 利用者の添付ファイルを取得
  const { data: attachments = [] } = useQuery({
    queryKey: [`/api/residents/${selectedResident?.id}/attachments`],
    enabled: !!selectedResident?.id,
  }) as { data: any[] };

  const form = useForm<NursingRecordForm>({
    resolver: zodResolver(nursingRecordSchema),
    defaultValues: {
      residentId: selectedResident?.id || "",
      recordDate: new Date(selectedDate + "T" + new Date().toTimeString().slice(0, 8)).toISOString().slice(0, 16),
      category: "看護記録",
      description: "",
    },
  });

  // selectedDateが変更された時にフォームのデフォルト値を更新
  useEffect(() => {
    const currentTime = new Date().toTimeString().slice(0, 8);
    const newRecordDate = new Date(selectedDate + "T" + currentTime).toISOString().slice(0, 16);
    
    form.reset({
      residentId: selectedResident?.id || "",
      recordDate: newRecordDate,
      category: "看護記録",
      description: "",
    });
  }, [selectedDate, selectedResident?.id, form]);

  // URLパラメータから利用者IDが指定されている場合、該当する利用者を選択し詳細画面を表示
  useEffect(() => {
    if (residentIdFromUrl && Array.isArray(residents) && residents.length > 0) {
      const resident = residents.find((r: any) => r.id === residentIdFromUrl);
      if (resident) {
        setSelectedResident(resident);
        setView('detail');
        form.setValue('residentId', resident.id);
      }
    }
  }, [residentIdFromUrl, residents, form]);

  // 選択された記録が変更されたら、編集用のstateを初期化
  useEffect(() => {
    if (selectedRecordForDetail) {
      setEditedDescription(selectedRecordForDetail.description || "");
      setEditedDate(selectedRecordForDetail.recordDate ? new Date(selectedRecordForDetail.recordDate) : new Date());
    }
  }, [selectedRecordForDetail]);

  const createMutation = useMutation({
    mutationFn: async (data: NursingRecordForm) => {
      await apiRequest("/api/nursing-records", "POST", {
        ...data,
        recordDate: new Date(data.recordDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
      form.reset({
        residentId: selectedResident?.id || "",
        recordDate: new Date(selectedDate + "T" + new Date().toTimeString().slice(0, 8)).toISOString().slice(0, 16),
        category: "看護記録",
        description: "",
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "看護記録の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 記録更新用ミューテーション（一覧画面用）
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onMutate: async (newData: { id: string; field: string; value: any }) => {
      // recordDateの更新時は楽観的更新によるキャッシュ操作を行わない
      if (newData.field === 'recordDate') {
        return;
      }
      // クエリのキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/nursing-records'] });

      // 以前のデータをスナップショット
      const previousNursingRecords = queryClient.getQueryData(['/api/nursing-records']);

      // キャッシュを楽観的に更新
      queryClient.setQueryData(['/api/nursing-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === newData.id ? { ...record, [newData.field]: newData.value } : record
        );
      });

      // コンテキストオブジェクトで以前のデータを返す
      return { previousNursingRecords };
    },
    onError: (err, newData, context) => {
      // description更新時のロールバック
      if (context?.previousNursingRecords) {
        queryClient.setQueryData(['/api/nursing-records'], context.previousNursingRecords);
      }
      // recordDate更新エラー時にローカルstateを元に戻す
      if (newData.field === 'recordDate') {
        setLocalRecordDates(prev => {
          const newState = { ...prev };
          delete newState[newData.id];
          return newState;
        });
      }
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 医療記録更新用ミューテーション
  const updateMedicalMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onMutate: async (newData: { id: string; field: string; value: any }) => {
      // recordDateの更新時は楽観的更新によるキャッシュ操作を行わない
      if (newData.field === 'recordDate') {
        return;
      }
      // クエリのキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/nursing-records'] });

      // 以前のデータをスナップショット
      const previousNursingRecords = queryClient.getQueryData(['/api/nursing-records']);

      // キャッシュを楽観的に更新
      queryClient.setQueryData(['/api/nursing-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === newData.id ? { ...record, [newData.field]: newData.value } : record
        );
      });

      // コンテキストオブジェクトで以前のデータを返す
      return { previousNursingRecords };
    },
    onError: (err, newData, context) => {
      // description更新時のロールバック
      if (context?.previousNursingRecords) {
        queryClient.setQueryData(['/api/nursing-records'], context.previousNursingRecords);
      }
      // recordDate更新エラー時にローカルstateを元に戻す
      if (newData.field === 'recordDate') {
        setLocalMedicalRecordDates(prev => {
          const newState = { ...prev };
          delete newState[newData.id];
          return newState;
        });
      }
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 処置更新用ミューテーション
  const updateTreatmentMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onMutate: async (newData: { id: string; field: string; value: any }) => {
      // recordDateの更新時は楽観的更新によるキャッシュ操作を行わない
      if (newData.field === 'recordDate') {
        return;
      }
      // クエリのキャンセル
      await queryClient.cancelQueries({ queryKey: ['/api/nursing-records'] });

      // 以前のデータをスナップショット
      const previousNursingRecords = queryClient.getQueryData(['/api/nursing-records']);

      // キャッシュを楽観的に更新
      queryClient.setQueryData(['/api/nursing-records'], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(record =>
          record.id === newData.id ? { ...record, [newData.field]: newData.value } : record
        );
      });

      // コンテキストオブジェクトで以前のデータを返す
      return { previousNursingRecords };
    },
    onError: (err, newData, context) => {
      // description更新時のロールバック
      if (context?.previousNursingRecords) {
        queryClient.setQueryData(['/api/nursing-records'], context.previousNursingRecords);
      }
      // recordDate更新エラー時にローカルstateを元に戻す
      if (newData.field === 'recordDate') {
        setLocalTreatmentRecordDates(prev => {
          const newState = { ...prev };
          delete newState[newData.id];
          return newState;
        });
      }
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 詳細更新用ミューテーション
  const updateDetailMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData: any = { [field]: value };
      if (field === 'recordDate') {
        // 確実にDateオブジェクトに変換
        const dateValue = typeof value === 'string' ? new Date(value) : value;
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          updateData[field] = dateValue;
        } else {
          throw new Error('Invalid date value');
        }
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['/api/nursing-records'], (oldData: any[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(record =>
          record.id === variables.id
            ? { ...record, [variables.field]: variables.value }
            : record
        );
      });
    },
    onError: (error) => {
        toast({
            title: "エラー",
            description: "記録の更新に失敗しました",
            variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    }
  });

  // 削除用ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/nursing-records/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
      setShowRecordDetail(false);
      setSelectedRecordForDetail(null);
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "記録の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NursingRecordForm) => {
    createMutation.mutate(data);
  };

  // 新規追加ブロック作成
  const addNewRecordBlock = () => {
    if (!selectedResident && view === 'detail') {
      toast({
        title: "エラー",
        description: "利用者が選択されていません",
        variant: "destructive",
      });
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
      category: "看護記録",
      recordDate: recordDate.toISOString(),
      description: "",
    };
    setNewRecordBlocks(prev => [...prev, newBlock]);
  };

  // 医療記録用新規追加ブロック作成
  const addNewMedicalRecordBlock = () => {
    if (!selectedResident && view === 'detail') {
      toast({
        title: "エラー",
        description: "利用者が選択されていません",
        variant: "destructive",
      });
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
      id: `medical-${selectedResident.id}-${Date.now()}`,
      residentId: selectedResident.id,
      category: "医療記録",
      recordDate: recordDate.toISOString(),
      description: "",
    };
    setNewMedicalRecordBlocks(prev => [...prev, newBlock]);
  };

  // 処置用新規追加ブロック作成
  const addNewTreatmentBlock = () => {
    if (!selectedResident && view === 'detail') {
      toast({
        title: "エラー",
        description: "利用者が選択されていません",
        variant: "destructive",
      });
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
      id: `treatment-${selectedResident.id}-${Date.now()}`,
      residentId: selectedResident.id,
      category: "処置",
      recordDate: recordDate.toISOString(),
      description: "",
      notes: "",
    };
    setNewTreatmentBlocks(prev => [...prev, newBlock]);
  };

  // カテゴリは「看護記録」に固定のため、オプションは不要

  // 時分選択用のオプション
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

  // 利用者詳細の記録を取得（既存のnursingRecordsを利用）
  const residentRecords = (nursingRecords as any[]).filter((record: any) => 
    selectedResident ? record.residentId === selectedResident.id : false
  );

  // 新規記録ブロックも利用者でフィルタリング
  const filteredNewRecordBlocks = newRecordBlocks.filter(block => 
    selectedResident ? block.residentId === selectedResident.id : false
  );

  // ソートされた看護記録のstate（初期表示と日付変更時のみ更新）
  const [sortedNursingRecords, setSortedNursingRecords] = useState<any[]>([]);
  
  // 時間編集用のローカル状態
  const [localRecordDates, setLocalRecordDates] = useState<Record<string, string>>({});
  const [localMedicalRecordDates, setLocalMedicalRecordDates] = useState<Record<string, string>>({});
  
  // 医療記録用の状態
  const [newMedicalRecordBlocks, setNewMedicalRecordBlocks] = useState<any[]>([]);
  const [sortedMedicalRecords, setSortedMedicalRecords] = useState<any[]>([]);
  const [localNewMedicalBlockDescriptions, setLocalNewMedicalBlockDescriptions] = useState<Record<string, string>>({});
  
  // 処置用の状態
  const [newTreatmentBlocks, setNewTreatmentBlocks] = useState<any[]>([]);
  const [sortedTreatments, setSortedTreatments] = useState<any[]>([]);
  const [localNewTreatmentBlockDescriptions, setLocalNewTreatmentBlockDescriptions] = useState<Record<string, string>>({});
  const [localNewTreatmentBlockNotes, setLocalNewTreatmentBlockNotes] = useState<Record<string, string>>({});
  const [localTreatmentRecordDates, setLocalTreatmentRecordDates] = useState<Record<string, string>>({});

  // 初期表示と日付・利用者変更時のみソート処理を実行（看護記録のみ）
  useEffect(() => {
    const filtered = (nursingRecords as any[])
      .filter((record: any) => {
        if (!selectedResident || record.residentId !== selectedResident.id) {
          return false;
        }
        // 看護記録カテゴリのみ（医療記録と処置を除外）
        if (record.category === "医療記録" || record.category === "処置") {
          return false;
        }
        const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
        return recordDate === selectedDate;
      })
      .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    
    setSortedNursingRecords(filtered);
    
    // 開発時のみデバッグ情報を出力
    if (process.env.NODE_ENV === 'development') {
      console.log(`看護記録ソート: ${filtered.length}件 (${selectedDate})`);
    }
  }, [nursingRecords, selectedDate, selectedResident?.id]);

  // 医療記録のソート処理（看護記録と同じデータソースを使用し、カテゴリで絞り込み）
  useEffect(() => {
    const filtered = (nursingRecords as any[])
      .filter((record: any) => {
        if (!selectedResident || record.residentId !== selectedResident.id) {
          return false;
        }
        // 医療記録カテゴリのみ
        if (record.category !== "医療記録") {
          return false;
        }
        const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
        return recordDate === selectedDate;
      })
      .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    
    setSortedMedicalRecords(filtered);
    
    // 開発時のみデバッグ情報を出力
    if (process.env.NODE_ENV === 'development') {
      console.log(`医療記録ソート: ${filtered.length}件 (${selectedDate})`);
    }
  }, [nursingRecords, selectedDate, selectedResident?.id]);

  // 処置のソート処理（看護記録と同じデータソースを使用し、カテゴリで絞り込み）
  useEffect(() => {
    const filtered = (nursingRecords as any[])
      .filter((record: any) => {
        if (!selectedResident || record.residentId !== selectedResident.id) {
          return false;
        }
        // 処置カテゴリのみ
        if (record.category !== "処置") {
          return false;
        }
        const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
        return recordDate === selectedDate;
      })
      .sort((a: any, b: any) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    
    setSortedTreatments(filtered);
    
    // 開発時のみデバッグ情報を出力
    if (process.env.NODE_ENV === 'development') {
      console.log(`処置ソート: ${filtered.length}件 (${selectedDate})`);
    }
  }, [nursingRecords, selectedDate, selectedResident?.id]);

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
    const filterDate = new Date(selectedDate);
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

  // 選択された日付の利用者の看護記録数を取得
  const getResidentNursingRecordCountForDate = (residentId: string) => {
    return (nursingRecords as any[]).filter((record: any) => {
      if (record.residentId !== residentId) return false;
      const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
      return recordDate === selectedDate;
    }).length;
  };

  // 利用者名のフォント色を決定
  const getResidentNameColor = (resident: any) => {
    // 入院中の場合は水色（優先）
    if (resident.isAdmitted) {
      return "text-blue-600";
    }
    // その日の看護記録が1件もない場合は赤字
    if (getResidentNursingRecordCountForDate(resident.id) === 0) {
      return "text-red-600";
    }
    // デフォルト
    return "text-gray-900 dark:text-gray-100";
  };

  // 記録内容全文表示用のstate
  const [selectedRecordContent, setSelectedRecordContent] = useState<string>("");
  const [contentDialogOpen, setContentDialogOpen] = useState(false);

  // 削除確認ダイアログ用のstate
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 現在選択されているタブの状態
  const [activeTab, setActiveTab] = useState("nursing-records");

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

  const getNewBlockDescription = (blockId: string): string => {
    if (localNewBlockDescriptions[blockId] !== undefined) {
      return localNewBlockDescriptions[blockId];
    }
    const block = newRecordBlocks.find(b => b.id === blockId);
    return block?.description || '';
  };

  const getNewMedicalBlockDescription = (blockId: string): string => {
    if (localNewMedicalBlockDescriptions[blockId] !== undefined) {
      return localNewMedicalBlockDescriptions[blockId];
    }
    const block = newMedicalRecordBlocks.find(b => b.id === blockId);
    return block?.description || '';
  };

  // 医療記録の新規記録ブロックも利用者でフィルタリング
  const filteredNewMedicalRecordBlocks = newMedicalRecordBlocks.filter(block => 
    selectedResident ? block.residentId === selectedResident.id : false
  );

  const getNewTreatmentBlockDescription = (blockId: string): string => {
    if (localNewTreatmentBlockDescriptions[blockId] !== undefined) {
      return localNewTreatmentBlockDescriptions[blockId];
    }
    const block = newTreatmentBlocks.find(b => b.id === blockId);
    return block?.description || '';
  };

  const getNewTreatmentBlockNotes = (blockId: string): string => {
    if (localNewTreatmentBlockNotes[blockId] !== undefined) {
      return localNewTreatmentBlockNotes[blockId];
    }
    const block = newTreatmentBlocks.find(b => b.id === blockId);
    return block?.notes || '';
  };

  // 処置の新規記録ブロックも利用者でフィルタリング
  const filteredNewTreatmentBlocks = newTreatmentBlocks.filter(block => 
    selectedResident ? block.residentId === selectedResident.id : false
  );

  // 詳細画面表示の条件分岐
  if (showRecordDetail && selectedResident) {
    const currentRecord = selectedRecordForDetail || {
      id: 'new',
      recordDate: new Date().toISOString(),
      description: '',
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">
              {currentRecord.category === "医療記録" ? "医療記録詳細" : 
               currentRecord.category === "処置" ? "処置詳細" : "看護記録詳細"}
            </h1>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident?.roomNumber || "未設定"}: {selectedResident?.name}　　
              <span className="text-sm font-normal">
                {selectedResident?.gender === 'male' ? '男性' : selectedResident?.gender === 'female' ? '女性' : '未設定'} {selectedResident?.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident?.careLevel || '未設定'}
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
                            }
                          }
                        );
                      }
                    }}
                    placeholder="--"
                    className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs">:</span>
                  <InputWithDropdown
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
                            }
                          }
                        );
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
                    value={
                      currentRecord.category === "医療記録" ? "医療記録" :
                      currentRecord.category === "処置" ? "処置" :
                      currentRecord.category === "assessment" ? "看護記録" :
                      currentRecord.category === "intervention" ? "看護記録" :
                      currentRecord.category === "evaluation" ? "看護記録" :
                      currentRecord.category === "observation" ? "看護記録" :
                      "看護記録"
                    }
                    readOnly
                    className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                  />
                </div>
                
                {/* 記録者 */}
                <div>
                  <input
                    type="text"
                    value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                    readOnly
                    className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                  />
                </div>
              </div>

              {/* 記録内容 */}
              <div className="flex-1">
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={(e) => {
                    const originalDescription = selectedRecordForDetail?.description || "";
                    if (e.target.value !== originalDescription) {
                      if (currentRecord.id !== 'new') {
                        updateDetailMutation.mutate(
                          { id: currentRecord.id, field: 'description', value: e.target.value },
                          {
                            onSuccess: () => {
                              setSelectedRecordForDetail((prev: any) => ({
                                ...prev,
                                description: e.target.value
                              }));
                            }
                          }
                        );
                      }
                    }
                  }}
                  className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1 resize-none"
                  placeholder="記録内容を入力..."
                  rows={4}
                  autoComplete="off"
                  spellCheck="false"
                  style={{ imeMode: 'auto' }}
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

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
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
            
            {/* 削除ボタン（新規記録でない場合のみ表示） */}
            {currentRecord.id !== 'new' && (
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </Button>
            )}
          </div>
        </div>

        {/* 削除確認ダイアログ */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>看護記録の削除</DialogTitle>
              <DialogDescription>
                この看護記録を削除してもよろしいですか？<br />
                削除した記録は復元できません。
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (currentRecord.id !== 'new') {
                    deleteMutation.mutate(currentRecord.id);
                  }
                  setDeleteDialogOpen(false);
                }}
                disabled={deleteMutation.isPending}
              >
                削除する
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (view === 'detail' && selectedResident) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">看護記録</h1>
          </div>
          <div className="bg-white rounded-lg p-2 mb-3 shadow-sm">
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
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-slate-800">
              {selectedResident.roomNumber || "未設定"}: {selectedResident.name}　　
              <span className="text-sm font-normal">
                {selectedResident.gender === 'male' ? '男性' : selectedResident.gender === 'female' ? '女性' : '未設定'} {selectedResident.age ? `${selectedResident.age}歳` : '未設定'} {selectedResident.careLevel || '未設定'}
              </span>
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4 pb-20">
          <Tabs defaultValue="nursing-records" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="nursing-records">看護記録</TabsTrigger>
              <TabsTrigger value="medical-records">医療記録</TabsTrigger>
              <TabsTrigger value="treatments">処置</TabsTrigger>
              <TabsTrigger value="attachments">添付</TabsTrigger>
              <TabsTrigger value="treatment-settings">処置設定</TabsTrigger>
            </TabsList>
            <TabsContent value="nursing-records">
              {/* 看護記録一覧テーブル */}
              <div className="space-y-0 border rounded-lg overflow-hidden mt-4">
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
                                
                                setNewRecordBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={format(new Date(block.recordDate), "mm", { locale: ja })}
                              options={minuteOptions}
                              onSave={(value) => {
                                const currentDate = new Date(block.recordDate);
                                currentDate.setMinutes(parseInt(value));
                                const newDateString = currentDate.toISOString();
                                
                                setNewRecordBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* カテゴリ */}
                          <div>
                            <input
                              type="text"
                              value="看護記録"
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                          
                          {/* 記録者 */}
                          <div>
                            <input
                              type="text"
                              value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
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
                              setLocalNewBlockDescriptions(prev => ({
                                ...prev,
                                [block.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              if (e.target.value.trim() && selectedResident) {
                                const submitData = {
                                  residentId: selectedResident.id,
                                  recordDate: new Date(block.recordDate).toISOString(),
                                  category: 'observation',
                                  description: e.target.value,
                                };
                                createMutation.mutate(submitData, {
                                  onSuccess: () => {
                                    setNewRecordBlocks(prev => prev.filter(b => b.id !== block.id));
                                    setLocalNewBlockDescriptions(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                  }
                                });
                              } else {
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

                        {/* アイコンボタン */}
                        <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordForDetail({
                                id: 'new',
                                residentId: selectedResident.id,
                                category: "看護記録",
                                description: block.description,
                                recordDate: block.recordDate
                              });
                              setShowRecordDetail(true);
                            }}
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordContent(block.description);
                              setContentDialogOpen(true);
                            }}
                          >
                            <Search className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 既存の記録 */}
                {sortedNursingRecords
                  .map((record: any, index: number) => {
                    const adjustedIndex = index + filteredNewRecordBlocks.length;
                    const displayDate = localRecordDates[record.id] || record.recordDate;
                    
                    return (
                      <div key={record.id} className={`${(adjustedIndex > 0 || filteredNewRecordBlocks.length > 0) ? 'border-t' : ''} bg-white`}>
                        <div className="p-2">
                          {/* 1行目：時間 + 記録内容 + アクションボタン */}
                          <div className="flex items-center gap-2 h-20">
                            {/* 左側：時間、カテゴリ、記録者を縦並び */}
                            <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                              {/* 時間 */}
                              <div className="flex items-center gap-0.5">
                                <InputWithDropdown
                                  value={format(new Date(displayDate), "HH", { locale: ja })}
                                  options={hourOptions}
                                  onSave={(value) => {
                                    const currentDate = new Date(displayDate);
                                    currentDate.setHours(parseInt(value));
                                    const newDateString = currentDate.toISOString();
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
                                      const currentDate = new Date(displayDate);
                                      currentDate.setMinutes(parseInt(value));
                                      const newDateString = currentDate.toISOString();
                                      setLocalRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                      updateMutation.mutate({
                                        id: record.id,
                                        field: 'recordDate',
                                        value: newDateString
                                      });
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
                                  value="看護記録"
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                              
                              {/* 記録者 */}
                              <div>
                                <input
                                  type="text"
                                  value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                            </div>

                            {/* 記録内容（高さいっぱい） */}
                            <div className="flex-1">
                              <textarea
                                value={record.description}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setSortedNursingRecords(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, description: e.target.value } : r)
                                  );
                                  queryClient.setQueryData(["/api/nursing-records"], (old: any[] | undefined) => {
                                    if (!old) return [];
                                    return old.map(r => r.id === record.id ? { ...r, description: e.target.value } : r);
                                  });
                                }}
                                onBlur={(e) => {
                                  updateMutation.mutate({ id: record.id, field: 'description', value: e.target.value });
                                }}
                                className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                                placeholder="記録を入力..."
                                rows={4}
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                            </div>

                            {/* アイコンボタン */}
                            <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordForDetail(record);
                                  setShowRecordDetail(true);
                                }}
                              >
                                <Info className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordContent(record.description);
                                  setContentDialogOpen(true);
                                }}
                              >
                                <Search className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 記録がない場合のメッセージ */}
              {sortedNursingRecords.length === 0 && filteredNewRecordBlocks.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <p>選択した日付の看護記録がありません</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="medical-records">
              {/* 医療記録一覧テーブル */}
              <div className="space-y-0 border rounded-lg overflow-hidden mt-4">
                {/* 新規医療記録ブロック */}
                {filteredNewMedicalRecordBlocks.map((block, index) => (
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
                                
                                setNewMedicalRecordBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={format(new Date(block.recordDate), "mm", { locale: ja })}
                              options={minuteOptions}
                              onSave={(value) => {
                                const currentDate = new Date(block.recordDate);
                                currentDate.setMinutes(parseInt(value));
                                const newDateString = currentDate.toISOString();
                                
                                setNewMedicalRecordBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* カテゴリ */}
                          <div>
                            <input
                              type="text"
                              value="医療記録"
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                          
                          {/* 記録者 */}
                          <div>
                            <input
                              type="text"
                              value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                        </div>

                        {/* 記録内容（高さいっぱい） */}
                        <div className="flex-1">
                          <textarea
                            value={getNewMedicalBlockDescription(block.id)}
                            onChange={(e) => {
                              setLocalNewMedicalBlockDescriptions(prev => ({
                                ...prev,
                                [block.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              if (e.target.value.trim() && selectedResident) {
                                const submitData = {
                                  residentId: selectedResident.id,
                                  recordDate: new Date(block.recordDate).toISOString(),
                                  category: '医療記録',
                                  description: e.target.value,
                                };
                                createMutation.mutate(submitData, {
                                  onSuccess: () => {
                                    setNewMedicalRecordBlocks(prev => prev.filter(b => b.id !== block.id));
                                    setLocalNewMedicalBlockDescriptions(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                  }
                                });
                              } else {
                                setLocalNewMedicalBlockDescriptions(prev => {
                                  const newState = { ...prev };
                                  delete newState[block.id];
                                  return newState;
                                });
                              }
                            }}
                            placeholder="医療記録内容を入力してください"
                            className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                            rows={4}
                            data-block-id={block.id}
                          />
                        </div>

                        {/* アイコンボタン */}
                        <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordForDetail({
                                id: 'new',
                                residentId: selectedResident.id,
                                category: "医療記録",
                                description: block.description,
                                recordDate: block.recordDate
                              });
                              setShowRecordDetail(true);
                            }}
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordContent(block.description);
                              setContentDialogOpen(true);
                            }}
                          >
                            <Search className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 既存の医療記録 */}
                {sortedMedicalRecords
                  .map((record: any, index: number) => {
                    const adjustedIndex = index + filteredNewMedicalRecordBlocks.length;
                    const displayDate = localMedicalRecordDates[record.id] || record.recordDate;
                    
                    return (
                      <div key={record.id} className={`${(adjustedIndex > 0 || filteredNewMedicalRecordBlocks.length > 0) ? 'border-t' : ''} bg-white`}>
                        <div className="p-2">
                          {/* 1行目：時間 + 記録内容 + アクションボタン */}
                          <div className="flex items-center gap-2 h-20">
                            {/* 左側：時間、カテゴリ、記録者を縦並び */}
                            <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                              {/* 時間 */}
                              <div className="flex items-center gap-0.5">
                                <InputWithDropdown
                                  value={format(new Date(displayDate), "HH", { locale: ja })}
                                  options={hourOptions}
                                  onSave={(value) => {
                                    const currentDate = new Date(displayDate);
                                    currentDate.setHours(parseInt(value));
                                    const newDateString = currentDate.toISOString();
                                    setLocalMedicalRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                    updateMedicalMutation.mutate({
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
                                      const currentDate = new Date(displayDate);
                                      currentDate.setMinutes(parseInt(value));
                                      const newDateString = currentDate.toISOString();
                                      setLocalMedicalRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                      updateMedicalMutation.mutate({
                                        id: record.id,
                                        field: 'recordDate',
                                        value: newDateString
                                      });
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
                                  value="医療記録"
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                              
                              {/* 記録者 */}
                              <div>
                                <input
                                  type="text"
                                  value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                            </div>

                            {/* 記録内容（高さいっぱい） */}
                            <div className="flex-1">
                              <textarea
                                value={record.description}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setSortedMedicalRecords(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, description: e.target.value } : r)
                                  );
                                  queryClient.setQueryData(["/api/nursing-records"], (old: any[] | undefined) => {
                                    if (!old) return [];
                                    return old.map(r => r.id === record.id ? { ...r, description: e.target.value } : r);
                                  });
                                }}
                                onBlur={(e) => {
                                  updateMedicalMutation.mutate({ id: record.id, field: 'description', value: e.target.value });
                                }}
                                className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                                placeholder="医療記録を入力..."
                                rows={4}
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                            </div>

                            {/* アイコンボタン */}
                            <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordForDetail(record);
                                  setShowRecordDetail(true);
                                }}
                              >
                                <Info className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordContent(record.description);
                                  setContentDialogOpen(true);
                                }}
                              >
                                <Search className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 記録がない場合のメッセージ */}
              {sortedMedicalRecords.length === 0 && filteredNewMedicalRecordBlocks.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <p>選択した日付の医療記録がありません</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="treatments">
              {/* 処置一覧テーブル */}
              <div className="space-y-0 border rounded-lg overflow-hidden mt-4">
                {/* 新規処置ブロック */}
                {filteredNewTreatmentBlocks.map((block, index) => (
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
                                
                                setNewTreatmentBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={format(new Date(block.recordDate), "mm", { locale: ja })}
                              options={minuteOptions}
                              onSave={(value) => {
                                const currentDate = new Date(block.recordDate);
                                currentDate.setMinutes(parseInt(value));
                                const newDateString = currentDate.toISOString();
                                
                                setNewTreatmentBlocks(prev => 
                                  prev.map(b => 
                                    b.id === block.id 
                                      ? { ...b, recordDate: newDateString }
                                      : b
                                  )
                                );
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* カテゴリ */}
                          <div>
                            <input
                              type="text"
                              value="処置"
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                          
                          {/* 記録者 */}
                          <div>
                            <input
                              type="text"
                              value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                              readOnly
                              className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                            />
                          </div>
                        </div>

                        {/* 記録内容エリア */}
                        <div className="flex-1 flex flex-col gap-1">
                          {/* 処置部位 */}
                          <input
                            type="text"
                            value={getNewTreatmentBlockNotes(block.id)}
                            onChange={(e) => {
                              setLocalNewTreatmentBlockNotes(prev => ({
                                ...prev,
                                [block.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              // 処置部位または処置内容が入力されている場合に保存
                              const description = getNewTreatmentBlockDescription(block.id);
                              if ((e.target.value.trim() || description.trim()) && selectedResident) {
                                const submitData = {
                                  residentId: selectedResident.id,
                                  recordDate: new Date(block.recordDate).toISOString(),
                                  category: '処置',
                                  description: description,
                                  notes: e.target.value,
                                };
                                createMutation.mutate(submitData, {
                                  onSuccess: () => {
                                    setNewTreatmentBlocks(prev => prev.filter(b => b.id !== block.id));
                                    setLocalNewTreatmentBlockDescriptions(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                    setLocalNewTreatmentBlockNotes(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                  }
                                });
                              }
                            }}
                            placeholder="処置部位"
                            className="h-6 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1"
                          />
                          {/* 処置内容 */}
                          <textarea
                            value={getNewTreatmentBlockDescription(block.id)}
                            onChange={(e) => {
                              setLocalNewTreatmentBlockDescriptions(prev => ({
                                ...prev,
                                [block.id]: e.target.value
                              }));
                            }}
                            onBlur={(e) => {
                              // 処置内容または処置部位が入力されている場合に保存
                              const notes = getNewTreatmentBlockNotes(block.id);
                              if ((e.target.value.trim() || notes.trim()) && selectedResident) {
                                const submitData = {
                                  residentId: selectedResident.id,
                                  recordDate: new Date(block.recordDate).toISOString(),
                                  category: '処置',
                                  description: e.target.value,
                                  notes: notes,
                                };
                                createMutation.mutate(submitData, {
                                  onSuccess: () => {
                                    setNewTreatmentBlocks(prev => prev.filter(b => b.id !== block.id));
                                    setLocalNewTreatmentBlockDescriptions(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                    setLocalNewTreatmentBlockNotes(prev => {
                                      const newState = { ...prev };
                                      delete newState[block.id];
                                      return newState;
                                    });
                                  }
                                });
                              } else {
                                setLocalNewTreatmentBlockDescriptions(prev => {
                                  const newState = { ...prev };
                                  delete newState[block.id];
                                  return newState;
                                });
                              }
                            }}
                            placeholder="処置内容を入力してください"
                            className="h-12 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                            rows={2}
                            data-block-id={block.id}
                          />
                        </div>

                        {/* アイコンボタン */}
                        <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordForDetail({
                                id: 'new',
                                residentId: selectedResident.id,
                                category: "処置",
                                description: block.description,
                                recordDate: block.recordDate
                              });
                              setShowRecordDetail(true);
                            }}
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                            onClick={() => {
                              setSelectedRecordContent(block.description);
                              setContentDialogOpen(true);
                            }}
                          >
                            <Search className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 既存の処置 */}
                {sortedTreatments
                  .map((record: any, index: number) => {
                    const adjustedIndex = index + filteredNewTreatmentBlocks.length;
                    const displayDate = localTreatmentRecordDates[record.id] || record.recordDate;
                    
                    return (
                      <div key={record.id} className={`${(adjustedIndex > 0 || filteredNewTreatmentBlocks.length > 0) ? 'border-t' : ''} bg-white`}>
                        <div className="p-2">
                          {/* 1行目：時間 + 記録内容 + アクションボタン */}
                          <div className="flex items-center gap-2 h-20">
                            {/* 左側：時間、カテゴリ、記録者を縦並び */}
                            <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
                              {/* 時間 */}
                              <div className="flex items-center gap-0.5">
                                <InputWithDropdown
                                  value={format(new Date(displayDate), "HH", { locale: ja })}
                                  options={hourOptions}
                                  onSave={(value) => {
                                    const currentDate = new Date(displayDate);
                                    currentDate.setHours(parseInt(value));
                                    const newDateString = currentDate.toISOString();
                                    setLocalTreatmentRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                    updateTreatmentMutation.mutate({
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
                                      const currentDate = new Date(displayDate);
                                      currentDate.setMinutes(parseInt(value));
                                      const newDateString = currentDate.toISOString();
                                      setLocalTreatmentRecordDates(prev => ({ ...prev, [record.id]: newDateString }));
                                      updateTreatmentMutation.mutate({
                                        id: record.id,
                                        field: 'recordDate',
                                        value: newDateString
                                      });
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
                                  value="処置"
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                              
                              {/* 記録者 */}
                              <div>
                                <input
                                  type="text"
                                  value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                            </div>

                            {/* 記録内容エリア */}
                            <div className="flex-1 flex flex-col gap-1">
                              {/* 処置部位 */}
                              <input
                                type="text"
                                value={record.notes || ""}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setSortedTreatments(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, notes: e.target.value } : r)
                                  );
                                  queryClient.setQueryData(["/api/nursing-records"], (old: any[] | undefined) => {
                                    if (!old) return [];
                                    return old.map(r => r.id === record.id ? { ...r, notes: e.target.value } : r);
                                  });
                                }}
                                onBlur={(e) => {
                                  updateTreatmentMutation.mutate({ id: record.id, field: 'notes', value: e.target.value });
                                }}
                                placeholder="処置部位"
                                className="h-6 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1"
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                              {/* 処置内容 */}
                              <textarea
                                value={record.description}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setSortedTreatments(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, description: e.target.value } : r)
                                  );
                                  queryClient.setQueryData(["/api/nursing-records"], (old: any[] | undefined) => {
                                    if (!old) return [];
                                    return old.map(r => r.id === record.id ? { ...r, description: e.target.value } : r);
                                  });
                                }}
                                onBlur={(e) => {
                                  updateTreatmentMutation.mutate({ id: record.id, field: 'description', value: e.target.value });
                                }}
                                className="h-12 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                                placeholder="処置内容を入力..."
                                rows={2}
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                            </div>

                            {/* アイコンボタン */}
                            <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:bg-green-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordForDetail(record);
                                  setShowRecordDetail(true);
                                }}
                              >
                                <Info className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:bg-blue-50 p-1 h-6 w-6"
                                onClick={() => {
                                  setSelectedRecordContent(record.description);
                                  setContentDialogOpen(true);
                                }}
                              >
                                <Search className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 記録がない場合のメッセージ */}
              {sortedTreatments.length === 0 && filteredNewTreatmentBlocks.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <p>選択した日付の処置がありません</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="attachments">
              <div className="space-y-4 mt-4">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    <Paperclip className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p>この利用者の添付ファイルはありません</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {attachments.map((attachment: any) => {
                      const isImageFile = (fileName: string, mimeType: string) => {
                        // mimeTypeでの判定
                        if (mimeType && mimeType.startsWith('image/')) return true;
                        
                        // 拡張子での判定（フォールバック）
                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
                        return imageExtensions.includes(extension);
                      };

                      const getFileIcon = (mimeType: string) => {
                        if (mimeType.startsWith('image/')) return Image;
                        if (mimeType === 'application/pdf') return FileText;
                        return File;
                      };

                      const formatFileSize = (bytes: number) => {
                        if (bytes === 0) return '0 Bytes';
                        const k = 1024;
                        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                      };

                      const isImage = isImageFile(attachment.fileName, attachment.mimeType);
                      const FileIcon = getFileIcon(attachment.mimeType);

                      return (
                        <div key={attachment.id} className="bg-white border rounded-lg overflow-hidden">
                          {/* 画像ファイルの場合は直接表示 */}
                          {isImage ? (
                            <div className="space-y-3">
                              <div className="aspect-video bg-slate-100 flex items-center justify-center">
                                <img
                                  src={`/uploads/${attachment.filePath}`}
                                  alt={attachment.fileName}
                                  className="max-w-full max-h-full object-contain rounded"
                                  style={{ maxHeight: '300px' }}
                                />
                              </div>
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-900 truncate">
                                      {attachment.fileName}
                                    </div>
                                    <div className="text-sm text-slate-500 space-y-1">
                                      <div>{formatFileSize(attachment.fileSize)}</div>
                                      {attachment.description && (
                                        <div className="text-slate-600">{attachment.description}</div>
                                      )}
                                      <div className="text-xs text-slate-400">
                                        {format(new Date(attachment.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(`/uploads/${attachment.filePath}`, '_blank')}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* 画像以外のファイルは従来通りの表示 */
                            <div className="flex items-center gap-3 p-3 hover:bg-slate-50">
                              <div className="flex-shrink-0">
                                <FileIcon className="w-8 h-8 text-slate-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {attachment.fileName}
                                </div>
                                <div className="text-sm text-slate-500 space-y-1">
                                  <div>{formatFileSize(attachment.fileSize)}</div>
                                  {attachment.description && (
                                    <div className="text-slate-600">{attachment.description}</div>
                                  )}
                                  <div className="text-xs text-slate-400">
                                    {format(new Date(attachment.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="treatment-settings">
              <div className="text-center py-8 text-slate-600">
                <p>処置設定は今後開発予定です。</p>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                const params = new URLSearchParams();
                params.set('date', selectedDate);
                params.set('floor', selectedFloor);
                setLocation(`/nursing-records-list?${params.toString()}`);
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
            {/* 現在のタブに応じて適切な追加ボタンを表示 */}
            {activeTab === "nursing-records" && (
              <Button
                onClick={addNewRecordBlock}
                className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
                title="看護記録を追加"
              >
                <Plus className="w-6 h-6" />
              </Button>
            )}
            {activeTab === "medical-records" && (
              <Button
                onClick={addNewMedicalRecordBlock}
                className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
                title="医療記録を追加"
              >
                <Plus className="w-6 h-6" />
              </Button>
            )}
            {activeTab === "treatments" && (
              <Button
                onClick={addNewTreatmentBlock}
                className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
                title="処置を追加"
              >
                <Plus className="w-6 h-6" />
              </Button>
            )}
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 h-16 flex items-center px-4">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', selectedDate);
              params.set('floor', selectedFloor);
              setLocation(`/?${params.toString()}`);
            }}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">利用者一覧　看護用</h1>
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
                className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

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
                  <CardContent className="p-1 sm:p-2">
                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* 居室番号 */}
                      <div className="text-center w-[40px] sm:w-[50px] flex-shrink-0">
                        <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                          {resident.roomNumber || "未設定"}
                        </div>
                      </div>
                      
                      {/* 利用者名 */}
                      <div className="flex-1 min-w-0 w-0">
                        <div className={`font-semibold text-sm sm:text-base truncate ${getResidentNameColor(resident)}`}>{resident.name}</div>
                      </div>

                      <div className="flex-auto" />
                      
                      {/* 記録ボタン */}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex items-center gap-0.5 px-1.5 sm:px-3 text-xs sm:text-sm flex-shrink-0"
                        onClick={() => {
                          setSelectedResident(resident);
                          setView('detail');
                          form.setValue('residentId', resident.id);
                        }}
                      >
                        <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">看護記録</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
