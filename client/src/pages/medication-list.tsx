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
  User
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
  { value: "", label: "空欄" },
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

  // 利用者データ取得
  const { data: residents } = useQuery<Resident[]>({
    queryKey: ["/api/residents"]
  });

  // 服薬記録データ取得
  const { data: medicationRecords = [], isLoading } = useQuery<MedicationRecordWithResident[]>({
    queryKey: ["/api/medication-records", selectedDate, selectedTiming, selectedFloor]
  });

  // 新規記録作成ミューテーション
  const createMutation = useMutation({
    mutationFn: (data: InsertMedicationRecord) => 
      apiRequest("/api/medication-records", { 
        method: "POST", 
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 記録更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertMedicationRecord> }) =>
      apiRequest(`/api/medication-records/${id}`, { 
        method: "PUT", 
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 記録削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/medication-records/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
    }
  });

  // 新規カード追加
  const handleAddRecord = () => {
    if (!residents || residents.length === 0) return;

    const firstResident = residents[0];
    createMutation.mutate({
      residentId: firstResident.id,
      recordDate: new Date(selectedDate),
      timing: selectedTiming,
      type: "服薬",
      confirmer1: "",
      confirmer2: "",
      notes: "",
      result: ""
    } as InsertMedicationRecord);
  };

  // フィールド更新
  const handleFieldUpdate = (recordId: string, field: keyof InsertMedicationRecord, value: any) => {
    updateMutation.mutate({
      id: recordId,
      data: { [field]: value }
    });
  };

  // 確認者設定
  const handleConfirmerClick = (recordId: string, confirmerField: "confirmer1" | "confirmer2") => {
    if (!user) return;
    const staffName = (user as any).firstName && (user as any).lastName 
      ? `${(user as any).lastName} ${(user as any).firstName}`
      : (user as any).email || "スタッフ";
    
    handleFieldUpdate(recordId, confirmerField, staffName);
  };

  // 削除
  const handleDelete = (recordId: string) => {
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
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">服薬一覧</h1>
            </div>
            <Button variant="ghost" size="sm">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="bg-white shadow-sm rounded-lg mx-4 mt-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          {/* 日付 */}
          <div className="text-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-sky-100 rounded-lg border-0 text-center font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* タイミング */}
          <div className="text-center">
            <Select value={selectedTiming} onValueChange={setSelectedTiming}>
              <SelectTrigger className="bg-sky-100 border-0 font-medium text-slate-700">
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

          {/* 階 */}
          <div className="text-center">
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="bg-sky-100 border-0 font-medium text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {floorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-600">服薬記録を読み込み中...</p>
          </div>
        ) : (medicationRecords as MedicationRecordWithResident[]).length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-slate-600 text-lg mb-2">服薬記録がありません</p>
              <p className="text-sm text-slate-500 mb-4">「+」ボタンから記録を追加してください</p>
            </CardContent>
          </Card>
        ) : (
          (medicationRecords as MedicationRecordWithResident[]).map((record: MedicationRecordWithResident) => (
            <Card key={record.id} className="bg-white">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* 1行目: 部屋番号、利用者名、タイミング */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-800">
                        {record.roomNumber || "未設定"}
                      </div>
                    </div>
                    <div className="text-center">
                      <Select
                        value={record.residentId}
                        onValueChange={(value) => handleFieldUpdate(record.id, "residentId", value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue>
                            {record.residentName || "利用者選択"}
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
                    <div className="text-center">
                      <Select
                        value={record.timing}
                        onValueChange={(value) => handleFieldUpdate(record.id, "timing", value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
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
                  </div>

                  {/* 2行目: 確認者1、確認者2 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-8 text-sm text-slate-600"
                      onClick={() => handleConfirmerClick(record.id, "confirmer1")}
                      data-testid={`button-confirmer1-${record.id}`}
                    >
                      {record.confirmer1 || "確認者1"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 text-sm text-slate-600"
                      onClick={() => handleConfirmerClick(record.id, "confirmer2")}
                      data-testid={`button-confirmer2-${record.id}`}
                    >
                      {record.confirmer2 || "確認者2"}
                    </Button>
                  </div>

                  {/* 3行目: 記録、種類、結果、削除 */}
                  <div className="grid grid-cols-4 gap-2">
                    <Textarea
                      placeholder="記録"
                      value={record.notes || ""}
                      onChange={(e) => handleFieldUpdate(record.id, "notes", e.target.value)}
                      className="h-8 text-sm resize-none"
                      rows={1}
                      data-testid={`textarea-notes-${record.id}`}
                    />
                    <Select
                      value={record.type}
                      onValueChange={(value) => handleFieldUpdate(record.id, "type", value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
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
                    <Select
                      value={record.result || ""}
                      onValueChange={(value) => handleFieldUpdate(record.id, "result", value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
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
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(record.id)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
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