import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMasterCategorySchema, updateMasterCategorySchema, insertMasterSettingSchema, updateMasterSettingSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Settings, Edit2, ArrowLeft, Trash2, GripVertical, ChevronUp, ChevronDown, Database } from "lucide-react";
import { useLocation } from "wouter";
import { getEnvironmentPath } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';
import { Switch } from "@/components/ui/switch";
import type { MasterCategory, InsertMasterCategory, UpdateMasterCategory, MasterSetting, InsertMasterSetting, UpdateMasterSetting } from "@shared/schema";

// ソート可能なアイテムコンポーネント
interface SortableItemProps {
  id: string;
  setting: MasterSetting;
  index: number;
  isMobile: boolean;
  onEdit: (setting: MasterSetting) => void;
  onDelete: (setting: MasterSetting) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onToggleActive: (checked: boolean) => Promise<void>;
}

function SortableItem({
  id,
  setting,
  index,
  isMobile,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onToggleActive
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isMobile ? 'flex flex-col space-y-3 p-3' : 'flex items-center justify-between p-3'} bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 ${
        isDragging
          ? 'opacity-50 shadow-lg scale-105 z-50'
          : 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* モバイルレイアウト */}
      {isMobile ? (
        <>
          {/* 上段: ドラッグハンドルと項目名 */}
          <div className="flex items-center space-x-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{setting.label}</div>
              {setting.value !== setting.label && (
                <div className="text-sm text-gray-500 truncate">({setting.value})</div>
              )}
            </div>
            <Switch
              checked={setting.isActive ?? true}
              onCheckedChange={onToggleActive}
            />
          </div>

          {/* 下段: 操作ボタン */}
          <div className="flex items-center justify-between">
            {/* 並び順変更 */}
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onMoveUp}
                disabled={isFirst}
                className="h-8 w-8 p-0"
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMoveDown}
                disabled={isLast}
                className="h-8 w-8 p-0"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>

            {/* 編集・削除 */}
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(setting)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(setting)}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* デスクトップレイアウト */
        <>
          <div className="flex items-center space-x-3 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
            >
              <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
            </div>
            <div className="flex-1">
              <span className="font-medium">{setting.label}</span>
              {setting.value !== setting.label && (
                <span className="ml-2 text-sm text-gray-500">({setting.value})</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={setting.isActive ?? true}
              onCheckedChange={onToggleActive}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(setting)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(setting)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MasterSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("other_items");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [settingDialogOpen, setSettingDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MasterCategory | null>(null);
  const [editingSetting, setEditingSetting] = useState<MasterSetting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'category' | 'setting', item: MasterCategory | MasterSetting } | null>(null);

  // ドラッグ&ドロップ状態
  const [activeId, setActiveId] = useState<string | null>(null);

  // ドラッグ&ドロップセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // カテゴリー一覧取得
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<MasterCategory[]>({
    queryKey: ["/api/master-categories"],
  });

  // 設定値一覧取得
  const { data: settings = [], isLoading: settingsLoading } = useQuery<MasterSetting[]>({
    queryKey: ["/api/master-settings", selectedCategory],
    queryFn: async () => {
      return await apiRequest(`/api/master-settings?categoryKey=${selectedCategory}`, "GET");
    },
    enabled: !!selectedCategory,
  });

  // 初期データ投入（初回アクセス時）
  useEffect(() => {
    if (!categoriesLoading && categories.length === 0) {
      initializeCategories();
    }
  }, [categories, categoriesLoading]);

  // 初期カテゴリー選択
  useEffect(() => {
    if (categories.length > 0 && !categories.find(c => c.categoryKey === selectedCategory)) {
      setSelectedCategory(categories[0].categoryKey);
    }
  }, [categories, selectedCategory]);

  const initializeCategories = async () => {
    try {
      const result = await apiRequest("/api/master-categories/initialize", "POST");

      queryClient.invalidateQueries({ queryKey: ["/api/master-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings"] });

      toast({
        title: "成功",
        description: "初期データを作成しました",
      });
    } catch (error: any) {
      console.error('❌ 初期化処理エラー:', error);
      toast({
        title: "初期化エラー",
        description: error.message || "初期データの作成に失敗しました",
        variant: "destructive",
      });
    }
  };

  // カテゴリーフォーム
  const categoryForm = useForm<UpdateMasterCategory>({
    resolver: zodResolver(updateMasterCategorySchema),
    defaultValues: {
      categoryName: "",
      description: "",
      sortOrder: 0,
    },
  });

  // 設定フォーム
  const settingForm = useForm<InsertMasterSetting>({
    resolver: zodResolver(insertMasterSettingSchema),
    defaultValues: {
      categoryKey: selectedCategory,
      value: "",
      label: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  // カテゴリー更新
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMasterCategory }) => {
      return await apiRequest(`/api/master-categories/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-categories"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      toast({
        title: "成功",
        description: "カテゴリーを更新しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: "カテゴリーの更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 設定作成
  const createSettingMutation = useMutation({
    mutationFn: async (data: InsertMasterSetting) => {
      return await apiRequest("/api/master-settings", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings", selectedCategory] });
      setSettingDialogOpen(false);
      settingForm.reset();
      toast({
        title: "成功",
        description: "設定を追加しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: "設定の追加に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 設定更新（楽観的更新）
  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMasterSetting }) => {
      return await apiRequest(`/api/master-settings/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/master-settings", selectedCategory] });

      // 以前の値を保存
      const previousSettings = queryClient.getQueryData<MasterSetting[]>(["/api/master-settings", selectedCategory]) || [];

      // 楽観的更新（即座に画面反映）
      queryClient.setQueryData<MasterSetting[]>(["/api/master-settings", selectedCategory], (oldData) =>
        oldData ? oldData.map(item => item.id === id ? { ...item, ...data } : item) : []
      );

      return { previousSettings };
    },
    onSuccess: () => {
      setSettingDialogOpen(false);
      setEditingSetting(null);
      toast({
        title: "成功",
        description: "設定を更新しました",
      });
    },
    onError: (error: any, variables, context) => {
      // エラー時はロールバック
      if (context?.previousSettings) {
        queryClient.setQueryData(["/api/master-settings", selectedCategory], context.previousSettings);
      }
      toast({
        title: "エラー",
        description: "設定の更新に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // 最終的にサーバーデータと同期
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings", selectedCategory] });
    },
  });

  // 設定削除
  const deleteSettingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/master-settings/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings", selectedCategory] });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      toast({
        title: "成功",
        description: "設定を削除しました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: "設定の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 並び順更新（楽観的更新）
  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sortOrder: number }[]) => {
      return await apiRequest("/api/master-settings/reorder", "POST", updates);
    },
    onMutate: async (updates) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["/api/master-settings", selectedCategory] });

      // 以前の値を保存
      const previousSettings = queryClient.getQueryData<MasterSetting[]>(["/api/master-settings", selectedCategory]) || [];

      // 楽観的更新（即座に並び順を反映）
      const updatedSettings = [...previousSettings];
      updates.forEach(update => {
        const itemIndex = updatedSettings.findIndex(item => item.id === update.id);
        if (itemIndex !== -1) {
          updatedSettings[itemIndex] = { ...updatedSettings[itemIndex], sortOrder: update.sortOrder };
        }
      });

      // sortOrderに基づいてソート
      updatedSettings.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      queryClient.setQueryData(["/api/master-settings", selectedCategory], updatedSettings);

      return { previousSettings };
    },
    onError: (error: any, variables, context) => {
      // エラー時はロールバック
      if (context?.previousSettings) {
        queryClient.setQueryData(["/api/master-settings", selectedCategory], context.previousSettings);
      }
      toast({
        title: "エラー",
        description: "並び順の更新に失敗しました",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // 最終的にサーバーデータと同期
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings", selectedCategory] });
    },
  });

  const handleCategoryEdit = (category: MasterCategory) => {
    setEditingCategory(category);
    categoryForm.reset({
      categoryName: category.categoryName,
      description: category.description || "",
      sortOrder: category.sortOrder || 0,
    });
    setCategoryDialogOpen(true);
  };

  const handleSettingEdit = (setting: MasterSetting) => {
    setEditingSetting(setting);
    settingForm.reset({
      categoryKey: setting.categoryKey,
      value: setting.value,
      label: setting.label,
      sortOrder: setting.sortOrder || 0,
      isActive: setting.isActive ?? true,
    });
    setSettingDialogOpen(true);
  };

  const handleSettingAdd = () => {
    setEditingSetting(null);
    settingForm.reset({
      categoryKey: selectedCategory,
      value: "",
      label: "",
      sortOrder: settings.length,
      isActive: true,
    });
    setSettingDialogOpen(true);
  };

  const handleDelete = (type: 'category' | 'setting', item: MasterCategory | MasterSetting) => {
    setDeletingItem({ type, item });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    if (deletingItem.type === 'setting') {
      await deleteSettingMutation.mutateAsync(deletingItem.item.id);
    }
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newSettings = [...settings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSettings.length) return;

    // スワップ
    [newSettings[index], newSettings[targetIndex]] = [newSettings[targetIndex], newSettings[index]];

    // 即座にUI更新（楽観的更新）
    queryClient.setQueryData<MasterSetting[]>(["/api/master-settings", selectedCategory], newSettings);

    // 並び順を更新（バックグラウンドで実行）
    const updates = newSettings.map((item, idx) => ({
      id: item.id,
      sortOrder: idx,
    }));

    await reorderMutation.mutateAsync(updates);
  };

  // ドラッグイベントハンドラー
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = settings.findIndex(item => item.id === active.id);
    const newIndex = settings.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      // 即座にUI更新（楽観的更新）
      const newSettings = arrayMove(settings, oldIndex, newIndex);

      // キャッシュを直接更新してドロップ瞬間に反映
      queryClient.setQueryData<MasterSetting[]>(["/api/master-settings", selectedCategory], newSettings);

      // 並び順を更新（バックグラウンドで実行）
      const updates = newSettings.map((item, idx) => ({
        id: item.id,
        sortOrder: idx,
      }));

      // reorderMutationも楽観的更新なので、エラー時はロールバックされる
      await reorderMutation.mutateAsync(updates);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const onCategorySubmit = async (data: UpdateMasterCategory) => {
    if (!editingCategory) return;
    await updateCategoryMutation.mutateAsync({ id: editingCategory.id, data });
  };

  const onSettingSubmit = async (data: InsertMasterSetting) => {
    if (editingSetting) {
      const { categoryKey, ...updateData } = data;
      await updateSettingMutation.mutateAsync({
        id: editingSetting.id,
        data: updateData as UpdateMasterSetting
      });
    } else {
      await createSettingMutation.mutateAsync(data);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  if (categoriesLoading || settingsLoading) {
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
          {/* デスクトップレイアウト */}
          {!isMobile && (
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
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-semibold text-pink-800">
                  マスタ設定
                </h1>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentCategory = categories.find(c => c.categoryKey === selectedCategory);
                    if (currentCategory) {
                      handleCategoryEdit(currentCategory);
                    }
                  }}
                  disabled={!categories.find(c => c.categoryKey === selectedCategory)}
                  className="text-pink-800 border-pink-300 hover:bg-pink-100"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  カテゴリー設定
                </Button>
              </div>
            </div>
          )}

          {/* モバイルレイアウト（2行構成） */}
          {isMobile && (
            <div className="py-3">
              {/* 1行目: タイトル行 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const menuPath = getEnvironmentPath("/management-menu");
                      navigate(menuPath);
                    }}
                    className="p-2 text-pink-800 hover:bg-pink-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <h1 className="text-lg font-semibold text-pink-800">
                    マスタ設定
                  </h1>
                </div>
              </div>

              {/* 2行目: ボタン行 */}
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentCategory = categories.find(c => c.categoryKey === selectedCategory);
                    if (currentCategory) {
                      handleCategoryEdit(currentCategory);
                    }
                  }}
                  disabled={!categories.find(c => c.categoryKey === selectedCategory)}
                  className="text-pink-800 border-pink-300 hover:bg-pink-100"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  カテゴリー設定
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* カテゴリー設定ダイアログ */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className={isMobile ? "max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-base" : ""}>
              カテゴリー設定
            </DialogTitle>
            <DialogDescription className={isMobile ? "text-sm" : ""}>
              カテゴリーの表示名や説明を編集できます
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className={`space-y-4 ${isMobile ? 'text-sm' : ''}`}>
              <FormField
                control={categoryForm.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>カテゴリー名</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={isMobile ? "text-base" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>説明</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        className={isMobile ? "text-base" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'justify-end space-x-2'}`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoryDialogOpen(false)}
                  className={isMobile ? "order-2" : ""}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className={`bg-pink-500 hover:bg-pink-600 ${isMobile ? 'order-1' : ''}`}
                >
                  保存
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          {isMobile ? (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-none bg-transparent p-0">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category.categoryKey}
                    value={category.categoryKey}
                    className="px-4 py-2"
                  >
                    {category.categoryName}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            <TabsList className="grid w-full grid-cols-2 mb-6">
              {categories.map((category) => (
                <TabsTrigger key={category.categoryKey} value={category.categoryKey}>
                  {category.categoryName}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {categories.map((category) => (
            <TabsContent key={category.categoryKey} value={category.categoryKey}>
              <Card>
                <CardHeader className={isMobile ? "space-y-3" : "flex flex-row items-center justify-between"}>
                  <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'} flex items-center`}>
                    <Database className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                    {category.categoryName}の設定
                  </CardTitle>
                  <Button
                    onClick={handleSettingAdd}
                    size={isMobile ? "sm" : "default"}
                    className={`bg-pink-500 hover:bg-pink-600 ${isMobile ? 'w-full' : ''}`}
                  >
                    <Plus className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
                    新規追加
                  </Button>
                </CardHeader>
                <CardContent>
                  {settings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      設定項目がありません
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext
                        items={settings.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {settings.map((setting, index) => (
                            <SortableItem
                              key={setting.id}
                              id={setting.id}
                              setting={setting}
                              index={index}
                              isMobile={isMobile}
                              onEdit={handleSettingEdit}
                              onDelete={(setting) => handleDelete('setting', setting)}
                              onMoveUp={() => moveItem(index, 'up')}
                              onMoveDown={() => moveItem(index, 'down')}
                              isFirst={index === 0}
                              isLast={index === settings.length - 1}
                              onToggleActive={async (checked) => {
                                await updateSettingMutation.mutateAsync({
                                  id: setting.id,
                                  data: { value: setting.value, label: setting.label, isActive: checked },
                                });
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeId ? (
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-pink-300 dark:border-pink-600 shadow-2xl ring-2 ring-pink-200 dark:ring-pink-700 transform rotate-2 scale-105 transition-all">
                            {settings.find(item => item.id === activeId) && (
                              <div className={`${isMobile ? 'flex flex-col space-y-3 p-3' : 'flex items-center justify-between p-3'}`}>
                                <div className="flex items-center space-x-3">
                                  <GripVertical className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-pink-500 flex-shrink-0`} />
                                  <div className="flex-1">
                                    <div className="font-medium text-pink-800 dark:text-pink-200">
                                      {settings.find(item => item.id === activeId)?.label}
                                    </div>
                                    {(() => {
                                      const activeSetting = settings.find(item => item.id === activeId);
                                      return activeSetting?.value !== activeSetting?.label && (
                                        <div className="text-sm text-pink-600 dark:text-pink-400">
                                          ({activeSetting?.value})
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Setting Dialog */}
      <Dialog open={settingDialogOpen} onOpenChange={setSettingDialogOpen}>
        <DialogContent className={isMobile ? "max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-base" : ""}>
              {editingSetting ? '設定を編集' : '新しい設定を追加'}
            </DialogTitle>
            <DialogDescription className={isMobile ? "text-sm" : ""}>
              選択肢の情報を入力してください
            </DialogDescription>
          </DialogHeader>
          <Form {...settingForm}>
            <form onSubmit={settingForm.handleSubmit(onSettingSubmit)} className={`space-y-4 ${isMobile ? 'text-sm' : ''}`}>
              <FormField
                control={settingForm.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>表示名</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例: エンシュア"
                        className={isMobile ? "text-base" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={settingForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>値</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例: エンシュア"
                        className={isMobile ? "text-base" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={settingForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className={`flex flex-row items-center justify-between rounded-lg border ${isMobile ? 'p-2' : 'p-3'}`}>
                    <div className="space-y-0.5">
                      <FormLabel className={isMobile ? "text-sm" : ""}>有効</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'justify-end space-x-2'}`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingDialogOpen(false)}
                  size={isMobile ? "default" : "default"}
                  className={isMobile ? "order-2" : ""}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className={`bg-pink-500 hover:bg-pink-600 ${isMobile ? 'order-1' : ''}`}
                  size={isMobile ? "default" : "default"}
                >
                  {editingSetting ? '更新' : '追加'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className={isMobile ? "max-w-[90vw]" : ""}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isMobile ? "text-base" : ""}>
              削除の確認
            </AlertDialogTitle>
            <AlertDialogDescription className={isMobile ? "text-sm" : ""}>
              この{deletingItem?.type === 'category' ? 'カテゴリー' : '設定'}を削除してもよろしいですか？
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isMobile ? "flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2" : ""}>
            <AlertDialogCancel className={isMobile ? "order-2 sm:order-1" : ""}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={`bg-red-500 hover:bg-red-600 ${isMobile ? 'order-1 sm:order-2' : ''}`}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}