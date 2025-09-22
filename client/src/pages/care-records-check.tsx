import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { ArrowLeft, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 記録内容用のIME対応リサイズ可能textareaコンポーネント
function ResizableNotesInput({
  recordId,
  initialValue,
  onLocalChange,
  onSave,
}: {
  recordId: string;
  initialValue: string;
  onLocalChange: (recordId: string, value: string) => void;
  onSave: (recordId: string, value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    // リアルタイムでローカル状態を更新
    onLocalChange(recordId, newValue);
  };

  const handleBlur = () => {
    // カーソルアウト時にAPI更新
    onSave(recordId, value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setValue(newValue);
    onLocalChange(recordId, newValue);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder="記録内容を入力..."
      className="min-h-[32px] text-xs w-full px-2 py-1 text-left border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      rows={1}
    />
  );
}

function InputWithDropdown({
  value,
  options,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSelect = (selectedValue: string) => {
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          type="text"
          value={inputValue}
          readOnly
          onClick={() => setOpen(!open)}
          placeholder={placeholder}
          className={className}
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
  );
}

export default function CareRecordsCheck() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // URLパラメータから日付を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const initialDate = dateParam || format(new Date(), "yyyy-MM-dd");
  
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [recordCategory, setRecordCategory] = useState("all");
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || "all");
  const [selectedResident, setSelectedResident] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editedContent, setEditedContent] = useState<{ [key: string]: string }>({});

  // React Queryの設定（最新データを取得するため）
  const queryOptions = {
    staleTime: 0, // データを常に古いとみなして再取得する
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
    refetchOnMount: true, // コンポーネントマウント時に再取得
  };

  // 利用者データと職員データを取得
  const { data: residents = [] } = useQuery({
    queryKey: ["residents"],
    queryFn: () => apiRequest("/api/residents"),
    ...queryOptions,
  });

  // 職員データを取得
  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-management"],
    queryFn: () => apiRequest("/api/staff-management").catch(() => []),
    ...queryOptions,
  });

  // デバッグ: 職員データの構造を確認(簡潔版)
  if (staffList.length > 0) {
    console.log('職員数:', staffList.length, '最初の職員:', staffList[0]?.staffName || staffList[0]?.name);
  }

  // 各テーブルからデータを取得

  const { data: careRecordsData = [] } = useQuery({
    queryKey: ["care-records"],
    queryFn: () => apiRequest("/api/care-records").catch(() => []),
    ...queryOptions,
  });

  const { data: vitalsData = [] } = useQuery({
    queryKey: ["vital-signs"],
    queryFn: () => apiRequest("/api/vital-signs").catch(() => []),
    ...queryOptions,
  });

  const { data: mealsData = [] } = useQuery({
    queryKey: ["meals-medication"],
    queryFn: () => apiRequest("/api/meals-medication").catch(() => []),
    ...queryOptions,
  });

  const { data: medicationData = [] } = useQuery({
    queryKey: ["medication-records"],
    queryFn: () => apiRequest("/api/medication-records").catch(() => []),
    ...queryOptions,
  });

  // デバッグ: 服薬データを確認
  if (medicationData.length > 0) {
    console.log('服薬データ数:', medicationData.length);
    console.log('最初の服薬データ:', medicationData[0]);
  } else {
    console.log('服薬データなし');
  }

  const { data: excretionData = [] } = useQuery({
    queryKey: ["excretion-records"],
    queryFn: () => apiRequest("/api/excretion-records").catch(() => []),
    ...queryOptions,
  });

  const { data: weightData = [] } = useQuery({
    queryKey: ["weight-records"],
    queryFn: () => apiRequest("/api/weight-records").catch(() => []),
    ...queryOptions,
  });

  const { data: cleaningData = [] } = useQuery({
    queryKey: ["cleaning-linen"],
    queryFn: () => apiRequest("/api/cleaning-linen").catch(() => []),
    ...queryOptions,
  });

  // デバッグ: 清掃リネンデータを確認
  if (cleaningData.length > 0) {
    console.log('清掃リネンデータ数:', cleaningData.length);
    console.log('最初の清掃リネンデータ:', cleaningData[0]);
  } else {
    console.log('清掃リネンデータなし');
  }

  const { data: nursingData = [] } = useQuery({
    queryKey: ["nursing-records"],
    queryFn: () => apiRequest("/api/nursing-records").catch(() => []),
    ...queryOptions,
  });

  // treatmentDataは不要になったため削除（nursingDataで全て処理）

  // 利用者情報と職員情報のヘルパー関数
  const getResidentInfo = (residentId: string) => {
    const resident = residents.find((r: any) => r.id === residentId);
    return {
      roomNumber: resident?.roomNumber || '',
      name: resident?.name || '',
      floor: resident?.floor?.toString() || ''
    };
  };

  const getStaffName = (staffId: string) => {
    if (!staffId) return '';
    // 職員データがまだ読み込まれていない場合はIDを返す
    if (!staffList || staffList.length === 0) {
      return staffId;
    }
    const staff = staffList.find((s: any) => s.id === staffId);
    // staffName フィールドを使用し、なければ name を使用
    return staff?.staffName || staff?.name || staffId;
  };

  // 統合されたケース記録データ
  const careRecords = useMemo(() => {
    // 職員データがまだ読み込まれていない場合は空配列を返す
    if (!staffList || staffList.length === 0) {
      return [];
    }
    
    const allRecords: any[] = [];

    // 介護記録
    careRecordsData.forEach((record: any, index: number) => {
      // descriptionまたはnotesフィールドを記録内容として使用
      const recordContent = record.description || record.notes || '';
      if (recordContent && recordContent.trim()) {
        const recordDateObj = new Date(record.recordDate);
        const residentInfo = getResidentInfo(record.residentId);
        
        // デバッグ: 記録者IDの確認(簡潔版)
        if (index === 0) {
          console.log(`介護記録[${index}] 記録者:`, record.staffId, '→', getStaffName(record.staffId));
        }
        
        allRecords.push({
          id: `care_${record.id}`,
          recordDate: recordDateObj,
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "様子",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'care-records',
          originalId: record.id,
        });
      }
    });

    // バイタル記録
    vitalsData.forEach((record: any) => {
      const recordContent = record.notes || '';
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `vitals_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "バイタル",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'vitals',
          originalId: record.id,
        });
      }
    });

    // 食事記録
    mealsData.forEach((record: any, index: number) => {
      const recordContent = record.notes || '';
      
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `meals_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "食事",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'meals',
          originalId: record.id,
        });
      }
    });

    // 服薬記録（medication_recordsテーブルから）
    medicationData.forEach((record: any, index: number) => {
      const recordContent = record.notes || '';
      
      // デバッグ: 服薬記録の詳細
      if (index === 0) {
        console.log(`服薬記録[${index}]:`, {
          id: record.id,
          notes: record.notes,
          timing: record.timing,
          type: record.type,
          result: record.result,
          recordDate: record.recordDate,
          residentId: record.residentId,
          全データ: record
        });
      }
      
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `medication_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "服薬",
          recorder: getStaffName(record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'medication',
          originalId: record.id,
        });
      } else if (index === 0) {
        console.log('服薬記録: notesフィールドが空またはundefined');
      }
    });

    // 排泄記録
    excretionData.forEach((record: any) => {
      const recordContent = record.notes || '';
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `excretion_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "排泄",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'excretion',
          originalId: record.id,
        });
      }
    });

    // 体重記録
    weightData.forEach((record: any) => {
      const recordContent = record.notes || '';
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `weight_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "体重",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'weight',
          originalId: record.id,
        });
      }
    });

    // 清掃リネン記録
    cleaningData.forEach((record: any, index: number) => {
      const recordContent = record.recordNote || '';
      
      // デバッグ: 清掃リネン記録の詳細
      if (index === 0) {
        console.log(`清掃リネン記録[${index}]:`, {
          id: record.id,
          recordNote: record.recordNote,
          recordDate: record.recordDate,
          residentId: record.residentId,
          staffId: record.staffId,
          createdBy: record.createdBy,
          全データ: record
        });
      }
      
      if (recordContent && recordContent.trim()) {
        const residentInfo = getResidentInfo(record.residentId);
        
        allRecords.push({
          id: `cleaning_${record.id}`,
          recordDate: new Date(record.recordDate),
          roomNumber: residentInfo.roomNumber,
          residentName: residentInfo.name,
          category: "清掃リネン",
          recorder: getStaffName(record.staffId || record.createdBy || ''),
          content: recordContent,
          residentId: record.residentId,
          floor: residentInfo.floor,
          originalTable: 'cleaning',
          originalId: record.id,
        });
      } else if (index === 0) {
        console.log('清掃リネン記録: recordNoteが空またはundefined');
      }
    });

    // 看護記録（categoryが"看護記録"のもののみ）
    nursingData.forEach((record: any) => {
      if (record.category === '看護記録') {
        const recordContent = record.description || '';
        if (recordContent && recordContent.trim()) {
          const residentInfo = getResidentInfo(record.residentId);
          
          allRecords.push({
            id: `nursing_${record.id}`,
            recordDate: new Date(record.recordDate),
            roomNumber: residentInfo.roomNumber,
            residentName: residentInfo.name,
            category: "看護記録",
            recorder: record.staffName || getStaffName(record.nurseId || record.createdBy || ''),
            content: recordContent,
            residentId: record.residentId,
            floor: residentInfo.floor,
            originalTable: 'nursing',
            originalId: record.id,
          });
        }
      }
    });


    // 処置記録（看護記録テーブルのcategoryが"処置"のレコード）
    nursingData.forEach((record: any) => {
      if (record.category === '処置') {
        const recordContent = record.description || '';
        if (recordContent && recordContent.trim()) {
          const residentInfo = getResidentInfo(record.residentId);
          
          allRecords.push({
            id: `treatment_${record.id}`,
            recordDate: new Date(record.recordDate),
            roomNumber: residentInfo.roomNumber,
            residentName: residentInfo.name,
            category: "処置",
            recorder: record.staffName || getStaffName(record.nurseId || record.createdBy || ''),
            content: recordContent,
            residentId: record.residentId,
            floor: residentInfo.floor,
            originalTable: 'treatment',
            originalId: record.id,
          });
        }
      }
    });

    // 日付順でソート
    return allRecords.sort((a, b) => b.recordDate.getTime() - a.recordDate.getTime());
  }, [careRecordsData, vitalsData, mealsData, medicationData, excretionData, weightData, cleaningData, nursingData, residents, staffList]);

  // カテゴリマッピング
  const getCategoryMapping = (recordCategory: string) => {
    const categoryMap: { [key: string]: string[] } = {
      "介護": ["体重", "食事", "排泄", "様子", "清掃リネン", "服薬"],
      "看護": ["バイタル", "看護記録", "処置"],
      "様子": ["様子"],
    };
    return categoryMap[recordCategory] || [];
  };

  // フィルタリングされたレコード
  const filteredRecords = useMemo(() => {
    return careRecords.filter((record) => {
      const recordDate = format(record.recordDate, "yyyy-MM-dd");
      
      // 日付範囲フィルタ
      if (recordDate < dateFrom || recordDate > dateTo) return false;
      
      // カテゴリフィルタ
      if (recordCategory && recordCategory !== "all") {
        const allowedCategories = getCategoryMapping(recordCategory);
        if (allowedCategories.length > 0 && !allowedCategories.includes(record.category)) {
          return false;
        }
      }
      
      // 階数フィルタ
      if (selectedFloor !== "all" && record.floor !== selectedFloor) return false;
      
      // 利用者フィルタ
      if (selectedResident !== "all" && record.residentId !== selectedResident) return false;
      
      return true;
    });
  }, [careRecords, dateFrom, dateTo, recordCategory, selectedFloor, selectedResident]);

  // ローカル編集用の状態管理（楽観的更新用）
  const handleLocalContentChange = (recordId: string, newContent: string) => {
    // 楽観的更新: 即座にローカル状態を更新
    setEditedContent(prev => ({
      ...prev,
      [recordId]: newContent
    }));
  };

  // API更新処理（onBlur時に呼び出される）
  const handleContentEdit = async (recordId: string, newContent: string) => {
    // 元のテーブルを特定して更新
    const record = careRecords.find(r => r.id === recordId);
    if (record) {
      // 元のコンテンツと同じ場合はAPI呼び出しをスキップ
      if (newContent === record.content) {
        return;
      }

      try {
        // テーブルごとに正しいフィールド名でリクエスト
        let updateData: any = {};
        
        switch (record.originalTable) {
          case 'care-records':
            updateData = { description: newContent };
            break;
          case 'vitals':
          case 'meals':
          case 'excretion':
          case 'weight':
            updateData = { notes: newContent };
            break;
          case 'cleaning':
            updateData = { recordNote: newContent };
            break;
          case 'nursing':
          case 'medical':
          case 'treatment':
            updateData = { description: newContent };
            break;
          default:
            updateData = { notes: newContent };
        }
        
        // medical と treatment は nursing-records APIを使用
        const apiTable = record.originalTable === 'medical' || record.originalTable === 'treatment' 
          ? 'nursing-records' 
          : record.originalTable === 'nursing' 
          ? 'nursing-records'
          : record.originalTable;
        const apiEndpoint = `/api/${apiTable}/${record.originalId}`;
        const method = (['meals', 'medication'].includes(record.originalTable)) ? 'PUT' : 'PATCH';
        
        const response = await fetch(apiEndpoint, {
          method,
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        // 更新成功後、関連するクエリキャッシュを無効化
        const queryKeyMap: { [key: string]: string } = {
          'care-records': 'care-records',
          'vitals': 'vital-signs', 
          'meals': 'meals-medication',
          'medication': 'medication-records',
          'excretion': 'excretion-records',
          'weight': 'weight-records',
          'cleaning': 'cleaning-linen',
          'nursing': 'nursing-records',
          'treatment': 'nursing-records'
        };
        
        const queryKey = queryKeyMap[record.originalTable];
        if (queryKey) {
          await queryClient.invalidateQueries({ queryKey: [queryKey] });
          
          // 再取得後にローカル状態をクリア（サーバーからの最新データを表示）
          setTimeout(() => {
            setEditedContent(prev => {
              const updated = { ...prev };
              delete updated[recordId];
              return updated;
            });
          }, 500);
        }
        
      } catch (error) {
        console.error('記録内容の更新に失敗しました:', error);
        // エラーの場合は元の値に戻す
        setEditedContent(prev => {
          const updated = { ...prev };
          delete updated[recordId];
          return updated;
        });
      }
    }
  };

  const getDisplayContent = (record: any) => {
    return editedContent[record.id] !== undefined ? editedContent[record.id] : record.content;
  };

  // 印刷処理
  const handlePrint = () => {
    try {
      // APIパラメータをURLエンコード
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        recordCategory,
        selectedFloor,
        selectedResident
      });

      // 新しいタブでPDFを表示
      const printUrl = `/api/care-records/print?${params.toString()}`;
      window.open(printUrl, '_blank');

    } catch (error) {
      console.error('印刷処理エラー:', error);
      alert('PDFの表示に失敗しました。しばらく待ってから再度お試しください。');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            // フィルタ状態をURLパラメータとして保持して戻る
            const params = new URLSearchParams();
            if (selectedFloor !== "all") params.set("floor", selectedFloor);
            if (dateFrom !== format(new Date(), "yyyy-MM-dd")) params.set("date", dateFrom);
            const menuPath = getEnvironmentPath("/check-list-menu");
            navigate(`${menuPath}${params.toString() ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">ケース記録チェック一覧</h1>
      </header>

      {/* フィルタ項目 */}
      <div className="bg-white p-3 border-b">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">表示期間:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-sm">〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">記録カテゴリ:</span>
            <Select value={recordCategory} onValueChange={setRecordCategory}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">未選択</SelectItem>
                <SelectItem value="介護">介護</SelectItem>
                <SelectItem value="看護">看護</SelectItem>
                <SelectItem value="様子">様子</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">階数:</span>
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="全階" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全階</SelectItem>
                <SelectItem value="1">1階</SelectItem>
                <SelectItem value="2">2階</SelectItem>
                <SelectItem value="3">3階</SelectItem>
                <SelectItem value="4">4階</SelectItem>
                <SelectItem value="5">5階</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">利用者:</span>
            <Select value={selectedResident} onValueChange={setSelectedResident}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全利用者" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全利用者</SelectItem>
                {residents.map((resident: any) => (
                  <SelectItem key={resident.id} value={resident.id}>
                    {resident.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-1" />
            印刷
          </Button>
        </div>
      </div>

      {/* テーブル */}
      <div className="flex-1 overflow-auto p-2">
        <div className="bg-white rounded-lg shadow">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-36 text-xs py-1 px-2">記録日時</TableHead>
                <TableHead className="w-16 text-xs py-1 px-2">居室</TableHead>
                <TableHead className="w-24 text-xs py-1 px-2">利用者名</TableHead>
                <TableHead className="w-20 text-xs py-1 px-2">カテゴリ</TableHead>
                <TableHead className="w-24 text-xs py-1 px-2">記録者</TableHead>
                <TableHead className="text-xs py-1 px-2">記録内容</TableHead>
                <TableHead className="w-10 text-xs py-1 px-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id} className="h-12">
                  <TableCell className="text-xs whitespace-nowrap py-1 px-2">
                    {format(record.recordDate, "MM月dd日 HH:mm", { locale: ja })}
                  </TableCell>
                  <TableCell className="text-xs py-1 px-2">{record.roomNumber}</TableCell>
                  <TableCell className="text-xs py-1 px-2">{record.residentName}</TableCell>
                  <TableCell className="text-xs py-1 px-2">{record.category}</TableCell>
                  <TableCell className="text-xs py-1 px-2">{record.recorder}</TableCell>
                  <TableCell className="text-xs py-1 px-2">
                    <ResizableNotesInput
                      recordId={record.id}
                      initialValue={getDisplayContent(record)}
                      onLocalChange={handleLocalContentChange}
                      onSave={handleContentEdit}
                    />
                  </TableCell>
                  <TableCell className="text-xs py-1 px-1">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="p-0.5 hover:bg-gray-100 rounded"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 記録内容詳細ダイアログ */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>記録内容詳細</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">記録日時：</span>
                  {format(selectedRecord.recordDate, "yyyy年MM月dd日 HH:mm", { locale: ja })}
                </div>
                <div>
                  <span className="font-medium">居室番号：</span>
                  {selectedRecord.roomNumber}
                </div>
                <div>
                  <span className="font-medium">利用者名：</span>
                  {selectedRecord.residentName}
                </div>
                <div>
                  <span className="font-medium">カテゴリ：</span>
                  {selectedRecord.category}
                </div>
                <div>
                  <span className="font-medium">記録者：</span>
                  {selectedRecord.recorder}
                </div>
              </div>
              <div>
                <span className="font-medium text-sm">記録内容：</span>
                <p className="mt-2 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                  {getDisplayContent(selectedRecord)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}