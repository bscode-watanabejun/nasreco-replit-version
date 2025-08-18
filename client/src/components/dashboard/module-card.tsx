import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: "blue" | "green" | "orange" | "red" | "pink" | "slate";
  onClick: () => void;
  span?: number;
  compact?: boolean;
  badge?: number | null;
}

export default function ModuleCard({
  icon: Icon,
  title,
  description,
  color,
  onClick,
  span = 1,
  compact = false,
  badge = null,
}: ModuleCardProps) {
  const colorClasses = {
    blue: "module-card-blue",
    green: "module-card-green",
    orange: "module-card-orange",
    red: "module-card-red",
    pink: "module-card-pink",
    slate: "module-card-slate",
  };

  return (
    <div
      className={cn(
        "module-card",
        colorClasses[color],
        span === 2 && "lg:col-span-2"
      )}
      onClick={onClick}
    >
      {compact ? (
        <div className="flex flex-col items-center text-center space-y-1 sm:space-y-2">
          <div className="relative">
            <div className={cn(
              "rounded-lg flex items-center justify-center module-icon transition-colors",
              "w-6 h-6 sm:w-8 sm:h-8"
            )}>
              <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
            {badge !== null && badge > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow-lg border-2 border-white z-10 animate-pulse">
                {badge > 99 ? "99+" : badge}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-medium text-slate-900 leading-tight text-xs">
              {title}
            </h3>
            <p className="text-slate-600 leading-tight text-xs mt-0 hidden sm:block">
              {description}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center module-icon transition-colors">
              <Icon className="w-6 h-6" />
            </div>
            {badge !== null && badge > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-sm font-bold rounded-full min-w-[22px] h-6 flex items-center justify-center px-1 shadow-lg border-2 border-white z-10 animate-pulse">
                {badge > 99 ? "99+" : badge}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 text-base leading-tight">
              {title}
            </h3>
            <p className="text-sm text-slate-600 mt-1 leading-tight">
              {description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}