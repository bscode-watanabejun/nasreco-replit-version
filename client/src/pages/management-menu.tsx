import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Users, Archive, Building, UserCog, Database, HelpCircle, Bell } from "lucide-react";
import { useLocation } from "wouter";

export default function ManagementMenu() {
  const [, navigate] = useLocation();

  const menuItems = [
    {
      id: "contacts",
      icon: <Bell className="w-8 h-8" />,
      title: "連絡事項管理",
      description: "職員への連絡事項を管理する画面です。職員への連絡事項の作成、確認、編集が行えます。",
      onClick: () => {
        // TODO: Implement contact management
        console.log("連絡事項管理");
      }
    },
    {
      id: "users",
      icon: <Users className="w-8 h-8" />,
      title: "ご利用者管理",
      description: "入居者様の基本情報を管理する画面です。入居者様の個人情報、サービス内容の登録や変更が行えます。",
      onClick: () => {
        // TODO: Implement user management
        console.log("ご利用者管理");
      }
    },
    {
      id: "past-records",
      icon: <Archive className="w-8 h-8" />,
      title: "退去者管理",
      description: "退去された方の情報を管理する画面です。過去者の情報照会や、再入居時の情報照会元などが行えます。",
      onClick: () => {
        // TODO: Implement past records management
        console.log("退去者管理");
      }
    },
    {
      id: "employees",
      icon: <UserCog className="w-8 h-8" />,
      title: "職員管理",
      description: "職員の情報を管理する画面です。職員の基本情報、権限情報の登録や変更が行えます。",
      onClick: () => {
        // TODO: Implement employee management
        console.log("職員管理");
      }
    },
    {
      id: "facility",
      icon: <Building className="w-8 h-8" />,
      title: "施設設定",
      description: "施設の基本情報を設定する画面です。施設の基本情報や、各種基準値、施設介護料介護システムの切り替えなどの設定が行えます。",
      onClick: () => {
        // TODO: Implement facility settings
        console.log("施設設定");
      }
    },
    {
      id: "master",
      icon: <Database className="w-8 h-8" />,
      title: "マスタ設定",
      description: "システムのマスタ情報を設定する画面です。薬、食事その他など、システム全体で使用するマスタの設定が行えます。",
      onClick: () => {
        // TODO: Implement master settings
        console.log("マスタ設定");
      }
    },
    {
      id: "support",
      icon: <HelpCircle className="w-8 h-8" />,
      title: "問い合わせ",
      description: "システムに関する問い合わせを行う画面です。操作方法の質問や不具合の報告などを行えます。",
      onClick: () => {
        // TODO: Implement support/inquiry
        console.log("問い合わせ");
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center space-x-2"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">ダッシュボードに戻る</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                管理メニュー
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-1"
              data-testid="button-menu-toggle"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left sidebar with menu items */}
          <div className="space-y-4">
            {menuItems.map((item) => (
              <Card 
                key={item.id} 
                className="cursor-pointer hover:shadow-md transition-shadow bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800"
                onClick={item.onClick}
                data-testid={`card-menu-${item.id}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-3 text-pink-800 dark:text-pink-200">
                    <div className="p-2 bg-pink-500 text-white rounded-lg">
                      {item.icon}
                    </div>
                    <span className="text-lg font-medium">{item.title}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Right side with descriptions */}
          <div className="space-y-6">
            {menuItems.map((item) => (
              <div 
                key={`desc-${item.id}`}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                data-testid={`description-${item.id}`}
              >
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}