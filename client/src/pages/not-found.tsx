import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">ページが見つかりません</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            お探しのページは存在しないか、移動された可能性があります。
          </p>
          
          <div className="mt-6">
            <Button 
              onClick={() => setLocation('/')}
              className="w-full"
              data-testid="button-back-to-home"
            >
              <Home className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
