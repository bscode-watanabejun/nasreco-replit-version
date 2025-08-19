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

export default function ExcretionList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // URLパラメータから初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedDate, setSelectedDate] = useState(urlParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [selectedFloor, setSelectedFloor] = useState(urlParams.get('floor') || 'all');
  
  // 今日の日付を取得（日本語表示）
  const displayDate = format(new Date(selectedDate), 'M月d日', { locale: ja });

  // 利用者データを取得
  const { data: residents } = useQuery({
    queryKey: ['/api/residents'],
    queryFn: async () => {
      const response = await apiRequest('/api/residents');
      return response.json();
    }
  });

  // フィルタリングされた利用者リスト
  const filteredResidents = residents?.filter((resident: Resident) => {
    if (selectedFloor === 'all') return true;
    return resident.floor === selectedFloor;
  }) || [];

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
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-center w-16" rowSpan={2}>部屋</th>
                  <th className="border border-slate-300 px-2 py-1 text-center w-8" rowSpan={2}>便</th>
                  <th className="border border-slate-300 px-2 py-1 text-center w-16" rowSpan={2}>利用者</th>
                  <th className="border border-slate-300 px-2 py-1 text-center w-8" rowSpan={2}>尿</th>
                  <th className="border border-slate-300 px-2 py-1 text-center w-16" rowSpan={2}>自立<br/>記録</th>
                  <th className="border border-slate-300 px-2 py-1 text-center" colSpan={3}>合計</th>
                  {hours.map(hour => (
                    <th key={hour} className="border border-slate-300 px-1 py-1 text-center w-8">
                      {hour}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1 py-1 text-center w-8">水</th>
                  <th className="border border-slate-300 px-1 py-1 text-center w-8">少</th>
                  <th className="border border-slate-300 px-1 py-1 text-center w-8">多</th>
                  {hours.map(hour => (
                    <th key={`${hour}-sub`} className="border border-slate-300 px-1 py-1 text-center w-8">
                      {hour < 12 ? hour + 12 : hour - 12}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map((resident: Resident) => (
                  <React.Fragment key={resident.id}>
                    {/* 便の行 */}
                    <tr>
                      <td className="border border-slate-300 px-2 py-1 text-center" rowSpan={2}>
                        {resident.roomNumber}
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center">便</td>
                      <td className="border border-slate-300 px-2 py-1 text-center" rowSpan={2}>
                        {resident.name}
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center">尿</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        <InputWithDropdown
                          value=""
                          options={statusOptions}
                          onSave={(value) => handleCellClick(resident.id, -1, 'stool', 'status', value)}
                          placeholder=""
                          className="w-full h-6 text-xs text-center border-0 bg-transparent focus:outline-none"
                        />
                        <br/>
                        <InputWithDropdown
                          value=""
                          options={statusOptions}
                          onSave={(value) => handleCellClick(resident.id, -1, 'urine', 'status', value)}
                          placeholder=""
                          className="w-full h-6 text-xs text-center border-0 bg-transparent focus:outline-none"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center">水</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">少</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">多</td>
                      {hours.map(hour => (
                        <td key={hour} className="border border-slate-300 px-1 py-1 text-center relative">
                          <div className="flex flex-col h-8">
                            <InputWithDropdown
                              value=""
                              options={amountOptions}
                              onSave={(value) => handleCellClick(resident.id, hour, 'stool', 'amount', value)}
                              placeholder=""
                              className="w-full h-4 text-xs text-center border-0 bg-transparent focus:outline-none"
                            />
                            <div className="border-t border-slate-200 w-full"></div>
                            <InputWithDropdown
                              value=""
                              options={amountOptions}
                              onSave={(value) => handleCellClick(resident.id, hour, 'urine', 'amount', value)}
                              placeholder=""
                              className="w-full h-4 text-xs text-center border-0 bg-transparent focus:outline-none"
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                    {/* 記録の行 */}
                    <tr>
                      <td className="border border-slate-300 px-1 py-1 text-center">記録</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">記録</td>
                      <td className="border border-slate-300 px-1 py-1 text-center" colSpan={3}></td>
                      {hours.map(hour => (
                        <td key={`${hour}-record`} className="border border-slate-300 px-1 py-1 text-center">
                          <div className="text-xs text-slate-600 min-h-[2rem] flex items-center justify-center">
                            {resident.roomNumber}
                            <br/>
                            {resident.name.split(' ')[1]}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}