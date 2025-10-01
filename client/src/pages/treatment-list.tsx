import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getEnvironmentPath } from "@/lib/queryClient";
import {
  Plus,
  Calendar,
  Building,
  User,
  Trash2,
  ArrowLeft,
  Info,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { matchFloor } from "@/lib/floorFilterUtils";
import type { MasterSetting } from "@shared/schema";

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
function InputWithDropdown({
  id,
  value,
  options,
  onSave,
  placeholder,
  className,
  disabled = false,
  enableAutoFocus = true,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  enableAutoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    // selectedValueはoption.valueなので、対応するlabelを取得
    const selectedOption = options.find(opt => opt.value === selectedValue);
    const displayValue = selectedOption ? selectedOption.label : selectedValue;
    setInputValue(displayValue);
    onSave(displayValue);
    setOpen(false);

    if (enableAutoFocus) {
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
            onClick={(e) => {
              e.preventDefault();
              setOpen(!open);
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

export default function TreatmentList() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(
    new URLSearchParams(window.location.search).get("date")
      ? new Date(new URLSearchParams(window.location.search).get("date")!)
      : new Date()
  );
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedFloor, setSelectedFloor] = useState<string>(
    urlParams.get("floor") || "all"
  );

  const { data: residents = [] } = useQuery<any[]>({
    queryKey: ["/api/residents"],
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  const { data: allNursingRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/nursing-records"],
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // 職員認証を優先して使用
  const { data: staffUser } = useQuery({
    queryKey: ["/api/auth/staff-user"],
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });
  const { data: replitUser } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: !staffUser, // 職員ログイン時は無効化
    refetchOnMount: true, // ページ遷移時に必ず最新データを取得
    staleTime: 0, // キャッシュを常に古い扱いにして確実に再取得
  });

  // 職員ログインを優先、フォールバックでReplitユーザーを使用
  const currentUser = staffUser || replitUser;

  // マスタ設定から階数データを取得
  const { data: floorMasterSettings = [] } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", "floor"],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=floor`, "GET");
    },
  });

  // ローカル状態でフィルタされた処置記録を管理
  const [localTreatmentRecords, setLocalTreatmentRecords] = useState<any[]>([]);

  // 新規追加用のミューテーション
  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      return apiRequest("/api/nursing-records", "POST", newRecord);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    },
    onError: () => {
      toast({ title: "エラー", description: "処置記録の追加に失敗しました", variant: "destructive" });
    },
  });

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

      // 現在のデータを保存
      const previousData = queryClient.getQueryData(['/api/nursing-records']);

      // 楽観的更新
      queryClient.setQueryData(['/api/nursing-records'], (old: any[]) => {
        if (!old) return old;
        return old.map((record: any) => 
          record.id === newData.id 
            ? { ...record, [newData.field]: newData.value }
            : record
        );
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    },
    onError: (err, newData, context) => {
      // エラー時は前の状態に復元
      if (context?.previousData) {
        queryClient.setQueryData(['/api/nursing-records'], context.previousData);
      }
      toast({ title: "エラー", description: "更新に失敗しました", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/nursing-records/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    },
    onError: () => {
      toast({ title: "エラー", description: "記録の削除に失敗しました。", variant: "destructive" });
    },
  });

  const filteredTreatmentRecords = useMemo(() => {
    const filteredResidents = residents.filter((resident: any) => {
      // 階数フィルター
      if (selectedFloor !== "全階") {
        return matchFloor(resident.floor, selectedFloor);
      }
      return true;
    });
    const residentIds = new Set(filteredResidents.map(r => r.id));

    const filtered = allNursingRecords
      .filter(record => record.category === '処置')
      .filter(record => format(new Date(record.recordDate), "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd"))
      .filter(record => !record.residentId || residentIds.has(record.residentId)) // residentIdがnullの記録も含める
      .sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    
    return filtered;
  }, [residents, allNursingRecords, selectedDate, selectedFloor]);

  // ローカル状態を filteredTreatmentRecords で同期
  useEffect(() => {
    setLocalTreatmentRecords(filteredTreatmentRecords);
  }, [filteredTreatmentRecords]);

  // 新規処置追加機能
  const addNewTreatment = () => {
    // 現在時刻を取得
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 分のオプション（0, 15, 30, 45）から最も近いものを選択
    const minuteOptions = [0, 15, 30, 45];
    const closestMinute = minuteOptions.reduce((prev, curr) => 
      Math.abs(curr - currentMinute) < Math.abs(prev - currentMinute) ? curr : prev
    );
    
    // 選択された日付と現在時刻を組み合わせ
    const recordDate = new Date(selectedDate);
    recordDate.setHours(currentHour, closestMinute, 0, 0);

    // 職員ログイン時はstaffManagement.id、Replitユーザーの場合はuserIdを使用
    let nurseId = "unknown";
    if (staffUser) {
      // 職員ログイン時：staffManagement.idを使用
      nurseId = (staffUser as any)?.id || "unknown";
    } else if (replitUser) {
      // Replitユーザー：userIdを使用
      nurseId = (replitUser as any)?.id || "unknown";
    }

    const newRecord = {
      // residentIdは一旦省略（未選択状態）
      nurseId: nurseId,
      category: "処置",
      recordDate: recordDate.toISOString(),
      description: "", // 処置内容は空文字列（プレースホルダー表示のため）
      notes: "", // 処置部位は空文字列（プレースホルダー表示のため）
    };

    addMutation.mutate(newRecord);
  };

  const hourOptions = useMemo(() => 
    Array.from({ length: 24 }, (_, i) => ({ value: i.toString(), label: i.toString().padStart(2, "0") })),
    []
  );
  
  const minuteOptions = useMemo(() => 
    [0, 15, 30, 45].map((m) => ({ value: m.toString(), label: m.toString().padStart(2, "0") })),
    []
  );
  
  // 利用者オプション
  const residentOptions = useMemo(() => [
    ...residents.map((r: any) => ({ value: r.id, label: r.name }))
  ], [residents]);

  const floorOptions = useMemo(() => {
    return floorMasterSettings
      .filter(setting => setting.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((setting) => {
        const optionValue = setting.value === "全階" ? "all" : setting.value;
        return { value: optionValue, label: setting.label };
      });
  }, [floorMasterSettings]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                const params = new URLSearchParams();
                params.set('date', format(selectedDate, 'yyyy-MM-dd'));
                params.set('floor', selectedFloor);
                const dashboardPath = getEnvironmentPath("/");
                const targetUrl = `${dashboardPath}?${params.toString()}`;
                setLocation(targetUrl);
              }} 
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">処置一覧</h1>
          </div>
        </div>
      </div>
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {floorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 py-4 pb-24">
        <div className="space-y-0 border rounded-lg overflow-hidden">
          {localTreatmentRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の記録がありません</p>
            </div>
          ) : (
            localTreatmentRecords.map((record: any, index: number) => {
                const resident = residents.find(r => r.id === record.residentId);
                return (
                    <div key={record.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
                        <div className="p-2">
                          <div className="flex flex-col gap-2">
                            {/* 上段: 左から居室番号、利用者名、時分、入力者 */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                {/* 居室番号 */}
                                <div className="h-6 w-12 px-2 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                                  {resident?.roomNumber || ''}
                                </div>
                                {/* 利用者名 */}
                                <InputWithDropdown
                                  value={resident?.name || (record.residentId ? residents.find(r => r.id === record.residentId)?.name || "" : "")}
                                  options={residentOptions}
                                  onSave={(value) => {
                                    // 選択された利用者名から利用者IDを取得
                                    const selectedResident = residents.find(r => r.name === value);
                                    const residentId = selectedResident ? selectedResident.id : null;
                                    
                                    // ローカル状態を楽観的更新
                                    setLocalTreatmentRecords(prev => 
                                      prev.map(r => r.id === record.id ? { ...r, residentId: residentId } : r)
                                    );
                                    
                                    updateMutation.mutate({ id: record.id, field: 'residentId', value: residentId });
                                  }}
                                  placeholder="利用者選択"
                                  className="h-6 w-24 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                  enableAutoFocus={false}
                                />
                                {/* 時分 */}
                                <div className="flex items-center gap-0.5">
                                  <InputWithDropdown
                                    value={format(new Date(record.recordDate), "HH", { locale: ja })}
                                    options={hourOptions}
                                    onSave={(value) => {
                                      const newDate = new Date(record.recordDate);
                                      newDate.setHours(parseInt(value));
                                      updateMutation.mutate({ id: record.id, field: 'recordDate', value: newDate.toISOString() });
                                    }}
                                    placeholder="--"
                                    className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                  <span className="text-xs">:</span>
                                  <InputWithDropdown
                                    value={format(new Date(record.recordDate), "mm", { locale: ja })}
                                    options={minuteOptions}
                                    onSave={(value) => {
                                      const newDate = new Date(record.recordDate);
                                      newDate.setMinutes(parseInt(value));
                                      updateMutation.mutate({ id: record.id, field: 'recordDate', value: newDate.toISOString() });
                                    }}
                                    placeholder="--"
                                    className="w-7 h-6 px-1 text-xs text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                </div>
                                {/* 入力者 */}
                                <input
                                  type="text"
                                  value={record.staffName || "不明"}
                                  readOnly
                                  className="h-6 w-16 px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                              <div className="flex items-center">
                                {/* 削除ボタン */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 p-1 h-6 w-6">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>記録削除の確認</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        この処置記録を削除してもよろしいですか？
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteMutation.mutate(record.id)}>
                                        削除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            
                            {/* 中段: 処置部位 */}
                            <div>
                              <input
                                type="text"
                                value={record.notes || ""}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setLocalTreatmentRecords(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, notes: e.target.value } : r)
                                  );
                                }}
                                onBlur={(e) => {
                                  updateMutation.mutate({ id: record.id, field: 'notes', value: e.target.value || "" });
                                }}
                                placeholder="処置部位"
                                className="h-6 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-2"
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                            </div>
                            
                            {/* 下段: 処置内容 */}
                            <div>
                              <textarea
                                value={record.description || ""}
                                onChange={(e) => {
                                  // 楽観的更新（ローカル状態も更新）
                                  setLocalTreatmentRecords(prev => 
                                    prev.map(r => r.id === record.id ? { ...r, description: e.target.value } : r)
                                  );
                                }}
                                onBlur={(e) => {
                                  updateMutation.mutate({ id: record.id, field: 'description', value: e.target.value || "" });
                                }}
                                placeholder="処置内容を入力してください"
                                className="h-12 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1 resize-none"
                                rows={2}
                                autoComplete="off"
                                spellCheck="false"
                                style={{ imeMode: 'auto' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                )
            })
          )}
        </div>
      </main>
      
      {/* フッダー */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-end max-w-4xl mx-auto">
          <Button
            onClick={addNewTreatment}
            className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-full p-0"
            title="処置を追加"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}