import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
    mutationFn: (data: InsertMedicationRecord) => {
      console.log('Creating medication record:', data);
      return apiRequest("/api/medication-records", "POST", data);
    },
    onSuccess: (_, variables) => {
      console.log('Create successful for:', variables);
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
      queryClient.refetchQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
    },
    onError: (error, variables) => {
      console.error('Create failed:', error, variables);
    }
  });

  // 記録更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertMedicationRecord> }) => {
      console.log('Updating medication record:', id, data);
      return apiRequest(`/api/medication-records/${id}`, "PUT", data);
    },
    onSuccess: (_, variables) => {
      console.log('Update successful for:', variables);
      // より包括的にクエリを無効化
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      // 現在のフィルタ条件のクエリも無効化
      queryClient.invalidateQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
      // 他の可能なフィルタ組み合わせも無効化
      queryClient.invalidateQueries({ 
        queryKey: ["/api/medication-records", selectedDate] 
      });
      // 少し遅延してから強制リフェッチ（データベースの更新を待つ）
      setTimeout(() => {
        queryClient.refetchQueries({ 
          queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
        });
      }, 100);
    },
    onError: (error, variables) => {
      console.error('Update failed:', error, variables);
    }
  });

  // 記録削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      console.log('Sending DELETE request for record:', id);
      return apiRequest(`/api/medication-records/${id}`, "DELETE");
    },
    onSuccess: (_, variables) => {
      console.log('Delete successful for record:', variables);
      // 現在のクエリを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      // 特定のクエリも無効化
      queryClient.invalidateQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
      // 強制的にリフェッチ
      queryClient.refetchQueries({ 
        queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] 
      });
    },
    onError: (error, variables) => {
      console.error('Delete failed for record:', variables, error);
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
      
      // 現在の表示レコードから既存の値を取得
      const currentRecord = displayMedicationRecords.find(r => r.id === recordId);
      
      const newRecord: InsertMedicationRecord = {
        residentId: field === 'residentId' ? value : (currentRecord?.residentId || residentId),
        recordDate: new Date(selectedDate),
        timing: field === 'timing' ? value : (currentRecord?.timing || selectedTiming),
        type: field === 'type' ? value : (currentRecord?.type || "服薬"),
        confirmer1: field === 'confirmer1' ? value : (currentRecord?.confirmer1 || ""),
        confirmer2: field === 'confirmer2' ? value : (currentRecord?.confirmer2 || ""),
        notes: field === 'notes' ? value : (currentRecord?.notes || ""),
        result: field === 'result' ? value : (currentRecord?.result || ""),
        createdBy: (user as any).claims?.sub || "unknown"
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
    console.log('Deleting record:', recordId);
    
    // 一時的なIDの場合は削除確認なしで即座に削除
    if (recordId.startsWith('temp-')) {
      console.log('Removing temp record from display');
      // 複数のクエリを無効化して確実に更新
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] });
      queryClient.refetchQueries({ queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor] });
      return;
    }
    
    // 実際のレコードの場合は削除確認を表示
    if (window.confirm('この記録を削除しますか？')) {
      console.log('User confirmed deletion, proceeding with delete');
      deleteMutation.mutate(recordId);
    } else {
      console.log('User cancelled deletion');
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

      {/* 利用者一覧（服薬記録用） */}
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-red-200 p-4 text-center rounded-lg">
            <p className="text-red-600 text-lg mb-2">エラーが発生しました</p>
            <p className="text-sm text-red-500">{error.message}</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-600">服薬記録を読み込み中...</p>
          </div>
        ) : !error && displayMedicationRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            該当する利用者がいません
          </div>
        ) : !error ? (
          displayMedicationRecords
            .sort((a: MedicationRecordWithResident, b: MedicationRecordWithResident) => {
              const roomA = parseInt(a.roomNumber || "0");
              const roomB = parseInt(b.roomNumber || "0");
              return roomA - roomB;
            })
            .map((record: MedicationRecordWithResident) => (
            <Card key={record.id} className="bg-white shadow-sm">
              <CardContent className="p-4 space-y-4">
                {/* 1行目：居室番号と利用者名 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">居室番号</label>
                    <div className="p-2 border border-gray-300 rounded-md bg-gray-50 text-center font-bold text-lg">
                      {record.roomNumber}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">利用者名</label>
                    <Select
                      value={record.residentId}
                      onValueChange={(value) => {
                        console.log('Resident changed for record', record.id, 'to:', value);
                        handleFieldUpdate(record.id, "residentId", value);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          <span>
                            {residents?.find(r => r.id === record.residentId)?.name || record.residentName}
                          </span>
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
                </div>

                {/* 2行目：服薬タイミングと種類 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">服薬タイミング</label>
                    <Select
                      value={record.timing}
                      onValueChange={(value) => {
                        console.log('Timing changed for record', record.id, 'to:', value);
                        handleFieldUpdate(record.id, "timing", value);
                      }}
                    >
                      <SelectTrigger className="h-10">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">種類</label>
                    <Select
                      value={record.type}
                      onValueChange={(value) => {
                        console.log('Type changed for record', record.id, 'to:', value);
                        handleFieldUpdate(record.id, "type", value);
                      }}
                    >
                      <SelectTrigger className="h-10">
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
                </div>

                {/* 3行目：確認者1と確認者2 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">確認者1</label>
                    <Button
                      variant="outline"
                      className="h-10 w-full text-sm text-gray-500 hover:bg-gray-100 justify-start"
                      onClick={() => handleConfirmerClick(record.id, "confirmer1")}
                      data-testid={`button-confirmer1-${record.id}`}
                    >
                      {record.confirmer1 || "タップして記入"}
                    </Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">確認者2</label>
                    <Button
                      variant="outline"
                      className="h-10 w-full text-sm text-gray-500 hover:bg-gray-100 justify-start"
                      onClick={() => handleConfirmerClick(record.id, "confirmer2")}
                      data-testid={`button-confirmer2-${record.id}`}
                    >
                      {record.confirmer2 || "タップして記入"}
                    </Button>
                  </div>
                </div>

                {/* 4行目：記録欄 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">記録</label>
                  <Textarea
                    value={localNotes[record.id] !== undefined ? localNotes[record.id] : (record.notes || "")}
                    onChange={(e) => {
                      setLocalNotes(prev => ({
                        ...prev,
                        [record.id]: e.target.value
                      }));
                    }}
                    onBlur={(e) => {
                      handleFieldUpdate(record.id, "notes", e.target.value);
                      setLocalNotes(prev => {
                        const newState = { ...prev };
                        delete newState[record.id];
                        return newState;
                      });
                    }}
                    className="h-16 text-sm resize-none w-full"
                    placeholder="記録を入力..."
                    data-testid={`textarea-notes-${record.id}`}
                  />
                </div>

                {/* 5行目：結果と削除 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">結果</label>
                    <Select
                      value={record.result || "空欄"}
                      onValueChange={(value) => {
                        console.log('Result changed for record', record.id, 'to:', value);
                        const actualValue = value === "空欄" ? "" : value;
                        handleFieldUpdate(record.id, "result", actualValue);
                      }}
                    >
                      <SelectTrigger className="h-10">
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
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="h-10 w-full text-red-600 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        console.log('Delete button clicked for record:', record.id);
                        handleDelete(record.id);
                      }}
                      data-testid={`button-delete-${record.id}`}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      削除
                    </Button>
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