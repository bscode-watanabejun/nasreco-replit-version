import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Building } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Resident } from "@shared/schema";

interface ExcretionRecord {
  id: string;
  residentId: string;
  recordDate: string;
  hour: number;
  type: 'urine' | 'stool';
  status: 'independent' | 'recorded';
  amount?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ExcretionGridData {
  [residentId: string]: {
    [hour: number]: {
      urine?: ExcretionRecord;
      stool?: ExcretionRecord;
    };
  };
}

interface ExcretionData {
  stoolState: string;
  stoolAmount: string;
  urineCC: string;
  urineAmount: string;
}

interface CellData {
  residentId: string;
  hour: number;
  data: ExcretionData;
}

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentId: string;
  hour: number;
  initialNotes: string;
  onSave: (residentId: string, hour: number, notes: string) => void;
  resident?: Resident;
}

// Input + Popoverコンポーネント（手入力とプルダウン選択両対応）
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
  const inputRef = useRef<HTMLInputElement>(null);

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
          ref={inputRef}
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

// 排泄記録ポップアップダイアログ
function ExcretionDialog({
  open,
  onOpenChange,
  residentId,
  hour,
  initialData,
  onSave,
  resident,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentId: string;
  hour: number;
  initialData: ExcretionData;
  onSave: (residentId: string, hour: number, data: ExcretionData) => void;
  resident?: Resident;
}) {
  const [stoolState, setStoolState] = useState(initialData.stoolState);
  const [stoolAmount, setStoolAmount] = useState(initialData.stoolAmount);
  const [urineCC, setUrineCC] = useState(initialData.urineCC);
  const [urineAmount, setUrineAmount] = useState(initialData.urineAmount);

  // ダイアログが開かれた時に初期データをセット
  useEffect(() => {
    setStoolState(initialData.stoolState);
    setStoolAmount(initialData.stoolAmount);
    setUrineCC(initialData.urineCC);
    setUrineAmount(initialData.urineAmount);
  }, [initialData, open]);

  const handleSave = () => {
    onSave(residentId, hour, {
      stoolState,
      stoolAmount,
      urineCC,
      urineAmount,
    });
    onOpenChange(false);
  };

  const stoolStateOptions = [
    { value: "", label: "" },
    { value: "普通便", label: "普通便" },
    { value: "水様便", label: "水様便" },
    { value: "軟便", label: "軟便" },
    { value: "硬便", label: "硬便" },
    { value: "未消化便", label: "未消化便" },
  ];

  const stoolAmountOptions = [
    { value: "", label: "" },
    { value: "多", label: "多" },
    { value: "中", label: "中" },
    { value: "小", label: "小" },
    { value: "付", label: "付" },
  ];

  const urineAmountOptions = [
    { value: "", label: "" },
    { value: "○", label: "○" },
    { value: "×", label: "×" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
    { value: "6", label: "6" },
  ];

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // ダイアログが閉じられる時に自動保存
      onSave(residentId, hour, {
        stoolState,
        stoolAmount,
        urineCC,
        urineAmount,
      });
    }
    onOpenChange(newOpen);
  };

  // タイトルを生成
  const dialogTitle = resident 
    ? `${resident.roomNumber} ${resident.name} ${hour}時 の排泄記録入力`
    : `${hour}時 の排泄記録入力`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            排泄記録の詳細情報を入力してください
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* 左上：便状態 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">便状態</label>
            <InputWithDropdown
              value={stoolState}
              options={stoolStateOptions}
              onSave={setStoolState}
              placeholder="選択してください"
              className="w-full h-8 text-xs px-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 右上：便量 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">便量</label>
            <InputWithDropdown
              value={stoolAmount}
              options={stoolAmountOptions}
              onSave={setStoolAmount}
              placeholder="選択してください"
              className="w-full h-8 text-xs px-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 左下：尿CC */}
          <div className="space-y-2">
            <label className="text-sm font-medium">尿CC</label>
            <input
              type="number"
              value={urineCC}
              onChange={(e) => setUrineCC(e.target.value)}
              placeholder="数値入力"
              className="w-full h-8 text-xs px-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 右下：尿量 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">尿量</label>
            <InputWithDropdown
              value={urineAmount}
              options={urineAmountOptions}
              onSave={setUrineAmount}
              placeholder="選択してください"
              className="w-full h-8 text-xs px-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 記録入力ポップアップダイアログ
