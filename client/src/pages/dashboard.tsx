import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import ModuleCard from "@/components/dashboard/module-card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  Bell,
  ClipboardList,
  Route,
  Utensils,
  Heart,
  Droplets,
  Sparkles,
  Waves,
  Scale,
  Stethoscope,
  Package,
  ListChecks,
  BookOpen,
  CheckSquare,
  Settings,
  Calendar,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useUnreadStaffNoticesCount } from "@/hooks/useStaffNotices";


export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // 未読連絡事項数を取得
  const { data: unreadCount = 0, refetchUnreadCount } = useUnreadStaffNoticesCount();
  
  // 日付とフロア選択のstate - デフォルト値で初期化
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedFloor, setSelectedFloor] = useState("all");

  // Wouterの現在のロケーションを監視
  const [location] = useLocation();
  
  // URLパラメータから値を設定（URL変更時に実行）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const floorParam = urlParams.get('floor');

    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    }
    if (floorParam) {
      setSelectedFloor(floorParam);
    }
  }, [location]); // locationが変更されるたびに実行
  
  // 未チェック看護記録の有無を確認
  const { data: hasUncheckedNursingRecords, isPending: isCheckingNursingRecords } = useQuery({
    queryKey: ["hasUncheckedNursingRecords", selectedDate],
    queryFn: async () => {
      try {
        const allBathingRecords = await apiRequest("/api/bathing-records");
        if (!allBathingRecords || !Array.isArray(allBathingRecords)) {
          return false;
        }
        const selectedDateRecords = allBathingRecords.filter((bathing: any) => {
          const bathingDate = format(new Date(bathing.recordDate), "yyyy-MM-dd");
          return bathingDate === format(selectedDate, "yyyy-MM-dd");
        });
        const uncheckedRecords = selectedDateRecords.filter((record: any) => {
          const hasCompleteVitals = record.temperature && 
                                  record.bloodPressureSystolic && 
                                  record.pulseRate && 
                                  record.oxygenSaturation;
          return hasCompleteVitals && !record.nursingCheck;
        });
        return uncheckedRecords.length > 0;
      } catch (error) {
        console.error("未チェック看護記録の確認でエラー:", error);
        return false;
      }
    },
    staleTime: 0, // 常に最新データを取得
    refetchOnMount: true, // マウント時に再取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
  });

  // 階数変更時にlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('selectedFloor', selectedFloor);
  }, [selectedFloor]);



  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "未認証",
        description: "ログインが必要です。ログイン画面に移動します...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleModuleClick = (path: string) => {
    // 選択された日付とフロアをURLパラメータとして渡す
    const params = new URLSearchParams();
    params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    params.set('floor', selectedFloor);
    navigate(`${path}?${params.toString()}`);
  };


  const primaryModules = [
    {
      icon: Users,
      title: "ご利用者情報",
      description: "利用者管理",
      color: "orange",
      path: "/user-info"
    },
    {
      icon: Bell,
      title: "連絡事項",
      description: "申し送り・連絡",
      color: "slate",
      path: "/communications"
    },
    {
      icon: ClipboardList,
      title: "介護記録",
      description: "日常介護記録",
      color: "blue",
      path: "/care-records"
    },
    {
      icon: Route,
      title: "ラウンド",
      description: "巡回記録",
      color: "blue",
      path: "/rounds"
    },
    {
      icon: Utensils,
      title: "食事/服薬",
      description: "食事・投薬記録",
      color: "blue",
      path: "/meals-medication"
    },
    {
      icon: Heart,
      title: "バイタル",
      description: "生体情報測定",
      color: "blue",
      path: "/vitals"
    },
    {
      icon: Droplets,
      title: "排泄",
      description: "排泄記録",
      color: "blue",
      path: "/excretion"
    },
    {
      icon: Sparkles,
      title: "清掃リネン",
      description: "清拭・リネン交換",
      color: "blue",
      path: "/cleaning-linen-list"
    },
    {
      icon: Waves,
      title: "入浴",
      description: "入浴記録",
      color: "blue",
      path: "/bathing-list"
    },

    {
      icon: Scale,
      title: "体重",
      description: "体重測定記録",
      color: "blue",
      path: "/weight-list"
    },
    {
      icon: Stethoscope,
      title: "看護記録",
      description: "看護ケア記録",
      color: "green",
      path: "/nursing-records-list"
    },
    {
      icon: Package,
      title: "処置一覧",
      description: "医療処置記録",
      color: "green",
      path: "/treatment-list"
    }
  ];

  const secondaryModules = [
    {
      icon: ListChecks,
      title: "今日の記録一覧",
      description: "本日の全記録確認",
      color: "slate",
      span: 2,
      path: "/daily-records"
    },
    {
      icon: BookOpen,
      title: "介護/看護日誌",
      description: "日誌・報告書",
      color: "slate",
      span: 2,
      path: "/nursing-journal"
    }
  ];

  const managementModules = [
    {
      icon: CheckSquare,
      title: "チェック一覧",
      description: "確認事項・点検項目",
      color: "pink",
      span: 2,
      path: "/check-list-menu"
    },
    {
      icon: Settings,
      title: "管理メニュー",
      description: "システム管理・設定",
      color: "pink",
      span: 2,
      path: "/management-menu"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      {/* 日付とフロア選択 */}
      <div className="bg-white p-3 shadow-sm border-b">
        <div className="flex gap-2 items-center justify-center">
          {/* 日付選択 */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-1 py-0.5 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
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

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 h-[calc(100vh-120px)] overflow-y-auto">
        <div>
          <div>
            {/* Primary Modules - より密なレイアウト */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 sm:gap-2 mb-1 sm:mb-2">
              {primaryModules.map((module) => (
                <ModuleCard
                  key={module.path}
                  icon={module.icon}
                  title={module.title}
                  description={module.description}
                  color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
                  onClick={() => handleModuleClick(module.path)}
                  compact={true}
                  badge={module.path === "/communications" && unreadCount > 0 ? unreadCount : 
                         module.path === "/nursing-records-list" && !isCheckingNursingRecords && hasUncheckedNursingRecords ? "未" : null}
                />
              ))}
            </div>

            {/* Secondary Actions - 2列レイアウト */}
            <div className="grid grid-cols-2 gap-1 sm:gap-2 mb-1 sm:mb-2">
              {secondaryModules.map((module) => (
                <ModuleCard
                  key={module.path}
                  icon={module.icon}
                  title={module.title}
                  description={module.description}
                  color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
                  onClick={() => handleModuleClick(module.path)}
                  compact={true}
                />
              ))}
            </div>

            {/* Management Actions - 2列レイアウト */}
            <div className="grid grid-cols-2 gap-1 sm:gap-2 mb-1 sm:mb-2">
              {managementModules.map((module) => (
                <ModuleCard
                  key={module.path}
                  icon={module.icon}
                  title={module.title}
                  description={module.description}
                  color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
                  onClick={() => handleModuleClick(module.path)}
                  compact={true}
                />
              ))}
            </div>

          </div>
        </div>
      </main>


    </div>
  );
}
