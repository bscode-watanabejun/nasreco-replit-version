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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Edit, ClipboardList, ArrowLeft, Save, Check, X, MoreHorizontal, Info, Search, Building } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const nursingRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
  interventions: z.string().optional(),
  outcomes: z.string().optional(),
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
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState<string>(urlParams.get('date') || format(new Date(), "yyyy-MM-dd"));
  const [selectedFloor, setSelectedFloor] = useState<string>(urlParams.get('floor') || "all");
  const residentIdFromUrl = urlParams.get('residentId');

  // 記録詳細画面用のstate
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);

  // 詳細画面の編集用状態
  const [editedDate, setEditedDate] = useState(new Date());
  const [editedDescription, setEditedDescription] = useState("");
  const [editedInterventions, setEditedInterventions] = useState("");
  const [editedOutcomes, setEditedOutcomes] = useState("");

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

  const form = useForm<NursingRecordForm>({
    resolver: zodResolver(nursingRecordSchema),
    defaultValues: {
      residentId: selectedResident?.id || "",
      recordDate: new Date(selectedDate + "T" + new Date().toTimeString().slice(0, 8)).toISOString().slice(0, 16),
      category: "看護記録",
      description: "",
      interventions: "",
      outcomes: "",
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
      interventions: "",
      outcomes: "",
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
      setEditedInterventions(selectedRecordForDetail.interventions || "");
      setEditedOutcomes(selectedRecordForDetail.outcomes || "");
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
        interventions: "",
        outcomes: "",
      });
      setOpen(false);
      toast({
        title: "成功",
        description: "看護記録を保存しました",
      });
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
      if (process.env.NODE_ENV === 'development') {
        console.log("看護記録を更新中:", { id, field, value, updateData });
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    },
    onError: (error) => {
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
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
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
      interventions: "",
      outcomes: "",
    };
    setNewRecordBlocks(prev => [...prev, newBlock]);
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
        residentId: selectedResident.id,
        recordDate: updatedBlock.recordDate,
        category: "看護記録",
        description: updatedBlock.description,
        interventions: updatedBlock.interventions || "",
        outcomes: updatedBlock.outcomes || "",
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log("看護記録を保存中:", submitData);
      }
      createMutation.mutate(submitData);
      // 保存後にブロックを削除
      setNewRecordBlocks(prev => prev.filter(block => block.id !== blockId));
    }
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

  // 初期表示と日付・利用者変更時のみソート処理を実行
  useEffect(() => {
    const filtered = (nursingRecords as any[])
      .filter((record: any) => {
        if (!selectedResident || record.residentId !== selectedResident.id) {
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

  // 新規データ追加時のみ記録を追加（ソートは行わない）
  useEffect(() => {
    if (!selectedResident) return;
    
    const newRecords = (nursingRecords as any[])
      .filter((record: any) => {
        if (record.residentId !== selectedResident.id) return false;
        const recordDate = format(new Date(record.recordDate), "yyyy-MM-dd");
        return recordDate === selectedDate;
      })
      .filter((record: any) => 
        !sortedNursingRecords.some(existing => existing.id === record.id)
      );
    
    if (newRecords.length > 0) {
      setSortedNursingRecords(prev => [...prev, ...newRecords]);
    }
  }, [nursingRecords, selectedResident?.id, selectedDate, sortedNursingRecords]);

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

  // 詳細画面表示の条件分岐
  if (showRecordDetail && selectedResident) {
    const currentRecord = selectedRecordForDetail || {
      id: 'new',
      recordDate: new Date().toISOString(),
      description: '',
      interventions: '',
      outcomes: ''
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-800">看護記録詳細</h1>
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

          {/* 介入内容カード */}
          <div className="bg-white border border-slate-200 p-3 shadow-sm mb-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2">介入内容</h3>
            <textarea
              value={editedInterventions}
              onChange={(e) => setEditedInterventions(e.target.value)}
              onBlur={(e) => {
                const originalInterventions = selectedRecordForDetail?.interventions || "";
                if (e.target.value !== originalInterventions) {
                  if (currentRecord.id !== 'new') {
                    updateDetailMutation.mutate(
                      { id: currentRecord.id, field: 'interventions', value: e.target.value },
                      {
                        onSuccess: () => {
                          setSelectedRecordForDetail((prev: any) => ({
                            ...prev,
                            interventions: e.target.value
                          }));
                        }
                      }
                    );
                  }
                }
              }}
              className="h-20 text-sm w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1 resize-none"
              placeholder="介入内容を入力..."
              rows={4}
              autoComplete="off"
              spellCheck="false"
              style={{ imeMode: 'auto' }}
            />
          </div>

          {/* 結果カード */}
          <div className="bg-white border border-slate-200 p-3 shadow-sm mb-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2">結果・アウトカム</h3>
            <textarea
              value={editedOutcomes}
              onChange={(e) => setEditedOutcomes(e.target.value)}
              onBlur={(e) => {
                const originalOutcomes = selectedRecordForDetail?.outcomes || "";
                if (e.target.value !== originalOutcomes) {
                  if (currentRecord.id !== 'new') {
                    updateDetailMutation.mutate(
                      { id: currentRecord.id, field: 'outcomes', value: e.target.value },
                      {
                        onSuccess: () => {
                          setSelectedRecordForDetail((prev: any) => ({
                            ...prev,
                            outcomes: e.target.value
                          }));
                        }
                      }
                    );
                  }
                }
              }}
              className="h-20 text-sm w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1 resize-none"
              placeholder="結果・アウトカムを入力..."
              rows={4}
              autoComplete="off"
              spellCheck="false"
              style={{ imeMode: 'auto' }}
            />
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-center max-w-lg mx-auto">
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
        <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
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
          {/* 看護記録一覧テーブル */}
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
                        value={block.description}
                        onChange={(e) => handleNewRecordEdit(block.id, 'description', e.target.value)}
                        placeholder="記録内容を入力してください"
                        className="h-20 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
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
                          setSelectedRecordForDetail({
                            id: 'new',
                            residentId: selectedResident.id,
                            category: "看護記録",
                            description: block.description,
                            interventions: block.interventions || "",
                            outcomes: block.outcomes || "",
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
            )))}

            {/* 既存の記録 */}
            {sortedNursingRecords
              .map((record: any, index: number) => {
                const adjustedIndex = index + filteredNewRecordBlocks.length;
                
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
                              value={format(new Date(record.recordDate), "HH", { locale: ja })}
                              options={hourOptions}
                              onSave={(value) => {
                                const currentDate = new Date(record.recordDate);
                                currentDate.setHours(parseInt(value));
                                updateMutation.mutate({
                                  id: record.id,
                                  field: 'recordDate',
                                  value: currentDate.toISOString()
                                });
                              }}
                              placeholder="--"
                              className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs">:</span>
                            <InputWithDropdown
                              value={format(new Date(record.recordDate), "mm", { locale: ja })}
                              options={minuteOptions}
                              onSave={(value) => {
                                const currentDate = new Date(record.recordDate);
                                currentDate.setMinutes(parseInt(value));
                                updateMutation.mutate({
                                  id: record.id,
                                  field: 'recordDate',
                                  value: currentDate.toISOString()
                                });
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
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/nursing-records-list')}
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
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
