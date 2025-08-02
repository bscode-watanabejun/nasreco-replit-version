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
import { Plus, Calendar, User, Heart, Thermometer, Activity } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const vitalSignsSchema = z.object({
  residentId: z.string().min(1, "利用者を選択してください"),
  recordDate: z.string().min(1, "記録日時を入力してください"),
  temperature: z.string().optional(),
  bloodPressureSystolic: z.string().optional(),
  bloodPressureDiastolic: z.string().optional(),
  pulseRate: z.string().optional(),
  respirationRate: z.string().optional(),
  oxygenSaturation: z.string().optional(),
  notes: z.string().optional(),
});

type VitalSignsForm = z.infer<typeof vitalSignsSchema>;

export default function Vitals() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // URLパラメータから日付とフロアの初期値を取得
  const urlParams = new URLSearchParams(window.location.search);
  const selectedDate = urlParams.get('date') || format(new Date(), "yyyy-MM-dd");
  const selectedFloor = urlParams.get('floor') || "all";

  const { data: residents = [] } = useQuery({
    queryKey: ["/api/residents"],
  });

  const { data: vitalSigns = [], isLoading } = useQuery({
    queryKey: ["/api/vital-signs"],
  });

  const form = useForm<VitalSignsForm>({
    resolver: zodResolver(vitalSignsSchema),
    defaultValues: {
      residentId: "",
      recordDate: new Date().toISOString().slice(0, 16),
      temperature: "",
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      pulseRate: "",
      respirationRate: "",
      oxygenSaturation: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VitalSignsForm) => {
      const vitalData = {
        residentId: data.residentId,
        recordDate: new Date(data.recordDate),
        temperature: data.temperature ? parseFloat(data.temperature) : null,
        bloodPressureSystolic: data.bloodPressureSystolic ? parseInt(data.bloodPressureSystolic) : null,
        bloodPressureDiastolic: data.bloodPressureDiastolic ? parseInt(data.bloodPressureDiastolic) : null,
        pulseRate: data.pulseRate ? parseInt(data.pulseRate) : null,
        respirationRate: data.respirationRate ? parseInt(data.respirationRate) : null,
        oxygenSaturation: data.oxygenSaturation ? parseFloat(data.oxygenSaturation) : null,
        notes: data.notes || null,
      };
      
      await apiRequest("POST", "/api/vital-signs", vitalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vital-signs"] });
      form.reset();
      setOpen(false);
      toast({
        title: "成功",
        description: "バイタルサインを記録しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "バイタルサインの記録に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VitalSignsForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">バイタルサイン</h1>
              <p className="text-slate-600">生体情報測定記録</p>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                新規記録
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>バイタルサイン記録</DialogTitle>
                <DialogDescription>
                  バイタルサインを測定・記録してください
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="temperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>体温 (°C)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1"
                              placeholder="36.5"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pulseRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>脈拍 (回/分)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="80"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bloodPressureSystolic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>収縮期血圧</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="120"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bloodPressureDiastolic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>拡張期血圧</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="80"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="respirationRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>呼吸数 (回/分)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="oxygenSaturation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>酸素飽和度 (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.1"
                              placeholder="98.0"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {createMutation.isPending ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vital Signs List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-slate-600">記録を読み込み中...</p>
            </div>
          ) : vitalSigns.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-slate-600">バイタルサインの記録がありません</p>
                <p className="text-sm text-slate-500 mt-2">「新規記録」ボタンから記録を追加してください</p>
              </CardContent>
            </Card>
          ) : (
            vitalSigns.map((vital: any) => {
              const resident = residents.find((r: any) => r.id === vital.residentId);
              
              return (
                <Card key={vital.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Heart className="w-5 h-5 text-red-600" />
                          バイタルサイン測定
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {resident?.name || "不明な利用者"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(vital.recordDate), "PPP HH:mm", { locale: ja })}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {vital.temperature && (
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-red-500" />
                          <span className="text-sm">
                            <strong>体温:</strong> {vital.temperature}°C
                          </span>
                        </div>
                      )}
                      
                      {(vital.bloodPressureSystolic && vital.bloodPressureDiastolic) && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">
                            <strong>血圧:</strong> {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
                          </span>
                        </div>
                      )}
                      
                      {vital.pulseRate && (
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="text-sm">
                            <strong>脈拍:</strong> {vital.pulseRate}/分
                          </span>
                        </div>
                      )}
                      
                      {vital.respirationRate && (
                        <div className="text-sm">
                          <strong>呼吸数:</strong> {vital.respirationRate}/分
                        </div>
                      )}
                      
                      {vital.oxygenSaturation && (
                        <div className="text-sm">
                          <strong>SpO2:</strong> {vital.oxygenSaturation}%
                        </div>
                      )}
                    </div>
                    
                    {vital.notes && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <strong>備考:</strong> {vital.notes}
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
