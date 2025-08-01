import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Calendar, User, Edit } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const careRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
  notes: z.string().optional(),
});

type CareRecordForm = z.infer<typeof careRecordSchema>;

export default function CareRecords() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: careRecords = [], isLoading } = useQuery({
    queryKey: ["/api/care-records"],
  });

  const form = useForm<CareRecordForm>({
    resolver: zodResolver(careRecordSchema),
    defaultValues: {
      residentId: "",
      recordDate: new Date().toISOString().slice(0, 16),
      category: "",
      description: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CareRecordForm) => {
      await apiRequest("POST", "/api/care-records", {
        ...data,
        recordDate: new Date(data.recordDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-records"] });
      form.reset();
      setOpen(false);
      toast({
        title: "成功",
        description: "介護記録を作成しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "介護記録の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CareRecordForm) => {
    createMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "daily_care", label: "日常介護" },
    { value: "assistance", label: "介助" },
    { value: "observation", label: "観察" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">介護記録</h1>
            <p className="text-slate-600">日常介護記録の管理</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新規介護記録</DialogTitle>
                <DialogDescription>
                  介護記録を入力してください
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="residentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>利用者</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="利用者を選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {residents.map((resident: any) => (
                              <SelectItem key={resident.id} value={resident.id}>
                                {resident.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recordDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>記録日時</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>カテゴリ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="カテゴリを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>記録内容</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="介護記録の内容を入力してください"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備考</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="特記事項があれば入力してください"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {createMutation.isPending ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Records List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">記録を読み込み中...</p>
            </div>
          ) : careRecords.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-slate-600">介護記録がありません</p>
                <p className="text-sm text-slate-500 mt-2">「新規記録」ボタンから記録を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            careRecords.map((record: any) => {
              const resident = residents.find((r: any) => r.id === record.residentId);
              const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
              
              return (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {resident?.name || "不明な利用者"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(record.recordDate), "PPP HH:mm", { locale: ja })}
                          </span>
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 mb-2">{record.description}</p>
                    {record.notes && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <strong>備考:</strong> {record.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
