import { useEffect, useState, useRef } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";

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

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // 日付とフロア選択のstate
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedFloor, setSelectedFloor] = useState("all");

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
      path: "/management-menu"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 h-[calc(100vh-60px)] overflow-hidden">
        {/* 日付とフロア選択 */}
        <div className="bg-white rounded-lg p-2 mb-2 shadow-sm">
          <div className="flex gap-2 sm:gap-4 items-center justify-center">
            {/* 日付選択 */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-6 sm:h-8 px-1 py-0 text-xs sm:text-sm border border-slate-300 rounded-md text-slate-700 bg-white"
              />
            </div>
            
            {/* フロア選択 */}
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <InputWithDropdown
                value={(() => {
                  const option = [
                    { value: "all", label: "全階" },
                    { value: "1", label: "1階" },
                    { value: "2", label: "2階" },
                    { value: "3", label: "3階" },
                    { value: "4", label: "4階" },
                    { value: "5", label: "5階" }
                  ].find(opt => opt.value === selectedFloor);
                  return option ? option.label : "全階";
                })()}
                options={[
                  { value: "all", label: "全階" },
                  { value: "1", label: "1階" },
                  { value: "2", label: "2階" },
                  { value: "3", label: "3階" },
                  { value: "4", label: "4階" },
                  { value: "5", label: "5階" }
                ]}
                onSave={(value) => setSelectedFloor(value)}
                placeholder="フロア選択"
                className="w-20 sm:w-32 h-6 sm:h-8 text-xs sm:text-sm px-1 text-center border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div className="h-[calc(100%-60px)]">
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

            {/* Bottom Actions */}
            <div className="flex gap-1 sm:gap-2 justify-center">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => window.open('https://manual.nasreco.bscode.co.jp/', '_blank')}
                className="bg-slate-600 hover:bg-slate-700 text-white border-slate-600 text-xs px-2 py-1"
              >
                <Book className="w-3 h-3 mr-1" />
                マニュアル
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 text-xs px-2 py-1"
              >
                <LogOut className="w-3 h-3 mr-1" />
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </main>


    </div>
  );
}
