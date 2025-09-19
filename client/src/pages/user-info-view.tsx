import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Users, Info, Calendar, Building } from "lucide-react";
import ResidentAttachmentsView from "@/components/ResidentAttachmentsView";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Resident } from "@shared/schema";


export default function UserInfoView() {
  const [, navigate] = useLocation();
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  });
  const [selectedFloor, setSelectedFloor] = useState<string>(urlParams.get('floor') || "all");

  // Fetch all residents
  const { data: residents = [], isLoading } = useQuery<Resident[]>({
    queryKey: ["/api/residents"],
  });

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const handleInfoClick = (resident: Resident) => {
    setSelectedResident(resident);
    setDialogOpen(true);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "未設定";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ja-JP");
    } catch {
      return dateString;
    }
  };

  const formatBoolean = (value?: boolean | null) => {
    if (value === undefined || value === null) return "未設定";
    return value ? "あり" : "なし";
  };

  const formatString = (value?: string | null) => {
    return value || "未設定";
  };

  // 階数のオプションを生成（利用者データから）
  const floorOptions = [
    { value: "all", label: "全階" },
    ...Array.from(new Set((residents as any[]).map(r => {
      // "1F", "2F" などのF文字を除去して数値のみ取得
      const floor = r.floor?.toString().replace('F', '');
      return floor ? parseInt(floor) : null;
    }).filter(Boolean)))
      .sort((a, b) => (a || 0) - (b || 0))
      .map(floor => ({ value: (floor || 0).toString(), label: `${floor || 0}階` }))
  ];
  

  // フィルター適用済みの利用者一覧
  const filteredResidents = (residents as any[]).filter((resident: any) => {
    // アクティブな利用者のみ表示
    if (resident.isActive === false) {
      return false;
    }
    
    // 階数フィルター
    if (selectedFloor !== "all") {
      if (!resident.floor) {
        return false;
      }
      
      // 複数のパターンでマッチを試みる
      const residentFloorStr = resident.floor?.toString();
      const residentFloorNum = residentFloorStr?.replace(/[^\d]/g, ''); // 数字のみ抽出
      const selectedFloorNum = selectedFloor.replace(/[^\d]/g, ''); // 数字のみ抽出
      
      const matches = 
        residentFloorStr === selectedFloor || // 完全一致
        residentFloorNum === selectedFloor || // 数字部分が一致
        residentFloorNum === selectedFloorNum || // 両方の数字部分が一致
        residentFloorStr === selectedFloor + 'F' || // selectedFloorにFを追加した形と一致
        residentFloorStr === selectedFloor + '階'; // selectedFloorに階を追加した形と一致
      
      
      if (!matches) {
        return false;
      }
    }
    
    // 日付フィルター（入所日・退所日による絞り込み）
    const filterDate = selectedDate;
    const admissionDate = resident.admissionDate ? new Date(resident.admissionDate) : null;
    const retirementDate = resident.retirementDate ? new Date(resident.retirementDate) : null;
    
    // 入所日がある場合、選択した日付が入所日以降である必要がある
    if (admissionDate && filterDate < admissionDate) {
      return false;
    }
    
    // 退所日がある場合、選択した日付が退所日以前である必要がある
    if (retirementDate && filterDate > retirementDate) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    const roomA = parseInt(a.roomNumber || '999999');
    const roomB = parseInt(b.roomNumber || '999999');
    return roomA - roomB;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Fixed */}
      <div className="bg-orange-500 shadow-sm border-b border-orange-600 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedDate) params.set('date', format(selectedDate, 'yyyy-MM-dd'));
                  if (selectedFloor) params.set('floor', selectedFloor);
                  const targetUrl = `/?${params.toString()}`;
                  navigate(targetUrl);
                }}
                className="p-2 text-white hover:bg-orange-600"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-white">
                ご利用者情報
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls - Fixed */}
      <div className="bg-white p-3 shadow-sm border-b sticky top-16 z-40">
        <div className="flex gap-2 items-center justify-center flex-wrap">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">全階</option>
                <option value="1">1階</option>
                <option value="2">2階</option>
                <option value="3">3階</option>
                <option value="4">4階</option>
                <option value="5">5階</option>
              </select>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-1 pt-2">
        {/* Residents List */}
        <div className="mb-6">
          {!filteredResidents || filteredResidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">ご利用者情報がありません</p>
                <p className="text-sm text-gray-500 mt-2">管理画面からご利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {filteredResidents.map((resident: Resident) => (
                <Card 
                  key={resident.id} 
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-1.5 sm:p-2">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <div className="text-center min-w-[40px] sm:min-w-[50px]">
                          <div className="text-sm sm:text-lg font-bold text-blue-600">
                            {formatString(resident.roomNumber)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm sm:text-base truncate">{resident.name}</div>
                        </div>
                        <div className="text-center min-w-[60px] sm:min-w-[80px]">
                          <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            {formatString(resident.careLevel)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInfoClick(resident)}
                        className="flex items-center gap-1 px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">情報</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ご利用者情報</DialogTitle>
            <DialogDescription>
              {selectedResident?.name}さんの詳細情報
            </DialogDescription>
          </DialogHeader>
          
          {selectedResident && (
            <div className="space-y-3">
              {/* 基本情報 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">基本情報</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">居室番号</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.roomNumber)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">階</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.floor)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">利用者名</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">性別</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.gender)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">入居日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatDate(selectedResident.admissionDate)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">退居日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatDate(selectedResident.retirementDate)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">生年月日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatDate(selectedResident.dateOfBirth)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">年齢</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.age || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">郵便番号</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.postalCode)}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">住所</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.address)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">主治医</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.attendingPhysician)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">介護度</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.careLevel)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">割合</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.careLevelRatio)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">被保険者番号</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.insuranceNumber)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">介護認定期間 From</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatDate(selectedResident.careAuthorizationPeriodStart)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">介護認定期間 To</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatDate(selectedResident.careAuthorizationPeriodEnd)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">入院</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.isAdmitted)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 緊急連絡先 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">緊急連絡先</h3>
                  <div className="space-y-3">
                    {/* 緊急連絡先1 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">緊急連絡先1</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">氏名1</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact1Name)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">続柄1</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact1Relationship)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">電話1-1</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact1Phone1)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">電話1-2</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact1Phone2)}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">住所</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact1Address)}</p>
                        </div>
                      </div>
                    </div>

                    {/* 緊急連絡先2 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">緊急連絡先2</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">氏名2</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact2Name)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">続柄2</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact2Relationship)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">電話2-1</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact2Phone1)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">電話2-2</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact2Phone2)}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">住所</label>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatString(selectedResident.emergencyContact2Address)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 服薬時間帯 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">服薬時間帯</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">起床後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWakeup)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">朝前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationMorningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">朝後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationMorning)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">昼前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationNoonBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">昼後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationBedtime)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">夕前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationEveningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">夕後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationEvening)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">眠前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationSleep)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">頓服</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationAsNeeded)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* 服薬時間帯 週次 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">服薬時間帯 週次</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">月曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">火曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">水曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">木曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">金曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">土曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">日曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationTimeSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 服薬時間帯　月次 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">服薬時間帯　月次</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">月次</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.medicationFrequency || "未設定"}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">食事</label>
                      <div className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">経管:</span>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.mealLunch)}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">経口:</span>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.mealDinner)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 点眼時間帯 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">点眼時間帯</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">起床後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsWakeup)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">朝前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsMorningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">朝後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsMorning)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">昼前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsNoonBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">昼後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsBedtime)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">夕前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsEveningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">夕後</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsEvening)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">眠前</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsSleep)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">頓服</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.eyeDropsAsNeeded)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 点眼時間帯　週次 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">点眼時間帯　週次</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">月曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">火曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">水曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">木曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">金曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">土曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">日曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.medicationWeekSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 清掃・リネン交換日 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">清掃・リネン交換日</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">月曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">火曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">水曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">木曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">金曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">土曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">日曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathingSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 入浴日 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">入浴日</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">月曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">火曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">水曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">木曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">金曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">土曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">日曜日</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.bathSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 排泄 */}
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">排泄</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">自立便</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.excretionTimeUrineStanding)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">介助便</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{formatBoolean(selectedResident.excretionTimeUrineAssisted)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">排泄時間</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.excretionTime || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">おむつサイズ</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.diaperSize || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">おむつコース</label>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedResident.diaperType || "未設定"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 添付ファイル */}
              <Card>
                <CardContent className="p-4">
                  <ResidentAttachmentsView 
                    residentId={selectedResident.id} 
                    title="添付ファイル"
                  />
                </CardContent>
              </Card>

              {/* 備考 */}
              {selectedResident.notes && (
                <Card>
                  <CardContent className="p-3">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">備考</h3>
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedResident.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}