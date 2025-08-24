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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
    setInputValue(selectedValue);
    onSave(selectedValue);
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
  const [selectedDate, setSelectedDate] = useState<string>(
    new URLSearchParams(window.location.search).get("date") || format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedFloor, setSelectedFloor] = useState<string>(
    new URLSearchParams(window.location.search).get("floor") || "all",
  );

  const { data: residents = [] } = useQuery<any[]>({
    queryKey: ["/api/residents"],
  });

  const { data: allNursingRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/nursing-records"],
  });

  const { data: currentUser } = useQuery({ queryKey: ["/api/auth/user"] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const updateData = { [field]: value };
      if (field === 'recordDate') {
        updateData[field] = new Date(value);
      }
      return apiRequest(`/api/nursing-records/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
    },
    onError: () => {
      toast({ title: "エラー", description: "更新に失敗しました", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/nursing-records/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
      toast({ description: "記録を削除しました" });
    },
    onError: () => {
      toast({ title: "エラー", description: "記録の削除に失敗しました。", variant: "destructive" });
    },
  });

  const filteredTreatmentRecords = useMemo(() => {
    const filteredResidents = residents.filter(r => {
        if (selectedFloor === '全階') return true;
        const residentFloor = r.floor?.toString();
        if (!residentFloor) return false;
        
        const selectedFloorNumber = selectedFloor.replace("階", "");
        
        if (residentFloor === selectedFloor) return true;
        if (residentFloor === selectedFloorNumber) return true;
        if (residentFloor.replace('F', '') === selectedFloorNumber) return true;
        
        return false;
    });
    const residentIds = new Set(filteredResidents.map(r => r.id));

    return allNursingRecords
      .filter(record => record.category === '処置')
      .filter(record => format(new Date(record.recordDate), "yyyy-MM-dd") === selectedDate)
      .filter(record => residentIds.has(record.residentId))
      .sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
  }, [residents, allNursingRecords, selectedDate, selectedFloor]);

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: i.toString(), label: i.toString().padStart(2, "0") }));
  const minuteOptions = [0, 15, 30, 45].map((m) => ({ value: m.toString(), label: m.toString().padStart(2, "0") }));
  const floorOptions = [
    { value: "全階", label: "全階" },
    ...Array.from(new Set(residents.map(r => r.floor?.toString().replace('F', '')).filter(Boolean)))
      .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
      .map(floor => ({ value: `${floor}階`, label: `${floor}階` }))
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">処置一覧</h1>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg p-2 my-4 mx-2 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <InputWithDropdown
                value={selectedFloor}
                options={floorOptions}
                onSave={(value) => setSelectedFloor(value)}
                placeholder="フロア選択"
                className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                enableAutoFocus={false}
              />
            </div>
          </div>
        </div>
      <main className="max-w-4xl mx-auto px-4 py-4 pb-20">
        <div className="space-y-0 border rounded-lg overflow-hidden">
          {filteredTreatmentRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p>選択した条件の記録がありません</p>
            </div>
          ) : (
            filteredTreatmentRecords.map((record: any, index: number) => {
                const resident = residents.find(r => r.id === record.residentId);
                return (
                    <div key={record.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
                        <div className="p-2">
                          <div className="flex items-center gap-2 h-20">
                            <div className="w-16 flex-shrink-0 flex flex-col justify-center space-y-1">
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
                              <div>
                                <div className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                                    {resident?.name || ''}
                                </div>
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={(currentUser as any)?.firstName || (currentUser as any)?.email?.split('@')[0] || "不明"}
                                  readOnly
                                  className="h-6 w-full px-1 text-xs text-center border border-slate-300 rounded bg-slate-100 text-slate-600"
                                />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                              <input
                                type="text"
                                value={record.notes || ""}
                                onBlur={(e) => updateMutation.mutate({ id: record.id, field: 'notes', value: e.target.value })}
                                placeholder="処置部位"
                                className="h-6 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1"
                              />
                              <textarea
                                value={record.description}
                                onBlur={(e) => updateMutation.mutate({ id: record.id, field: 'description', value: e.target.value })}
                                placeholder="処置内容を入力..."
                                className="h-12 text-xs w-full border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 px-1 py-1 resize-none"
                                rows={2}
                              />
                            </div>
                            <div className="flex flex-col justify-center gap-1 flex-shrink-0">
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
                        </div>
                      </div>
                )
            })
          )}
        </div>
      </main>
    </div>
  );
}