import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Users, Info } from "lucide-react";
import { useLocation } from "wouter";
import type { Resident } from "@shared/schema";

export default function UserInfoView() {
  const [, navigate] = useLocation();
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-orange-500 shadow-sm border-b border-orange-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
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

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {/* Residents List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">ご利用者一覧</h2>
          {!residents || residents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">ご利用者情報がありません</p>
                <p className="text-sm text-gray-500 mt-2">管理画面からご利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {residents
                .filter(resident => resident.isActive !== false)
                .sort((a, b) => {
                  const roomA = parseInt(a.roomNumber || '999999');
                  const roomB = parseInt(b.roomNumber || '999999');
                  return roomA - roomB;
                })
                .map((resident: Resident) => (
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
            <div className="space-y-6">
              {/* 基本情報 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">部屋番号</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.roomNumber)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">フロア</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.floor)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">利用者名</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">性別</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.gender)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">入居日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedResident.admissionDate)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">生年月日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedResident.dateOfBirth)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">年齢</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.age || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">郵便番号</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.postalCode)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">要介護度</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.careLevel)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">割合</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.careLevelRatio)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.address)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">主治医</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.attendingPhysician)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">保険番号</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.insuranceNumber)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">介護認定期間 From</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedResident.careAuthorizationPeriodStart)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">介護認定期間 To</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedResident.careAuthorizationPeriodEnd)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">退去日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedResident.retirementDate)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">入院</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.isAdmitted)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 緊急連絡先 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">緊急連絡先</h3>
                  <div className="space-y-6">
                    {/* 緊急連絡先1 */}
                    <div>
                      <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">緊急連絡先1</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">氏名</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact1Name)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">続柄</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact1Relationship)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号1</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact1Phone1)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号2</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact1Phone2)}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact1Address)}</p>
                        </div>
                      </div>
                    </div>

                    {/* 緊急連絡先2 */}
                    <div>
                      <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">緊急連絡先2</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">氏名</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact2Name)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">続柄</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact2Relationship)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号1</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact2Phone1)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号2</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact2Phone2)}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatString(selectedResident.emergencyContact2Address)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 服薬時間帯 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">服薬時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">朝後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationMorning)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationEvening)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">朝前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationMorningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationEveningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昼後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationBedtime)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationOther)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 目薬時間帯 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">目薬時間帯</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">朝後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsMorning)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsEvening)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">朝前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsMorningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsEveningBefore)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昼後</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsBedtime)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.eyeDropsOther)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 服薬時間帯 週次 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">服薬時間帯 週次</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">月曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">火曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">水曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">木曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">金曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">土曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">日曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationTimeSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 服薬時間帯 月次 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">服薬時間帯 月次</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">経口 (昼)</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.mealLunch)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">経口 (夕)</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.mealDinner)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">月次</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.medicationFrequency || "未設定"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 週間服薬 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">週間服薬</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">月曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">火曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">水曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">木曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">金曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">土曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">日曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationWeekSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 清拭・リネン交換日 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">清拭・リネン交換日</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">月曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">火曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">水曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">木曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">金曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">土曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">日曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathingSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 入浴日 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">入浴日</h3>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">月曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathMonday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">火曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathTuesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">水曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathWednesday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">木曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathThursday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">金曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathFriday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">土曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathSaturday)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">日曜日</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.bathSunday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 排泄 */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">排泄</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">自立便</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.excretionTimeUrineStanding)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">介助便</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.excretionTimeUrineAssisted)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">排泄時間</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.excretionTime || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">おむつサイズ</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.diaperSize || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">おむつコース</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.diaperType || "未設定"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* その他の特記事項 */}
              {selectedResident.notes && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">その他の特記事項</h3>
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