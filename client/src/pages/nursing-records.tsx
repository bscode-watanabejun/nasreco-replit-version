import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NursingRecords() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">看護記録　看護ケア記録の管理</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-gray-600 mb-4">
            看護記録ページ
          </h2>
          <p className="text-gray-500">
            新しい看護記録機能を実装予定です。
          </p>
        </div>
      </div>
    </div>
  );
}