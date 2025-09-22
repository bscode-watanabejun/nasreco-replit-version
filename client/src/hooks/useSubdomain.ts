import { useEffect, useState } from 'react';
import { useTenant } from './useAuth';

interface SubdomainInfo {
  subdomain: string | null;
  tenantId: string | null;
  isValidTenant: boolean;
  loading: boolean;
}

export function useSubdomain(): SubdomainInfo {
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo>({
    subdomain: null,
    tenantId: null,
    isValidTenant: false,
    loading: true,
  });

  const { switchTenant } = useTenant();

  useEffect(() => {
    const detectSubdomain = async () => {
      try {
        // URLからサブドメインを抽出
        const hostname = window.location.hostname;
        let subdomain: string | null = null;

        // Replit環境の検出 - サブドメイン処理をスキップ
        if (hostname.includes('.replit.dev') || hostname.includes('.replit.co') || hostname.includes('replit')) {
          setSubdomainInfo({
            subdomain: null,
            tenantId: null,
            isValidTenant: false,
            loading: false,
          });
          return;
        }

        if (hostname.includes('.')) {
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            const potentialSubdomain = parts[0];

            // 予約されたサブドメインをチェック
            const reservedSubdomains = ['www', 'api', 'admin', 'mail', 'ftp', 'cpanel', 'webmail', 'localhost'];

            if (!reservedSubdomains.includes(potentialSubdomain.toLowerCase())) {
              subdomain = potentialSubdomain;
            }
          }
        }

        if (subdomain) {
          // サブドメインが有効なテナントIDかサーバーで確認
          try {
            const response = await fetch(`/api/tenants/${subdomain}`, {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const tenant = await response.json();
              setSubdomainInfo({
                subdomain,
                tenantId: tenant.id,
                isValidTenant: true,
                loading: false,
              });

              // 自動でテナントを切り替え（必要に応じて）
              try {
                await switchTenant(tenant.id);
              } catch (error) {
                console.warn('Failed to auto-switch tenant from subdomain:', error);
              }
            } else {
              setSubdomainInfo({
                subdomain,
                tenantId: null,
                isValidTenant: false,
                loading: false,
              });
            }
          } catch (error) {
            console.error('Error validating subdomain tenant:', error);
            setSubdomainInfo({
              subdomain,
              tenantId: null,
              isValidTenant: false,
              loading: false,
            });
          }
        } else {
          setSubdomainInfo({
            subdomain: null,
            tenantId: null,
            isValidTenant: false,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error detecting subdomain:', error);
        setSubdomainInfo({
          subdomain: null,
          tenantId: null,
          isValidTenant: false,
          loading: false,
        });
      }
    };

    detectSubdomain();
  }, [switchTenant]);

  return subdomainInfo;
}

// サブドメインベースのURLを生成するヘルパー関数
export function generateTenantUrl(tenantId: string, path: string = ''): string {
  const currentUrl = new URL(window.location.href);
  const hostname = currentUrl.hostname;

  // サブドメインが既に存在する場合は置き換え、存在しない場合は追加
  let newHostname: string;
  if (hostname.includes('.')) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // 最初の部分をテナントIDに置き換え
      parts[0] = tenantId;
      newHostname = parts.join('.');
    } else {
      // ドメインの前にテナントIDを追加
      newHostname = `${tenantId}.${hostname}`;
    }
  } else {
    // ローカル開発環境などでドメインにドットがない場合
    newHostname = `${tenantId}.${hostname}`;
  }

  return `${currentUrl.protocol}//${newHostname}${currentUrl.port ? ':' + currentUrl.port : ''}${path}`;
}

// テナント切り替えリダイレクト関数
export function redirectToTenant(tenantId: string, path: string = '/'): void {
  const tenantUrl = generateTenantUrl(tenantId, path);
  window.location.href = tenantUrl;
}