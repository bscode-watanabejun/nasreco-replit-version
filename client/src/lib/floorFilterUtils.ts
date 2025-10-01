/**
 * 階数フィルタのユーティリティ関数
 * マスタ設定で「1階」「1F」「1」などの様々な表記に対応
 */

/**
 * 利用者の階数とフィルタ選択値がマッチするかチェック
 * @param residentFloor 利用者の階数（例: "1階", "1F", "1", "2階" など）
 * @param selectedFloor フィルタで選択された階数（例: "1階", "2", "3F" など）
 * @returns マッチする場合true
 */
export function matchFloor(residentFloor: string | null | undefined, selectedFloor: string): boolean {
  if (!residentFloor) {
    return false;
  }

  // 複数のパターンでマッチを試みる
  const residentFloorStr = residentFloor.toString();
  const residentFloorNum = residentFloorStr.replace(/[^\d]/g, ''); // 数字のみ抽出
  const selectedFloorNum = selectedFloor.replace(/[^\d]/g, ''); // 数字のみ抽出

  const matches =
    residentFloorStr === selectedFloor || // 完全一致
    residentFloorNum === selectedFloor || // 数字部分が一致（利用者"1階" vs フィルタ"1"）
    residentFloorNum === selectedFloorNum || // 両方の数字部分が一致（利用者"1F" vs フィルタ"1階"）
    residentFloorStr === selectedFloor + 'F' || // selectedFloorにFを追加した形と一致
    residentFloorStr === selectedFloor + '階'; // selectedFloorに階を追加した形と一致

  return matches;
}
