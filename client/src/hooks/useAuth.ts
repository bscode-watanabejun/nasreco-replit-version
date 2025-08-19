import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Try both Replit Auth and Staff Auth
  const { data: replitUser, isLoading: isReplitLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: staffUser, isLoading: isStaffLoading } = useQuery({
    queryKey: ["/api/auth/staff-user"],
    retry: false,
  });

  const isLoading = isReplitLoading || isStaffLoading;
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
