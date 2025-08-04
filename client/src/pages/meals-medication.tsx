import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, UserIcon, ClockIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { MealsMedication, InsertMealsMedication } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface MealsMedicationWithResident extends MealsMedication {
  residentName: string;
  roomNumber: string;
  floor: string;
}

export default function MealsMedicationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

  const { data: mealsMedicationData = [] } = useQuery({
    queryKey: ['/api/meals-medication', format(selectedDate, 'yyyy-MM-dd'), selectedMealTime, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: format(selectedDate, 'yyyy-MM-dd'),
        mealTime: selectedMealTime,
        floor: selectedFloor,
      });
      return apiRequest(`/api/meals-medication?${params}`) as Promise<MealsMedicationWithResident[]>;
    }
  }) as { data: MealsMedicationWithResident[] };

  const createMutation = useMutation({
    mutationFn: (data: InsertMealsMedication) => apiRequest('/api/meals-medication', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
      toast({
        title: "記録が保存されました",
        description: "食事/服薬記録が正常に作成されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "記録の保存に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertMealsMedication }) => 
      apiRequest(`/api/meals-medication/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals-medication'] });
      toast({
        title: "記録が更新されました",
        description: "食事/服薬記録が正常に更新されました。",
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
  const mainAmountOptions = ["none", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  const sideAmountOptions = ["none", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "-", "欠", "拒"];
  const waterIntakeOptions = ["none", "300", "250", "200", "150", "100", "50", "0"];
  const supplementOptions = ["none", "ラコール", "エンシュア", "メイバランス", "カロリーメイト", "プロテイン"];

  const handleSaveRecord = (residentId: string, field: string, value: string, notes?: string) => {
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealTime === selectedMealTime
    );

    const recordData: InsertMealsMedication = {
      residentId,
      recordDate: format(selectedDate, 'yyyy-MM-dd'),
      mealTime: selectedMealTime,
      mainAmount: field === 'mainAmount' ? value : existingRecord?.mainAmount || '',
      sideAmount: field === 'sideAmount' ? value : existingRecord?.sideAmount || '',
      waterIntake: field === 'waterIntake' ? value : existingRecord?.waterIntake || '',
      supplement: field === 'supplement' ? value : existingRecord?.supplement || '',
      notes: field === 'notes' ? value : existingRecord?.notes || '',
      staffName: (user as any)?.firstName || 'スタッフ',
    };

    if (existingRecord) {
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      createMutation.mutate(recordData);
    }
  };

  const handleStaffStamp = (residentId: string) => {
    const existingRecord = mealsMedicationData.find(
      (record: MealsMedicationWithResident) => 
        record.residentId === residentId && record.mealTime === selectedMealTime
    );

    const recordData: InsertMealsMedication = {
      residentId,
      recordDate: format(selectedDate, 'yyyy-MM-dd'),
      mealTime: selectedMealTime,
      mainAmount: existingRecord?.mainAmount || '',
      sideAmount: existingRecord?.sideAmount || '',
      waterIntake: existingRecord?.waterIntake || '',
      supplement: existingRecord?.supplement || '',
      notes: existingRecord?.notes || '',
      staffName: (user as any)?.firstName || 'スタッフ',
    };

    if (existingRecord) {
      updateMutation.mutate({ id: existingRecord.id, data: recordData });
    } else {
      createMutation.mutate(recordData);
    }
  };

  const filteredResidents = residents.filter((resident: any) => {
    if (selectedFloor === 'all') return true;
    return resident.floor === selectedFloor || resident.floor?.toString() === selectedFloor;
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <h1 className="text-2xl font-bold">食事/服薬記録</h1>
        
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
                {selectedDate ? format(selectedDate, "MM/dd", { locale: ja }) : "日付を選択"}
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
                locale={ja}
                data-testid="calendar-date-picker"
              />
            </PopoverContent>
          </Popover>

          {/* 食事時間選択 */}
          <Select value={selectedMealTime} onValueChange={setSelectedMealTime}>
            <SelectTrigger className="w-20" data-testid="select-meal-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mealTimes.map((time) => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* フロア選択 */}
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-20" data-testid="select-floor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全体</SelectItem>
              {floors.slice(1).map((floor) => (
                <SelectItem key={floor} value={floor}>{floor}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 利用者カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResidents.map((resident: any) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealTime === selectedMealTime
          );

          return (
            <Card key={resident.id} className="w-full" data-testid={`card-resident-${resident.id}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{resident.roomNumber} {resident.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStaffStamp(resident.id)}
                    className="ml-2"
                    data-testid={`button-staff-stamp-${resident.id}`}
                  >
                    <UserIcon className="h-4 w-4 mr-1" />
                    {existingRecord?.staffName || 'スタンプ'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 主食摂取量 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">主</Label>
                  <Select 
                    value={existingRecord?.mainAmount || 'none'} 
                    onValueChange={(value) => handleSaveRecord(resident.id, 'mainAmount', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger data-testid={`select-main-amount-${resident.id}`}>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {mainAmountOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "none" ? "選択" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 副食摂取量 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">副</Label>
                  <Select 
                    value={existingRecord?.sideAmount || 'none'} 
                    onValueChange={(value) => handleSaveRecord(resident.id, 'sideAmount', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger data-testid={`select-side-amount-${resident.id}`}>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {sideAmountOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "none" ? "選択" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 水分摂取量 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">水分</Label>
                  <Select 
                    value={existingRecord?.waterIntake || 'none'} 
                    onValueChange={(value) => handleSaveRecord(resident.id, 'waterIntake', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger data-testid={`select-water-intake-${resident.id}`}>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {waterIntakeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "none" ? "選択" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 栄養補助食品 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">その他</Label>
                  <Select 
                    value={existingRecord?.supplement || 'none'} 
                    onValueChange={(value) => handleSaveRecord(resident.id, 'supplement', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger data-testid={`select-supplement-${resident.id}`}>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplementOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "none" ? "選択" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 記録（フリー入力） */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">記録</Label>
                  <Textarea
                    value={existingRecord?.notes || ''}
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
                    {format(new Date(existingRecord.updatedAt || existingRecord.createdAt), 'HH:mm')}
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