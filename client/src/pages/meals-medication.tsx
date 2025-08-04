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
      return apiRequest('/api/meals-medication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/meals-medication/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
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
  const intakeOptions = ["none", "full", "partial", "minimal"];
  const mealCategories = [
    { key: "mainDish", label: "主食" },
    { key: "sideDish", label: "主菜" }, 
    { key: "subDish", label: "副菜" },
    { key: "water", label: "水分" }
  ];

  const handleSaveRecord = (residentId: string, field: string, value: string, notes?: string) => {
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
    } else if (['mainDish', 'sideDish', 'subDish', 'water'].includes(field)) {
      if (!mealData.categories) mealData.categories = {};
      mealData.categories[field] = value;
    }

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
    if (!record?.notes) return "none";
    
    try {
      if (record.notes.startsWith('{')) {
        const mealData = JSON.parse(record.notes);
        return mealData.categories?.[category] || "none";
      }
    } catch (e) {
      // JSONパースに失敗した場合は"none"を返す
    }
    return "none";
  };

  // フリーテキストを取得するヘルパー関数
  const getFreeText = (record: MealsMedicationWithResident | undefined): string => {
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredResidents.map((resident: any) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealType === selectedMealTime
          );

          return (
            <Card key={resident.id} className="relative">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserIcon className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{resident.roomNumber} {resident.name}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {resident.floor}F
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 食事カテゴリ（主食/主菜/副菜/水分） */}
                {mealCategories.map((category) => (
                  <div key={category.key} className="space-y-2">
                    <Label className="text-sm font-medium">{category.label}</Label>
                    <Select
                      value={getMealCategoryValue(existingRecord, category.key)}
                      onValueChange={(value) => handleSaveRecord(resident.id, category.key, value)}
                    >
                      <SelectTrigger data-testid={`select-${category.key}-${resident.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intakeOptions.map((option, index) => (
                          <SelectItem key={`${category.key}-${option}-${index}`} value={option}>
                            {option === "none" ? "選択" : 
                             option === "full" ? "完食" :
                             option === "partial" ? "半分" :
                             option === "minimal" ? "少量" : "摂取なし"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                {/* 記録（フリー入力） */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">記録</Label>
                  <Textarea
                    value={getFreeText(existingRecord)}
                    onChange={(e) => handleSaveRecord(resident.id, 'notes', e.target.value)}
                    placeholder="記録を入力..."
                    className="min-h-[60px]"
                    data-testid={`textarea-notes-${resident.id}`}
                  />
                </div>

                {/* 最終更新時間 */}
                {existingRecord && (
                  <div className="text-xs text-muted-foreground flex items-center mt-2">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {existingRecord.administeredTime ? 
                      format(new Date(existingRecord.administeredTime), 'HH:mm') : 
                      '記録なし'
                    }
                  </div>
                )}
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
    </div>
  );
}