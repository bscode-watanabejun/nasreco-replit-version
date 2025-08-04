import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftIcon, CalendarIcon, UserIcon, ClockIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { MealsAndMedication, InsertMealsAndMedication } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

interface MealsMedicationWithResident extends MealsAndMedication {
  residentName: string;
  roomNumber: string;
  floor: string;
}

export default function MealsMedicationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMealTime, setSelectedMealTime] = useState("朝");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // URLパラメータからstate復元
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    const mealTimeParam = params.get('mealTime');
    const floorParam = params.get('floor');

    if (dateParam) {
      setSelectedDate(new Date(dateParam));
    }
    if (mealTimeParam) {
      setSelectedMealTime(mealTimeParam);
    }
    if (floorParam) {
      setSelectedFloor(floorParam);
    }
  }, []);

  // URLパラメータ更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('mealTime', selectedMealTime);
    params.set('floor', selectedFloor);
    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [selectedDate, selectedMealTime, selectedFloor]);

  const { data: mealsMedicationResponse } = useQuery({
    queryKey: ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        floor: selectedFloor,
      });
      const response = await apiRequest(`/api/meals-medication?${params}`);
      return response.json();
    }
  });

  const mealsMedicationData: MealsMedicationWithResident[] = Array.isArray(mealsMedicationResponse) ? mealsMedicationResponse : [];

  const createMutation = useMutation({
    mutationFn: async (data: InsertMealsAndMedication) => {
      return apiRequest('/api/meals-medication', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
      toast({
        title: "成功",
        description: "記録が作成されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "記録の作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertMealsAndMedication }) => {
      return apiRequest(`/api/meals-medication/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
      toast({
        title: "成功",
        description: "記録が更新されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "記録の更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const { data: residents = [] } = useQuery({
    queryKey: ['/api/residents'],
  }) as { data: any[] };

  const mealTimes = ["朝", "10時", "昼", "15時", "夕"];
  const floors = ["all", "1F", "2F", "3F"];
  
  // 主・副の選択肢
  const mainOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  const sideOptions = ["empty", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  
  // 水分の選択肢
  const waterOptions = ["empty", "300", "250", "200", "150", "100", "50", "0"];
  
  // その他の選択肢
  const otherOptions = [
    "empty",
    "ラコール 200ml",
    "エンシュア 200ml", 
    "メイバランス 200ml",
    "ツインラインNF 400ml",
    "エンシュア 250ml",
    "イノラス 187.5ml",
    "ラコールＮＦ半固形剤 300g"
  ];

  const mealCategories = [
    { key: "main", label: "主", options: mainOptions },
    { key: "side", label: "副", options: sideOptions },
    { key: "water", label: "水分", options: waterOptions },
    { key: "supplement", label: "その他", options: otherOptions }
  ];

  const handleSaveRecord = (residentId: string, field: string, value: string, notes?: string) => {
    // 自動で記入者情報を設定
    const staffName = (user as any)?.firstName || 'スタッフ';
    
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealType === selectedMealTime
    );

    // 既存の食事カテゴリデータを解析
    let mealData: any = {};
    try {
      if (existingRecord?.notes && existingRecord.notes.startsWith('{')) {
        mealData = JSON.parse(existingRecord.notes);
      }
    } catch (e) {
      mealData = { freeText: existingRecord?.notes || '' };
    }

    // フィールドを更新
    if (field === 'notes') {
      mealData.freeText = value;
    } else if (['main', 'side', 'water', 'supplement'].includes(field)) {
      if (!mealData.categories) mealData.categories = {};
      mealData.categories[field] = value === "empty" ? "" : value;
    }
    
    // どの項目が更新されても記入者情報を自動設定
    mealData.staffName = staffName;
    mealData.staffTime = new Date().toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const recordData: InsertMealsAndMedication = {
      residentId,
      recordDate: selectedDate,
      type: 'meal',
      mealType: selectedMealTime,
      mealIntake: value || existingRecord?.mealIntake || '',
      medicationName: existingRecord?.medicationName || '',
      dosage: existingRecord?.dosage || '',
      notes: JSON.stringify(mealData),
      administeredTime: new Date(),
    };

    if (existingRecord) {
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      createMutation.mutate(recordData);
    }
  };

  // 既存レコードから食事カテゴリデータを取得するヘルパー関数
  const getMealCategoryValue = (record: MealsMedicationWithResident | undefined, category: string): string => {
    if (!record?.notes) return "empty";
    
    try {
      if (record.notes.startsWith('{')) {
        const mealData = JSON.parse(record.notes);
        const value = mealData.categories?.[category];
        return value === "" || value === undefined ? "empty" : value;
      }
    } catch (e) {
      // JSONパースに失敗した場合は"empty"を返す
    }
    return "empty";
  };

  // スタッフ情報を取得するヘルパー関数
  const getStaffInfo = (record: MealsMedicationWithResident | undefined): { name: string; time: string } => {
    if (!record?.notes) return { name: '', time: '' };
    
    try {
      if (record.notes.startsWith('{')) {
        const mealData = JSON.parse(record.notes);
        return {
          name: mealData.staffName || '',
          time: mealData.staffTime || ''
        };
      }
    } catch (e) {
      // JSONパースに失敗した場合は空文字を返す
    }
    return { name: '', time: '' };
  };

  // フリーテキストを取得するヘルパー関数
  const getFreeText = (record: MealsMedicationWithResident | undefined, residentId: string): string => {
    // ローカル状態があればそれを使用
    if (localNotes[residentId] !== undefined) {
      return localNotes[residentId];
    }
    
    if (!record?.notes) return '';
    
    try {
      if (record.notes.startsWith('{')) {
        const mealData = JSON.parse(record.notes);
        return mealData.freeText || '';
      }
      return record.notes; // 古い形式の場合はそのまま返す
    } catch (e) {
      return record.notes; // JSONパースに失敗した場合は元の値を返す
    }
  };

  const filteredResidents = residents.filter((resident: any) => {
    if (selectedFloor === 'all') return true;
    return resident.floor === selectedFloor || resident.floor?.toString() === selectedFloor;
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">食事/服薬記録</h1>
        </div>
        
        {/* フィルター */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* 日付選択 */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                data-testid="button-date-picker"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "yyyy年MM月dd日", { locale: ja }) : "日付を選択"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }
                }}
                initialFocus
                locale={ja}
              />
            </PopoverContent>
          </Popover>

          {/* 食事時間選択 */}
          <Select value={selectedMealTime} onValueChange={setSelectedMealTime}>
            <SelectTrigger className="w-[120px]" data-testid="select-meal-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mealTimes.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* フロア選択 */}
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-[100px]" data-testid="select-floor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {floors.map((floor) => (
                <SelectItem key={floor} value={floor}>
                  {floor === "all" ? "全て" : floor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 利用者カード一覧 */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredResidents.map((resident: any) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealType === selectedMealTime
          );

          return (
            <Card key={resident.id} className="relative">
              <CardContent className="p-3 space-y-2">
                {/* コンパクトヘッダー（居住者情報） */}
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-4 w-4" />
                  <div className="font-semibold text-sm">{resident.roomNumber} {resident.name}</div>
                  <div className="text-xs text-muted-foreground">{resident.floor}F</div>
                </div>

                {/* 食事カテゴリ（主/副/水分は小さく、その他は大きく） */}
                <div className="grid grid-cols-8 gap-2">
                  {mealCategories.map((category) => (
                    <div key={category.key} className={`space-y-1 min-w-0 ${category.key === 'supplement' ? 'col-span-3' : 'col-span-1'}`}>
                      <Label className="text-xs font-medium">{category.label}</Label>
                      <Select
                        value={getMealCategoryValue(existingRecord, category.key)}
                        onValueChange={(value) => {
                          handleSaveRecord(resident.id, category.key, value);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-full min-w-0" data-testid={`select-${category.key}-${resident.id}`}>
                          <SelectValue placeholder="空欄" className="truncate" />
                        </SelectTrigger>
                        <SelectContent className="w-auto min-w-[200px]">
                          {category.options.filter(option => option !== "").map((option, index) => (
                            <SelectItem key={`${category.key}-${option}-${index}`} value={option}>
                              {option === "empty" ? "空欄" : option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* 記入者表示と記録を横並びに */}
                <div className="grid grid-cols-6 gap-2">
                  {/* 記入者表示 */}
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs font-medium">記入者</Label>
                    <div className="h-7 flex items-center px-2 bg-gray-50 rounded border text-xs">
                      {(() => {
                        const staffInfo = getStaffInfo(existingRecord);
                        return staffInfo.name || '未記入';
                      })()}
                    </div>
                  </div>

                  {/* 記録（フリー入力） */}
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs font-medium">記録</Label>
                    <Textarea
                      value={getFreeText(existingRecord, resident.id)}
                      onChange={(e) => {
                        setLocalNotes(prev => ({
                          ...prev,
                          [resident.id]: e.target.value
                        }));
                      }}
                      onBlur={(e) => {
                        handleSaveRecord(resident.id, 'notes', e.target.value);
                        setLocalNotes(prev => {
                          const newState = { ...prev };
                          delete newState[resident.id];
                          return newState;
                        });
                      }}
                      placeholder="記録を入力..."
                      className="min-h-[40px] text-xs"
                      data-testid={`textarea-notes-${resident.id}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredResidents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          該当する利用者がいません
        </div>
      )}

      {/* 下部ボタン */}
      <div className="flex justify-center gap-4 mt-8 pb-4">
        <Button 
          variant="outline" 
          disabled
          data-testid="button-bulk-register"
        >
          一括登録
        </Button>
        <Button 
          variant="default"
          onClick={() => setLocation('/medication-list')}
          data-testid="button-medication-list"
        >
          服薬一覧へ
        </Button>
      </div>
    </div>
  );
}