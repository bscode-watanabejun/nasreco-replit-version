import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileText, Download, Trash2, Plus, Image } from "lucide-react";
import type { ResidentAttachment } from "@shared/schema";

interface ResidentAttachmentsProps {
  residentId: string;
}

export default function ResidentAttachments({ residentId }: ResidentAttachmentsProps) {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const { data: attachments = [], isLoading } = useQuery<ResidentAttachment[]>({
    queryKey: [`/api/residents/${residentId}/attachments`],
    enabled: !!residentId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest(`/api/residents/${residentId}/attachments`, "POST", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/residents/${residentId}/attachments`] });
      toast({
        title: "ファイルがアップロードされました",
        description: "添付ファイルが正常に保存されました。",
      });
      setUploadOpen(false);
      setSelectedFile(null);
      setDescription("");
    },
    onError: (error: any) => {
      console.error("Upload error:", error);
      const errorMessage = error?.message || error?.toString() || "ファイルのアップロードに失敗しました。";
      toast({
        title: "アップロードエラー",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return apiRequest(`/api/residents/attachments/${attachmentId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/residents/${residentId}/attachments`] });
      toast({
        title: "ファイルが削除されました",
        description: "添付ファイルが正常に削除されました。",
      });
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      toast({
        title: "削除エラー",
        description: "ファイルの削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "ファイルが選択されていません",
        description: "アップロードするファイルを選択してください。",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("description", description);

    uploadMutation.mutate(formData);
  };

  const handleDownload = (attachment: ResidentAttachment) => {
    window.open(`/uploads/${attachment.filePath}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return imageExtensions.includes(extension);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">添付ファイル</h3>
          <div className="text-center py-4">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">添付ファイル</h3>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                ファイル追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ファイルをアップロード</DialogTitle>
                <DialogDescription>
                  ご利用者に関連するファイルをアップロードできます。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">ファイル選択</label>
                  <Input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      選択されたファイル: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">説明（任意）</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="ファイルの説明を入力してください"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setUploadOpen(false)}>
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedFile || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? "アップロード中..." : "アップロード"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {attachments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>添付ファイルはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attachments.map((attachment) => {
              const isImage = isImageFile(attachment.fileName);
              
              return (
                <div key={attachment.id} className="border rounded-lg overflow-hidden">
                  {/* 画像の場合はプレビューを表示 */}
                  {isImage && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800">
                      <img
                        src={`/uploads/${attachment.filePath}`}
                        alt={attachment.fileName}
                        className="max-w-full h-auto max-h-64 mx-auto rounded-md shadow-sm"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  )}
                  
                  {/* ファイル情報と操作ボタン */}
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {isImage ? (
                        <Image className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.fileSize)} • {attachment.createdAt ? new Date(attachment.createdAt).toLocaleDateString('ja-JP') : '不明'}
                        </p>
                        {attachment.description && (
                          <p className="text-xs text-gray-600 mt-1">{attachment.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(attachment)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>ファイルを削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              この操作は取り消せません。ファイル「{attachment.fileName}」を完全に削除します。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(attachment.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}