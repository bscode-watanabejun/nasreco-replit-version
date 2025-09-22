import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ArrowLeft, Save } from "lucide-react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFacilitySettingsSchema, type InsertFacilitySettings, type FacilitySettings } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function FacilitySettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch current facility settings
  const { data: settings, isLoading } = useQuery<FacilitySettings>({
    queryKey: ["/api/facility-settings"],
  });

  const form = useForm<InsertFacilitySettings>({
    resolver: zodResolver(insertFacilitySettingsSchema),
    defaultValues: {
      careType: undefined,
      facilityName: "",
      facilityAddress: "",
      dayShiftFrom: "",
      dayShiftTo: "",
      weightBaseline: undefined,
      excretionBaseline: undefined,
      vitalSetting: undefined,
      diarySettings: undefined,
      detailSettings: undefined,
      surveyUrl: "",
    },
  });

  // Reset form with fetched data
  useEffect(() => {
    if (settings) {
      form.reset({
        careType: settings.careType as "訪問介護" | "デイケア" | "デイサービス" | undefined,
        facilityName: settings.facilityName || "",
        facilityAddress: settings.facilityAddress || "",
        dayShiftFrom: settings.dayShiftFrom || "",
        dayShiftTo: settings.dayShiftTo || "",
        weightBaseline: settings.weightBaseline ? Number(settings.weightBaseline) : undefined,
        excretionBaseline: settings.excretionBaseline || undefined,
        vitalSetting: settings.vitalSetting as "前日" | "午前/午後" | undefined,
        diarySettings: settings.diarySettings as "フロア" | "全体" | undefined,
        detailSettings: settings.detailSettings as "シンプル" | "アドバンス" | undefined,
        surveyUrl: settings.surveyUrl || "",
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: (data: InsertFacilitySettings) => {
      if (settings?.id) {
        return apiRequest(`/api/facility-settings/${settings.id}`, "PUT", data);
      } else {
        return apiRequest("/api/facility-settings", "POST", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "施設設定が正常に保存されました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facility-settings"] });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "施設設定の保存に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertFacilitySettings) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-pink-100 shadow-sm border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const menuPath = getEnvironmentPath("/management-menu");
                  navigate(menuPath);
                }}
                className="p-2 text-pink-800 hover:bg-pink-200"
                data-testid="button-back-management"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-pink-800">
                施設設定
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  基本情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 介護施設種別 */}
                <FormField
                  control={form.control}
                  name="careType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>介護施設種別</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-care-type">
                            <SelectValue placeholder="施設種別を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="訪問介護">訪問介護</SelectItem>
                          <SelectItem value="デイケア">デイケア</SelectItem>
                          <SelectItem value="デイサービス">デイサービス</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        介護施設の種類を設定します。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 施設名 */}
                <FormField
                  control={form.control}
                  name="facilityName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>施設名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="施設名を入力してください"
                          {...field}
                          data-testid="input-facility-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 施設住所 */}
                <FormField
                  control={form.control}
                  name="facilityAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>施設住所</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="施設住所を入力してください"
                          {...field}
                          data-testid="input-facility-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  運用設定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 日勤時間帯 */}
                <div className="space-y-2">
                  <Label>日勤時間帯</Label>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <FormField
                      control={form.control}
                      name="dayShiftFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              data-testid="input-day-shift-from"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="text-center text-gray-500">〜</div>
                    <FormField
                      control={form.control}
                      name="dayShiftTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              data-testid="input-day-shift-to"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    今日の記録一覧や日誌で利用します。
                  </p>
                </div>

                {/* 体重基準値 */}
                <FormField
                  control={form.control}
                  name="weightBaseline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>体重基準値</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-weight-baseline">
                            <SelectValue placeholder="基準値を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="9">9</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        体重基準値上下kgの体重変化があった場合、体重一覧の表示が赤くなります。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 排泄基準値 */}
                <FormField
                  control={form.control}
                  name="excretionBaseline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排泄基準値</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-excretion-baseline">
                            <SelectValue placeholder="基準値を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        排泄基準値の回数排泄「小」が1日で実施された場合、排泄「中」と同じとなります。<br />
                        例：設定3で、小3回で、中1回と同じ値になります。1〜5回で設定可能です。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* バイタル設定 */}
                <FormField
                  control={form.control}
                  name="vitalSetting"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>バイタル設定</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vital-setting">
                            <SelectValue placeholder="バイタル設定を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="前日">全日</SelectItem>
                          <SelectItem value="午前/午後">午前/午後</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        施設でバイタルを測る頻度を設定します。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 施設日誌設定 */}
                <FormField
                  control={form.control}
                  name="diarySettings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>施設日誌設定</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-diary-settings">
                            <SelectValue placeholder="日誌設定を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="フロア">フロア</SelectItem>
                          <SelectItem value="全体">全体</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        日誌をフロアごとか全体かを選択が可能です。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 施設詳細設定 */}
                <FormField
                  control={form.control}
                  name="detailSettings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>施設詳細設定</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-detail-settings">
                            <SelectValue placeholder="詳細設定を選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="シンプル">シンプル</SelectItem>
                          <SelectItem value="アドバンス">アドバンス</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        アドバンスでは介護記録で詳細な情報を閲覧できます。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* アンケートURL */}
                <FormField
                  control={form.control}
                  name="surveyUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>アンケートURL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://example.com/survey"
                          {...field}
                          data-testid="input-survey-url"
                        />
                      </FormControl>
                      <FormDescription>
                        アンケートURLを登録すると、連絡事項にアンケートボタンが表示されます。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-pink-500 hover:bg-pink-600 text-white"
                data-testid="button-save-settings"
              >
                <Save className="w-4 h-4 mr-2" />
                {mutation.isPending ? "保存中..." : "設定を保存"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}