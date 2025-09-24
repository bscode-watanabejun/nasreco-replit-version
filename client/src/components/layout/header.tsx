import { useAuth } from "@/hooks/useAuth";
import { User, Book, LogOut, Lock, Building2 } from "lucide-react";
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
import { useState, useMemo } from "react";
import ChangePasswordDialog from "@/components/change-password-dialog";
import { getEnvironmentPath } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export default function Header() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const currentDate = new Date();
  const greeting = getGreeting();
  const formattedDate = format(currentDate, "yyyy年MM月dd日です", { locale: ja });

  // 職員ログインユーザーかどうかを判定
  const isStaffUser = !!(user as any)?.staffName;

  // テナント一覧を取得（テナント名表示用）
  const { data: tenantList = [] } = useQuery<any[]>({
    queryKey: ["/api/tenants"],
    enabled: !!user, // ユーザー認証後に取得
    staleTime: 10 * 60 * 1000, // 10分間キャッシュ
  });

  // 現在の環境情報を取得
  const environment = useMemo(() => {
    // 1. まずURLパスからテナントIDを取得（最優先）
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/^\/tenant\/([^\/]+)/);
      if (pathMatch) {
        const tenantFromUrl = pathMatch[1];
        // URLにテナントが含まれている場合は、そのテナント情報を使用
        const tenant = tenantList.find(t => t.tenantId === tenantFromUrl);
        return {
          tenantId: tenantFromUrl,
          isParentEnvironment: false,
          isTenantEnvironment: true,
          environmentName: tenant ? tenant.tenantName : tenantFromUrl
        };
      }
    }

    // 2. URLにテナントが含まれていない場合はsessionStorageを確認
    const selectedTenantId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTenantId') : null;
    if (selectedTenantId) {
      const tenant = tenantList.find(t => t.tenantId === selectedTenantId);
      return {
        tenantId: selectedTenantId,
        isParentEnvironment: false,
        isTenantEnvironment: true,
        environmentName: tenant ? tenant.tenantName : selectedTenantId
      };
    }

    // 3. どちらもない場合は親環境
    return {
      tenantId: null,
      isParentEnvironment: true,
      isTenantEnvironment: false,
      environmentName: '親環境'
    };
  }, [location, tenantList]); // locationとtenantListを依存配列に追加

  function getGreeting() {
    const hour = currentDate.getHours();
    if (hour < 10) return "おはようございます";
    if (hour < 18) return "こんにちは";
    return "こんばんは";
  }

  const handleLogoClick = () => {
    // 現在の環境を維持してダッシュボードへ
    const dashboardPath = getEnvironmentPath("/");
    navigate(dashboardPath);
  };

  const handleManualClick = () => {
    window.open('https://manual.nasreco.bscode.co.jp/', '_blank');
  };

  const handleLogout = async () => {
    // スタッフユーザーの場合はスタッフログアウトAPIを使用
    if (isStaffUser) {
      try {
        // テナント情報を事前に取得（sessionStorageクリア前）
        const selectedTenantId = sessionStorage.getItem('selectedTenantId');

        // ヘッダーでテナント情報を送信（APIがテナント判定するため）
        const headers: Record<string, string> = {
          "Content-Type": "application/json"
        };

        // テナント情報があればヘッダーに追加
        if (selectedTenantId) {
          headers['x-tenant-id'] = selectedTenantId;
        }

        const response = await fetch("/api/auth/staff-logout", {
          method: "POST",
          headers
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // sessionStorageをクリア（APIコール後）
        sessionStorage.clear();

        // APIから返されたリダイレクトURLを使用
        window.location.href = data.redirect || "/staff-login";
      } catch (error) {
        console.error("Logout error:", error);

        // エラーが発生した場合のフォールバック処理
        sessionStorage.clear();

        // テナント環境にいるかを判定してフォールバックリダイレクト
        const currentPath = window.location.pathname;
        const tenantMatch = currentPath.match(/^\/tenant\/([^\/]+)/);

        if (tenantMatch) {
          // テナント環境の場合
          const tenantId = tenantMatch[1];
          window.location.href = `/tenant/${tenantId}/staff-login`;
        } else {
          // 親環境の場合
          window.location.href = "/staff-login";
        }
      }
    } else {
      // Replitユーザーの場合は従来のログアウト処理
      sessionStorage.clear();
      window.location.href = "/api/logout";
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div>
              <img
                src="/uploads/nasreco-logo.png"
                alt="NASRECO"
                className="h-14 w-auto object-contain"
              />
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
            {/* テナント環境表示 */}
            <div className="flex items-center space-x-2 text-xs bg-slate-100 px-2 py-1 rounded-md border">
              <Building2 className="w-3 h-3 text-slate-600" />
              <span className={`font-medium ${environment.isParentEnvironment ? 'text-blue-600' : 'text-green-600'}`}>
                {environment.environmentName}
              </span>
            </div>
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
