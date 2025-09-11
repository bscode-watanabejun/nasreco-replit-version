import { useLocation } from "wouter";
import { ArrowLeft, ClipboardList, Plus, Utensils, Droplets, Bath, MapPin, Book, Pill, Activity, Sparkles, Weight, FileText, Footprints } from "lucide-react";

export default function CheckListMenu() {
  const [, navigate] = useLocation();

  // 画面キャプチャの配置順に合わせたボタン配列
  const menuItems = [
    { id: "care-records", label: "ケース記録", icon: ClipboardList, path: "/check-list/care-records" },
    { id: "daily-records", label: "日誌一覧", icon: FileText, path: "/check-list/daily-records" },
    { id: "meals", label: "食事・水分一覧", icon: Utensils, path: "/check-list/meals" },
    { id: "medication", label: "服薬一覧", icon: Pill, path: "/check-list/medication" },
    { id: "excretion", label: "排泄一覧", icon: Droplets, path: "/check-list/excretion" },
    { id: "vitals", label: "バイタル一覧", icon: Activity, path: "/check-list/vitals" },
    { id: "bathing", label: "入浴一覧", icon: Bath, path: "/check-list/bathing" },
    { id: "cleaning", label: "清掃リネン一覧", icon: Sparkles, path: "/check-list/cleaning" },
    { id: "rounds", label: "ラウンド一覧", icon: Footprints, path: "/check-list/rounds" },
    { id: "weight", label: "体重一覧", icon: Weight, path: "/check-list/weight" },
  ];

  const handleButtonClick = (path: string, label: string) => {
    if (label === "ケース記録") {
      // URLパラメータを引き継ぎ
      const urlParams = new URLSearchParams(window.location.search);
      const params = urlParams.toString();
      navigate(`/care-records-check${params ? `?${params}` : ''}`);
    } else if (label === "食事・水分一覧") {
      // URLパラメータを引き継ぎ
      const urlParams = new URLSearchParams(window.location.search);
      const params = urlParams.toString();
      navigate(`/meal-water-check-list${params ? `?${params}` : ''}`);
    } else if (label === "排泄一覧") {
      // URLパラメータを引き継ぎ
      const urlParams = new URLSearchParams(window.location.search);
      const params = urlParams.toString();
      navigate(`/excretion-check-list${params ? `?${params}` : ''}`);
    } else if (label === "入浴一覧") {
      // URLパラメータを引き継ぎ
      const urlParams = new URLSearchParams(window.location.search);
      const params = urlParams.toString();
      navigate(`/bathing-check-list${params ? `?${params}` : ''}`);
    } else {
      // その他は現在開発中
      console.log(`遷移先: ${path} (現在開発中)`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            // URLパラメータを保持してダッシュボードに戻る
            const urlParams = new URLSearchParams(window.location.search);
            const params = urlParams.toString();
            navigate(`/${params ? `?${params}` : ''}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">チェック一覧メニュー</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleButtonClick(item.path, item.label)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-colors shadow-sm active:scale-95 transform transition-transform"
              >
                <Icon className="h-10 w-10" strokeWidth={2} />
                <span className="text-base sm:text-lg font-bold text-center leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}