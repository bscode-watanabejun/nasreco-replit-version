import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // First try Replit Auth
  const { data: replitUser, isLoading: isReplitLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Only check staff auth if Replit user is not authenticated and we're not loading
  const shouldCheckStaffAuth = !replitUser && !isReplitLoading;
  
  const { data: staffUser, isLoading: isStaffLoading } = useQuery({
    queryKey: ["/api/auth/staff-user"],
    retry: false,
    enabled: shouldCheckStaffAuth,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const isLoading = isReplitLoading || (shouldCheckStaffAuth && isStaffLoading);
  const user = replitUser || staffUser;
  const isAuthenticated = !!(replitUser || staffUser);
  const authType = replitUser ? 'replit' : staffUser ? 'staff' : null;

  return {
    user,
    isLoading,
    isAuthenticated,
    authType,
    isStaffAuth: !!staffUser,
    isReplitAuth: !!replitUser,
  };
}
