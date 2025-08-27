import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { UserCog, Eye, EyeOff } from "lucide-react";

const staffLoginSchema = z.object({
  staffId: z.string().min(1, "職員IDを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type StaffLoginForm = z.infer<typeof staffLoginSchema>;

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<StaffLoginForm>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: {
      staffId: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: StaffLoginForm) => {
      return await apiRequest("/api/auth/staff-login", "POST", data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/staff-user"], data);
      toast({
        title: "ログイン成功",
        description: "職員としてログインしました",
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "ログインエラー",
        description: error.message || "職員IDまたはパスワードが正しくありません",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StaffLoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-pink-200">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
            <UserCog className="w-8 h-8 text-pink-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-pink-800">職員ログイン</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              登録済みの職員IDとパスワードでログインしてください
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-pink-800 font-medium">職員ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="staff001"
                        className="border-pink-200 focus:border-pink-500 focus:ring-pink-500"
                        disabled={loginMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-pink-800 font-medium">パスワード</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="パスワードを入力"
                          className="border-pink-200 focus:border-pink-500 focus:ring-pink-500 pr-10"
                          disabled={loginMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loginMutation.isPending}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-2 transition-colors"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ログイン中...
                  </>
                ) : (
                  "ログイン"
                )}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 pt-4 border-t border-pink-100">
            <p className="text-xs text-gray-500 text-center">
              職員IDやパスワードでお困りの場合は、管理者にお問い合わせください
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
