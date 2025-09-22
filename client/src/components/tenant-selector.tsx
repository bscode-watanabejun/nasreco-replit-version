import { useState } from "react";
import { useTenant } from "@/hooks/useAuth";
import { redirectToTenant } from "@/hooks/useSubdomain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TenantSelectorProps {
  className?: string;
  compact?: boolean;
  useSubdomainRedirect?: boolean; // サブドメインリダイレクトを使用するかどうか
}

export function TenantSelector({ className = "", compact = false, useSubdomainRedirect = false }: TenantSelectorProps) {
  const { currentTenantId, hasMultipleTenants, availableTenants, switchTenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);

  // 複数テナントアクセス権限がない場合は表示しない
  if (!hasMultipleTenants || availableTenants.length <= 1) {
    return null;
  }

  const currentTenant = availableTenants.find((tenant: any) => tenant.id === currentTenantId);

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) return;

    setIsLoading(true);
    try {
      if (useSubdomainRedirect) {
        // サブドメインリダイレクトを使用
        redirectToTenant(tenantId);
        return; // リダイレクトが発生するのでここで終了
      } else {
        // 通常のAPI切り替え
        await switchTenant(tenantId);
        toast({
          title: "テナント切り替え完了",
          description: `${availableTenants.find((t: any) => t.id === tenantId)?.name || tenantId} に切り替えました`,
        });
      }
    } catch (error) {
      console.error('テナント切り替えエラー:', error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "テナントの切り替えに失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select value={currentTenantId || ""} onValueChange={handleTenantSwitch} disabled={isLoading}>
          <SelectTrigger className="h-8 w-auto border-0 bg-transparent px-2 text-sm focus:ring-0">
            <SelectValue placeholder="テナントを選択" />
          </SelectTrigger>
          <SelectContent>
            {availableTenants.map((tenant: any) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                <div className="flex items-center gap-2">
                  {tenant.id === currentTenantId && <Check className="h-3 w-3" />}
                  <span>{tenant.name || tenant.id}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">施設選択</span>
        <Badge variant="secondary" className="text-xs">
          {availableTenants.length} 施設
        </Badge>
      </div>

      <div className="grid gap-2">
        {availableTenants.map((tenant: any) => {
          const isActive = tenant.id === currentTenantId;
          return (
            <Button
              key={tenant.id}
              variant={isActive ? "default" : "outline"}
              className={`justify-between h-auto p-3 ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => handleTenantSwitch(tenant.id)}
              disabled={isLoading || isActive}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{tenant.name || tenant.id}</span>
                {tenant.description && (
                  <span className="text-xs text-muted-foreground">{tenant.description}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isActive && <Check className="h-4 w-4" />}
                {!isActive && <ChevronDown className="h-4 w-4" />}
              </div>
            </Button>
          );
        })}
      </div>

      {currentTenant && (
        <div className="mt-3 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">現在の施設</span>
          </div>
          <div className="text-sm font-medium">{currentTenant.name || currentTenant.id}</div>
          {currentTenant.address && (
            <div className="text-xs text-muted-foreground mt-1">{currentTenant.address}</div>
          )}
        </div>
      )}
    </div>
  );
}