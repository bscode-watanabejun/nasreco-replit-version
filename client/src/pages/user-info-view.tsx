import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Users, Info } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Resident {
  id: number;
  roomNumber?: string;
  floor?: string;
  name: string;
  gender?: string;
  admissionDate?: string;
  retirementDate?: string;
  dateOfBirth?: string;
  age?: string;
  postalCode?: string;
  address?: string;
  attendingPhysician?: string;
  careLevel?: string;
  insuranceNumber?: string;
  careAuthorizationPeriod?: string;
  isAdmitted?: boolean;
  
  // 緊急連絡先1
  emergencyContact1Name?: string;
  emergencyContact1Relationship?: string;
  emergencyContact1Phone1?: string;
  emergencyContact1Phone2?: string;
  emergencyContact1Address?: string;
  
  // 緊急連絡先2
  emergencyContact2Name?: string;
  emergencyContact2Relationship?: string;
  emergencyContact2Phone1?: string;
  emergencyContact2Phone2?: string;
  emergencyContact2Address?: string;
  
  // 服薬時間帯
  medicationMorning?: boolean;
  medicationLunch?: boolean;
  medicationEvening?: boolean;
  medicationBedtime?: boolean;
  
  // その他の情報
  personalMemo?: string;
}

export default function UserInfoView() {
  const [, navigate] = useLocation();
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all residents
  const { data: residents = [] } = useQuery<Resident[]>({
    queryKey: ["/api/residents"],
    queryFn: () => apiRequest("/api/residents", "GET"),
  });

  const handleInfoClick = (resident: Resident) => {
    setSelectedResident(resident);
    setDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "未設定";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ja-JP");
    } catch {
      return dateString;
    }
  };

  const formatBoolean = (value?: boolean) => {
    if (value === undefined) return "未設定";
    return value ? "あり" : "なし";
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Residents List */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">ご利用者一覧</h2>
          {residents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">ご利用者情報がありません</p>
                <p className="text-sm text-gray-500 mt-2">管理画面からご利用者を登録してください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {residents.map((resident: Resident) => (
                <Card 
                  key={resident.id} 
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-blue-600">
                            {resident.roomNumber || "未設定"}
                          </div>
                          <div className="text-xs text-gray-500">号室</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base truncate">{resident.name}</div>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {resident.careLevel || "未設定"}
                          </div>
                          <div className="text-xs text-gray-500">介護度</div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInfoClick(resident)}
                        className="flex items-center gap-1"
                      >
                        <Info className="w-4 h-4" />
                        情報
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
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.roomNumber || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">フロア</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.floor || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">利用者名</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">性別</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.gender || "未設定"}</p>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">要介護度</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.careLevel || "未設定"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.address || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">主治医</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.attendingPhysician || "未設定"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">保険番号</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.insuranceNumber || "未設定"}</p>
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
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact1Name || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">続柄</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact1Relationship || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号1</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact1Phone1 || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号2</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact1Phone2 || "未設定"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact1Address || "未設定"}</p>
                        </div>
                      </div>
                    </div>

                    {/* 緊急連絡先2 */}
                    <div>
                      <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">緊急連絡先2</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">氏名</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact2Name || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">続柄</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact2Relationship || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号1</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact2Phone1 || "未設定"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号2</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact2Phone2 || "未設定"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedResident.emergencyContact2Address || "未設定"}</p>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">朝</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationMorning)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昼</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationLunch)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">夕</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationEvening)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">就寝前</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatBoolean(selectedResident.medicationBedtime)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 個人メモ */}
              {selectedResident.personalMemo && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">個人メモ</h3>
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedResident.personalMemo}
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