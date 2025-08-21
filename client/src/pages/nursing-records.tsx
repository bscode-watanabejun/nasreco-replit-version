import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ArrowLeft, Stethoscope, User, Calendar } from "lucide-react";
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

const categories = [
  { value: "assessment", label: "アセスメント" },
  { value: "intervention", label: "介入" },
  { value: "evaluation", label: "評価" },
];

export default function NursingRecords() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<NursingRecordForm>({
    resolver: zodResolver(nursingRecordSchema),
    defaultValues: {
      residentId: "",
      recordDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      category: "",
      description: "",
      interventions: "",
      outcomes: "",
    },
  });

  // Fetch nursing records
  const { data: nursingRecords = [], isLoading } = useQuery({
    queryKey: ["/api/nursing-records"],
    queryFn: async () => {
      const response = await fetch("/api/nursing-records");
      if (!response.ok) throw new Error("Failed to fetch nursing records");
      return response.json();
    },
  });

  // Fetch residents for the select dropdown
  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
    queryFn: async () => {
      const response = await fetch("/api/residents");
      if (!response.ok) throw new Error("Failed to fetch residents");
      return response.json();
    },
  });

  // Create nursing record mutation
  const createNursingRecord = useMutation({
    mutationFn: async (data: NursingRecordForm) => {
      const response = await fetch("/api/nursing-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          recordDate: new Date(data.recordDate).toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Failed to create nursing record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nursing-records"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "成功",
        description: "看護記録が作成されました",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "看護記録の作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: NursingRecordForm) => {
    createNursingRecord.mutate(data);
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(c => c.value === category)?.label || category;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Stethoscope className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">看護記録</h1>
                <p className="text-slate-600">看護ケア記録の管理</p>
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-nursing-record">
                <Plus className="h-4 w-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>看護記録の新規作成</DialogTitle>
                <DialogDescription>
                  看護ケアの記録を作成してください
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="residentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>利用者</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                            data-testid="select-resident"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="利用者を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {(residents as any[]).map((resident: any) => (
                                <SelectItem key={resident.id} value={resident.id}>
                                  {resident.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
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
                          <Input
                            type="datetime-local"
                            {...field}
                            data-testid="input-record-date"
                          />
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
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                            data-testid="select-category"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="カテゴリを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.value} value={category.value}>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
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
                            {...field}
                            placeholder="看護記録の詳細を入力してください"
                            rows={3}
                            data-testid="textarea-description"
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
                        <FormLabel>介入内容</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="実施した介入内容を入力してください"
                            rows={2}
                            data-testid="textarea-interventions"
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
                            {...field}
                            placeholder="介入の結果や評価を入力してください"
                            rows={2}
                            data-testid="textarea-outcomes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      キャンセル
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createNursingRecord.isPending}
                      data-testid="button-save"
                    >
                      保存
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Records List */}
        <div className="space-y-4">
          {(nursingRecords as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Stethoscope className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">看護記録がありません</p>
                <p className="text-slate-500 text-sm">新規記録ボタンから記録を作成してください</p>
              </CardContent>
            </Card>
          ) : (
            (nursingRecords as any[]).map((record: any) => (
              <Card key={record.id} data-testid={`card-nursing-record-${record.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">
                          {(residents as any[]).find((r: any) => r.id === record.residentId)?.name || record.residentId}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {getCategoryLabel(record.category)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(record.recordDate), "yyyy/MM/dd HH:mm", { locale: ja })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-slate-900 mb-1">記録内容</h4>
                      <p className="text-slate-700">{record.description}</p>
                    </div>
                    {record.interventions && (
                      <div>
                        <h4 className="font-medium text-slate-900 mb-1">介入内容</h4>
                        <p className="text-slate-700">{record.interventions}</p>
                      </div>
                    )}
                    {record.outcomes && (
                      <div>
                        <h4 className="font-medium text-slate-900 mb-1">結果・評価</h4>
                        <p className="text-slate-700">{record.outcomes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}