function NotesDialog({
  open,
  onOpenChange,
  residentId,
  hour,
  initialNotes,
  onSave,
  resident,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);

  // ダイアログが開かれた時に初期データをセット
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes, open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // ダイアログが閉じられる時に自動保存
      onSave(residentId, hour, notes);
    }
    onOpenChange(newOpen);
  };

  // タイトルを生成
  const dialogTitle = resident 
    ? `${resident.roomNumber} ${resident.name} の記録入力`
    : `記録入力`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            記録内容を自由に入力してください
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">記録内容</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="記録内容を入力してください"
              className="w-full h-32 text-xs px-2 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExcretionList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || 'all');
  
  // ダイアログ状態管理
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState<{ residentId: string; hour: number } | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [currentNotesCell, setCurrentNotesCell] = useState<{ residentId: string; hour: number } | null>(null);
  
  // セルデータ管理
  const [cellData, setCellData] = useState<Record<string, ExcretionData>>({});
  const [notesData, setNotesData] = useState<Record<string, string>>({});
  
  // 今日の日付を取得（日本語表示）
  const displayDate = format(new Date(selectedDate), 'M月d日', { locale: ja });

  // 利用者データを取得
  const { data: allResidents = [] } = useQuery<Resident[]>({
    queryKey: ['/api/residents'],
  });

  // フィルタリングされた利用者リスト
  const filteredResidents = allResidents.filter((resident: Resident) => {
    if (selectedFloor === 'all') return true;
    // 数値と文字列（"1F", "2F"など）の両方に対応
    return resident.floor === selectedFloor || 
           resident.floor === `${selectedFloor}F` ||
           resident.floor === selectedFloor.toString();
  });

  // 排泄記録データを取得（将来的に実装）
  const { data: excretionRecords } = useQuery({
    queryKey: ['/api/excretion-records', selectedDate, selectedFloor],
    queryFn: async () => {
      // 将来的にAPIエンドポイントを実装
      return [];
    }
  });

  // 時間セル用のオプション
  const statusOptions = [
    { value: "independent", label: "自立" },
    { value: "recorded", label: "記録" }
  ];

  const amountOptions = [
    { value: "", label: "" },
    { value: "水", label: "水" },
    { value: "少", label: "少" },
    { value: "多", label: "多" }
  ];

  // 時間配列を生成（0-23時）
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // セルのクリックハンドラー（将来的に実装）
  const handleCellClick = (residentId: string, hour: number, type: 'urine' | 'stool', field: string, value: string) => {
    console.log('Cell clicked:', { residentId, hour, type, field, value });
    // 将来的にAPIを通じてデータを保存
  };

  // 時間セルのクリックハンドラー
  const handleTimesCellClick = (residentId: string, hour: number) => {
    setCurrentCell({ residentId, hour });
    setDialogOpen(true);
  };

  // データ保存ハンドラー
  const handleSaveExcretionData = (residentId: string, hour: number, data: ExcretionData) => {
    const key = `${residentId}-${hour}`;
    setCellData(prev => ({
      ...prev,
      [key]: data
    }));
    console.log('Excretion data saved:', { residentId, hour, data });
    // 将来的にAPIを通じてデータを保存
  };

  // 記録データ保存ハンドラー
  const handleSaveNotesData = (residentId: string, hour: number, notes: string) => {
    const key = `${residentId}-${hour}`;
    setNotesData(prev => ({
      ...prev,
      [key]: notes
    }));
    console.log('Notes data saved:', { residentId, hour, notes });
    // 将来的にAPIを通じてデータを保存
  };

  // 記録セルクリックハンドラー
  const handleNotesClick = (residentId: string, hour: number) => {
    setCurrentNotesCell({ residentId, hour });
    setNotesDialogOpen(true);
  };

  // セルデータ取得
  const getCellData = (residentId: string, hour: number): ExcretionData => {
    const key = `${residentId}-${hour}`;
    return cellData[key] || {
      stoolState: "",
      stoolAmount: "",
      urineCC: "",
      urineAmount: ""
    };
  };

  // 記録データ取得
  const getNotesData = (residentId: string, hour: number): string => {
    const key = `${residentId}-${hour}`;
    return notesData[key] || "";
  };

  // セル表示用の文字取得関数
  const getDisplayText = (data: ExcretionData, type: 'stool' | 'urine'): string => {
    if (type === 'stool') {
      // 便行：便状態と便量を縦に表示（頭文字のみ）
      const stoolStateChar = data.stoolState ? data.stoolState.charAt(0) : '';
      const stoolAmountChar = data.stoolAmount;
      if (stoolStateChar && stoolAmountChar) {
        return `${stoolStateChar}\n${stoolAmountChar}`;
      } else if (stoolStateChar) {
        return stoolStateChar;
      } else if (stoolAmountChar) {
        return stoolAmountChar;
      }
    } else {
      // 尿行：尿CCを優先、なければ尿量
      if (data.urineCC) {
        return data.urineCC;
      } else if (data.urineAmount) {
        return data.urineAmount;
      }
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-slate-800" data-testid="text-title">
            排泄一覧
          </h1>
        </div>

        {/* 日付とフロア選択 */}
        <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
                data-testid="input-date"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1" data-testid="select-floor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全階</SelectItem>
                  <SelectItem value="1F">1階</SelectItem>
                  <SelectItem value="2F">2階</SelectItem>
                  <SelectItem value="3F">3階</SelectItem>
                  <SelectItem value="4F">4階</SelectItem>
                  <SelectItem value="5F">5階</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* 排泄記録テーブル */}
      <div className="p-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-r border-b border-gray-200 px-2 py-1 text-center w-20">
                    {/* 空白 */}
                  </th>
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center min-w-[35px]">
                    {/* 空白 */}
                  </th>
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center min-w-[35px]">自立</th>
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center min-w-[35px]">記録</th>
                  {hours.map(hour => (
                    <th key={hour} className="border-r border-b border-gray-200 px-1 py-1 text-center min-w-[35px]">
                      {hour}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map((resident: Resident) => {
                  const residentId = resident.id;
                  return (
                    <>
                      {/* 便の行 */}
                      <tr key={`${residentId}-stool`}>
                      <td className="border-r border-b border-gray-200 px-2 py-1 text-center" rowSpan={2}>
                        <div className="text-[11px] font-medium">{resident.roomNumber}</div>
                        <div className="text-[10px] text-gray-600 leading-tight">{resident.name}</div>
                      </td>
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center">便</td>
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center">
                        <input
                          type="text"
                          onChange={(e) => handleCellClick(resident.id, -1, 'stool', 'status', e.target.value)}
                          placeholder=""
                          className="w-full h-6 text-xs text-center border-0 bg-transparent focus:outline-none font-bold"
                        />
                      </td>
                      <td 
                        className="border-r border-b border-gray-200 px-1 py-1 text-center cursor-pointer hover:bg-blue-50" 
                        rowSpan={2}
                        onClick={() => handleNotesClick(resident.id, -1)}
                      >
                        <div className="text-xs leading-tight">
                          {getNotesData(resident.id, -1).substring(0, 6)}
                        </div>
                      </td>
                      {hours.map(hour => {
                        const data = getCellData(resident.id, hour);
                        const displayText = getDisplayText(data, 'stool');
                        return (
                          <td 
                            key={hour} 
                            className="border-r border-b border-gray-200 px-1 py-1 text-center cursor-pointer hover:bg-blue-50"
                            onClick={() => handleTimesCellClick(resident.id, hour)}
                          >
                            <div className="text-xs whitespace-pre-line leading-tight">
                              {displayText}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                      {/* 記録の行 */}
                      <tr key={`${residentId}-urine`}>
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center">尿</td>
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center">
                        <input
                          type="text"
                          onChange={(e) => handleCellClick(resident.id, -1, 'urine', 'status', e.target.value)}
                          placeholder=""
                          className="w-full h-6 text-xs text-center border-0 bg-transparent focus:outline-none font-bold"
                        />
                      </td>
                      {/* 記録列は上の行でrowSpan={2}でマージされているため、ここにはセルなし */}
                      {hours.map(hour => {
                        const data = getCellData(resident.id, hour);
                        const displayText = getDisplayText(data, 'urine');
                        return (
                          <td 
                            key={`${hour}-record`} 
                            className="border-r border-b border-gray-200 px-1 py-1 text-center cursor-pointer hover:bg-blue-50"
                            onClick={() => handleTimesCellClick(resident.id, hour)}
                          >
                            <div className="text-xs leading-tight">
                              {displayText}
                            </div>
                          </td>
                        );
                      })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 排泄記録ダイアログ */}
      {currentCell && (
        <ExcretionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          residentId={currentCell.residentId}
          hour={currentCell.hour}
          initialData={getCellData(currentCell.residentId, currentCell.hour)}
          onSave={handleSaveExcretionData}
          resident={filteredResidents.find((r: Resident) => r.id === currentCell.residentId)}
        />
      )}

      {/* 記録入力ダイアログ */}
      {currentNotesCell && (
        <NotesDialog
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          residentId={currentNotesCell.residentId}
          hour={currentNotesCell.hour}
          initialNotes={getNotesData(currentNotesCell.residentId, currentNotesCell.hour)}
          onSave={handleSaveNotesData}
          resident={filteredResidents.find((r: Resident) => r.id === currentNotesCell.residentId)}
        />
      )}
    </div>
  );
}