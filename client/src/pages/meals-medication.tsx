import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft as ArrowLeftIcon, Calendar as CalendarIcon, User as UserIcon, Clock as ClockIcon, Building as BuildingIcon } from "lucide-react";
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
    // Handle both number and string formats
    const residentFloor = resident.floor?.toString();
    const selectedFloorValue = selectedFloor.replace('F', ''); // Remove 'F' from "3F" -> "3"
    
    return residentFloor === selectedFloor || 
           residentFloor === selectedFloorValue || 
           `${residentFloor}F` === selectedFloor;
  });

  return (
    <div className="space-y-4 p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-4">
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

      {/* 日付とフロア選択 */}
      <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
        <div className="flex gap-2 sm:gap-4 items-center justify-center">
          {/* 日付選択 */}
          <div className="flex items-center space-x-1">
            <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              data-testid="input-date"
            />
          </div>

          {/* 食事時間選択 */}
          <div className="flex items-center space-x-1">
            <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <Select value={selectedMealTime} onValueChange={setSelectedMealTime}>
              <SelectTrigger className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm" data-testid="select-meal-time">
                <SelectValue placeholder="時間" />
              </SelectTrigger>
              <SelectContent>
                {mealTimes.map((time) => (
                  <SelectItem key={time} value={time} data-testid={`option-meal-time-${time}`}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* フロア選択 */}
          <div className="flex items-center space-x-1">
            <BuildingIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm" data-testid="select-floor">
                <SelectValue placeholder="フロア選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-floor-all">全階</SelectItem>
                <SelectItem value="1F" data-testid="option-floor-1F">1階</SelectItem>
                <SelectItem value="2F" data-testid="option-floor-2F">2階</SelectItem>
                <SelectItem value="3F" data-testid="option-floor-3F">3階</SelectItem>
                <SelectItem value="4F" data-testid="option-floor-4F">4階</SelectItem>
                <SelectItem value="5F" data-testid="option-floor-5F">5階</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 利用者一覧テーブル（極限にコンパクト） */}
      <div className="space-y-0 border rounded-lg overflow-hidden">
        {filteredResidents.map((resident: any, index: number) => {
          const existingRecord = mealsMedicationData.find(
            (record: MealsMedicationWithResident) => 
              record.residentId === resident.id && record.mealType === selectedMealTime
          );

          return (
            <div key={resident.id} className={`${index > 0 ? 'border-t' : ''} bg-white`}>
              <div className="p-2 space-y-2">
                {/* 1行目：部屋番号 + 主/副/水分 + 記入者 */}
                <div className="flex items-center gap-2">
                  {/* 部屋番号 */}
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="font-bold text-lg">{resident.roomNumber}</div>
                  </div>
                  
                  {/* 主 */}
                  <div className="w-16 flex-shrink-0">
                    <div className="text-center text-xs mb-1">主</div>
                    <Select
                      value={getMealCategoryValue(existingRecord, 'main')}
                      onValueChange={(value) => handleSaveRecord(resident.id, 'main', value)}
                    >
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainOptions.filter(option => option !== "").map((option, idx) => (
                          <SelectItem key={idx} value={option}>
                            {option === "empty" ? "" : option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 副 */}
                  <div className="w-16 flex-shrink-0">
                    <div className="text-center text-xs mb-1">副</div>
                    <Select
                      value={getMealCategoryValue(existingRecord, 'side')}
                      onValueChange={(value) => handleSaveRecord(resident.id, 'side', value)}
                    >
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {sideOptions.filter(option => option !== "").map((option, idx) => (
                          <SelectItem key={idx} value={option}>
                            {option === "empty" ? "" : option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 水分 */}
                  <div className="w-20 flex-shrink-0">
                    <div className="text-center text-xs mb-1">水分</div>
                    <Select
                      value={getMealCategoryValue(existingRecord, 'water')}
                      onValueChange={(value) => handleSaveRecord(resident.id, 'water', value)}
                    >
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {waterOptions.filter(option => option !== "").map((option, idx) => (
                          <SelectItem key={idx} value={option}>
                            {option === "empty" ? "" : option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 記入者 */}
                  <div className="flex-1 ml-2">
                    <div className="text-center text-xs mb-1">記入者</div>
                    <div className="h-6 flex items-center justify-center px-1 bg-gray-50 rounded border text-xs">
                      {(() => {
                        const staffInfo = getStaffInfo(existingRecord);
                        return staffInfo.name || '';
                      })()}
                    </div>
                  </div>
                </div>

                {/* 2行目：利用者名 + その他 */}
                <div className="flex items-center gap-2">
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="text-xs font-medium">{resident.name}</div>
                  </div>
                  
                  {/* その他 */}
                  <div className="flex-1">
                    <div className="text-left text-xs mb-1">その他</div>
                    <Select
                      value={getMealCategoryValue(existingRecord, 'supplement')}
                      onValueChange={(value) => handleSaveRecord(resident.id, 'supplement', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-full">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[200px]">
                        {otherOptions.filter(option => option !== "").map((option, idx) => (
                          <SelectItem key={idx} value={option}>
                            {option === "empty" ? "" : option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3行目：記録欄 */}
                <div className="flex items-center gap-2">
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="text-xs text-gray-500">記録</div>
                  </div>
                  
                  {/* 記録欄 */}
                  <div className="flex-1">
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
                      className="h-12 text-xs resize-none w-full leading-tight"
                      placeholder="記録を入力..."
                      data-testid={`textarea-notes-${resident.id}`}
                    />
                  </div>
                </div>
              </div>
            </div>
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