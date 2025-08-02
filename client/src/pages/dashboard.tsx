import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import ModuleCard from "@/components/dashboard/module-card";
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
  Book,
  LogOut,
  Calendar,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // 日付とフロア選択のstate
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedFloor, setSelectedFloor] = useState("all");

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
    params.set('date', selectedDate);
    params.set('floor', selectedFloor);
    navigate(`${path}?${params.toString()}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
      title: "清拭リネン",
      description: "清拭・リネン交換",
      color: "blue",
      path: "/hygiene"
    },
    {
      icon: Waves,
      title: "入浴",
      description: "入浴記録",
      color: "blue",
      path: "/bathing"
    },
    {
      icon: Scale,
      title: "体重",
      description: "体重測定記録",
      color: "blue",
      path: "/weight"
    },
    {
      icon: Stethoscope,
      title: "看護記録",
      description: "看護ケア記録",
      color: "green",
      path: "/nursing-records"
    },
    {
      icon: Package,
      title: "処置一覧",
      description: "医療処置記録",
      color: "green",
      path: "/treatments"
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
      path: "/journals"
    }
  ];

  const managementModules = [
    {
      icon: CheckSquare,
      title: "チェック一覧",
      description: "確認事項・点検項目",
      color: "pink",
      span: 2,
      path: "/checklists"
    },
    {
      icon: Settings,
      title: "管理メニュー",
      description: "システム管理・設定",
      color: "pink",
      span: 2,
      path: "/management"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 日付とフロア選択 */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-600" />
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="フロア選択" />
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
          </div>
        </div>
        
        {/* Primary Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {primaryModules.map((module) => (
            <ModuleCard
              key={module.path}
              icon={module.icon}
              title={module.title}
              description={module.description}
              color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
              onClick={() => handleModuleClick(module.path)}
            />
          ))}
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {secondaryModules.map((module) => (
            <ModuleCard
              key={module.path}
              icon={module.icon}
              title={module.title}
              description={module.description}
              color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
              span={module.span}
              onClick={() => handleModuleClick(module.path)}
            />
          ))}
        </div>

        {/* Management Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {managementModules.map((module) => (
            <ModuleCard
              key={module.path}
              icon={module.icon}
              title={module.title}
              description={module.description}
              color={module.color as "orange" | "slate" | "blue" | "green" | "pink" | "red"}
              span={module.span}
              onClick={() => handleModuleClick(module.path)}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="outline"
            size="lg"
            onClick={() => window.open('https://manual.nasreco.bscode.co.jp/', '_blank')}
            className="bg-slate-600 hover:bg-slate-700 text-white border-slate-600"
          >
            <Book className="w-5 h-5 mr-2" />
            マニュアル
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={handleLogout}
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="w-5 h-5 mr-2" />
            ログアウト
          </Button>
        </div>
      </main>

      {/* Mobile Quick Action */}
      <div className="fixed bottom-4 right-4 sm:hidden">
        <Button 
          size="lg" 
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
          onClick={() => handleModuleClick('/care-records')}
        >
          <ClipboardList className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
