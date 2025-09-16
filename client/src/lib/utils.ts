import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { ja } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * データベースから取得した日時文字列を日本時間として正しくフォーマットする
 * @param dateString データベースから取得した日時文字列
 * @param formatString フォーマット文字列（デフォルト: "yyyy/MM/dd HH:mm"）
 * @returns フォーマットされた日時文字列
 */
export function formatJapanDateTime(dateString: string | Date | null | undefined, formatString: string = "yyyy/MM/dd HH:mm"): string {
  if (!dateString) return "-";

  try {
    let date: Date;

    if (typeof dateString === 'string') {
      // データベースから取得した日時文字列は日本時間として保存されているが、
      // new Date()はUTC時間として解釈してしまうため、補正が必要
      const parsedDate = new Date(dateString);

      // 不正な日付の場合は "-" を返す
      if (isNaN(parsedDate.getTime())) {
        return "-";
      }

      // UTC時間として解釈された値から、実際の日本時間を復元
      // DBの値は日本時間なので、UTC解釈で9時間進んでしまった分を戻す
      const timezoneOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒に変換
      date = new Date(parsedDate.getTime() - timezoneOffset);
    } else {
      date = dateString;

      // 不正な日付の場合は "-" を返す
      if (isNaN(date.getTime())) {
        return "-";
      }
    }

    return format(date, formatString, { locale: ja });
  } catch (error) {
    console.error("日時フォーマットエラー:", error);
    return "-";
  }
}
