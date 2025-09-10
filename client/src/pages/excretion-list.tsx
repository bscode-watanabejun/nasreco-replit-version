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

interface ExcretionRecordIds {
  stoolId?: string;
  urineId?: string;
  generalNoteId?: string;
  assistanceStoolId?: string;
  assistanceUrineId?: string;
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
  onSelectCallback,
  inputRef,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  onSelectCallback?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const localInputRef = useRef<HTMLInputElement>(null);
  const refToUse = inputRef || localInputRef;

  // 値が外部から変更された場合に同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // アクティブ要素を監視してフォーカス状態を更新
  useEffect(() => {
    const checkFocus = () => {
      if (refToUse.current) {
        setIsFocused(document.activeElement === refToUse.current);
      }
    };

    // 初回チェック
    checkFocus();

    // フォーカス変更を監視
    const handleFocusChange = () => {
      checkFocus();
    };

    // document全体でfocus/blurイベントを監視
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, [refToUse]);

  const handleSelect = (selectedValue: string) => {
    const selectedOption = options.find(opt => opt.value === selectedValue);
    setInputValue(selectedOption ? selectedOption.label : selectedValue);
    onSave(selectedValue);
    setOpen(false);
    // 選択後にコールバックを実行
    if (onSelectCallback) {
      setTimeout(() => onSelectCallback(), 100);
    }
  };

  return (
    <div className={`relative ${isFocused || open ? 'ring-2 ring-blue-200 rounded' : ''} transition-all`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={refToUse}
            type="text"
            value={inputValue}
            readOnly
            onFocus={() => {
              setOpen(true);
              setIsFocused(true);
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 50);
            }}
            onClick={() => {
              if (!open) {
                setOpen(true);
                setIsFocused(true);
              }
            }}
            placeholder={placeholder}
            className={`${className} ${isFocused || open ? '!border-blue-500' : ''} transition-all outline-none`}
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

  // 各入力フィールドのrefを作成
  const stoolStateRef = useRef<HTMLInputElement>(null);
  const stoolAmountRef = useRef<HTMLInputElement>(null);
  const urineCCRef = useRef<HTMLInputElement>(null);
  const urineAmountRef = useRef<HTMLInputElement>(null);

  // ダイアログが開かれた時に初期データをセット
  useEffect(() => {
    setStoolState(initialData.stoolState);
    setStoolAmount(initialData.stoolAmount);
    setUrineCC(initialData.urineCC);
    setUrineAmount(initialData.urineAmount);
    
    // ダイアログが開かれた時に最初のフィールドを自動的に開く
    if (open) {
      setTimeout(() => {
        if (!initialData.stoolState) {
          stoolStateRef.current?.click();
        }
      }, 200);
    }
  }, [initialData, open]);

  // 次のフィールドに移動する関数
  const moveToNextField = (currentField: string) => {
    setTimeout(() => {
      switch (currentField) {
        case 'stoolState':
          if (!stoolAmount) {
            stoolAmountRef.current?.click();
          } else if (!urineCC) {
            urineCCRef.current?.focus();
          } else if (!urineAmount) {
            urineAmountRef.current?.click();
          }
          break;
        case 'stoolAmount':
          if (!urineCC) {
            urineCCRef.current?.focus();
          } else if (!urineAmount) {
            urineAmountRef.current?.click();
          }
          break;
        case 'urineCC':
          if (!urineAmount) {
            urineAmountRef.current?.click();
          }
          break;
        case 'urineAmount':
          // 最後のフィールドなので何もしない
          break;
      }
    }, 150);
  };

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
            排泄記録の詳細を入力してください。
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
              inputRef={stoolStateRef}
              onSelectCallback={() => moveToNextField('stoolState')}
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
              inputRef={stoolAmountRef}
              onSelectCallback={() => moveToNextField('stoolAmount')}
            />
          </div>

          {/* 左下：尿CC */}
          <div className="space-y-2">
            <label className="text-sm font-medium">尿CC</label>
            <input
              ref={urineCCRef}
              type="number"
              value={urineCC}
              onChange={(e) => setUrineCC(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urineCC) {
                  moveToNextField('urineCC');
                }
              }}
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
              inputRef={urineAmountRef}
              onSelectCallback={() => moveToNextField('urineAmount')}
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
            記録内容を入力してください。
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
  const [selectedFloor, setSelectedFloor] = useState(() => {
    const floorParam = urlParams.get('floor');
    if (floorParam) {
      if (floorParam === 'all') return '全階';
      const floorNumber = floorParam.replace('F', '');
      if (!isNaN(Number(floorNumber))) {
        return `${floorNumber}階`;
      }
    }
    return '全階';
  });
  
  // ダイアログ状態管理
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState<{ residentId: string; hour: number } | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [currentNotesCell, setCurrentNotesCell] = useState<{ residentId: string; hour: number } | null>(null);
  
  // セルデータ管理
  const [cellData, setCellData] = useState<Record<string, ExcretionData>>({});
  const [recordIds, setRecordIds] = useState<Record<string, ExcretionRecordIds>>({});
  const [notesData, setNotesData] = useState<Record<string, string>>({});
  const [assistanceData, setAssistanceData] = useState<Record<string, { stool: string; urine: string }>>({});
  const [aiAnalysisData, setAiAnalysisData] = useState<Record<string, string>>({});
  
  // タブ管理
  const [activeTab, setActiveTab] = useState<'record' | 'summary'>('record');
  
  // 今日の日付を取得（日本語表示）
  const displayDate = format(new Date(selectedDate), 'M月d日', { locale: ja });

  // 利用者データを取得
  const { data: allResidents = [] } = useQuery<Resident[]>({
    queryKey: ['/api/residents'],
  });

  // 排泄記録データを取得
  const { data: excretionRecords } = useQuery({
    queryKey: ['/api/excretion-records', selectedDate, selectedFloor],
    queryFn: async () => {
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(selectedDate);
      startDate.setDate(endDate.getDate() - 29); // 過去30日間のデータを取得
      startDate.setHours(0, 0, 0, 0);
      
      const response = await fetch(`/api/excretion-records?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch excretion records');
      }
      return response.json();
    }
  });

  // 日付や階数が変更されたときにローカル状態をリセット
  useEffect(() => {
    setCellData({});
    setRecordIds({});
    setNotesData({});
    setAssistanceData({});
    setAiAnalysisData({});
  }, [selectedDate, selectedFloor]);

  // APIから取得したデータをローカル状態に反映
  useEffect(() => {
    if (!excretionRecords || !Array.isArray(excretionRecords)) return;

    console.log('🔍 取得した排泄記録データ:', excretionRecords);

    const newCellData: Record<string, ExcretionData> = {};
    const newRecordIds: Record<string, ExcretionRecordIds> = {};
    const newNotesData: Record<string, string> = {};
    const newAssistanceData: Record<string, { stool: string; urine: string }> = {};
    
    const selectedDayStart = startOfDay(new Date(selectedDate));

    excretionRecords
      .filter((record: any) => startOfDay(new Date(record.recordDate)).getTime() === selectedDayStart.getTime())
      .forEach((record: any) => {
      const key = `${record.residentId}--1`; // -1は自立列用

      // 自立列のデータ（assistanceフィールドを使用）
      if (record.assistance) {
        if (!newAssistanceData[key]) {
          newAssistanceData[key] = { stool: "", urine: "" };
        }
        if (!newRecordIds[key]) {
          newRecordIds[key] = {};
        }
        
        if (record.type === 'bowel_movement') {
          newAssistanceData[key].stool = record.assistance;
          newRecordIds[key].assistanceStoolId = record.id;
        } else if (record.type === 'urination') {
          newAssistanceData[key].urine = record.assistance;
          newRecordIds[key].assistanceUrineId = record.id;
        }
        
        console.log('🔍 自立データ処理:', { recordId: record.id, type: record.type, assistance: record.assistance });
      }

      // 記録日時から時間を抽出してnotesを保存
      const recordDate = new Date(record.recordDate);
      const hour = recordDate.getHours();
      const extractedKey = `${record.residentId}-${hour}`;
      
      // 記録内容をnotesDataに保存（時間ベース）
      if (record.notes) {
        newNotesData[extractedKey] = record.notes;
        console.log(`🔍 排泄記録のnotes保存:`, {
          recordId: record.id,
          residentId: record.residentId,
          hour: hour,
          extractedKey: extractedKey,
          notes: record.notes,
          recordDate: record.recordDate
        });
      }
      
      // 記録内容の処理（type: 'general_note'の場合）
      if (record.type === 'general_note' && record.notes) {
        // hour: -1（記録列）用のキーとしてresidentIdを使用
        const generalKey = `${record.residentId}--1`;
        newNotesData[generalKey] = record.notes;
        
        // general_noteのIDも保存
        if (!newRecordIds[generalKey]) {
          newRecordIds[generalKey] = {};
        }
        newRecordIds[generalKey].generalNoteId = record.id;
        
        console.log('🔍 general_note記録を処理:', { key: generalKey, notes: record.notes, id: record.id });
      }
      
      // 従来の処理：記録から時間を抽出する簡易的な方法（既存データとの互換性のため）
      else if (record.notes && record.notes.includes('時の')) {
        const hourMatch = record.notes.match(/(\d+)時の/);
        if (hourMatch) {
          const extractedHour = parseInt(hourMatch[1]);
          const extractedKey = `${record.residentId}-${extractedHour}`;

          if (record.type === 'bowel_movement') {
            if (!newCellData[extractedKey]) {
              newCellData[extractedKey] = { stoolState: "", stoolAmount: "", urineCC: "", urineAmount: "" };
            }
            if (!newRecordIds[extractedKey]) {
              newRecordIds[extractedKey] = {};
            }
            newCellData[extractedKey].stoolState = record.consistency || "";
            newCellData[extractedKey].stoolAmount = record.amount || "";
            newRecordIds[extractedKey].stoolId = record.id; // 便記録のID保存
          } else if (record.type === 'urination') {
            if (!newCellData[extractedKey]) {
              newCellData[extractedKey] = { stoolState: "", stoolAmount: "", urineCC: "", urineAmount: "" };
            }
            if (!newRecordIds[extractedKey]) {
              newRecordIds[extractedKey] = {};
            }
            newCellData[extractedKey].urineAmount = record.amount || "";
            newRecordIds[extractedKey].urineId = record.id; // 尿記録のID保存
            // CCデータを専用フィールドから取得
            if (record.urineVolumeCc) {
              newCellData[extractedKey].urineCC = record.urineVolumeCc.toString();
              console.log('💧 新フィールドからCC取得:', { recordId: record.id, cc: record.urineVolumeCc });
            }
            // 旧データの互換性：notesからのCC抽出（既存データの移行期間用）
            else {
              let ccMatch = record.notes?.match(/\[CC:(\d+)\]/); // 新フォーマット
              if (!ccMatch) {
                ccMatch = record.notes?.match(/\((\d+)CC\)/); // 旧フォーマット
              }
              if (ccMatch) {
                newCellData[extractedKey].urineCC = ccMatch[1];
                console.log('🔄 旧フォーマットからCC取得:', { recordId: record.id, cc: ccMatch[1] });
              }
            }
          }
          
          // 記録内容をnotesDataに保存（排泄記録の自動生成文字列は除外）
          if (record.notes) {
            // 排泄記録の自動生成文字列パターンをチェック（新フォーマット対応 + 旧フォーマット互換性）
            const isExcretionAutoGenerated = /^\d+時の[便尿]記録(\s(\[CC:\d+\]|\(\d+CC\)))?$/.test(record.notes);
            if (!isExcretionAutoGenerated) {
              newNotesData[extractedKey] = record.notes;
            }
          }
        }
      }
    });

    // データを置き換える（蓄積しない）
    setCellData(newCellData);
    setRecordIds(newRecordIds);
    
    // notesDataは既存のローカルデータを保持しつつマージ
    setNotesData(prev => {
      const finalNotesData = {
        ...newNotesData, // API取得データ
        ...prev // 既存のローカルデータで上書き（優先）
      };
      console.log(`🔍 notesData更新:`, {
        newNotesData: newNotesData,
        prevNotesData: prev,
        finalNotesData: finalNotesData
      });
      return finalNotesData;
    });
    
    setAssistanceData(newAssistanceData);
  }, [excretionRecords, selectedDate]);

  // フィルタリングされた利用者リスト
  const filteredResidents = allResidents.filter((resident: Resident) => {
    if (selectedFloor === 'all' || selectedFloor === '全階') return true;
    
    const residentFloor = resident.floor;
    if (!residentFloor) return false; // null/undefinedをフィルタアウト
    
    // 複数のフォーマットに対応した比較
    const selectedFloorNumber = selectedFloor.replace("階", "").replace("F", "");
    
    // "1階" 形式との比較
    if (residentFloor === selectedFloor) return true;
    
    // "1F" 形式との比較
    if (residentFloor === `${selectedFloorNumber}F`) return true;
    
    // "1" 形式との比較
    if (residentFloor === selectedFloorNumber) return true;
    
    return false;
  }).sort((a: Resident, b: Resident) => {
    // 居室番号で昇順ソート
    const roomA = parseInt(a.roomNumber || "0");
    const roomB = parseInt(b.roomNumber || "0");
    return roomA - roomB;
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

  // セルのクリックハンドラー（自立データ用）
  const handleCellClick = async (residentId: string, hour: number, type: 'urine' | 'stool', field: string, value: string) => {
    console.log('Cell clicked:', { residentId, hour, type, field, value });
    
    if (!residentId || !value.trim()) return;
    
    try {
      const key = `${residentId}--1`; // 自立列用のキー
      const existingIds = recordIds[key] || {};
      const existingIdField = type === 'stool' ? 'assistanceStoolId' : 'assistanceUrineId';
      const existingId = existingIds[existingIdField];
      
      // 自立データの場合、hour は -1 なので現在時刻を使用
      const recordDateTime = (() => {
        const dt = new Date(selectedDate);
        // hour=-1（自立）の場合は12時、それ以外は指定時間
        const saveHour = hour === -1 ? 12 : hour;
        dt.setHours(saveHour, 0, 0, 0);
        return dt;
      })();
      
      const recordData = {
        residentId,
        recordDate: recordDateTime.toISOString(),
        type: type === 'stool' ? 'bowel_movement' : 'urination',
        assistance: value,
        notes: hour === -1 ? '' : `${hour}時の${type === 'stool' ? '便' : '尿'}記録`
      };
      
      if (existingId) {
        // 既存の自立レコードを更新
        await apiRequest(`/api/excretion-records/${existingId}`, 'PATCH', recordData);
      } else {
        // 新規の自立レコードを作成
        const newRecord = await apiRequest('/api/excretion-records', 'POST', recordData);
        // 新しいIDを保存
        setRecordIds(prev => ({
          ...prev,
          [key]: { ...prev[key], [existingIdField]: newRecord.id }
        }));
        console.log(`✨ ${type}自立データを新規作成:`, newRecord.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/excretion-records'] });
    } catch (error) {
      console.error('Error saving excretion record:', error);
    }
  };

  // 時間セルのクリックハンドラー
  const handleTimesCellClick = (residentId: string, hour: number) => {
    setCurrentCell({ residentId, hour });
    setDialogOpen(true);
  };

  // データ保存ハンドラー
  const handleSaveExcretionData = async (residentId: string, hour: number, data: ExcretionData) => {
    const key = `${residentId}-${hour}`;
    setCellData(prev => ({
      ...prev,
      [key]: data
    }));
    console.log('Excretion data saved:', { residentId, hour, data });
    
    if (!residentId) return;
    
    try {
      const existingIds = recordIds[key] || {};
      
      // 便記録の保存/更新
      if (data.stoolState || data.stoolAmount) {
        // 選択日時 + 時間を組み合わせた日時を作成
        const recordDateTime = new Date(selectedDate);
        recordDateTime.setHours(hour, 0, 0, 0);
        
        const stoolRecord = {
          residentId,
          recordDate: recordDateTime.toISOString(),
          type: 'bowel_movement',
          consistency: data.stoolState || null,
          amount: data.stoolAmount || null,
          notes: `${hour}時の便記録`
        };
        
        if (existingIds.stoolId) {
          // 既存レコードを更新
          await apiRequest(`/api/excretion-records/${existingIds.stoolId}`, 'PATCH', stoolRecord);
          console.log('🔄 便記録を更新:', existingIds.stoolId);
        } else {
          // 新規レコードを作成
          const newRecord = await apiRequest('/api/excretion-records', 'POST', stoolRecord);
          // 新しいIDを保存
          setRecordIds(prev => ({
            ...prev,
            [key]: { ...prev[key], stoolId: newRecord.id }
          }));
          console.log('✨ 便記録を新規作成:', newRecord.id);
        }
      }
      
      // 尿記録の保存/更新
      if (data.urineCC || data.urineAmount) {
        // 選択日時 + 時間を組み合わせた日時を作成
        const recordDateTime = new Date(selectedDate);
        recordDateTime.setHours(hour, 0, 0, 0);
        
        const urineRecord = {
          residentId,
          recordDate: recordDateTime.toISOString(),
          type: 'urination',
          amount: data.urineAmount || null,
          urineVolumeCc: data.urineCC ? parseInt(data.urineCC) : null,
          notes: `${hour}時の尿記録`
        };
        console.log('💧 尿記録保存データ:', { urineCC: data.urineCC, urineVolumeCc: urineRecord.urineVolumeCc });
        
        if (existingIds.urineId) {
          // 既存レコードを更新
          await apiRequest(`/api/excretion-records/${existingIds.urineId}`, 'PATCH', urineRecord);
          console.log('🔄 尿記録を更新:', existingIds.urineId);
        } else {
          // 新規レコードを作成
          const newRecord = await apiRequest('/api/excretion-records', 'POST', urineRecord);
          // 新しいIDを保存
          setRecordIds(prev => ({
            ...prev,
            [key]: { ...prev[key], urineId: newRecord.id }
          }));
          console.log('✨ 尿記録を新規作成:', newRecord.id);
        }
      }
      
      // 正しいクエリキーで無効化
      queryClient.invalidateQueries({ queryKey: ['/api/excretion-records', selectedDate, selectedFloor] });
    } catch (error) {
      console.error('Error saving excretion record:', error);
    }
  };

  // 記録データ保存ハンドラー
  const handleSaveNotesData = async (residentId: string, hour: number, notes: string) => {
    const key = `${residentId}-${hour}`;
    
    // general_noteとしてもキーを作成（hour: -1用）
    const generalKey = `${residentId}--1`;
    
    setNotesData(prev => ({
      ...prev,
      [key]: notes,
      [generalKey]: notes // general_note用キーにも保存
    }));
    console.log('Notes data saved:', { residentId, hour, notes, generalKey });
    
    if (!residentId || !notes.trim()) return;
    
    try {
      const existingIds = recordIds[generalKey] || {};
      // 記録内容は選択日の12:00に保存（hour=-1の場合は日付がずれないように）
      const recordDateTime = new Date(selectedDate);
      // hour=-1の場合は12時、それ以外は指定時間
      const saveHour = hour === -1 ? 12 : hour;
      recordDateTime.setHours(saveHour, 0, 0, 0);
      
      const recordData = {
        residentId,
        recordDate: recordDateTime.toISOString(),
        type: 'general_note',
        notes: notes
      };
      
      if (existingIds.generalNoteId) {
        // 既存の記録内容を更新
        await apiRequest(`/api/excretion-records/${existingIds.generalNoteId}`, 'PATCH', recordData);
        console.log('🔄 記録内容を更新:', existingIds.generalNoteId);
      } else {
        // 新規記録内容を作成
        const newRecord = await apiRequest('/api/excretion-records', 'POST', recordData);
        // 新しいIDを保存
        setRecordIds(prev => ({
          ...prev,
          [generalKey]: { ...prev[generalKey], generalNoteId: newRecord.id }
        }));
        console.log('✨ 記録内容を新規作成:', newRecord.id);
      }
      
      // 正しいクエリキーで無効化
      queryClient.invalidateQueries({ queryKey: ['/api/excretion-records', selectedDate, selectedFloor] });
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  // 記録セルクリックハンドラー
  const handleNotesClick = (residentId: string, hour: number) => {
    setCurrentNotesCell({ residentId, hour });
    setNotesDialogOpen(true);
  };

  // AI分析データ保存ハンドラー
  const handleSaveAiAnalysis = async (residentId: string, analysis: string) => {
    setAiAnalysisData(prev => ({
      ...prev,
      [residentId]: analysis
    }));
    
    console.log('AI分析データ保存:', { residentId, analysis });
    
    // ここで必要に応じてAPIに送信（現在はローカルstateのみ更新）
    try {
      // 将来的にAPIエンドポイントを追加する場合はここに実装
      // await apiRequest('/api/ai-analysis', 'POST', { residentId, date: selectedDate, analysis });
      // queryClient.invalidateQueries({ queryKey: ['/api/ai-analysis'] });
    } catch (error) {
      console.error('AI分析データの保存エラー:', error);
    }
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
    let result = notesData[key] || "";
    
    // hour: -1の場合（記録列）、general_noteタイプの記録を最優先で確認
    if (hour === -1) {
      const generalKey = `${residentId}--1`;
      if (notesData[generalKey]) {
        result = notesData[generalKey];
        console.log('🔍 general_note記録を取得:', { residentId, result });
        return result;
      }
      const residentNotesKeys = Object.keys(notesData).filter(k => k.startsWith(`${residentId}-`));
      if (residentNotesKeys.length > 0) {
        // 最新の記録内容を取得（時間が最も大きいものを使用）
        const latestKey = residentNotesKeys.sort((a, b) => {
          const hourA = parseInt(a.split('-').pop() || '0');
          const hourB = parseInt(b.split('-').pop() || '0');
          return hourB - hourA; // 降順
        })[0];
        result = notesData[latestKey] || "";
        
        // 既存データの"-1時の記録: "などのプレフィックスを除去
        const timeRecordPattern = /-?\d+時の記録:\s*/;
        if (timeRecordPattern.test(result)) {
          result = result.replace(timeRecordPattern, '');
        }
        // 排泄記録の自動生成文字列も削除（新旧両フォーマット対応）
        const excretionPattern = /^\d+時の[便尿]記録(\s(\[CC:\d+\]|\(\d+CC\)))?$/;
        if (excretionPattern.test(result)) {
          result = '';
        }
      }
    }
    
    // 通常の時間指定でも同様の処理を適用
    if (result) {
      const timeRecordPattern = /-?\d+時の記録:\s*/;
      if (timeRecordPattern.test(result)) {
        result = result.replace(timeRecordPattern, '');
      }
      // 排泄記録の自動生成文字列も削除（新旧両フォーマット対応）
      const excretionPattern = /^\d+時の[便尿]記録(\s(\[CC:\d+\]|\(\d+CC\)))?$/;
      if (excretionPattern.test(result)) {
        result = '';
      }
    }
    
    console.log(`🔍 getNotesData呼出:`, {
      residentId: residentId,
      hour: hour,
      key: key,
      generalKey: hour === -1 ? `${residentId}--1` : null,
      result: result,
      allNotesDataKeys: Object.keys(notesData),
      isRecordColumn: hour === -1,
      hasGeneralNote: hour === -1 && notesData[`${residentId}--1`] ? true : false
    });
    return result;
  };

  // 自立データ取得
  const getAssistanceData = (residentId: string, type: 'stool' | 'urine'): string => {
    const key = `${residentId}--1`;
    return assistanceData[key]?.[type] || "";
  };

  // AI分析データ取得
  const getAiAnalysisData = (residentId: string): string => {
    return aiAnalysisData[residentId] || "";
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('date', selectedDate);
              params.set('floor', selectedFloor === '全階' ? 'all' : selectedFloor.replace('階', ''));
              const targetUrl = `/?${params.toString()}`;
              setLocation(targetUrl);
            }}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800" data-testid="text-title">
            排泄一覧
          </h1>
        </div>
      </div>

      {/* フィルタ条件 */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
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
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-16 sm:w-20 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="全階">全階</option>
              <option value="1階">1階</option>
              <option value="2階">2階</option>
              <option value="3階">3階</option>
              <option value="4階">4階</option>
              <option value="5階">5階</option>
            </select>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="px-1">
        <div className="flex bg-white rounded-t-lg border-b border-gray-200">
          <button
            onClick={() => setActiveTab('record')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'record'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            記録
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'summary'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            合計
          </button>
        </div>
      </div>

      {/* コンテンツ - タブごとに異なる */}
      <div className="px-1 py-2">
        {activeTab === 'record' ? (
          /* 記録タブ - 既存の排泄記録テーブル */
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs table-fixed">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center w-12 bg-gray-100 sticky left-0 z-20">
                    {/* 空白 */}
                  </th>
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center w-[36px] text-xs overflow-hidden bg-gray-100 sticky left-12 z-20">
                    {/* 空白 */}
                  </th>
                  <th className="border-r border-b border-gray-200 px-0 py-1 text-center w-[40px] text-xs overflow-hidden">自立</th>
                  <th className="border-r border-b border-gray-200 px-1 py-1 text-center w-[40px] text-xs overflow-hidden">記録</th>
                  {hours.map(hour => (
                    <th key={hour} className="border-r border-b border-gray-200 px-0 py-1 text-center w-[28px] text-xs overflow-hidden border-solid">
                      {hour}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map((resident: Resident) => {
                  const residentId = resident.id;
                  return [
                      // 便の行
                      <tr key={`${residentId}-stool`}>
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center bg-gray-100 sticky left-0 z-10" rowSpan={2}>
                        <div className="text-xs font-bold">{resident.roomNumber}</div>
                        <div className="text-xs text-gray-600 leading-tight font-bold">
                          {resident.name.includes(' ') ? 
                            resident.name.split(' ').map((part, index) => (
                              <div key={`${resident.id}-name-${index}`}>{part}</div>
                            )) : 
                            <div>{resident.name}</div>
                          }
                        </div>
                      </td>
                      <td className="border-r border-gray-200 border-b border-gray-200 px-1 py-1 text-center w-[36px] text-xs overflow-hidden font-bold bg-gray-100 sticky left-12 z-10">便</td>
                      <td className="border-r border-gray-200 border-b border-gray-200 px-0 py-1 text-center w-[40px] text-xs overflow-hidden">
                        <input
                          type="text"
                          value={getAssistanceData(resident.id, 'stool')}
                          onChange={(e) => {
                            const key = `${resident.id}--1`;
                            setAssistanceData(prev => ({
                              ...prev,
                              [key]: { ...prev[key], stool: e.target.value }
                            }));
                            handleCellClick(resident.id, -1, 'stool', 'status', e.target.value);
                          }}
                          placeholder="入力"
                          className="w-full h-6 text-xs text-center border border-dashed border-gray-300 bg-blue-50 hover:bg-blue-100 focus:bg-white focus:border-blue-500 focus:outline-none font-bold rounded cursor-text transition-colors px-0.5"
                        />
                      </td>
                      <td 
                        className="border-r border-b border-gray-200 px-1 py-1 text-center cursor-pointer hover:bg-blue-100 w-[40px] text-xs overflow-hidden bg-blue-50 transition-colors"
                        rowSpan={2}
                        onClick={() => handleNotesClick(resident.id, -1)}
                      >
                        <div className="text-xs leading-tight">
                          {getNotesData(resident.id, -1).substring(0, 3) || "記録"}
                        </div>
                      </td>
                      {hours.map(hour => {
                        const data = getCellData(resident.id, hour);
                        const displayText = getDisplayText(data, 'stool');
                        return (
                          <td 
                            key={hour} 
                            className="border-r border-gray-200 border-b border-gray-200 px-0 py-1 text-center cursor-pointer hover:bg-blue-50 w-[28px] text-xs overflow-hidden"
                            onClick={() => handleTimesCellClick(resident.id, hour)}
                          >
                            <div className="text-xs whitespace-pre-line leading-tight">
                              {displayText}
                            </div>
                          </td>
                        );
                      })}
                    </tr>,
                      // 尿の行
                      <tr key={`${residentId}-urine`} className="border-b-2 border-gray-300">
                      <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-[36px] text-xs overflow-hidden font-bold bg-gray-100 sticky left-12 z-10">尿</td>
                      <td className="border-r border-b border-gray-200 px-0 py-1 text-center w-[40px] text-xs overflow-hidden">
                        <input
                          type="text"
                          value={getAssistanceData(resident.id, 'urine')}
                          onChange={(e) => {
                            const key = `${resident.id}--1`;
                            setAssistanceData(prev => ({
                              ...prev,
                              [key]: { ...prev[key], urine: e.target.value }
                            }));
                            handleCellClick(resident.id, -1, 'urine', 'status', e.target.value);
                          }}
                          placeholder="入力"
                          className="w-full h-6 text-xs text-center border border-dashed border-gray-300 bg-blue-50 hover:bg-blue-100 focus:bg-white focus:border-blue-500 focus:outline-none font-bold rounded cursor-text transition-colors px-0.5"
                        />
                      </td>
                      {/* 記録列は上の行でrowSpan={2}でマージされているため、ここにはセルなし */}
                      {hours.map(hour => {
                        const data = getCellData(resident.id, hour);
                        const displayText = getDisplayText(data, 'urine');
                        return (
                          <td 
                            key={`${hour}-record`} 
                            className="border-r border-b border-gray-200 px-0 py-1 text-center cursor-pointer hover:bg-blue-50 w-[28px] text-xs overflow-hidden"
                            onClick={() => handleTimesCellClick(resident.id, hour)}
                          >
                            <div className="text-xs leading-tight">
                              {displayText}
                            </div>
                          </td>
                        );
                      })}
                      </tr>
                  ];
                })}
              </tbody>
            </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* 合計タブ - 新しい合計テーブル */
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs table-fixed">
                  <tbody>
                    {filteredResidents.map((resident: Resident) => {
                      // 合計データの計算
                      const stoolCount = hours.reduce((total, hour) => {
                        const data = getCellData(resident.id, hour);
                        // 便量が「多」または「中」の場合のみカウント
                        if (data.stoolAmount === '多' || data.stoolAmount === '中') {
                          return total + 1;
                        }
                        return total;
                      }, 0) + (() => {
                        // 自立便を追加
                        const independentStool = getAssistanceData(resident.id, 'stool');
                        return (independentStool && !isNaN(parseInt(independentStool))) ? parseInt(independentStool) : 0;
                      })();
                      
                      const urineCount = hours.reduce((total, hour) => {
                        const data = getCellData(resident.id, hour);
                        if (!data.urineAmount) return total;
                        
                        // 尿量の値に応じて回数を計算
                        switch (data.urineAmount) {
                          case "○": return total + 1;
                          case "×": return total + 0;
                          case "2": return total + 2;
                          case "3": return total + 3;
                          case "4": return total + 4;
                          case "5": return total + 5;
                          case "6": return total + 6;
                          default:
                            // 数値の場合は parseInt で処理
                            const numValue = parseInt(data.urineAmount);
                            return total + (isNaN(numValue) ? 0 : numValue);
                        }
                      }, 0);
                      
                      // 最終便からの経過日数を計算（便量が「多」または「中」の場合のみカウント）
                      const today = new Date(selectedDate);
                      let daysSinceLastStool = '';
                      if (excretionRecords) {
                        const residentStoolRecords = excretionRecords
                          .filter((r: any) => 
                            r.residentId === resident.id && 
                            r.type === 'bowel_movement' &&
                            (r.amount === '多' || r.amount === '中')
                          )
                          .sort((a: any, b: any) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());

                        if (residentStoolRecords.length > 0) {
                          const lastStoolDate = new Date(residentStoolRecords[0].recordDate);
                          const diffTime = today.getTime() - lastStoolDate.getTime();
                          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                          daysSinceLastStool = `${diffDays}日`;
                        } else {
                          daysSinceLastStool = '-';
                        }
                      }
                      
                      // 尿量計の合計を計算
                      const totalUrineCC = hours.reduce((total, hour) => {
                        const data = getCellData(resident.id, hour);
                        const cc = parseInt(data.urineCC) || 0;
                        return total + cc;
                      }, 0);

                      // AI分析の生成（簡易実装）
                      const generateAIAnalysis = (residentId: string, records: any[]) => {
                        if (!records) {
                          return "分析中...";
                        }
                        const residentRecords = records.filter((r: any) => r.residentId === residentId);
                        
                        if (residentRecords.length === 0) {
                          return "傾向：過去30日間の記録が\nありません。\n注意：記録漏れの可能性があります。";
                        }

                        const stoolRecords = residentRecords.filter((r: any) => r.type === 'bowel_movement');
                        const urineRecords = residentRecords.filter((r: any) => r.type === 'urination');

                        let trend = `傾向：過去30日間で${stoolRecords.length}回の排便、${urineRecords.length}回の排尿がありました。`;
                        let attention = "注意：";

                        if (stoolRecords.length === 0) {
                          attention += "30日間排便がありません。重度の便秘の可能性があります。";
                        } else {
                          const wateryStool = stoolRecords.some((r: any) => r.consistency === '水様便');
                          if (wateryStool) {
                            trend += "水様便が見られます。";
                            attention += "下剤の影響や感染症の可能性も考えられます。";
                          }
                        }

                        if (urineRecords.length < 30) {
                            attention += "尿の回数が少ないようです。水分摂取量を確認してください。";
                        }
                        
                        if (attention === "注意：") {
                          attention += "特記事項はありません。";
                        }

                        return trend + "\n" + attention;
                      };

                      const aiAnalysis = generateAIAnalysis(resident.id, excretionRecords);
                      
                      // 編集済みのAI分析があればそれを使用、なければ自動生成されたものを使用
                      const currentAiAnalysis = getAiAnalysisData(resident.id) || aiAnalysis;
                      
                      const residentId = resident.id;
                      return [
                          // 便の行
                          <tr key={`${residentId}-stool`}>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center bg-gray-100 sticky left-0 z-10 w-16" rowSpan={2}>
                              <div className="text-xs font-bold">{resident.roomNumber}</div>
                              <div className="text-xs text-gray-600 leading-tight font-bold">
                                {resident.name.includes(' ') ? 
                                  resident.name.split(' ').map((part, index) => (
                                    <div key={`${resident.id}-name-${index}`}>{part}</div>
                                  )) : 
                                  <div>{resident.name}</div>
                                }
                              </div>
                            </td>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              便計
                            </td>
                            <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-10">
                              <span className="text-xs font-bold">{stoolCount > 0 ? stoolCount : ''}</span>
                            </td>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              最終便
                            </td>
                            <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-16">
                              <span className="text-xs font-bold">{daysSinceLastStool}</span>
                            </td>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              サイズ
                            </td>
                            <td className="border-b border-gray-200 px-1 py-1 text-center w-16">
                              <span className="text-xs font-bold">{resident.diaperSize || ''}</span>
                            </td>
                            <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-64" rowSpan={2}>
                              <textarea
                                value={currentAiAnalysis}
                                onChange={(e) => {
                                  // リアルタイムでローカルstateを更新
                                  setAiAnalysisData(prev => ({
                                    ...prev,
                                    [resident.id]: e.target.value
                                  }));
                                }}
                                onBlur={(e) => {
                                  // カーソルアウト時にデータを保存
                                  handleSaveAiAnalysis(resident.id, e.target.value);
                                }}
                                className="w-full h-24 text-xs p-1 border border-gray-300 rounded bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="AI分析結果を編集できます..."
                              />
                            </td>
                          </tr>
                          ,
                          // 尿の行
                          <tr key={`${residentId}-urine`} className="border-b-2 border-gray-300"> 
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              尿計
                            </td>
                            <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-10">
                              <span className="text-xs font-bold">{urineCount > 0 ? urineCount : ''}</span>
                            </td>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              尿量計
                            </td>
                            <td className="border-r border-b border-gray-200 px-1 py-1 text-center w-16">
                              <span className="text-xs font-bold">{totalUrineCC > 0 ? `${totalUrineCC}cc` : ''}</span>
                            </td>
                            <td className="border-r border-b border-gray-200 px-0.5 py-1 text-center text-xs bg-gray-100 w-12">
                              コース
                            </td>
                            <td className="border-b border-gray-200 px-1 py-1 text-center w-16">
                              <span className="text-xs font-bold">{resident.diaperType || ''}</span>
                            </td>
                          </tr>
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
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
