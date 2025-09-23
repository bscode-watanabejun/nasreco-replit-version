import React from "react";

interface NasrecoLogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export default function NasrecoLogo({
  className = "h-12 w-12",
  showText = false,
  textClassName = "text-2xl font-semibold text-slate-900"
}: NasrecoLogoProps) {
  return (
    <div className="flex items-center space-x-3">
      <svg
        viewBox="0 0 100 100"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ハート形状 */}
        <path
          d="M50 85 C20 60, 5 40, 5 25 C5 15, 12 8, 22 8 C32 8, 40 15, 50 25 C60 15, 68 8, 78 8 C88 8, 95 15, 95 25 C95 40, 80 60, 50 85Z"
          stroke="#DC2626"
          strokeWidth="3"
          fill="none"
        />

        {/* 家の形（ダイヤモンド型） */}
        <g transform="translate(50, 40)">
          {/* 家のアウトライン */}
          <path
            d="M0 -18 L15 0 L0 18 L-15 0 Z"
            stroke="#DC2626"
            strokeWidth="2.5"
            fill="none"
          />

          {/* 窓（小さな四角） */}
          <rect
            x="-4"
            y="-4"
            width="8"
            height="8"
            fill="#DC2626"
          />
        </g>
      </svg>

      {showText && (
        <span className={textClassName}>NASRECO</span>
      )}
    </div>
  );
}

// より詳細なロゴバージョン（オプション）
export function NasrecoLogoDetailed({
  className = "h-16 w-16",
  showText = true,
  textClassName = "text-2xl font-semibold text-slate-900"
}: NasrecoLogoProps) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <svg
        viewBox="0 0 120 100"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ハート形状（より滑らかなパス） */}
        <path
          d="M60 90 C60 90, 15 60, 15 35 C15 22, 22 15, 35 15 C45 15, 53 22, 60 30 C67 22, 75 15, 85 15 C98 15, 105 22, 105 35 C105 60, 60 90, 60 90Z"
          stroke="#DC2626"
          strokeWidth="3"
          fill="none"
        />

        {/* 家の形（改良版） */}
        <g transform="translate(60, 45)">
          {/* 家の本体 */}
          <path
            d="M0 -20 L18 0 L0 20 L-18 0 Z"
            stroke="#DC2626"
            strokeWidth="2.5"
            fill="none"
          />

          {/* 窓の枠 */}
          <rect
            x="-6"
            y="-6"
            width="12"
            height="12"
            stroke="#DC2626"
            strokeWidth="1.5"
            fill="none"
          />

          {/* 窓の十字 */}
          <line x1="0" y1="-6" x2="0" y2="6" stroke="#DC2626" strokeWidth="1.5"/>
          <line x1="-6" y1="0" x2="6" y2="0" stroke="#DC2626" strokeWidth="1.5"/>
        </g>
      </svg>

      {showText && (
        <span className={textClassName}>NASRECO</span>
      )}
    </div>
  );
}