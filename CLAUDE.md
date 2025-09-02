# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリで作業する際のガイドです。

## 🚀 Quick Start
```bash
[DEVELOPMENT_COMMAND]  # Start development server (MANUAL EXECUTION ONLY)
```
- Frontend: [FRONTEND_URL]
- Backend: [BACKEND_URL]

**⚠️ 重要**: `[DEVELOPMENT_COMMAND]`は手動実行のみ。Claude Codeでは実行しない。
**✅ 必須**: 実装後は必ず高速エラーチェックを実施すること。

## ⚡ 高速エラーチェック
実装後の検証には以下の高速化手法を使用:
```bash
npm run check  # TypeScript型チェック（推奨：30秒以内）
npm run build  # 完全ビルド（時間要注意：フルビルドが必要な場合のみ）
```
**使い分け**:
- **通常の実装後**: `npm run check` で型エラーを高速検証
- **デプロイ前**: `npm run build` でフルビルドテスト
- **緊急修正**: `npm run check` で迅速確認


## 開発コマンド

### 基本開発
- `npm run dev` - ホットリロード付きで開発サーバーを起動
- `npm run build` - 本番用バンドル（クライアント＋サーバー）をビルド
- `npm run start` - 本番サーバーを起動
- `npm run check` - TypeScript の型チェックを実行
- `npm run db:push` - データベーススキーマの変更を PostgreSQL に反映

### データベース操作
- スキーマ変更は `/shared/schema.ts` 内の **Drizzle ORM** で管理
- スキーマを変更したら `npm run db:push` を実行し反映
- データベースは **Neon PostgreSQL serverless**（接続プール付き）を使用

## アーキテクチャ概要

### Monorepo構成
├── client/ # フロントエンド（React + Vite + TypeScript）
├── server/ # バックエンド（Express + TypeScript）
├── shared/ # 型・スキーマ共有（Drizzle + Zod）
└── attached_assets/ # アップロードされたファイルや画像

### 主要な設計パターン

**フルスタック型安全性**  
データベースモデル、API型、バリデーションスキーマを `/shared/schema.ts` に一元定義（Drizzle ORM + Zod使用）。  
これにより、全スタックで型の一貫性を確保。

**認証フロー**  
- Replit Auth（OpenID Connect）を使用  
- セッションは PostgreSQL に保存  
- `isAuthenticated` ミドルウェアで全APIルートを保護  
- ユーザー情報には役割（staff, nurse, admin）を含み、権限管理に利用

**データ層構造**  
- **ストレージインターフェース**: `/server/storage.ts` の `IStorage`  
- **DB実装**: `DatabaseStorage` クラスで全CRUD実装  
- **ルートハンドラ**: `/server/routes.ts` にREST API  
- **スキーマ検証**: 共有層のZodスキーマで全API入力を検証

**フロントエンド状態管理**  
- **サーバー状態**: TanStack Query（React Query）  
- **フォーム状態**: React Hook Form + Zod  
- **ルート状態**: Wouter（軽量ルーティング）  
- **UI状態**: React useState

### 医療・介護ドメインモデル（日本向け）

**主要エンティティ**
- 入居者（患者）情報
- ケア記録（日常ケアや観察）
- 看護記録（医療観察や介入）
- バイタルサイン（体温、血圧、脈拍、SpO₂）
- 食事・投薬記録
- スタッフ向け通知（既読管理あり）

**データ関係**
- 多くのレコードは `residentId` 外部キーで入居者と紐付け
- 全レコードに監査項目（`createdAt`, `createdBy`）あり
- 権限はユーザー役割によって制御

### UI/UXパターン

**レスポンシブデザイン**  
- モバイル優先。デスク管理とモバイル入力の両方に最適化
- モバイルで利用する一覧系の画面は項目名を表示せずにplaceholderに項目名を設定

**コンポーネント構造**
- **shadcn/ui**: 基本UIライブラリ（医療向けカスタマイズあり）
- **フォームパターン**: React Hook Form + Zodの一貫したレイアウト
- **データテーブル**: ソート・フィルタ・ページネーション対応
- **モーダルワークフロー**: 詳細・編集画面をダイアログで表示
- **Selectコンポーネント**: InputWithDropdownを利用

**日本語ローカライズ**  
- date-fns（jaロケール）で日付フォーマット  
- 医療用語や文化的表記に対応

## 主要ファイル

### フロントエンド
- `/client/src/App.tsx` - ルーターと認証ラッパー
- `/client/src/pages/dashboard.tsx` - ダッシュボード
- `/client/src/pages/management-menu.tsx` - 管理メニュー

### バックエンド
- `/server/index.ts` - Expressサーバー設定
- `/server/routes.ts` - APIルート定義
- `/server/storage.ts` - DB抽象化とCRUD
- `/server/replitAuth.ts` - 認証統合

### 共有
- `/shared/schema.ts` - DBスキーマ & Zodスキーマ
- `/client/src/lib/queryClient.ts` - TanStack Query設定

### 設定
- `/vite.config.ts` - フロントビルド設定
- `/drizzle.config.ts` - DBマイグレーション設定
- `/tailwind.config.ts` - UI設定

## 開発ガイドライン

### 新機能追加手順
1. `/shared/schema.ts` にスキーマ定義
2. `IStorage` にCRUDメソッド追加し `DatabaseStorage` に実装
3. `/server/routes.ts` にAPI追加（認証必須）
4. `/client/src/pages/` にUIページ追加
5. TanStack Query でデータ取得・エラーハンドリング

### コード整理
- 複雑なページは**機能別フォルダ**で管理
- 再利用コンポーネントは `/client/src/components/ui/`
- 共通ロジックは `/client/src/hooks/`
- TypeScript＋共有スキーマで型安全性を担保

### DBスキーマ変更
- `/shared/schema.ts` を更新
- Drizzleの型安全クエリを使用
- `npm run db:push` で適用
- 既存データとの互換性を考慮

### 認証
- 全APIは `isAuthenticated` 必須
- `req.user.claims.sub` でユーザー情報取得
- フロント認証は `/client/src/hooks/useAuth.ts` で管理
- UIで役割に応じた制御

## 日本の医療・介護向け注意点
- 日付形式は年月日
- 医療用語・介護レベルは正しい日本語を使用
- 家族関係や住所表記など文化的配慮
- 日本の医療文書要件に準拠

# Claude Code 設定
- 常に日本語で返答してください。  
- コードコメントや説明文も日本語で書いてください。  
- 英単語は必要最小限でOKです。

