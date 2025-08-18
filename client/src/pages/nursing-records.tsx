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
import { Plus, Calendar, User, Edit, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const nursingRecordSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  description: z.string().min(1, "記録内容を入力してください"),
  interventions: z.string().optional(),
  outcomes: z.string().optional(),
});

type NursingRecordForm = z.infer<typeof nursingRecordSchema>;

export default function NursingRecords() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: nursingRecords = [], isLoading } = useQuery({
    queryKey: ["/api/nursing-records"],
  });

  const form = useForm<NursingRecordForm>({
    resolver: zodResolver(nursingRecordSchema),
    defaultValues: {
      residentId: "",
      recordDate: new Date().toISOString().slice(0, 16),
      category: "",
      description: "",
      interventions: "",
      outcomes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: NursingRecordForm) => {
      await apiRequest("POST", "/api/nursing-records", {
        ...data,
        recordDate: new Date(data.recordDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
      form.reset();
      setOpen(false);
      toast({
        title: "成功",
        description: "看護記録を作成しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "看護記録の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NursingRecordForm) => {
    createMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "assessment", label: "アセスメント" },
    { value: "intervention", label: "看護介入" },
    { value: "evaluation", label: "評価" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">看護記録</h1>
              <p className="text-slate-600">看護ケア記録の管理</p>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新規看護記録</DialogTitle>
                <DialogDescription>
                  看護記録を入力してください
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
                            {(residents as any[]).map((resident: any) => (
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
                            placeholder="看護記録の内容を入力してください"
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
                    name="interventions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>看護介入</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="実施した看護介入を入力してください"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="outcomes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>結果・評価</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="結果や評価を入力してください"
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
                      className="bg-green-600 hover:bg-green-700"
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-slate-600">記録を読み込み中...</p>
            </div>
          ) : (nursingRecords as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-slate-600">看護記録がありません</p>
                <p className="text-sm text-slate-500 mt-2">「新規記録」ボタンから記録を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            (nursingRecords as any[]).map((record: any) => {
              const resident = (residents as any[]).find((r: any) => r.id === record.residentId);
              const categoryLabel = categoryOptions.find(opt => opt.value === record.category)?.label || record.category;
              
              return (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-green-600" />
                          {categoryLabel}
                        </CardTitle>
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
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium text-slate-900 mb-1">記録内容</h4>
                      <p className="text-slate-700">{record.description}</p>
                    </div>
                    
                    {record.interventions && (
                      <div>
                        <h4 className="font-medium text-slate-900 mb-1">看護介入</h4>
                        <p className="text-sm text-slate-600 bg-green-50 p-2 rounded">
                          {record.interventions}
                        </p>
                      </div>
                    )}
                    
                    {record.outcomes && (
                      <div>
                        <h4 className="font-medium text-slate-900 mb-1">結果・評価</h4>
                        <p className="text-sm text-slate-600 bg-blue-50 p-2 rounded">
                          {record.outcomes}
                        </p>
                      </div>
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
