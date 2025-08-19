import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeartPulse, Shield, Users, Activity, UserCog, LogIn } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">NASRECO</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            介護看護記録システム
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            包括的な介護・看護施設管理システム
          </p>
          
          {/* Login Options */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/api/login'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg w-full sm:w-auto"
            >
              <LogIn className="w-5 h-5 mr-2" />
              管理者ログイン
            </Button>
            
            <div className="text-gray-400">または</div>
            
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/staff-login')}
              className="border-pink-300 text-pink-700 hover:bg-pink-50 px-8 py-3 text-lg w-full sm:w-auto"
            >
              <UserCog className="w-5 h-5 mr-2" />
              職員ログイン
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">利用者管理</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                利用者情報の一元管理と健康状態の追跡
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-lg">記録管理</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                介護・看護記録の効率的な入力と管理
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle className="text-lg">品質管理</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                ケアの品質向上と安全性の確保
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* System Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">システム機能</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 text-blue-600">介護記録機能</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• 日常介護記録の入力・管理</li>
                  <li>• バイタルサイン測定記録</li>
                  <li>• 食事・服薬記録</li>
                  <li>• 入浴・排泄記録</li>
                  <li>• 体重測定記録</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-green-600">看護記録機能</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• 看護ケア記録</li>
                  <li>• 医療処置記録</li>
                  <li>• 連絡事項・申し送り</li>
                  <li>• ラウンド記録</li>
                  <li>• レポート・分析機能</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
