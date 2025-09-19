import { useAuth } from "@/hooks/useAuth";
import { HeartPulse, User, Book, LogOut, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import ChangePasswordDialog from "@/components/change-password-dialog";

export default function Header() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const currentDate = new Date();
  const greeting = getGreeting();
  const formattedDate = format(currentDate, "yyyy年MM月dd日です", { locale: ja });

  // 職員ログインユーザーかどうかを判定
  const isStaffUser = !!(user as any)?.staffName;

  function getGreeting() {
    const hour = currentDate.getHours();
    if (hour < 10) return "おはようございます";
    if (hour < 18) return "こんにちは";
    return "こんばんは";
  }

  const handleLogoClick = () => {
    navigate("/");
  };

  const handleManualClick = () => {
    window.open('https://manual.nasreco.bscode.co.jp/', '_blank');
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={handleLogoClick}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">NASRECO</h1>
            </div>
            <div className="hidden sm:block text-slate-600">
              <span className="mr-1">{greeting}</span>
              <span className="font-medium text-slate-900">
                {(() => {
                  // 職員ログインの場合
                  if ((user as any)?.staffName) {
                    return `${(user as any).staffName}さん`;
                  }
                  // Replitユーザーの場合
                  if ((user as any)?.firstName && (user as any)?.lastName) {
                    return `${(user as any).firstName}・${(user as any).lastName}さん`;
                  }
                  // フォールバック
                  return "ユーザーさん";
                })()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-600 hidden sm:block">
              <span>{formattedDate}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600 transition-colors p-0"
                >
                  {(user as any)?.profileImageUrl ? (
                    <img
                      src={(user as any).profileImageUrl}
                      alt="Profile"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* ユーザー名表示 */}
                <div className="px-2 py-2 text-sm">
                  <div className="font-medium text-slate-900">
                    {(() => {
                      // 職員ログインの場合
                      if ((user as any)?.staffName) {
                        return `${(user as any).staffName}さん`;
                      }
                      // Replitユーザーの場合
                      if ((user as any)?.firstName && (user as any)?.lastName) {
                        return `${(user as any).firstName}・${(user as any).lastName}さん`;
                      }
                      // フォールバック
                      return "ユーザーさん";
                    })()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {greeting}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleManualClick}>
                  <Book className="w-4 h-4 mr-2" />
                  マニュアル
                </DropdownMenuItem>
                {isStaffUser && (
                  <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                    <Lock className="w-4 h-4 mr-2" />
                    パスワード変更
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {isStaffUser && (
        <ChangePasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
        />
      )}
    </header>
  );
}
