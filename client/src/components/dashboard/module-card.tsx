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
}

export default function ModuleCard({
  icon: Icon,
  title,
  description,
  color,
  onClick,
  span = 1,
  compact = false,
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
          <div className={cn(
            "rounded-lg flex items-center justify-center module-icon transition-colors",
            "w-6 h-6 sm:w-8 sm:h-8"
          )}>
            <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
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
          <div className="w-12 h-12 rounded-lg flex items-center justify-center module-icon transition-colors">
            <Icon className="w-6 h-6" />
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
