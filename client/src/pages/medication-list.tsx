import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { 
  Calendar,
  ChevronLeft,
  Plus,
  Trash2,
  Menu,
  User,
  ArrowLeft as ArrowLeftIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Building as BuildingIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import type { MedicationRecord, InsertMedicationRecord, Resident } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

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

const floorOptions = [
  { value: "all", label: "全階" },
  { value: "1F", label: "1階" },
  { value: "2F", label: "2階" },
  { value: "3F", label: "3階" },
  { value: "4F", label: "4階" }
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

export default function MedicationList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // フィルタ状態
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTiming, setSelectedTiming] = useState("朝後");
  const [selectedFloor, setSelectedFloor] = useState("all");
  
  // ローカル状態管理（編集中のメモ）
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // 利用者データ取得
  const { data: residents } = useQuery<Resident[]>({
    queryKey: ["/api/residents"]
  });

  // 服薬記録データ取得
  const { data: medicationRecords = [], isLoading, error } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams({
        recordDate: selectedDate,
        timing: selectedTiming,
        floor: selectedFloor
      });
      const response = await fetch(`/api/medication-records?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Medication records fetched:', data);
      return data;
    }
  });

  // 本日を含む過去日かどうかを判定
  const isCurrentOrPastDate = () => {
    const today = new Date();
    const selected = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    return selected <= today;
  };

  // 表示用の服薬記録データを作成（本日を含む過去日の場合は全利用者分のレコードを作成）
  const displayMedicationRecords = (() => {
    if (!isCurrentOrPastDate() || !residents) {
      return medicationRecords;
    }

    // フィルタ条件に合致する利用者を取得
    const filteredResidents = residents.filter((resident: any) => {
      if (selectedFloor === 'all') return true;
      const residentFloor = resident.floor?.toString();
      const selectedFloorValue = selectedFloor.replace('F', '');
      return residentFloor === selectedFloor || 
             residentFloor === selectedFloorValue || 
             `${residentFloor}F` === selectedFloor;
    });

    // 既存の記録がある利用者のIDを取得
    const existingRecordsByResident = medicationRecords.reduce((acc, record) => {
      acc[record.residentId] = record;
      return acc;
    }, {} as Record<string, MedicationRecordWithResident>);

    // 全利用者分のレコードを作成
    const allRecords = filteredResidents.map((resident: any) => {
      const existingRecord = existingRecordsByResident[resident.id];
      
      if (existingRecord) {
        // 既存の記録がある場合はそれを使用
        return {
          ...existingRecord,
          residentName: resident.name,
          roomNumber: resident.roomNumber,
          floor: resident.floor
        };
      } else {
        // 既存の記録がない場合は空のレコードを作成
        return {
          id: `temp-${resident.id}`,
          residentId: resident.id,
          residentName: resident.name,
          roomNumber: resident.roomNumber,
          floor: resident.floor,
          recordDate: selectedDate,
          timing: selectedTiming,
          type: "服薬",
          confirmer1: "",
          confirmer2: "",
          notes: "",
          result: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: ""
        } as MedicationRecordWithResident;
      }
    });

    return allRecords;
  })();

  // 新規記録作成ミューテーション
  const createMutation = useMutation({
    mutationFn: (data: InsertMedicationRecord) => 
      apiRequest("/api/medication-records", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 記録更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertMedicationRecord> }) =>
      apiRequest(`/api/medication-records/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 記録削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/medication-records/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 新規カード追加 - 未記録の利用者を探して追加
  const handleAddRecord = () => {
    if (!residents || residents.length === 0 || !user) return;

    // フィルタ条件に合致する利用者を取得
    const filteredResidents = residents.filter((resident: any) => {
      if (selectedFloor === 'all') return true;
      const residentFloor = resident.floor?.toString();
      const selectedFloorValue = selectedFloor.replace('F', '');
      return residentFloor === selectedFloor || 
             residentFloor === selectedFloorValue || 
             `${residentFloor}F` === selectedFloor;
    });
    
    // 既に記録がある利用者のIDを取得
    const recordedResidentIds = medicationRecords.map(r => r.residentId);
    
    // 未記録の利用者を探す
    const unrecordedResident = filteredResidents.find((resident: any) => 
      !recordedResidentIds.includes(resident.id)
    );
    
    // 未記録の利用者がいる場合は新しいレコードを作成、いない場合は最初の利用者で作成
    const targetResident = unrecordedResident || filteredResidents[0];
    
    if (targetResident) {
      createMutation.mutate({
        residentId: targetResident.id,
        recordDate: new Date(selectedDate),
        timing: selectedTiming,
        type: "服薬",
        confirmer1: "",
        confirmer2: "",
        notes: "",
        result: "",
        createdBy: (user as any).claims?.sub || "unknown"
      } as InsertMedicationRecord);
    }
  };

  // フィールド更新
  const handleFieldUpdate = (recordId: string, field: keyof InsertMedicationRecord, value: any) => {
    console.log(`Updating field ${field} for record ${recordId} with value:`, value);
    
    // 一時的なIDの場合は新規作成
    if (recordId.startsWith('temp-')) {
      const residentId = recordId.replace('temp-', '');
      const newRecord: InsertMedicationRecord = {
        residentId,
        recordDate: new Date(selectedDate),
        timing: selectedTiming,
        type: "服薬",
        confirmer1: "",
        confirmer2: "",
        notes: "",
        result: "",
        createdBy: (user as any).claims?.sub || "unknown",
        [field]: value
      };
      console.log('Creating new record:', newRecord);
      createMutation.mutate(newRecord);
    } else {
      const updateData = { [field]: value };
      console.log('Updating existing record:', updateData);
      updateMutation.mutate({
        id: recordId,
        data: updateData
      });
    }
  };

  // 確認者設定
  const handleConfirmerClick = (recordId: string, confirmerField: "confirmer1" | "confirmer2") => {
    if (!user) return;
    const staffName = (user as any).firstName && (user as any).lastName 
      ? `${(user as any).lastName} ${(user as any).firstName}`
      : (user as any).email || "スタッフ";
    
    console.log(`Setting ${confirmerField} for record ${recordId} to:`, staffName);
    handleFieldUpdate(recordId, confirmerField, staffName);
  };

  // 削除
  const handleDelete = (recordId: string) => {
    // 一時的なIDの場合は削除処理をスキップ
    if (recordId.startsWith('temp-')) {
      return;
    }
    deleteMutation.mutate(recordId);
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const date = parse(dateString, "yyyy-MM-dd", new Date());
      return format(date, "M月d日", { locale: ja });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/meals-medication">
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">服薬一覧</h1>
      </div>

      {/* 日付とフロア選択 */}
      <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
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
            <Select value={selectedTiming} onValueChange={setSelectedTiming}>
              <SelectTrigger className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm" data-testid="select-timing">
                <SelectValue placeholder="タイミング" />
              </SelectTrigger>
              <SelectContent>
                {timingOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} data-testid={`option-timing-${option.value}`}>
                    {option.label}
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

      {/* 記録一覧 */}
      <div className="px-4 py-4 space-y-3">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="text-center py-8">
              <p className="text-red-600 text-lg mb-2">エラーが発生しました</p>
              <p className="text-sm text-red-500">{error.message}</p>
            </CardContent>
          </Card>
        )}
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-600">服薬記録を読み込み中...</p>
          </div>
        ) : !error && displayMedicationRecords.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-slate-600 text-lg mb-2">服薬記録がありません</p>
              <p className="text-sm text-slate-500 mb-4">「+」ボタンから記録を追加してください</p>
            </CardContent>
          </Card>
        ) : !error ? (
          // 表示用のレコードを利用（本日を含む過去日の場合は全利用者分）
          displayMedicationRecords
            .sort((a: MedicationRecordWithResident, b: MedicationRecordWithResident) => {
              const roomA = parseInt(a.roomNumber || "0");
              const roomB = parseInt(b.roomNumber || "0");
              return roomA - roomB;
            })
            .map((record: MedicationRecordWithResident) => (
            <Card key={record.id} className="bg-white">
              <CardContent className="p-3">
                <div className="space-y-2">
                  {/* 1行目: 部屋番号、利用者名、タイミング、確認者1、確認者2 */}
                  <div className="grid gap-1 sm:gap-2" style={{gridTemplateColumns: "50px minmax(80px, 1fr) 60px 60px 60px"}}>
                    <div className="bg-gray-100 rounded px-2 py-1 text-center">
                      <div className="text-sm font-bold text-slate-800">
                        {record.roomNumber || "106"}
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Select
                        value={record.residentId}
                        onValueChange={(value) => {
                          console.log('Resident changed for record', record.id, 'to:', value);
                          handleFieldUpdate(record.id, "residentId", value);
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 w-full">
                          <SelectValue>
                            <span className="truncate">{record.residentName || "御子柴 啓"}</span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {residents?.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Select
                        value={record.timing}
                        onValueChange={(value) => {
                          console.log('Timing changed for record', record.id, 'to:', value);
                          handleFieldUpdate(record.id, "timing", value);
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Button
                        variant="ghost"
                        className="h-6 text-xs p-0 text-gray-500 hover:bg-transparent w-full truncate"
                        onClick={() => handleConfirmerClick(record.id, "confirmer1")}
                        data-testid={`button-confirmer1-${record.id}`}
                      >
                        <span className="truncate text-xs">{record.confirmer1 || "確認1"}</span>
                      </Button>
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Button
                        variant="ghost"
                        className="h-6 text-xs p-0 text-gray-500 hover:bg-transparent w-full truncate"
                        onClick={() => handleConfirmerClick(record.id, "confirmer2")}
                        data-testid={`button-confirmer2-${record.id}`}
                      >
                        <span className="truncate text-xs">{record.confirmer2 || "確認2"}</span>
                      </Button>
                    </div>
                  </div>

                  {/* 2行目: 記録、種類、結果、削除 */}
                  <div className="grid gap-1 sm:gap-2" style={{gridTemplateColumns: "1fr 60px 60px 40px"}}>
                    <div className="bg-gray-100 rounded px-2 py-1">
                      <Textarea
                        placeholder="記録"
                        value={localNotes[record.id] !== undefined ? localNotes[record.id] : (record.notes || "")}
                        onChange={(e) => {
                          // ローカル状態で管理
                          setLocalNotes(prev => ({
                            ...prev,
                            [record.id]: e.target.value
                          }));
                        }}
                        onBlur={(e) => {
                          handleFieldUpdate(record.id, "notes", e.target.value);
                          // ローカル状態をクリア
                          setLocalNotes(prev => {
                            const newState = { ...prev };
                            delete newState[record.id];
                            return newState;
                          });
                        }}
                        className="h-6 text-xs resize-none border-0 bg-transparent p-0"
                        rows={1}
                        data-testid={`textarea-notes-${record.id}`}
                      />
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Select
                        value={record.type}
                        onValueChange={(value) => {
                          console.log('Type changed for record', record.id, 'to:', value);
                          handleFieldUpdate(record.id, "type", value);
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-gray-100 rounded px-1 py-1 text-center">
                      <Select
                        value={record.result || "空欄"}
                        onValueChange={(value) => {
                          console.log('Result changed for record', record.id, 'to:', value);
                          const actualValue = value === "空欄" ? "" : value;
                          handleFieldUpdate(record.id, "result", actualValue);
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 w-full">
                          <SelectValue placeholder="結果" />
                        </SelectTrigger>
                        <SelectContent>
                          {resultOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-red-100 rounded px-1 py-1 text-center">
                      <Button
                        variant="ghost"
                        className="h-6 w-full text-xs p-0 text-red-600 hover:bg-transparent"
                        onClick={() => handleDelete(record.id)}
                        data-testid={`button-delete-${record.id}`}
                        disabled={record.id.startsWith('temp-')}
                      >
                        <Trash2 className="w-2 h-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : null}
      </div>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/meals-medication">
            <Button variant="outline" className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              食事一覧へ
            </Button>
          </Link>
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

      {/* 下部余白 */}
      <div className="h-20"></div>
    </div>
  );
}