import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { db } from "./db";
import { users, excretionRecords, staffManagement } from "../shared/schema";
import { and, gte, lte, desc, eq } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";

// テナント抽出ミドルウェア
const extractTenant = async (req: any, res: any, next: any) => {
  try {
    let tenantId: string | null = null;
    let tenantSource: string = 'none';


    // 1. リクエストヘッダーからテナントIDを取得
    tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId) {
      tenantSource = 'header';
    }

    // 2. サブドメインからテナントIDを取得
    if (!tenantId) {
      const host = req.get('host');
      if (host && host.includes('.')) {
        const subdomain = host.split('.')[0];
        // 予約されたサブドメインをチェック
        const reservedSubdomains = ['www', 'api', 'admin', 'mail', 'ftp', 'cpanel', 'webmail', 'localhost'];
        if (subdomain && !reservedSubdomains.includes(subdomain.toLowerCase())) {
          // サブドメインがテナントIDとして有効かDBで確認
          try {
            const tenants = await storage.getTenants();
            const tenant = tenants.find(t => t.id === subdomain);
            if (tenant) {
              tenantId = subdomain;
              tenantSource = 'subdomain';
            }
          } catch (error) {
            console.warn(`Subdomain '${subdomain}' not found as tenant:`, error);
          }
        }
      }
    }

    // 3. URLパスからテナントIDを取得 (/tenant/{tenantId}/...)
    if (!tenantId) {
      const pathMatch = req.path.match(/^\/tenant\/([^\/]+)/);
      if (pathMatch) {
        const pathTenantId = pathMatch[1];
        try {
          const tenants = await storage.getTenants();
          const tenant = tenants.find(t => t.id === pathTenantId);
          if (tenant) {
            tenantId = pathTenantId;
            tenantSource = 'path';
          }
        } catch (error) {
          console.warn(`Path tenant '${pathTenantId}' not found:`, error);
        }
      }
    }

    // 4. スタッフセッションからテナントIDを取得
    if (!tenantId && req.session?.staff?.tenantId) {
      tenantId = req.session.staff.tenantId;
      tenantSource = 'staff_session';
    }

    // 5. ユーザーセッションからテナントIDを取得
    if (!tenantId && req.session?.tenant?.currentTenantId) {
      tenantId = req.session.tenant.currentTenantId;
      tenantSource = 'user_session';
    }


    if (tenantId) {
      storage.setCurrentTenant(tenantId);
      req.tenantId = tenantId;
      req.tenantSource = tenantSource;

    } else {
      // テナントIDがない場合は明示的にnullに設定（親環境）
      storage.setCurrentTenant(null);
      req.tenantId = null;
      req.tenantSource = 'parent_environment';
    }

    next();
  } catch (error) {
    console.error('Error in extractTenant middleware:', error);
    next();
  }
};

import {
  insertResidentSchema,
  insertCareRecordSchema,
  insertNursingRecordSchema,
  insertVitalSignsSchema,
  updateVitalSignsSchema,
  insertMealsAndMedicationSchema,
  insertBathingRecordSchema,
  insertExcretionRecordSchema,
  updateExcretionRecordSchema,
  insertWeightRecordSchema,
  updateWeightRecordSchema,
  insertCommunicationSchema,
  insertRoundRecordSchema,
  insertMedicationRecordSchema,
  insertFacilitySettingsSchema,
  insertStaffNoticeSchema,
  insertStaffNoticeReadStatusSchema,
  insertCleaningLinenRecordSchema,
  updateCleaningLinenRecordSchema,
  insertStaffManagementSchema,
  updateStaffManagementApiSchema,
  insertResidentAttachmentSchema,
  insertTenantSchema,
  updateTenantApiSchema,
  insertJournalEntrySchema,
} from "@shared/schema";

// ファイルアップロード設定
const uploadDir = path.join(process.cwd(), 'attached_assets');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB制限
  },
  fileFilter: (req, file, cb) => {
    // 許可するファイルタイプ
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // 静的ファイル配信
  app.use('/uploads', express.static(uploadDir));

  // Global tenant extraction middleware for all API routes
  app.use('/api', extractTenant);

  // Tenant management routes (admin only)
  app.get('/api/tenants', isAuthenticated, async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error: any) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get('/api/tenants/:id', isAuthenticated, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant" });
    }
  });

  app.post('/api/tenants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.staff?.id;
      if (!userId) {
        return res.status(401).json({ message: "認証が必要です" });
      }

      const validatedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validatedData, userId);
      res.status(201).json(tenant);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      res.status(400).json({ message: error.message || "Invalid tenant data" });
    }
  });

  app.put('/api/tenants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.staff?.id;
      if (!userId) {
        return res.status(401).json({ message: "認証が必要です" });
      }

      const validatedData = updateTenantApiSchema.parse({ id: req.params.id, ...req.body });
      const tenant = await storage.updateTenant(validatedData, userId);
      res.json(tenant);
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      res.status(400).json({ message: error.message || "Invalid tenant data" });
    }
  });

  app.delete('/api/tenants/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTenant(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Check if this is a staff session first
      const staffSession = (req as any).session?.staff;
      if (staffSession) {
        // Return staff information
        res.json({
          id: staffSession.staffId,
          staffName: staffSession.staffName,
          authority: staffSession.authority,
          floor: staffSession.floor,
          jobRole: staffSession.jobRole,
          tenantId: staffSession.tenantId,
          isStaff: true
        });
        return;
      }
      
      // Fallback to regular user lookup only if req.user exists
      if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        res.json(user);
      } else {
        res.status(401).json({ message: "ユーザー情報が見つかりません" });
      }
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Staff login route
  app.post('/api/auth/staff-login', async (req, res) => {
    try {
      const { staffId, password } = req.body;
      
      if (!staffId || !password) {
        return res.status(400).json({ message: "職員IDとパスワードを入力してください" });
      }

      const staff = await storage.authenticateStaff(staffId, password);
      
      if (!staff) {
        return res.status(401).json({ message: "職員IDまたはパスワードが正しくありません" });
      }

      if (staff.status === "ロック") {
        return res.status(401).json({ message: "このアカウントはロックされています" });
      }

      // セッションに職員情報を保存（テナント情報含む）
      (req as any).session.staff = {
        id: staff.id,
        staffId: staff.staffId,
        staffName: staff.staffName,
        authority: staff.authority,
        floor: staff.floor,
        jobRole: staff.jobRole,
        tenantId: staff.tenantId,
      };

      res.json({
        id: staff.id,
        staffId: staff.staffId,
        staffName: staff.staffName,
        authority: staff.authority,
        floor: staff.floor,
        jobRole: staff.jobRole,
        tenantId: staff.tenantId,
      });
    } catch (error: any) {
      console.error("Error during staff login:", error);
      res.status(500).json({ message: "ログイン処理中にエラーが発生しました" });
    }
  });

  // Staff logout route
  app.post('/api/auth/staff-logout', (req, res) => {
    (req as any).session.staff = null;
    res.json({ message: "ログアウトしました" });
  });

  // テナント切り替えAPI
  app.post('/api/auth/switch-tenant', isAuthenticated, async (req, res) => {
    try {
      const { tenantId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ message: "テナントIDが必要です" });
      }

      // テナントの存在確認
      const tenants = await storage.getTenants();
      const tenant = tenants.find(t => t.id === tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "指定されたテナントが見つかりません" });
      }

      // スタッフセッションの場合
      const staffSession = (req as any).session?.staff;
      if (staffSession) {
        // スタッフがそのテナントにアクセス権限があるかチェック
        if (staffSession.tenantId !== tenantId) {
          return res.status(403).json({ message: "指定されたテナントへのアクセス権限がありません" });
        }

        // セッションを更新（すでに正しいテナントの場合）
        (req as any).session.staff.tenantId = tenantId;
        return res.json({ message: "テナントを切り替えました", tenantId });
      }

      // Replitユーザーセッションの場合
      if (req.user && (req.user as any).claims) {
        const userId = (req.user as any).claims.sub;
        const users = await storage.getResidents(); // tenantsテーブルを使用すべきだが、ユーザー管理の実装は後で改善
        const user = users.find((u: any) => u.id === userId);

        if (!user) {
          return res.status(404).json({ message: "ユーザーが見つかりません" });
        }

        // ユーザーがマルチテナントアクセス権限を持っているかチェック
        // TODO: テナントアクセス権限のチェックロジックを実装
        // 現在は全テナントへのアクセスを許可

        // セッションにテナント情報を保存
        if (!(req as any).session.tenant) {
          (req as any).session.tenant = {};
        }
        (req as any).session.tenant.currentTenantId = tenantId;

        return res.json({ message: "テナントを切り替えました", tenantId });
      }

      return res.status(401).json({ message: "認証が必要です" });
    } catch (error: any) {
      console.error("Error switching tenant:", error);
      res.status(500).json({ message: "テナントの切り替えに失敗しました" });
    }
  });

  // Change staff password route
  app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const staffSession = (req as any).session?.staff;

      if (!staffSession) {
        return res.status(401).json({ message: "職員ログインが必要です" });
      }

      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "パスワードは4文字以上で入力してください" });
      }

      await storage.changeStaffPassword(staffSession.id, newPassword);

      res.json({ message: "パスワードを変更しました" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "パスワードの変更中にエラーが発生しました" });
    }
  });

  // Get current staff user
  app.get('/api/auth/staff-user', async (req, res) => {
    try {
      const staff = (req as any).session?.staff;
      if (!staff) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      
      // 職員IDに対応するusersテーブルのIDを検索
      let correspondingUser = null;
      try {
        correspondingUser = await storage.findUserByStaffInfo(staff.staffId, staff.staffName);
      } catch (findError) {
        console.error("❌ Error finding corresponding user:", findError);
        // findUserByStaffInfoでエラーが発生した場合は、correspondingUserをnullのままにする
      }
      
      // 正しいIDフィールドを確実に返す
      const staffResponse = {
        id: staff.id, // staff_managementテーブルのプライマリキー（UUID）
        staffId: staff.staffId, // ログインID
        staffName: staff.staffName,
        authority: staff.authority,
        floor: staff.floor,
        jobRole: staff.jobRole,
        tenantId: staff.tenantId, // テナント情報を追加
        userId: correspondingUser?.id || null, // 対応するusersテーブルのIDを追加
      };

      res.json(staffResponse);
    } catch (error: any) {
      console.error("Error fetching staff user:", error);
      res.status(500).json({ message: "Failed to fetch staff user" });
    }
  });

  // Residents routes
  app.get('/api/residents', isAuthenticated, async (req, res) => {
    try {
      const tenantId = storage.getCurrentTenant();
      console.log('🏠 API /api/residents - tenantId:', tenantId);
      const residents = await storage.getResidents(tenantId || undefined);
      res.json(residents);
    } catch (error: any) {
      console.error("Error fetching residents:", error);
      res.status(500).json({ message: "Failed to fetch residents" });
    }
  });

  app.get('/api/residents/:id', isAuthenticated, async (req, res) => {
    try {
      const resident = await storage.getResident(req.params.id);
      if (!resident) {
        return res.status(404).json({ message: "Resident not found" });
      }
      res.json(resident);
    } catch (error: any) {
      console.error("Error fetching resident:", error);
      res.status(500).json({ message: "Failed to fetch resident" });
    }
  });

  app.post('/api/residents', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertResidentSchema.parse(req.body);
      const resident = await storage.createResident(validatedData);
      res.status(201).json(resident);
    } catch (error: any) {
      console.error("Error creating resident:", error);
      res.status(400).json({ message: "Invalid resident data" });
    }
  });

  app.put('/api/residents/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertResidentSchema.parse(req.body);
      const resident = await storage.updateResident(id, validatedData);
      if (!resident) {
        return res.status(404).json({ message: "Resident not found" });
      }
      res.json(resident);
    } catch (error: any) {
      console.error("Error updating resident:", error);
      res.status(400).json({ message: "Invalid resident data" });
    }
  });

  app.delete('/api/residents/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteResident(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting resident:", error);
      res.status(500).json({ message: "Failed to delete resident" });
    }
  });

  // Care records routes
  app.get('/api/care-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const records = await storage.getCareRecords(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching care records:", error);
      console.error("Error stack:", error.stack);
      console.error("Query params:", req.query);
      res.status(500).json({ message: "Failed to fetch care records" });
    }
  });

  app.post('/api/care-records', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : req.user.claims.sub;

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const requestData = {
        ...req.body,
        staffId: staffId,
      };


      const validatedData = insertCareRecordSchema.parse(requestData);
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、
          // 9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // updated_atフィールドが含まれている場合は削除
      const { updatedAt, updated_at, ...cleanData } = validatedData as any;
      
      // created_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);
      
      console.log("Setting createdAt to JST:", jstNow.toISOString(), "Local:", jstNow.toString());
      
      // 型の問題を回避するためanyでキャスト
      const recordWithCreatedAt = { ...cleanData, createdAt: jstNow } as any;
      const record = await storage.createCareRecord(recordWithCreatedAt);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating care record:", error);
      if (error.issues) {
        console.error("Validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Invalid care record data",
        error: error.message,
        issues: error.issues || []
      });
    }
  });

  app.patch('/api/care-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.recordDate) {
        // recordDateをJST時刻として処理
        console.log("Original recordDate:", updateData.recordDate, "Type:", typeof updateData.recordDate);
        
        let parsedDate: Date;
        if (typeof updateData.recordDate === 'string') {
          const dateString = updateData.recordDate as string;
          // フロントエンドから送信される時刻は、JST時刻をUTCのISO形式にしたもの
          // 例: JST 15:30 → UTC 06:30 として送信される
          // これを正しいJST時刻に戻すため、9時間加算する
          parsedDate = new Date(dateString);
          console.log("Parsed from string (UTC interpreted):", parsedDate);
          
          // UTC時刻として解釈されたものを9時間加算してJST時刻に戻す
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        } else if (updateData.recordDate instanceof Date) {
          parsedDate = updateData.recordDate;
          // Dateオブジェクトの場合も同様の調整が必要
          const jstOffset = 9 * 60 * 60 * 1000;
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Date object adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        } else {
          parsedDate = new Date(updateData.recordDate);
          // その他の場合も同様
          const jstOffset = 9 * 60 * 60 * 1000;
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Other type adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        }
        
        // 日時の有効性を検証
        if (isNaN(parsedDate.getTime())) {
          console.error("Invalid date detected:", updateData.recordDate);
          return res.status(400).json({ message: "Invalid date value provided" });
        }
        console.log("Final parsed date:", parsedDate);
        
        updateData.recordDate = parsedDate;
      }
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      updateData.updatedAt = jstNow;
      
      const record = await storage.updateCareRecord(req.params.id, updateData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating care record:", error);
      res.status(500).json({ message: "Failed to update care record" });
    }
  });

  // 介護記録削除
  app.delete('/api/care-records/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCareRecord(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting care record:", error);
      res.status(500).json({ message: "Failed to delete care record" });
    }
  });

  // Nursing records routes
  app.get('/api/nursing-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate, floor } = req.query;
      const records = residentId || startDate || endDate 
        ? await storage.getNursingRecords(
            residentId as string,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          )
        : await storage.getAllNursingRecords(floor as string);
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching nursing records:", error);
      res.status(500).json({ message: "Failed to fetch nursing records" });
    }
  });

  app.post('/api/nursing-records', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      let nurseId = null;
      
      if (staffSession) {
        // 職員ログインの場合、staff_management.idを直接使用
        nurseId = staffSession.id;
      } else {
        // 通常ログインの場合
        nurseId = req.user?.claims?.sub || null;
      }

      // フロントエンドから送信されたnurseIdも確認（デバッグ用）

      if (!nurseId) {
        console.error("❌ Validation failed: nurseId is missing or no corresponding user found.");
        return res.status(401).json({ message: "有効な看護師IDが見つかりません" });
      }

      // nurseIdがstaff_managementテーブルに存在するか確認
      const staffExists = await db.select().from(staffManagement).where(eq(staffManagement.id, nurseId)).limit(1);
      
      if (staffExists.length === 0) {
        console.error("❌ Validation failed: nurseId does not exist in staff_management table:", nurseId);
        return res.status(400).json({ message: "指定された職員IDが存在しません" });
      }

      const validatedData = insertNursingRecordSchema.parse({
        ...req.body,
        nurseId: nurseId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const currentTime = new Date();
      const jstOffset2 = 9 * 60 * 60 * 1000;
      const jstNow = new Date(currentTime.getTime() + jstOffset2);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const record = await storage.createNursingRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating nursing record:", error);
      if (error.code === '23503') {
        res.status(400).json({ message: "参照データが存在しません。看護師IDまたは入居者IDを確認してください。" });
      } else {
        res.status(400).json({ message: "看護記録の作成に失敗しました", error: error.message });
      }
    }
  });

  app.patch('/api/nursing-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      // まずvalidationを通す
      const validatedData = insertNursingRecordSchema.partial().parse(req.body);
      
      // Check if there are any fields to update
      const fieldsToUpdate = Object.keys(validatedData).filter(key => validatedData[key as keyof typeof validatedData] !== undefined);
      if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ message: "No valid fields provided for update" });
      }
      
      // recordDateがある場合はJST時刻として処理
      if (validatedData.recordDate) {
        console.log("Original recordDate:", validatedData.recordDate, "Type:", typeof validatedData.recordDate);
        
        let parsedDate: Date;
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          // フロントエンドから送信される時刻は、JST時刻をUTCのISO形式にしたもの
          // 例: JST 15:30 → UTC 06:30 として送信される
          // これを正しいJST時刻に戻すため、9時間加算する
          parsedDate = new Date(dateString);
          console.log("Parsed from string (UTC interpreted):", parsedDate);
          
          // UTC時刻として解釈されたものを9時間加算してJST時刻に戻す
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        } else if (validatedData.recordDate instanceof Date) {
          parsedDate = validatedData.recordDate;
          // Dateオブジェクトの場合も同様の調整が必要
          const jstOffset = 9 * 60 * 60 * 1000;
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Date object adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        } else {
          parsedDate = new Date(validatedData.recordDate);
          // その他の場合も同様
          const jstOffset = 9 * 60 * 60 * 1000;
          parsedDate = new Date(parsedDate.getTime() + jstOffset);
          console.log("Other type adjusted to JST (+9 hours):", parsedDate, "Valid:", !isNaN(parsedDate.getTime()));
        }
        
        // 日時の有効性を検証
        if (isNaN(parsedDate.getTime())) {
          console.error("Invalid date detected:", validatedData.recordDate);
          return res.status(400).json({ message: "Invalid date value provided" });
        }
        console.log("Final parsed date:", parsedDate);
        
        validatedData.recordDate = parsedDate;
      }
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).updatedAt = jstNow;
      
      const record = await storage.updateNursingRecord(req.params.id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating nursing record:", error);
      res.status(500).json({ message: "Failed to update nursing record", error: error.message });
    }
  });

  app.get('/api/nursing-records/:id', isAuthenticated, async (req, res) => {
    try {
      const record = await storage.getNursingRecordById(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "Nursing record not found" });
      }
      res.json(record);
    } catch (error: any) {
      console.error("Error fetching nursing record:", error);
      res.status(500).json({ message: "Failed to fetch nursing record", error: error.message });
    }
  });

  app.delete('/api/nursing-records/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteNursingRecord(req.params.id);
      res.json({ message: "Nursing record deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting nursing record:", error);
      res.status(500).json({ message: "Failed to delete nursing record", error: error.message });
    }
  });

  // バイタル記録印刷用HTMLエンドポイント
  app.get('/api/vital-signs/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;
      const selectedTiming = req.query.selectedTiming as string;

      // 1. データを取得
      const [
        vitalSigns,
        residents
      ] = await Promise.all([
        storage.getVitalSigns(),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);

      const filteredVitals = vitalSigns.filter((record: any) => {
        const recordDate = new Date(record.recordDate);
        const recordDateStr = recordDate.toISOString().split('T')[0];
        return recordDateStr >= dateFrom && recordDateStr <= dateTo;
      });

      // 3. その他のフィルタを適用
      const filteredData = filteredVitals.filter((record: any) => {
        const resident = residents.find((r: any) => r.id === record.residentId);

        // 階数フィルタ
        if (selectedFloor !== "all") {
          if (resident?.floor !== selectedFloor && resident?.floor !== `${selectedFloor}階`) {
            return false;
          }
        }

        // 利用者フィルタ
        if (selectedResident !== "all" && record.residentId !== selectedResident) {
          return false;
        }

        // 時間帯フィルタ
        if (selectedTiming !== "all" && record.timing !== selectedTiming) {
          return false;
        }

        return true;
      });

      // 4. 利用者ごとにグループ化し、日付と時間帯でデータを整理
      const recordsByResident = new Map();

      // 期間内の全日付を生成
      const dates: string[] = [];
      let currentDate = new Date(fromDate);
      while (currentDate <= toDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 表示対象の利用者を取得
      const displayResidents = residents.filter((r: any) => {
        if (selectedFloor !== "all" &&
            r.floor !== selectedFloor &&
            r.floor !== `${selectedFloor}階`) return false;
        if (selectedResident !== "all" && r.id !== selectedResident) return false;
        return true;
      });

      // 利用者ごとの初期化
      displayResidents.forEach((resident: any) => {
        recordsByResident.set(resident.id, {
          resident,
          dateRecords: new Map()
        });

        // 各日付に午前・午後の枠を作成
        dates.forEach(date => {
          const timingsToCreate = selectedTiming === "all" ? ["午前", "午後"] : [selectedTiming];

          timingsToCreate.forEach(timing => {
            const key = `${date}_${timing}`;
            recordsByResident.get(resident.id).dateRecords.set(key, {
              date,
              timing,
              record: null
            });
          });
        });
      });

      // 実際のバイタル記録をマージ
      filteredData.forEach((record: any) => {
        const resident = residents.find((r: any) => r.id === record.residentId);
        if (!resident) return;

        const dateKey = new Date(record.recordDate).toISOString().split('T')[0];
        const key = `${dateKey}_${record.timing}`;

        if (recordsByResident.has(record.residentId)) {
          const residentData = recordsByResident.get(record.residentId);
          if (residentData.dateRecords.has(key)) {
            residentData.dateRecords.set(key, {
              date: dateKey,
              timing: record.timing,
              record
            });
          } else if (dates.includes(dateKey)) {
            // 臨時記録など、事前に枠がない場合も追加
            residentData.dateRecords.set(key, {
              date: dateKey,
              timing: record.timing,
              record
            });
          }
        }
      });

      // 5. HTMLテンプレートを生成
      const generateVitalPrintHTML = (recordsByResident: Map<any, any>, dateFrom: string, dateTo: string) => {
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
          const dayOfWeek = dayNames[date.getDay()];
          return `${date.getMonth() + 1}月${date.getDate().toString().padStart(2, '0')}日(${dayOfWeek})`;
        };

        const formatTime = (record: any) => {
          if (record && record.hour !== null && record.minute !== null) {
            return `${record.hour.toString().padStart(2, '0')}:${record.minute.toString().padStart(2, '0')}`;
          }
          return '';
        };

        const formatBloodPressure = (record: any) => {
          if (record && record.bloodPressureSystolic && record.bloodPressureDiastolic) {
            return `${record.bloodPressureSystolic} / ${record.bloodPressureDiastolic}`;
          }
          return '';
        };

        let htmlContent = `
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <title>ケース記録（バイタル）</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                font-family: 'MS Gothic', monospace;
                font-size: 11px;
                line-height: 1.2;
                margin: 0;
                padding: 0;
              }
              .page {
                page-break-after: always;
                min-height: 260mm;
              }
              .page:last-child {
                page-break-after: avoid;
              }
              .header {
                margin-bottom: 5mm;
              }
              .title {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 3mm;
                text-align: center;
              }
              .resident-info {
                font-size: 11px;
                margin-bottom: 3mm;
                line-height: 1.4;
              }
              .date-range {
                text-align: right;
                font-size: 11px;
                margin-bottom: 3mm;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
              }
              th, td {
                border: 1px solid #333;
                padding: 2px 3px;
                text-align: center;
                vertical-align: middle;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
                font-size: 10px;
              }
              .date-col { width: 70px; }
              .time-col { width: 40px; }
              .temp-col { width: 35px; }
              .pulse-col { width: 35px; }
              .bp-col { width: 60px; }
              .spo2-col { width: 35px; }
              .sugar-col { width: 35px; }
              .resp-col { width: 35px; }
              .notes-col {
                width: auto;
                text-align: left;
                padding-left: 4px;
                word-wrap: break-word;
                max-width: 200px;
              }
              @media print {
                .no-print { display: none !important; }
                body { margin: 0; }
              }
            </style>
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </head>
          <body>
        `;

        // 利用者ごとにページを生成（居室番号順にソート）
        Array.from(recordsByResident.values())
          .sort((a: any, b: any) => {
            const roomA = a.resident?.roomNumber || "";
            const roomB = b.resident?.roomNumber || "";

            // 居室番号を数値として比較（文字列の場合は文字列比較）
            const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
            const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

            if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
              return roomNumA - roomNumB;
            } else {
              return roomA.localeCompare(roomB, undefined, { numeric: true });
            }
          })
          .forEach((residentData: any, index: number) => {
          const { resident, dateRecords } = residentData;

          htmlContent += `
            <div class="page">
              <div class="header">
                <div class="title">ケース記録（バイタル）</div>
                <div class="resident-info">
                  利用者氏名：${resident.roomNumber || ''}：${resident.name}<br>
                  サービス種類：特定施設
                </div>
                <div class="date-range">日付：${formatDate(dateFrom)}〜${formatDate(dateTo)}</div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th rowspan="2" class="date-col">日付</th>
                    <th rowspan="2" class="time-col">時間</th>
                    <th class="temp-col">体温</th>
                    <th class="pulse-col">脈拍</th>
                    <th class="bp-col">血圧（上下）</th>
                    <th class="spo2-col">SpO2</th>
                    <th class="sugar-col">血糖</th>
                    <th class="resp-col">呼吸数</th>
                    <th rowspan="2" class="notes-col">記録</th>
                  </tr>
                  <tr>
                    <th class="temp-col">°C</th>
                    <th class="pulse-col">回</th>
                    <th class="bp-col">mmHg</th>
                    <th class="spo2-col">%</th>
                    <th class="sugar-col">mg/dL</th>
                    <th class="resp-col">回</th>
                  </tr>
                </thead>
                <tbody>
          `;

          // 日付順にソートして表示
          const sortedRecords = Array.from(dateRecords.values()).sort((a: any, b: any) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;

            const timingOrder: Record<string, number> = { "午前": 0, "午後": 1, "臨時": 2 };
            const aOrder = timingOrder[a.timing] ?? 3;
            const bOrder = timingOrder[b.timing] ?? 3;
            return aOrder - bOrder;
          });

          sortedRecords.forEach((entry: any) => {
            const { date, timing, record } = entry;

            htmlContent += `
              <tr>
                <td class="date-col">${formatDate(date)}</td>
                <td class="time-col">${formatTime(record)}</td>
                <td class="temp-col">${record?.temperature ? parseFloat(record.temperature).toFixed(1) : ''}</td>
                <td class="pulse-col">${record?.pulseRate || ''}</td>
                <td class="bp-col">${formatBloodPressure(record)}</td>
                <td class="spo2-col">${record?.oxygenSaturation || ''}</td>
                <td class="sugar-col">${record?.bloodSugar || ''}</td>
                <td class="resp-col">${record?.respirationRate || ''}</td>
                <td class="notes-col">${record?.notes || ''}</td>
              </tr>
            `;
          });

          htmlContent += `
                </tbody>
              </table>
            </div>
          `;
        });

        htmlContent += `
          </body>
          </html>
        `;

        return htmlContent;
      };

      // HTMLを生成してレスポンス
      const htmlContent = generateVitalPrintHTML(recordsByResident, dateFrom, dateTo);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error('❌ Error generating vital signs print HTML:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        error: 'Failed to generate vital signs print HTML',
        details: error.message
      });
    }
  });

  // Get vital signs by ID
  app.get('/api/vital-signs/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const vitals = await storage.getVitalSignsById(id);
      if (!vitals) {
        return res.status(404).json({ message: "Vital signs not found" });
      }
      res.json(vitals);
    } catch (error: any) {
      console.error("Error fetching vital signs:", error);
      res.status(500).json({ message: "Failed to fetch vital signs" });
    }
  });

  // Meal records routes (alias for meals-medication for backward compatibility)
  app.get('/api/meal-records/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const records = await storage.getMealsAndMedication();
      const record = records.find(r => r.id === id);
      if (!record) {
        return res.status(404).json({ message: "Meal record not found" });
      }
      res.json(record);
    } catch (error: any) {
      console.error("Error fetching meal record:", error);
      res.status(500).json({ message: "Failed to fetch meal record" });
    }
  });

  // Vital signs routes
  app.get('/api/vital-signs', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const vitals = await storage.getVitalSigns(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedVitals = vitals.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedVitals);
    } catch (error: any) {
      console.error("Error fetching vital signs:", error);
      res.status(500).json({ message: "Failed to fetch vital signs" });
    }
  });

  app.post('/api/vital-signs', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      let staffId = staffSession ? staffSession.id : null;

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!staffId) {
        try {
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            staffId = userBasedStaff.id;
          } else {
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              staffId = defaultStaff.id;
            } else {
              return res.status(401).json({ message: "有効な職員情報が見つかりません。職員管理で職員を登録するか、職員ログインを行ってください。" });
            }
          }
        } catch (staffError) {
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      const validatedData = insertVitalSignsSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const vitals = await storage.createVitalSigns(validatedData);
      res.status(201).json(vitals);
    } catch (error: any) {
      console.error("Error creating vital signs:", error);
      console.error("Request body:", req.body);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ 
          message: "Invalid vital signs data", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: "Invalid vital signs data" });
      }
    }
  });

  app.patch('/api/vital-signs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateVitalSignsSchema.parse(req.body);
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);
      validatedData.updatedAt = jstNow;
      
      const vitals = await storage.updateVitalSigns(id, validatedData);
      res.json(vitals);
    } catch (error: any) {
      console.error("Error updating vital signs:", error);
      console.error("Request body:", req.body);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ 
          message: "Invalid vital signs data", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: "Invalid vital signs data" });
      }
    }
  });

  app.delete('/api/vital-signs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVitalSigns(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting vital signs:", error);
      res.status(500).json({ message: "Failed to delete vital signs" });
    }
  });

  // Meals and medication routes
  app.get('/api/meals-medication', isAuthenticated, async (req, res) => {
    try {
      const { recordDate, mealTime, floor } = req.query;
      const records = await storage.getMealList(
        recordDate as string || new Date().toISOString().split('T')[0],
        mealTime as string || 'all',
        floor as string || 'all'
      );
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching meals and medication:", error);
      res.status(500).json({ message: "Failed to fetch meals and medication records" });
    }
  });

  app.post('/api/meals-medication', isAuthenticated, async (req: any, res) => {
    try {

      const staffSession = (req as any).session?.staff;
      let staffId = staffSession ? staffSession.id : null;

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!staffId) {
        try {
          // まず、認証ユーザーに対応する職員を探す
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            staffId = userBasedStaff.id;
          } else {
            // 見つからない場合はデフォルト職員を取得
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              staffId = defaultStaff.id;
            } else {
              console.error("❌ No valid staff found for user:", req.user.claims.sub);
              return res.status(401).json({ message: "有効な職員情報が見つかりません。職員管理で職員を登録するか、職員ログインを行ってください。" });
            }
          }
        } catch (staffError) {
          console.error("❌ Error finding staff:", staffError);
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      
      const validatedData = insertMealsAndMedicationSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateを日付のみ（時刻00:00:00）に正規化
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const dateOnly = new Date(dateString);
          dateOnly.setUTCHours(0, 0, 0, 0);
          validatedData.recordDate = dateOnly;
        } else if (validatedData.recordDate instanceof Date) {
          // 日付のみを保持し、時刻を00:00:00に正規化
          const dateOnly = new Date(validatedData.recordDate);
          dateOnly.setUTCHours(0, 0, 0, 0);
          validatedData.recordDate = dateOnly;
        }
      }
      
      // updated_atフィールドが含まれている場合は削除し、created_atをJST時刻で設定
      const { updatedAt, updated_at, ...cleanData } = validatedData as any;
      
      // created_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);
      
      // 型の問題を回避するためanyでキャスト
      const recordWithCreatedAt = { ...cleanData, createdAt: jstNow } as any;
      const record = await storage.createMealsAndMedication(recordWithCreatedAt);
      
      res.status(201).json(record);
    } catch (error: any) {
      console.error("❌ Error creating meals/medication record:", error);
      if (error.issues) {
        console.error("Validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Invalid meals/medication data",
        error: error.message,
        issues: error.issues || []
      });
    }
  });

  app.put('/api/meals-medication/:id', isAuthenticated, async (req: any, res) => {
    try {
      // 既存のレコードを取得
      const existingRecord = await storage.getMealsAndMedicationById(req.params.id);
      if (!existingRecord) {
        return res.status(404).json({ message: "Record not found" });
      }

      const staffSession = (req as any).session?.staff;
      let staffId = req.body.staffId || existingRecord.staffId || (staffSession ? staffSession.id : null);

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!staffId) {
        try {
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            staffId = userBasedStaff.id;
          } else {
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              staffId = defaultStaff.id;
            } else {
              return res.status(401).json({ message: "有効な職員情報が見つかりません。" });
            }
          }
        } catch (staffError) {
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      // 既存データと新しいデータをマージ（送信されたフィールドのみ更新）
      const mergedData = {
        residentId: existingRecord.residentId,
        recordDate: existingRecord.recordDate,
        type: existingRecord.type,
        mealType: existingRecord.mealType,
        mainAmount: existingRecord.mainAmount,
        sideAmount: existingRecord.sideAmount,
        waterIntake: existingRecord.waterIntake,
        supplement: existingRecord.supplement,
        staffName: existingRecord.staffName,
        notes: existingRecord.notes,
        ...req.body,  // 送信されたフィールドで上書き
        staffId: staffId,
      };

      const validatedData = insertMealsAndMedicationSchema.parse(mergedData);
      const record = await storage.updateMealsAndMedication(req.params.id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating meals medication:", error);
      if (error.issues) {
        console.error("Update validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Invalid meals medication data",
        error: error.message,
        issues: error.issues || []
      });
    }
  });

  // Bathing records routes
  app.get('/api/bathing-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      
      const records = await storage.getBathingRecords(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching bathing records:", error);
      res.status(500).json({ message: "Failed to fetch bathing records" });
    }
  });

  app.post('/api/bathing-records', isAuthenticated, async (req: any, res) => {
    try {
      
      const dataToValidate = {
        ...req.body,
        // staffIdはomitされているため、バリデーションに含めない
      };
      
      const validatedData = insertBathingRecordSchema.partial().parse(dataToValidate);
      
      // staffId の決定 - 職員セッションを優先
      const staffSession = (req as any).session?.staff;
      let staffId = staffSession ? staffSession.id : null;

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!staffId) {
        try {
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            staffId = userBasedStaff.id;
          } else {
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              staffId = defaultStaff.id;
            } else {
              return res.status(401).json({ message: "有効な職員情報が見つかりません。職員管理で職員を登録するか、職員ログインを行ってください。" });
            }
          }
        } catch (staffError) {
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      // residentIdとstaffIdはvalidationから除外されているため、手動で追加
      const recordData = {
        ...validatedData,
        residentId: req.body.residentId || req.query.residentId || null,  // bodyから優先して取得、なければquery、それでもなければnull
        staffId: staffId,  // 職員セッションを優先したstaffIdを設定
        recordDate: req.body.recordDate ? new Date(req.body.recordDate) : new Date(),  // recordDateが未定義の場合は現在日時
      };
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (recordData as any).createdAt = jstNow;
      (recordData as any).updatedAt = jstNow;
      
      // 既存レコードの検索（同じ利用者、同じ日付）
      const existingRecord = await storage.getBathingRecords(
        recordData.residentId,
        recordData.recordDate,
        recordData.recordDate
      );
      
      if (existingRecord && existingRecord.length > 0) {
        // 既存レコードがある場合は更新
        const updatedRecord = await storage.updateBathingRecord(existingRecord[0].id, recordData);
        res.status(200).json(updatedRecord);
      } else {
        // 既存レコードがない場合は新規作成
        const record = await storage.createBathingRecord(recordData);
        res.status(201).json(record);
      }
    } catch (error: any) {
      console.error("=== POST Validation Error ===");
      console.error("Error creating bathing record:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.errors || error.issues) {
        console.error("Validation errors:", error.errors || error.issues);
        res.status(400).json({ 
          message: "Invalid bathing record data", 
          errors: error.errors || error.issues
        });
      } else {
        console.error("No detailed error information available");
        res.status(400).json({ 
          message: "Invalid bathing record data",
          error: error.message 
        });
      }
    }
  });

  app.patch('/api/bathing-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // residentIdが含まれている場合は別途処理
      const { residentId, ...bodyWithoutResidentId } = req.body;
      const validatedData = insertBathingRecordSchema.partial().parse(bodyWithoutResidentId);
      
      // residentIdがある場合は手動で追加（空文字列も含む）
      const updateData = {
        ...validatedData,
        ...(residentId !== undefined && { residentId }),
      };
      
      // updated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (updateData as any).updatedAt = jstNow;
      
      const record = await storage.updateBathingRecord(id, updateData);
      res.json(record);
    } catch (error: any) {
      console.error("=== PATCH Validation Error ===");
      console.error("Error updating bathing record:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ 
          message: "Invalid bathing record data", 
          errors: error.errors 
        });
      } else {
        console.error("No error.errors property found");
        res.status(400).json({ message: "Invalid bathing record data" });
      }
    }
  });

  app.delete('/api/bathing-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBathingRecord(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting bathing record:", error);
      res.status(500).json({ message: "Failed to delete bathing record" });
    }
  });

  // Excretion records routes
  app.get('/api/excretion-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const records = await storage.getExcretionRecords(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching excretion records:", error);
      res.status(500).json({ message: "Failed to fetch excretion records" });
    }
  });

  app.post('/api/excretion-records', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const validatedData = insertExcretionRecordSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // created_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      
      const record = await storage.createExcretionRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating excretion record:", error);
      res.status(400).json({ message: "Invalid excretion record data" });
    }
  });

  app.patch('/api/excretion-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = updateExcretionRecordSchema.parse(req.body);
      
      // recordDateをJST時刻として処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordDate = new Date(utcTime + jstOffset);
        }
      }
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      validatedData.updatedAt = jstNow;
      
      const record = await storage.updateExcretionRecord(req.params.id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating excretion record:", error);
      res.status(400).json({ message: "Invalid excretion record data" });
    }
  });

  // 排泄チェック一覧用のHTMLテンプレート生成関数
  function generateExcretionPrintHTML(
    residentExcretionData: any[],
    dateRange: Date[],
    dateFrom: string,
    dateTo: string
  ): string {
    const formatDate = (date: Date) => {
      const day = date.getDate();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = dayNames[date.getDay()];
      return { day, dayOfWeek };
    };

    const formatDateRange = (from: string, to: string) => {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return `${fromDate.getFullYear()}年${fromDate.getMonth() + 1}月${fromDate.getDate()}日 〜 ${toDate.getFullYear()}年${toDate.getMonth() + 1}月${toDate.getDate()}日`;
    };

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>排泄チェック表</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }
    body {
      font-family: 'MS Gothic', monospace;
      font-size: 10px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }
    @media print {
      .content-wrapper {
        max-width: 297mm;
        margin: 0 auto;
      }
      .resident-section {
        page-break-inside: avoid;
        margin-bottom: 5mm;
      }
    }
    @media screen {
      .content-wrapper {
        max-width: 100%;
      }
    }
    .header {
      text-align: center;
      margin-bottom: 10mm;
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 2px solid #000;
      margin-bottom: 5mm;
    }
    th, td {
      border: 1px solid #000;
      padding: 1mm;
      text-align: center;
      vertical-align: middle;
      height: 18px;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .room-cell {
      width: 40px;
      font-weight: bold;
    }
    .name-cell {
      width: 80px;
      font-weight: bold;
      text-align: left;
      padding-left: 2mm;
    }
    .item-cell {
      width: 40px;
      font-weight: bold;
    }
    .date-cell {
      width: 25px;
    }
    .resident-last-row {
      border-bottom: 3px double #000 !important;
    }
    .data-cell {
      font-size: 11px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>

  <div class="content-wrapper">
    <div class="header">
      <div class="title">排泄チェック表　　${formatDateRange(dateFrom, dateTo)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th rowspan="2" class="room-cell">居室</th>
          <th rowspan="2" class="name-cell">利用者名</th>
          <th rowspan="2" class="item-cell">項目</th>`;

    // 日付ヘッダー
    dateRange.forEach((date, index) => {
      const { day } = formatDate(date);
      html += `<th class="date-cell">${day}</th>`;
    });

    html += `
        </tr>
        <tr>`;

    // 曜日ヘッダー
    dateRange.forEach((date, index) => {
      const { dayOfWeek } = formatDate(date);
      html += `<th class="date-cell">${dayOfWeek}</th>`;
    });

    html += `
        </tr>
      </thead>
      <tbody>`;

    // 入居者データを連続して表示
    residentExcretionData.forEach((residentData) => {
      const { resident, dailyData } = residentData;

      // 便計行
      html += `
        <tr class="resident-section">
          <td rowspan="3" class="room-cell">${resident.roomNumber || ''}</td>
          <td rowspan="3" class="name-cell">${resident.name || ''}</td>
          <td class="item-cell">便計</td>`;

      dailyData.forEach((dayData: any) => {
        html += `<td class="date-cell data-cell">${dayData.stoolCount > 0 ? dayData.stoolCount : ''}</td>`;
      });

      html += `
        </tr>`;

      // 尿計行
      html += `
        <tr>
          <td class="item-cell">尿計</td>`;

      dailyData.forEach((dayData: any) => {
        html += `<td class="date-cell data-cell">${dayData.urineCount > 0 ? dayData.urineCount : ''}</td>`;
      });

      html += `
        </tr>`;

      // 尿量行（利用者の最後の行）
      html += `
        <tr class="resident-last-row">
          <td class="item-cell">尿量</td>`;

      dailyData.forEach((dayData: any) => {
        html += `<td class="date-cell data-cell">${dayData.urineVolume > 0 ? dayData.urineVolume : ''}</td>`;
      });

      html += `
        </tr>`;
    });

    html += `
      </tbody>
    </table>
  </div>

</body>
</html>`;

    return html;
  }

  // 体重チェック一覧年次用のHTMLテンプレート生成関数
  function generateWeightPrintHTML(
    yearlyTableData: any[],
    selectedYear: string,
    weightBaseline: number = 2
  ): string {
    // 30利用者ずつでページ分割
    const itemsPerPage = 30;
    const totalPages = Math.ceil(yearlyTableData.length / itemsPerPage);

    // 体重の前月比を算出し、指定した基準値以上の差があるかチェック
    const isWeightChangeSignificant = (currentWeight: number | null, previousWeight: number | null): boolean => {
      if (!currentWeight || !previousWeight) return false;
      return Math.abs(currentWeight - previousWeight) >= weightBaseline;
    };

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>体重チェック表</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }
    body {
      font-family: 'MS Gothic', monospace;
      font-size: 11px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }
    @media print {
      .content-wrapper {
        max-width: 297mm;
        margin: 0 auto;
      }
      .page-break {
        page-break-before: always;
      }
    }
    @media screen {
      .content-wrapper {
        max-width: 100%;
        margin: 0 auto;
        padding: 10px;
      }
      .page-break {
        margin-top: 30px;
        border-top: 2px solid #ccc;
        padding-top: 20px;
      }
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .page-info {
      font-size: 12px;
      text-align: right;
      margin-bottom: 10px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10px;
      border: 2px solid #000;
      outline: 1px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 2px;
      text-align: center;
      white-space: nowrap;
    }
    /* 最後の列の右側の罫線を強調 */
    th:last-child, td:last-child {
      border-right: 2px solid #000 !important;
    }
    /* ヘッダー行 */
    .header-row th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    /* 固定幅の月列 */
    .month-col {
      width: 60px !important;
      min-width: 60px !important;
      max-width: 60px !important;
      font-size: 12px;
    }
    /* 居室番号・利用者名の列 */
    .room-col {
      width: 60px;
      text-align: center;
      font-size: 11px;
    }
    .name-col {
      width: 120px;
      text-align: left;
      padding-left: 4px;
      font-size: 11px;
    }
    /* 赤文字（2kg以上の変化） */
    .weight-significant {
      color: red;
      font-weight: bold;
    }
  </style>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</head>
<body>
`;

    // ページごとに処理
    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, yearlyTableData.length);
      const pageData = yearlyTableData.slice(startIndex, endIndex);

      if (page > 0) {
        html += '<div class="page-break"></div>';
      }

      html += `
  <div class="content-wrapper">
    <div class="header">
      <div class="title">体重チェック表　${selectedYear}年度</div>
      <div class="page-info">${page + 1}ページ目</div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr class="header-row">
            <th class="room-col">居室</th>
            <th class="name-col">利用者名</th>
            <th class="month-col">4月</th>
            <th class="month-col">5月</th>
            <th class="month-col">6月</th>
            <th class="month-col">7月</th>
            <th class="month-col">8月</th>
            <th class="month-col">9月</th>
            <th class="month-col">10月</th>
            <th class="month-col">11月</th>
            <th class="month-col">12月</th>
            <th class="month-col">1月</th>
            <th class="month-col">2月</th>
            <th class="month-col">3月</th>
          </tr>
        </thead>
        <tbody>`;

      // 利用者データ
      pageData.forEach((item, index) => {
        html += `
          <tr>
            <td class="room-col">${item.resident.roomNumber || ""}</td>
            <td class="name-col">${item.resident.name}</td>`;

        // 月別体重データ
        item.monthlyWeights.forEach((weight: number | null, monthIndex: number) => {
          const previousWeight = monthIndex > 0 ? item.monthlyWeights[monthIndex - 1] : null;
          const isSignificant = weight !== null && isWeightChangeSignificant(weight, previousWeight);
          const weightClass = isSignificant ? ' class="weight-significant"' : '';
          const displayWeight = weight !== null ? weight.toString() : "";

          html += `<td class="month-col"><span${weightClass}>${displayWeight}</span></td>`;
        });

        html += `
          </tr>`;
      });

      html += `
        </tbody>
      </table>
    </div>
  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  // 介護/看護日誌用のHTMLテンプレート生成関数
  function generateNursingJournalPrintHTML(
    filteredJournalRecords: any[],
    residents: any[],
    selectedDate: string,
    selectedRecordType: string,
    residentStats: any,
    enteredBy: string
  ): string {
    // 日付フォーマット用の関数
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      return `${year}年${month}月${day}日 ${weekday}曜日`;
    };

    const formatTime = (dateString: string) => {
      try {
        const date = new Date(dateString);
        // JST（UTC+9）に変換
        const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
        const hours = jstDate.getUTCHours().toString().padStart(2, '0');
        const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch {
        return "";
      }
    };

    // 日付情報
    const selectedDateObj = new Date(selectedDate);
    const day = selectedDateObj.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[selectedDateObj.getDay()];

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>日誌 ー ${selectedRecordType}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: 'MS Gothic', monospace;
      font-size: 11px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }
    @media print {
      .content-wrapper {
        max-width: 210mm;
        margin: 0 auto;
      }
    }
    @media screen {
      .content-wrapper {
        max-width: 100%;
        margin: 0 auto;
        padding: 10px;
      }
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .date-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .date-left {
      font-weight: 500;
    }
    .date-stats {
      margin-top: 8px;
    }
    .date-stats > div {
      display: inline-block;
      margin-right: 20px;
    }
    .hospitalized-names {
      margin-top: 4px;
    }
    .entered-by {
      text-align: right;
    }
    .table-container {
      margin-top: 20px;
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 11px;
      border: 1px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 6px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
      text-align: center;
    }
    th:first-child, td:first-child {
      width: 120px;
      text-align: center;
    }
    th:nth-child(2), td:nth-child(2) {
      width: 100px;
      text-align: center;
    }
    td:nth-child(3) {
      text-align: left;
    }
    .no-records {
      text-align: center;
      padding: 40px 0;
    }
  </style>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</head>
<body>
  <div class="content-wrapper">
    <div class="header">
      <div class="title">日誌 ー ${selectedRecordType}</div>
    </div>

    <div class="date-info">
      <div>
        <div class="date-left">${formatDate(selectedDate)}</div>
        <div class="date-stats">
          <div>入居者数：${residentStats.totalResidents}　</div>
          <div>入院者数：${residentStats.hospitalizedCount}</div>
        </div>
        <div class="hospitalized-names">
          入院者名：${residentStats.hospitalizedNames.length > 0 ? residentStats.hospitalizedNames.join("、") : "なし"}
        </div>
      </div>
      <div class="entered-by">
        記入者：${enteredBy || "_________________"}
      </div>
    </div>

    <div class="table-container">`;

    if (filteredJournalRecords.length > 0) {
      html += `
      <table>
        <thead>
          <tr>
            <th style="width: 120px">ご利用者</th>
            <th style="width: 100px">日時</th>
            <th>内容</th>
          </tr>
        </thead>
        <tbody>`;

      filteredJournalRecords.forEach(record => {
        // 記録内容の取得（記録タイプ別）
        let content = '';
        if (record.recordType === '処置') {
          content = record.originalData?.description || record.originalData?.interventions || '';
        } else if (record.recordType === 'バイタル') {
          content = record.notes || '';
        } else {
          content = record.content || '';
        }

        html += `
          <tr>
            <td style="width: 120px; text-align: center;">
              <div>${record.roomNumber} ${record.residentName}</div>
            </td>
            <td style="width: 100px; text-align: center;">
              ${day}(${weekday}) ${formatTime(record.recordTime)}
            </td>
            <td style="text-align: left;">
              ${content}
            </td>
          </tr>`;
      });

      html += `
        </tbody>
      </table>`;
    } else {
      html += `
      <div class="no-records">
        <p>選択された日誌種別にチェックされた記録がありません</p>
      </div>`;
    }

    html += `
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // 清掃リネンチェック一覧用のHTMLテンプレート生成関数
  function generateCleaningLinenPrintHTML(
    filteredResidents: any[],
    cleaningLinenData: any[],
    dateRange: Date[],
    dateFrom: string,
    dateTo: string
  ): string {
    const formatDate = (date: Date) => {
      const day = date.getDate();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = dayNames[date.getDay()];
      return { day, dayOfWeek };
    };

    const formatDateRange = (from: string, to: string) => {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return `${fromDate.getFullYear()}年${fromDate.getMonth() + 1}月${fromDate.getDate()}日 〜 ${toDate.getFullYear()}年${toDate.getMonth() + 1}月${toDate.getDate()}日`;
    };

    // 18利用者ずつでページ分割
    const itemsPerPage = 18;
    const totalPages = Math.ceil(filteredResidents.length / itemsPerPage);

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>清掃リネンチェック表</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }
    body {
      font-family: 'MS Gothic', monospace;
      font-size: 10px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }
    @media print {
      .content-wrapper {
        max-width: 297mm;
        margin: 0 auto;
      }
      .page-break {
        page-break-before: always;
      }
    }
    @media screen {
      .content-wrapper {
        max-width: 100%;
        margin: 0 auto;
        padding: 10px;
      }
      .page-break {
        margin-top: 30px;
        border-top: 2px solid #ccc;
        padding-top: 20px;
      }
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .date-range {
      font-size: 14px;
      margin-bottom: 10px;
    }
    .page-info {
      font-size: 12px;
      text-align: right;
      margin-bottom: 10px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10px;
      border: 2px solid #000;
      outline: 1px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 2px;
      text-align: center;
      white-space: nowrap;
    }
    /* 最後の列の右側の罫線を強調 */
    th:last-child, td:last-child {
      border-right: 2px solid #000 !important;
    }
    /* ヘッダー行 */
    .header-row th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    /* 固定幅の日付列 */
    .date-col {
      width: 25px !important;
      min-width: 25px !important;
      max-width: 25px !important;
      font-size: 10px;
    }
    /* 利用者を跨ぐ横の罫線を二重線に */
    .resident-separator {
      border-bottom: 3px double #000 !important;
    }
    /* 居室番号・利用者名の列 */
    .room-name-col {
      width: 120px;
      text-align: left;
      padding-left: 4px;
    }
    /* 項目列 */
    .item-col {
      width: 50px;
    }
  </style>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</head>
<body>
`;

    // ページごとに処理
    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, filteredResidents.length);
      const pageResidents = filteredResidents.slice(startIndex, endIndex);

      if (page > 0) {
        html += '<div class="page-break"></div>';
      }

      html += `
  <div class="content-wrapper">
    <div class="header">
      <div class="title">清掃リネンチェック表</div>
      <div class="date-range">${formatDateRange(dateFrom, dateTo)}</div>
      <div class="page-info">${page + 1}ページ目</div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr class="header-row">
            <th rowspan="2" class="room-name-col">居室<br>利用者名</th>
            <th rowspan="2" class="item-col">項目</th>`;

      // 日付ヘッダー
      dateRange.forEach(date => {
        const { day, dayOfWeek } = formatDate(date);
        html += `<th class="date-col">${day}<br>${dayOfWeek}</th>`;
      });

      html += `
          </tr>
        </thead>
        <tbody>`;

      // 利用者データ
      pageResidents.forEach((resident, index) => {
        // 清掃行
        html += `
          <tr>
            <td rowspan="2" class="room-name-col">
              ${resident.roomNumber || ""}<br>
              ${resident.name}
            </td>
            <td class="item-col">清掃</td>`;

        dateRange.forEach(date => {
          const dateStr = date.toISOString().split('T')[0];
          const record = cleaningLinenData.find((r: any) =>
            r.residentId === resident.id &&
            new Date(r.recordDate).toISOString().split('T')[0] === dateStr
          );
          html += `<td class="date-col">${record?.cleaningValue || ""}</td>`;
        });

        html += `
          </tr>
          <tr${index < pageResidents.length - 1 ? ' class="resident-separator"' : ''}>
            <td class="item-col">リネン</td>`;

        dateRange.forEach(date => {
          const dateStr = date.toISOString().split('T')[0];
          const record = cleaningLinenData.find((r: any) =>
            r.residentId === resident.id &&
            new Date(r.recordDate).toISOString().split('T')[0] === dateStr
          );
          html += `<td class="date-col">${record?.linenValue || ""}</td>`;
        });

        html += `
          </tr>`;
      });

      html += `
        </tbody>
      </table>
    </div>
  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  // 入浴チェック一覧用のHTMLテンプレート生成関数
  function generateBathingPrintHTML(
    residentBathingData: any[],
    dateRange: Date[],
    dateFrom: string,
    dateTo: string
  ): string {
    const formatDate = (date: Date) => {
      const day = date.getDate();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = dayNames[date.getDay()];
      return { day, dayOfWeek };
    };

    const formatDateRange = (from: string, to: string) => {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return `${fromDate.getFullYear()}年${fromDate.getMonth() + 1}月${fromDate.getDate()}日 〜 ${toDate.getFullYear()}年${toDate.getMonth() + 1}月${toDate.getDate()}日`;
    };

    // 18行ずつでページ分割
    const itemsPerPage = 18;
    const totalPages = Math.ceil(residentBathingData.length / itemsPerPage);

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>入浴チェック表</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }
    body {
      font-family: 'MS Gothic', monospace;
      font-size: 10px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }
    @media print {
      .content-wrapper {
        max-width: 297mm;
        margin: 0 auto;
      }
      .page-break {
        page-break-before: always;
      }
    }
    @media screen {
      .content-wrapper {
        max-width: 100%;
        margin: 0 auto;
        padding: 10px;
      }
      .page-break {
        margin-top: 30px;
        border-top: 2px solid #ccc;
        padding-top: 20px;
      }
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .date-range {
      font-size: 14px;
      margin-bottom: 10px;
    }
    .page-info {
      font-size: 12px;
      text-align: right;
      margin-bottom: 10px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10px;
      border: 2px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 2px;
      text-align: center;
      white-space: nowrap;
    }
    /* 最後の列の右側の罫線を強調 */
    th:last-child, td:last-child {
      border-right: 2px solid #000 !important;
    }
    /* 表全体の外枠を確実に表示 */
    table {
      outline: 2px solid #000;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .room-col {
      width: 60px;
      text-align: center;
      vertical-align: middle;
      padding: 2px;
    }
    .room-col div {
      line-height: 1.2;
    }
    .resident-name {
      font-size: 10px;
      margin-top: 2px;
    }
    .category-col {
      width: 40px;
      text-align: center;
      vertical-align: middle;
    }
    .date-col {
      width: 25px !important;
      min-width: 25px !important;
      max-width: 25px !important;
      text-align: center;
      vertical-align: middle;
      font-size: 10px;
      line-height: 1.1;
    }
    .spacer-row {
      height: 12px;
    }
    .spacer-row td {
      padding: 0;
      height: 12px;
    }
    .day-header {
      font-size: 8px;
    }
    .date-number {
      font-size: 10px;
      font-weight: bold;
    }
    .day-name {
      font-size: 7px;
    }
  </style>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</head>
<body>
  <div class="content-wrapper">`;

    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, residentBathingData.length);
      const pageData = residentBathingData.slice(startIndex, endIndex);

      if (page > 0) {
        html += `    <div class="page-break"></div>`;
      }

      html += `
    <div class="header">
      <div class="title">入浴チェック表</div>
      <div class="date-range">${formatDateRange(dateFrom, dateTo)}</div>
      <div class="page-info">${page + 1}ページ目</div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th rowspan="2" class="room-col">
              <div>居室番号</div>
              <div>利用者名</div>
            </th>
            <th rowspan="2" class="category-col">区分</th>`;

      // 日付ヘッダー（rowspan="2"で結合）
      dateRange.forEach(date => {
        const { day, dayOfWeek } = formatDate(date);
        html += `
            <th rowspan="2" class="date-col">
              <div class="day-header">
                <div class="date-number">${day}</div>
                <div class="day-name">${dayOfWeek}</div>
              </div>
            </th>`;
      });

      html += `
          </tr>
          <tr class="spacer-row">`;

      // 2行目には日付列のセルは作らない（rowspan="2"で結合済み）

      html += `
          </tr>
        </thead>
        <tbody>`;

      // データ行
      pageData.forEach(({ resident, dailyData }) => {
        html += `
          <tr>
            <td rowspan="2" class="room-col">
              <div>${resident.roomNumber || ''}</div>
              <div class="resident-name">${resident.name || ''}</div>
            </td>
            <td rowspan="2" class="category-col">入浴</td>`;

        // 日付ごとの入浴記録（rowspan="2"で2行分結合）
        dailyData.forEach((dayData: any) => {
          html += `
            <td rowspan="2" class="date-col">${(dayData.isBathDay || dayData.displayText) ? dayData.displayText : ''}</td>`;
        });

        html += `
          </tr>
          <tr class="spacer-row">`;

        // 2行目には日付セルは作らない（rowspan="2"で結合済み）

        html += `
          </tr>`;
      });

      html += `
        </tbody>
      </table>
    </div>`;
    }

    html += `
  </div>
</body>
</html>`;

    return html;
  }

  // 排泄チェック一覧の印刷
  app.get('/api/excretion-records/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. データを取得
      const [excretionData, residents] = await Promise.all([
        storage.getExcretionRecords(undefined, new Date(dateFrom), new Date(dateTo)),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) =>
          resident.roomNumber?.startsWith(selectedFloor)
        );
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 居室番号の若い順にソート
      filteredResidents.sort((a, b) => {
        const roomA = parseInt(a.roomNumber || "0");
        const roomB = parseInt(b.roomNumber || "0");
        return roomA - roomB;
      });

      // 6. 日付範囲内のすべての日付を生成
      const dateRange: Date[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dateRange.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      // 7. 利用者ごとにデータをグループ化
      const residentExcretionData = filteredResidents.map((resident: any) => {
        const residentRecords = excretionData.filter((record: any) =>
          record.residentId === resident.id
        );

        // 画面と同じロジックで日付ごとの便計・尿計・尿量を計算
        const dailyData = dateRange.map(date => {
          const dateStr = date.toISOString().split('T')[0];

          // その日の排泄記録から構造化データを作成
          const dayRecords = residentRecords.filter((record: any) => {
            const recordDate = new Date(record.recordDate);
            return recordDate.toISOString().split('T')[0] === dateStr;
          });

          // 構造化データを作成（画面側と同じロジック）
          const structuredData: { [key: string]: any } = {};

          dayRecords.forEach((record: any) => {
            const recordTime = new Date(record.recordDate).getHours();

            if (recordTime === 12) {
              // 12:00のデータは自立データとして処理
              if (record.assistance) {
                const assistanceKey = `${resident.id}-${dateStr}--1`;
                if (!structuredData[assistanceKey]) {
                  structuredData[assistanceKey] = {};
                }
                if (record.type === 'bowel_movement' || record.type === 'stool') {
                  structuredData[assistanceKey].independentStool = record.assistance;
                } else if (record.type === 'urination' || record.type === 'urine') {
                  structuredData[assistanceKey].independentUrine = record.assistance;
                }
              }
            } else {
              // 実際の時刻データは時間帯セルに配置
              if (recordTime >= 0 && recordTime <= 23) {
                const key = `${resident.id}-${dateStr}-${recordTime}`;
                if (!structuredData[key]) {
                  structuredData[key] = {};
                }

                if (record.type === 'stool' || record.type === 'bowel_movement') {
                  structuredData[key].stoolAmount = record.amount || '';
                } else if (record.type === 'urine' || record.type === 'urination') {
                  structuredData[key].urineCC = record.urineVolumeCc?.toString() || '';
                  structuredData[key].urineAmount = record.amount || '';
                }
              }
            }
          });

          // 便計を計算（画面側と同じロジック）
          let stoolCount = 0;
          for (let hour = 0; hour < 24; hour++) {
            const key = `${resident.id}-${dateStr}-${hour}`;
            const amount = structuredData[key]?.stoolAmount || '';
            if (amount === '多' || amount === '中') {
              stoolCount++;
            }
          }

          // 自立便を追加
          const independentStoolKey = `${resident.id}-${dateStr}--1`;
          const independentStool = structuredData[independentStoolKey]?.independentStool || '';
          if (independentStool && !isNaN(parseInt(independentStool))) {
            stoolCount += parseInt(independentStool);
          }

          // 尿計を計算（画面側と同じロジック）
          let urineCount = 0;
          for (let hour = 0; hour < 24; hour++) {
            const key = `${resident.id}-${dateStr}-${hour}`;
            const amount = structuredData[key]?.urineAmount || '';
            if (amount === '○') {
              urineCount += 1;
            } else if (amount === '×') {
              // カウントしない
            } else if (amount && !isNaN(parseInt(amount))) {
              urineCount += parseInt(amount);
            }
          }

          // 自立尿を追加
          const independentUrineKey = `${resident.id}-${dateStr}--1`;
          const independentUrine = structuredData[independentUrineKey]?.independentUrine || '';
          if (independentUrine && !isNaN(parseInt(independentUrine))) {
            urineCount += parseInt(independentUrine);
          }

          // 尿量を計算（画面側と同じロジック）
          let urineVolume = 0;
          for (let hour = 0; hour < 24; hour++) {
            const key = `${resident.id}-${dateStr}-${hour}`;
            const cc = structuredData[key]?.urineCC || '';
            if (cc && !isNaN(parseInt(cc))) {
              urineVolume += parseInt(cc);
            }
          }

          return {
            date,
            stoolCount: stoolCount > 0 ? stoolCount : 0,
            urineCount: urineCount > 0 ? urineCount : 0,
            urineVolume: urineVolume > 0 ? urineVolume : 0
          };
        });

        return { resident, dailyData };
      });

      // 8. HTMLテンプレート生成
      const htmlContent = generateExcretionPrintHTML(
        residentExcretionData,
        dateRange,
        dateFrom,
        dateTo
      );

      // 9. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error("Error generating excretion print:", error);
      res.status(500).json({ message: "印刷データの生成に失敗しました" });
    }
  });

  // 清掃リネンチェック一覧の印刷
  app.get('/api/cleaning-linen-records/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. データを取得
      const [cleaningLinenData, residents] = await Promise.all([
        storage.getCleaningLinenRecordsByDateRange(new Date(dateFrom), new Date(dateTo)),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) => {
          return resident.floor === selectedFloor ||
                 resident.floor === `${selectedFloor}階`;
        });
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 日付範囲内のすべての日付を生成
      const dateRange: Date[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dateRange.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      // 6. 居室番号でソート
      filteredResidents.sort((a: any, b: any) => {
        const roomA = a.roomNumber || "";
        const roomB = b.roomNumber || "";
        const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
        const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

        if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
          return roomNumA - roomNumB;
        }
        return roomA.localeCompare(roomB, undefined, { numeric: true });
      });

      // 7. HTMLテンプレート生成
      const htmlContent = generateCleaningLinenPrintHTML(
        filteredResidents,
        cleaningLinenData,
        dateRange,
        dateFrom,
        dateTo
      );

      // 8. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error("Error generating cleaning linen print:", error);
      res.status(500).json({ message: "印刷データの生成に失敗しました" });
    }
  });

  // 体重チェック一覧年次の印刷
  app.get('/api/weight-records/print', isAuthenticated, async (req, res) => {
    try {
      const selectedYear = req.query.selectedYear as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. 年度範囲の計算
      const fiscalYear = parseInt(selectedYear);
      const startDate = new Date(fiscalYear, 3, 1); // 4月1日
      const endDate = new Date(fiscalYear + 1, 2, 31); // 翌年3月31日

      // 2. データを取得
      const [weightRecords, residents, facilitySettings] = await Promise.all([
        storage.getWeightRecords(undefined, startDate, endDate),
        storage.getResidents(),
        storage.getFacilitySettings()
      ]);

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) => {
          return resident.floor === selectedFloor ||
                 resident.floor === `${selectedFloor}階`;
        });
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 居室番号でソート
      filteredResidents.sort((a: any, b: any) => {
        const roomA = a.roomNumber || "";
        const roomB = b.roomNumber || "";
        const roomNumA = parseInt(roomA.toString().replace(/[^0-9]/g, ''), 10);
        const roomNumB = parseInt(roomB.toString().replace(/[^0-9]/g, ''), 10);

        if (!isNaN(roomNumA) && !isNaN(roomNumB)) {
          return roomNumA - roomNumB;
        }
        return roomA.localeCompare(roomB, undefined, { numeric: true });
      });

      // 6. 月別データの構築
      const yearlyTableData = filteredResidents.map(resident => {
        const monthlyWeights: (number | null)[] = new Array(12).fill(null);

        // 該当する体重記録を月別に振り分け
        weightRecords
          .filter(record => record.residentId === resident.id)
          .forEach(record => {
            if (!record.recordDate || !record.weight) return;

            const recordDate = new Date(record.recordDate);
            const year = recordDate.getFullYear();
            const month = recordDate.getMonth();

            let monthIndex = -1;

            if (year === fiscalYear && month >= 3) {
              monthIndex = month - 3;
            } else if (year === fiscalYear + 1 && month <= 2) {
              monthIndex = month + 9;
            }

            if (monthIndex >= 0 && monthIndex < 12) {
              monthlyWeights[monthIndex] = parseFloat(record.weight.toString());
            }
          });

        return {
          resident,
          monthlyWeights,
        };
      });

      // 7. HTMLテンプレート生成
      const weightBaseline = facilitySettings?.weightBaseline ? Number(facilitySettings.weightBaseline) : 2;
      const htmlContent = generateWeightPrintHTML(
        yearlyTableData,
        selectedYear,
        weightBaseline
      );

      // 8. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error("Error generating weight print:", error);
      res.status(500).json({ message: "印刷データの生成に失敗しました" });
    }
  });

  // 介護/看護日誌の印刷
  app.get('/api/nursing-journal/print', isAuthenticated, async (req, res) => {
    try {
      const selectedDate = req.query.date as string;
      const selectedRecordType = req.query.recordType as string;
      const selectedFloor = req.query.floor as string;
      const enteredBy = req.query.enteredBy as string;

      if (!selectedDate || !selectedRecordType) {
        return res.status(400).json({ message: "日付と記録種別は必須です" });
      }

      // 1. データを取得
      const [records, journalCheckboxes, residents] = await Promise.all([
        storage.getDailyRecords(selectedDate),
        storage.getJournalCheckboxes(selectedDate),
        storage.getResidents()
      ]);

      // 2. チェックボックスでフィルタされた記録（日中、夜間、看護のチェックが付いた記録のみ）
      const checkedRecordIds = journalCheckboxes
        .filter(checkbox => checkbox.isChecked && checkbox.checkboxType === selectedRecordType)
        .map(checkbox => checkbox.recordId);

      let filteredJournalRecords = records.filter(record => checkedRecordIds.includes(record.id));

      // 3. 階数フィルタ
      if (selectedFloor !== "all" && selectedFloor !== "全階") {
        const selectedFloorNumber = selectedFloor.replace(/[^0-9]/g, "");
        filteredJournalRecords = filteredJournalRecords.filter(record => {
          const resident = residents.find(r => r.id === record.residentId);
          if (!resident || !resident.floor) return false;

          const residentFloorNumber = resident.floor.toString().replace(/[^0-9]/g, "");
          return residentFloorNumber === selectedFloorNumber;
        });
      }

      // 4. 居室番号でソート（数値として比較）
      filteredJournalRecords.sort((a, b) => {
        const roomA = parseInt(a.roomNumber || '0') || 0;
        const roomB = parseInt(b.roomNumber || '0') || 0;
        return roomA - roomB;
      });

      // 5. 入居者数・入院者数・入院者名を計算
      const today = new Date();
      const currentResidents = residents.filter(resident => {
        const admissionDate = resident.admissionDate ? new Date(resident.admissionDate) : null;
        const retirementDate = resident.retirementDate ? new Date(resident.retirementDate) : null;

        const isCurrentlyAdmitted = (!admissionDate || admissionDate <= today) &&
                                    (!retirementDate || retirementDate >= today);

        return isCurrentlyAdmitted;
      });

      const hospitalizedResidents = currentResidents.filter(resident => resident.isAdmitted);

      const residentStats = {
        totalResidents: currentResidents.length,
        hospitalizedCount: hospitalizedResidents.length,
        hospitalizedNames: hospitalizedResidents.map(r => r.name)
      };

      // 6. HTMLテンプレート生成
      const htmlContent = generateNursingJournalPrintHTML(
        filteredJournalRecords,
        residents,
        selectedDate,
        selectedRecordType,
        residentStats,
        enteredBy
      );

      // 7. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);
    } catch (error: any) {
      console.error("Error generating nursing journal print:", error);
      res.status(500).json({ message: "印刷データの生成に失敗しました" });
    }
  });

  // 入浴チェック一覧の印刷
  app.get('/api/bathing-records/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. データを取得
      const [bathingData, residents] = await Promise.all([
        storage.getBathingRecords(undefined, new Date(dateFrom), new Date(dateTo)),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) => {
          return resident.floor === selectedFloor ||
                 resident.floor === `${selectedFloor}階`;
        });
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 日付範囲内のすべての日付を生成
      const dateRange: Date[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dateRange.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      // 6. 入浴日設定で表示対象利用者を絞り込み
      const displayResidents = filteredResidents.filter((resident: any) => {
        // 入浴日設定の確認
        return dateRange.some(date => {
          const dayOfWeek = date.getDay();
          const bathDayFields = [
            'bathSunday',    // 0: 日曜日
            'bathMonday',    // 1: 月曜日
            'bathTuesday',   // 2: 火曜日
            'bathWednesday', // 3: 水曜日
            'bathThursday',  // 4: 木曜日
            'bathFriday',    // 5: 金曜日
            'bathSaturday'   // 6: 土曜日
          ];
          const bathDayField = bathDayFields[dayOfWeek];
          return resident[bathDayField] === true;
        });
      }).sort((a, b) => {
        // 居室番号の若い順にソート
        const roomA = parseInt(a.roomNumber?.toString().replace(/[^0-9]/g, '') || "0");
        const roomB = parseInt(b.roomNumber?.toString().replace(/[^0-9]/g, '') || "0");
        return roomA - roomB;
      });

      // 7. 利用者ごとにデータをグループ化
      const residentBathingData = displayResidents.map((resident: any) => {
        const residentRecords = bathingData.filter((record: any) =>
          record.residentId === resident.id
        );

        // 日付ごとの入浴記録データを作成
        const dailyData = dateRange.map(date => {
          const dateStr = date.toISOString().split('T')[0];

          // その日の入浴記録を検索
          const dayRecord = residentRecords.find((record: any) => {
            const recordDate = new Date(record.recordDate);
            return recordDate.toISOString().split('T')[0] === dateStr;
          });

          // 入浴日かどうかをチェック
          const dayOfWeek = date.getDay();
          const bathDayFields = [
            'bathSunday', 'bathMonday', 'bathTuesday', 'bathWednesday',
            'bathThursday', 'bathFriday', 'bathSaturday'
          ];
          const bathDayField = bathDayFields[dayOfWeek];
          const isBathDay = resident[bathDayField] === true;

          // 表示文字列の変換
          let displayText = "";
          if (dayRecord && dayRecord.bathType) {
            switch (dayRecord.bathType) {
              case "入浴":
                displayText = "○";
                break;
              case "シャワー浴":
                displayText = "シャ<br>ワー";
                break;
              case "清拭":
                displayText = "清拭";
                break;
              case "×":
                displayText = "×";
                break;
              default:
                displayText = "";
            }
          }

          return {
            date,
            isBathDay,
            record: dayRecord,
            displayText
          };
        });

        return { resident, dailyData };
      });

      // 8. HTMLテンプレート生成
      const htmlContent = generateBathingPrintHTML(
        residentBathingData,
        dateRange,
        dateFrom,
        dateTo
      );

      // 9. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error("Error generating bathing print:", error);
      res.status(500).json({ message: "印刷データの生成に失敗しました" });
    }
  });


  // Weight records routes
  app.get('/api/weight-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const records = await storage.getWeightRecords(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: record.recordDate ? new Date(record.recordDate).toISOString().replace('Z', '+09:00') : null
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching weight records:", error);
      res.status(500).json({ message: "Failed to fetch weight records" });
    }
  });

  app.post('/api/weight-records', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      let staffId = staffSession ? staffSession.id : null;

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!staffId) {
        try {
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            staffId = userBasedStaff.id;
          } else {
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              staffId = defaultStaff.id;
            } else {
              return res.status(401).json({ message: "有効な職員情報が見つかりません。職員管理で職員を登録するか、職員ログインを行ってください。" });
            }
          }
        } catch (staffError) {
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      const validatedData = insertWeightRecordSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // recordTimeはフロントエンドから送信された値をそのまま使用
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const record = await storage.createWeightRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating weight record:", error);
      res.status(400).json({ message: "Invalid weight record data" });
    }
  });

  app.patch('/api/weight-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateWeightRecordSchema.parse(req.body);
      
      // recordDateをJST時刻として処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordDate = new Date(utcTime + jstOffset);
        }
      }
      
      // recordTimeもフロントエンドから送信された値をそのまま使用
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      validatedData.updatedAt = jstNow;
      
      const record = await storage.updateWeightRecord(id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating weight record:", error);
      res.status(400).json({ message: "Invalid weight record data" });
    }
  });

  app.delete('/api/weight-records/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWeightRecord(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting weight record:", error);
      res.status(500).json({ message: "Failed to delete weight record" });
    }
  });

  // Communications routes
  app.get('/api/communications', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const tenantId = storage.getCurrentTenant();

      console.log('📡 /api/communications - getCurrentTenant():', tenantId);
      console.log('📡 /api/communications - query params:', { residentId, startDate, endDate });

      const communications = await storage.getCommunications(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId || undefined
      );

      console.log('📡 /api/communications - returning', communications.length, 'items');
      res.json(communications);
    } catch (error: any) {
      console.error("Error fetching communications:", error);
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  app.post('/api/communications', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const validatedData = insertCommunicationSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      const communication = await storage.createCommunication(validatedData);
      res.status(201).json(communication);
    } catch (error: any) {
      console.error("Error creating communication:", error);
      res.status(400).json({ message: "Invalid communication data" });
    }
  });

  app.patch('/api/communications/:id/read', isAuthenticated, async (req, res) => {
    try {
      await storage.markCommunicationAsRead(req.params.id);
      res.json({ message: "Communication marked as read" });
    } catch (error: any) {
      console.error("Error marking communication as read:", error);
      res.status(500).json({ message: "Failed to mark communication as read" });
    }
  });

  // Duplicate routes removed - using the routes defined at lines 424 and 468

  // Round Records routes
  app.get('/api/round-records', isAuthenticated, async (req, res) => {
    try {
      const { recordDate } = req.query;
      const rounds = await storage.getRoundRecords(
        recordDate ? new Date(recordDate as string) : new Date()
      );
      res.json(rounds);
    } catch (error: any) {
      console.error("Error fetching round records:", error);
      res.status(500).json({ message: "Failed to fetch round records" });
    }
  });

  app.post('/api/round-records', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const createdBy = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!createdBy) {
        console.error("Validation failed: createdBy is missing.");
        return res.status(401).json({ message: "有効な作成者IDが見つかりません" });
      }

      const validatedData = insertRoundRecordSchema.parse({
        ...req.body,
        createdBy: createdBy,
      });
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const roundRecord = await storage.createRoundRecord(validatedData);
      res.status(201).json(roundRecord);
    } catch (error: any) {
      console.error("Error creating round record:", error);
      res.status(400).json({ message: "Invalid round record data" });
    }
  });

  app.patch('/api/round-records/:id', isAuthenticated, async (req, res) => {
    try {
      const updatedRecord = await storage.updateRoundRecord(req.params.id, req.body);
      res.json(updatedRecord);
    } catch (error: any) {
      console.error("Error updating round record:", error);
      res.status(500).json({ message: "Failed to update round record" });
    }
  });

  app.delete('/api/round-records/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteRoundRecord(req.params.id);
      res.json({ message: "Round record deleted" });
    } catch (error: any) {
      console.error("Error deleting round record:", error);
      res.status(500).json({ message: "Failed to delete round record" });
    }
  });


  // Medication Records routes
  app.get('/api/medication-records', isAuthenticated, async (req, res) => {
    try {
      const { recordDate, dateFrom, dateTo, timing, floor } = req.query;
      
      let records;
      
      // 日付範囲が指定されている場合は一括取得
      if (dateFrom && dateTo) {
        records = await storage.getMedicationRecordsByDateRange(
          dateFrom as string,
          dateTo as string,
          timing as string || 'all',
          floor as string || 'all'
        );
      }
      // 単一日付が指定されている場合は従来の方法
      else if (recordDate) {
        records = await storage.getMedicationRecords(
          recordDate as string,
          timing as string || 'all',
          floor as string || 'all'
        );
      }
      // パラメータが指定されていない場合は全データを取得
      else {
        records = await storage.getAllMedicationRecords(floor as string);
      }
      
      // recordDateをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00')
      }));
      
      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching medication records:", error);
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  app.post('/api/medication-records', isAuthenticated, async (req: any, res) => {
    console.log('🎯 POST /api/medication-records - Request received:', {
      body: req.body,
      user: req.user?.claims?.sub
    });
    
    try {
      const staffSession = (req as any).session?.staff;
      let createdBy = staffSession ? staffSession.id : null;

      // 職員セッションがない場合、デフォルト職員またはユーザー職員を探す
      if (!createdBy) {
        try {
          // まず、認証ユーザーに対応する職員を探す
          const userBasedStaff = await storage.getStaffByUserId(req.user.claims.sub);
          if (userBasedStaff) {
            createdBy = userBasedStaff.id;
          } else {
            // 見つからない場合はデフォルト職員を取得
            const defaultStaff = await storage.getDefaultStaff();
            if (defaultStaff) {
              createdBy = defaultStaff.id;
            } else {
              console.error("❌ No valid staff found for user:", req.user.claims.sub);
              return res.status(401).json({ message: "有効な職員情報が見つかりません。職員管理で職員を登録するか、職員ログインを行ってください。" });
            }
          }
        } catch (staffError) {
          console.error("❌ Error finding staff:", staffError);
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      const validatedData = insertMedicationRecordSchema.parse({
        ...req.body,
        createdBy: createdBy,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // created_atとupdated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);
      
      console.log("Setting medication record timestamps to JST:", jstNow.toISOString());
      
      // 型の問題を回避するためanyでキャスト
      const recordWithTimestamps = { 
        ...validatedData, 
        createdAt: jstNow,
        updatedAt: jstNow 
      } as any;
      
      // Upsert操作を実行（重複がある場合は更新、ない場合は作成）
      const record = await storage.upsertMedicationRecord(recordWithTimestamps);
      
      if (!record) {
        console.error("❌ Upsert returned null/undefined record");
        return res.status(500).json({ message: "Failed to create/update medication record" });
      }
      
      console.log('🎉 Sending successful response:', record);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("❌ Error upserting medication record:", error);
      res.status(400).json({ message: "Invalid medication record data", error: error.message });
    }
  });

  app.put('/api/medication-records/:id', isAuthenticated, async (req: any, res) => {
    console.log('🎯 PUT /api/medication-records/:id - Request received:', {
      id: req.params.id,
      body: req.body,
      isPlaceholder: req.params.id?.startsWith('placeholder-')
    });
    
    try {
      // プレースホルダーIDの場合はエラーを返す
      if (req.params.id?.startsWith('placeholder-')) {
        console.error('❌ Cannot update record with placeholder ID:', req.params.id);
        return res.status(400).json({ 
          message: "Cannot update record with placeholder ID. Use POST to create new record." 
        });
      }
      
      // 部分更新用のスキーマ - 必須フィールドをオプションにする
      const partialMedicationRecordSchema = insertMedicationRecordSchema.partial();
      const validatedData = partialMedicationRecordSchema.parse(req.body);
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);
      
      // 型の問題を回避するためanyでキャスト
      const recordWithUpdatedAt = { ...validatedData, updatedAt: jstNow } as any;
      const record = await storage.updateMedicationRecord(req.params.id, recordWithUpdatedAt);
      
      if (!record) {
        console.error('❌ Record not found for ID:', req.params.id);
        return res.status(404).json({ message: "Record not found" });
      }
      
      res.json(record);
    } catch (error: any) {
      console.error("❌ Error updating medication record:", error);
      res.status(400).json({ message: "Invalid medication record data", error: error.message });
    }
  });

  app.delete('/api/medication-records/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMedicationRecord(req.params.id);
      res.json({ message: "Medication record deleted" });
    } catch (error: any) {
      console.error("Error deleting medication record:", error);
      res.status(500).json({ message: "Failed to delete medication record" });
    }
  });

  // Facility settings routes
  app.get('/api/facility-settings', isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getFacilitySettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching facility settings:", error);
      res.status(500).json({ message: "Failed to fetch facility settings" });
    }
  });

  app.post('/api/facility-settings', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertFacilitySettingsSchema.parse(req.body);
      const settings = await storage.createFacilitySettings(validatedData);
      res.json(settings);
    } catch (error: any) {
      console.error("Error creating facility settings:", error);
      res.status(500).json({ message: "Failed to create facility settings" });
    }
  });

  app.put('/api/facility-settings/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertFacilitySettingsSchema.parse(req.body);
      const settings = await storage.updateFacilitySettings(req.params.id, validatedData);
      res.json(settings);
    } catch (error: any) {
      console.error("Error updating facility settings:", error);
      res.status(500).json({ message: "Failed to update facility settings" });
    }
  });

  // Staff notice routes (連絡事項管理)
  app.get('/api/staff-notices', isAuthenticated, async (req, res) => {
    try {
      const tenantId = storage.getCurrentTenant();
      console.log('🔍 /api/staff-notices - getCurrentTenant():', tenantId);
      console.log('🔍 /api/staff-notices - req.query:', req.query);

      const notices = await storage.getStaffNotices(tenantId || undefined);

      console.log('🔍 /api/staff-notices - returned notices count:', notices.length);
      if (notices.length > 0) {
        console.log('🔍 /api/staff-notices - sample tenant_ids:', notices.slice(0, 3).map(n => n.tenantId));
      }

      res.json(notices);
    } catch (error: any) {
      console.error("Error fetching staff notices:", error);
      res.status(500).json({ message: "Failed to fetch staff notices" });
    }
  });

  app.post('/api/staff-notices', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const createdBy = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!createdBy) {
        console.error("Validation failed: createdBy is missing.");
        return res.status(401).json({ message: "有効な作成者IDが見つかりません" });
      }

      const validatedData = insertStaffNoticeSchema.parse({
        ...req.body,
        createdBy: createdBy,
      });

      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
      const jstNow = new Date(now.getTime() + jstOffset);

      // 型の問題を回避するためanyでキャスト
      const dataWithTimestamps = {
        ...validatedData,
        createdAt: jstNow,
        updatedAt: jstNow
      } as any;

      const notice = await storage.createStaffNotice(dataWithTimestamps);
      res.status(201).json(notice);
    } catch (error: any) {
      console.error("Error creating staff notice:", error);
      res.status(400).json({ message: "Invalid staff notice data" });
    }
  });

  app.delete('/api/staff-notices/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteStaffNotice(req.params.id);
      res.json({ message: "Staff notice deleted" });
    } catch (error: any) {
      console.error("Error deleting staff notice:", error);
      res.status(500).json({ message: "Failed to delete staff notice" });
    }
  });

  // Staff notice read status routes
  app.get('/api/staff-notices/:id/read-status', isAuthenticated, async (req, res) => {
    try {
      const readStatus = await storage.getStaffNoticeReadStatus(req.params.id);
      res.json(readStatus);
    } catch (error: any) {
      console.error("Error fetching staff notice read status:", error);
      res.status(500).json({ message: "Failed to fetch read status" });
    }
  });

  app.post('/api/staff-notices/:id/mark-read', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const userId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!userId) {
        return res.status(401).json({ message: "有効なユーザーIDが見つかりません" });
      }

      const readStatus = await storage.markStaffNoticeAsRead(req.params.id, userId);
      res.status(201).json(readStatus);
    } catch (error: any) {
      console.error("Error marking staff notice as read:", error);
      res.status(400).json({ message: "Failed to mark as read" });
    }
  });

  app.post('/api/staff-notices/:id/mark-unread', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const userId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!userId) {
        return res.status(401).json({ message: "有効なユーザーIDが見つかりません" });
      }

      await storage.markStaffNoticeAsUnread(req.params.id, userId);
      res.status(200).json({ message: "Marked as unread" });
    } catch (error: any) {
      console.error("Error marking staff notice as unread:", error);
      res.status(400).json({ message: "Failed to mark as unread" });
    }
  });

  app.get('/api/staff-notices/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const userId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!userId) {
        return res.status(401).json({ message: "有効なユーザーIDが見つかりません" });
      }

      const count = await storage.getUnreadStaffNoticesCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Cleaning Linen routes (清掃リネン管理)
  app.get('/api/cleaning-linen', isAuthenticated, async (req, res) => {
    try {
      const { weekStartDate, floor, startDate, endDate } = req.query;

      // 新規：startDate/endDate パラメータによる期間フィルタリング（チェック一覧画面用）
      if (startDate && endDate) {
        const records = await storage.getCleaningLinenRecordsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string),
          floor as string
        );

        // 全ての時刻フィールドをJST時刻として正しく返すために変換
        const convertedRecords = records.map(record => ({
          ...record,
          recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00'),
          recordTime: record.recordTime ? new Date(record.recordTime).toISOString().replace('Z', '+09:00') : record.recordTime,
          createdAt: record.createdAt ? new Date(record.createdAt).toISOString().replace('Z', '+09:00') : record.createdAt,
          updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString().replace('Z', '+09:00') : record.updatedAt
        }));

        res.json(convertedRecords);
        return;
      }

      // 既存：weekStartDateが指定されていない場合は全データを取得
      if (!weekStartDate) {
        const records = await storage.getAllCleaningLinenRecords(floor as string);

        // 全ての時刻フィールドをJST時刻として正しく返すために変換
        const convertedRecords = records.map(record => ({
          ...record,
          recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00'),
          recordTime: record.recordTime ? new Date(record.recordTime).toISOString().replace('Z', '+09:00') : record.recordTime,
          createdAt: record.createdAt ? new Date(record.createdAt).toISOString().replace('Z', '+09:00') : record.createdAt,
          updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString().replace('Z', '+09:00') : record.updatedAt
        }));

        res.json(convertedRecords);
        return;
      }

      // 既存：weekStartDateが指定されている場合は週単位で取得
      const weekStart = new Date(weekStartDate as string);
      const records = await storage.getCleaningLinenRecords(weekStart, floor as string);

      // 全ての時刻フィールドをJST時刻として正しく返すために変換
      const convertedRecords = records.map(record => ({
        ...record,
        recordDate: new Date(record.recordDate).toISOString().replace('Z', '+09:00'),
        recordTime: record.recordTime ? new Date(record.recordTime).toISOString().replace('Z', '+09:00') : record.recordTime,
        createdAt: record.createdAt ? new Date(record.createdAt).toISOString().replace('Z', '+09:00') : record.createdAt,
        updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString().replace('Z', '+09:00') : record.updatedAt
      }));

      res.json(convertedRecords);
    } catch (error: any) {
      console.error("Error fetching cleaning linen records:", error);
      res.status(500).json({ message: "Failed to fetch cleaning linen records" });
    }
  });

  app.post('/api/cleaning-linen', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const validatedData = insertCleaningLinenRecordSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // recordTimeもJST時刻として明示的に処理
      if (validatedData.recordTime) {
        if (typeof validatedData.recordTime === 'string') {
          const timeString = validatedData.recordTime as string;
          const jstTime = new Date(timeString + (timeString.includes('+') ? '' : '+09:00'));
          validatedData.recordTime = jstTime;
        } else if (validatedData.recordTime instanceof Date) {
          const utcTime = validatedData.recordTime.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordTime = new Date(utcTime + jstOffset);
        }
      } else {
        // recordTimeが指定されていない場合、現在のJST時刻を設定
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        validatedData.recordTime = new Date(now.getTime() + jstOffset);
      }
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const record = await storage.createCleaningLinenRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  app.put('/api/cleaning-linen/:id', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const validatedData = updateCleaningLinenRecordSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordDate = new Date(utcTime + jstOffset);
        }
      }
      
      // recordTimeをJST時刻として処理
      if (validatedData.recordTime) {
        if (typeof validatedData.recordTime === 'string') {
          const timeString = validatedData.recordTime as string;
          const jstTime = new Date(timeString + (timeString.includes('+') ? '' : '+09:00'));
          validatedData.recordTime = jstTime;
        } else if (validatedData.recordTime instanceof Date) {
          const utcTime = validatedData.recordTime.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordTime = new Date(utcTime + jstOffset);
        }
      }
      
      // updated_atを現在のJST時刻で明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      validatedData.updatedAt = jstNow;
      
      const record = await storage.updateCleaningLinenRecord(req.params.id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  app.post('/api/cleaning-linen/upsert', isAuthenticated, async (req: any, res) => {
    try {
      const staffSession = (req as any).session?.staff;
      const staffId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);

      if (!staffId) {
        console.error("Validation failed: staffId is missing.");
        return res.status(401).json({ message: "有効な記録者IDが見つかりません" });
      }

      const validatedData = insertCleaningLinenRecordSchema.parse({
        ...req.body,
        staffId: staffId,
      });
      
      // recordDateをJST時刻として明示的に処理
      if (validatedData.recordDate) {
        if (typeof validatedData.recordDate === 'string') {
          const dateString = validatedData.recordDate as string;
          const jstDate = new Date(dateString + (dateString.includes('+') ? '' : '+09:00'));
          validatedData.recordDate = jstDate;
        } else if (validatedData.recordDate instanceof Date) {
          // フロントエンドがJSTのつもりで送信したがUTCとして解釈されている場合、9時間加算してJST時刻に修正
          const utcTime = validatedData.recordDate.getTime();
          const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
          const jstTime = new Date(utcTime + jstOffset);
          validatedData.recordDate = jstTime;
        }
      }
      
      // recordTimeもJST時刻として明示的に処理
      if (validatedData.recordTime) {
        if (typeof validatedData.recordTime === 'string') {
          const timeString = validatedData.recordTime as string;
          const jstTime = new Date(timeString + (timeString.includes('+') ? '' : '+09:00'));
          validatedData.recordTime = jstTime;
        } else if (validatedData.recordTime instanceof Date) {
          const utcTime = validatedData.recordTime.getTime();
          const jstOffset = 9 * 60 * 60 * 1000;
          validatedData.recordTime = new Date(utcTime + jstOffset);
        }
      } else {
        // recordTimeが指定されていない場合、現在のJST時刻を設定
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        validatedData.recordTime = new Date(now.getTime() + jstOffset);
      }
      
      // created_atとupdated_atをJST時刻として明示的に設定
      const currentTime = new Date();
      const jstOffset2 = 9 * 60 * 60 * 1000;
      const jstNow = new Date(currentTime.getTime() + jstOffset2);
      (validatedData as any).createdAt = jstNow;
      (validatedData as any).updatedAt = jstNow;
      
      const record = await storage.upsertCleaningLinenRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error upserting cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  app.delete('/api/cleaning-linen/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCleaningLinenRecord(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting cleaning linen record:", error);
      res.status(500).json({ message: "削除に失敗しました" });
    }
  });

  // Staff Management routes
  
  app.get('/api/staff-management', isAuthenticated, async (req, res) => {
    try {
      const staffList = await storage.getStaffManagement();
      res.json(staffList);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.get('/api/staff-management/:id', isAuthenticated, async (req, res) => {
    try {
      const staff = await storage.getStaffManagementById(req.params.id);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(staff);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post('/api/staff-management', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertStaffManagementSchema.parse(req.body);
      const staff = await storage.createStaffManagement(validatedData);
      res.status(201).json(staff);
    } catch (error: any) {
      console.error("Error creating staff:", error);
      
      // Zodバリデーションエラーの詳細処理
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "入力データの検証に失敗しました", 
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: error.message || "職員情報の作成に失敗しました" });
    }
  });

  app.patch('/api/staff-management/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = updateStaffManagementApiSchema.parse({
        ...req.body,
        id: req.params.id,
      });
      const staff = await storage.updateStaffManagement(validatedData);
      res.json(staff);
    } catch (error: any) {
      console.error("Error updating staff:", error);
      res.status(400).json({ message: "Invalid staff data" });
    }
  });

  app.delete('/api/staff-management/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteStaffManagement(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      res.status(500).json({ message: "Failed to delete staff" });
    }
  });

  app.post('/api/staff-management/:id/unlock', isAuthenticated, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "パスワードは6文字以上で入力してください" });
      }
      const staff = await storage.unlockStaffAccount(req.params.id, password);
      res.json(staff);
    } catch (error: any) {
      console.error("Error unlocking staff account:", error);
      res.status(400).json({ message: "アカウントロック解除に失敗しました" });
    }
  });

  app.post('/api/staff-management/:id/lock', isAuthenticated, async (req, res) => {
    try {
      const staff = await storage.lockStaffAccount(req.params.id);
      res.json(staff);
    } catch (error: any) {
      console.error("Error locking staff account:", error);
      res.status(400).json({ message: "アカウントロックに失敗しました" });
    }
  });

  // Tenant Management routes
  app.get('/api/tenants', isAuthenticated, async (req, res) => {
    try {
      const tenantList = await storage.getTenants();
      res.json(tenantList);
    } catch (error: any) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get('/api/tenants/:id', isAuthenticated, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant" });
    }
  });

  app.post('/api/tenants', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertTenantSchema.parse(req.body);
      const user = req.user as any;

      // ログインユーザーのstaff IDを取得
      let staffId: string | null = null;

      if (user?.claims?.sub) {
        // Replit認証の場合、対応するstaff_managementレコードを検索
        const staff = await storage.getStaffByUserId(user.claims.sub);
        if (staff) {
          staffId = staff.id;
        }
      } else if ((req as any).session?.staff?.id) {
        // 職員認証の場合
        staffId = (req as any).session.staff.id;
      }

      if (!staffId) {
        return res.status(400).json({ message: "ユーザー情報が見つかりません" });
      }

      const tenant = await storage.createTenant(validatedData, staffId);
      res.status(201).json(tenant);
    } catch (error: any) {
      console.error("Error creating tenant:", error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "入力データが正しくありません",
          errors: error.errors
        });
      }

      res.status(400).json({ message: error.message || "テナントの作成に失敗しました" });
    }
  });

  app.patch('/api/tenants/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = updateTenantApiSchema.parse({
        ...req.body,
        id: req.params.id,
      });

      const user = req.user as any;

      // ログインユーザーのstaff IDを取得
      let staffId: string | null = null;

      if (user?.claims?.sub) {
        // Replit認証の場合、対応するstaff_managementレコードを検索
        const staff = await storage.getStaffByUserId(user.claims.sub);
        if (staff) {
          staffId = staff.id;
        }
      } else if ((req as any).session?.staff?.id) {
        // 職員認証の場合
        staffId = (req as any).session.staff.id;
      }

      if (!staffId) {
        return res.status(400).json({ message: "ユーザー情報が見つかりません" });
      }

      const tenant = await storage.updateTenant(validatedData, staffId);
      res.json(tenant);
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      res.status(400).json({ message: error.message || "テナントの更新に失敗しました" });
    }
  });

  app.delete('/api/tenants/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTenant(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Resident Attachments routes
  app.get('/api/residents/:residentId/attachments', isAuthenticated, async (req, res) => {
    try {
      const { residentId } = req.params;
      const attachments = await storage.getResidentAttachments(residentId);
      res.json(attachments);
    } catch (error: any) {
      console.error("Error fetching resident attachments:", error);
      res.status(500).json({ message: "添付ファイルの取得に失敗しました" });
    }
  });

  app.post('/api/residents/:residentId/attachments', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const staffSession = (req as any).session?.staff;
      const userId = staffSession ? staffSession.id : (req.user?.claims?.sub || null);
      const file = req.file;

      if (!userId) {
        console.error("Validation failed: userId is missing.");
        return res.status(401).json({ message: "有効なユーザーIDが見つかりません" });
      }
      
      if (!file) {
        return res.status(400).json({ message: "ファイルが選択されていません" });
      }
      
      const validatedData = insertResidentAttachmentSchema.parse({
        residentId,
        uploadedBy: userId,
        fileName: file.originalname,
        filePath: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: req.body.description || "",
      });
      
      const attachment = await storage.createResidentAttachment(validatedData);
      res.json(attachment);
    } catch (error: any) {
      console.error("Error creating resident attachment:", error);
      res.status(400).json({ message: "添付ファイルの作成に失敗しました" });
    }
  });

  app.delete('/api/residents/attachments/:attachmentId', isAuthenticated, async (req, res) => {
    try {
      const { attachmentId } = req.params;
      await storage.deleteResidentAttachment(attachmentId);
      res.json({ message: "添付ファイルが削除されました" });
    } catch (error: any) {
      console.error("Error deleting resident attachment:", error);
      res.status(500).json({ message: "添付ファイルの削除に失敗しました" });
    }
  });

  // 添付ファイルのダウンロード
  app.get('/api/attachments/:attachmentId/download', isAuthenticated, async (req, res) => {
    try {
      const { attachmentId } = req.params;
      const attachment = await storage.getResidentAttachment(attachmentId);
      
      if (!attachment) {
        return res.status(404).json({ message: "添付ファイルが見つかりません" });
      }

      const filePath = path.join(process.cwd(), attachment.filePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "ファイルが見つかりません" });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
      res.setHeader('Content-Type', attachment.mimeType);
      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ message: "ファイルのダウンロードに失敗しました" });
    }
  });

  // 添付ファイルの表示（画像など）
  app.get('/api/attachments/:attachmentId/view', isAuthenticated, async (req, res) => {
    try {
      const { attachmentId } = req.params;
      const attachment = await storage.getResidentAttachment(attachmentId);
      
      if (!attachment) {
        return res.status(404).json({ message: "添付ファイルが見つかりません" });
      }

      const filePath = path.join(process.cwd(), attachment.filePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "ファイルが見つかりません" });
      }

      res.setHeader('Content-Type', attachment.mimeType);
      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Error viewing attachment:", error);
      res.status(500).json({ message: "ファイルの表示に失敗しました" });
    }
  });

  // テスト用エンドポイント（認証なし）
  app.get('/api/test-nursing-categories', async (req, res) => {
    try {
      const allRecords = await storage.getDailyRecords(new Date().toISOString().split('T')[0]);
      const nursingRecords = allRecords.filter(r => r.recordType === '看護記録' || r.recordType === '処置' || r.recordType === '医療記録');
      res.json({
        total: allRecords.length,
        nursing: nursingRecords.length,
        categories: nursingRecords.map(r => ({
          id: r.id,
          recordType: r.recordType,
          originalCategory: r.originalData?.category,
        }))
      });
    } catch (error: any) {
      console.error("Error testing nursing categories:", error);
      res.status(500).json({ message: "Failed to test nursing categories" });
    }
  });

  // 排泄記録デバッグ用エンドポイント（認証なし）
  app.get('/api/debug-excretion', async (req, res) => {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.query;
      
      const startDate = new Date(date as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date as string);
      endDate.setHours(23, 59, 59, 999);

      // 全排泄記録を取得
      const allExcretionRecords = await db.select()
        .from(excretionRecords)
        .where(and(
          gte(excretionRecords.recordDate, startDate),
          lte(excretionRecords.recordDate, endDate)
        ))
        .orderBy(desc(excretionRecords.recordDate));

      // 今は一旦コメントアウト
      // const allGeneralNotes = await db.select()
      //   .from(excretionRecords)  
      //   .where(eq(excretionRecords.type, 'general_note'))
      //   .orderBy(desc(excretionRecords.createdAt))
      //   .limit(10);

      res.json({
        date: date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRecords: allExcretionRecords.length,
        byType: {
          general_note: allExcretionRecords.filter(r => r.type === 'general_note').length,
          bowel_movement: allExcretionRecords.filter(r => r.type === 'bowel_movement').length,
          urination: allExcretionRecords.filter(r => r.type === 'urination').length,
        },
        records: allExcretionRecords.map(r => ({
          id: r.id,
          type: r.type,
          residentId: r.residentId,
          recordDate: r.recordDate,
          consistency: r.consistency,
          amount: r.amount,
          urineVolumeCc: r.urineVolumeCc,
          assistance: r.assistance,
          notes: r.notes,
          createdAt: r.createdAt,
          staffId: r.staffId
        })),
        // allGeneralNotes: allGeneralNotes.map(r => ({
        //   id: r.id,
        //   residentId: r.residentId,
        //   recordDate: r.recordDate,
        //   notes: r.notes,
        //   createdAt: r.createdAt,
        //   staffId: r.staffId
        // }))
      });
    } catch (error: any) {
      console.error("Error debugging excretion:", error);
      res.status(500).json({ message: "Failed to debug excretion records" });
    }
  });

  // デバッグ用：介護記録の詳細確認API
  app.get('/api/debug-care-records', isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      // 指定日の全介護記録を取得
      const startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(23, 59, 59, 999);
      
      const records = await storage.getCareRecords(undefined, startDate, endDate);
      
      const debugInfo = records.map(r => ({
        id: r.id,
        residentId: r.residentId,
        recordDate: r.recordDate,
        recordDateISO: new Date(r.recordDate).toISOString(),
        recordDateJST: new Date(new Date(r.recordDate).getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00'),
        description: r.description?.substring(0, 50),
        staffId: r.staffId
      }));
      
      res.json({
        date: targetDate.toISOString(),
        count: records.length,
        records: debugInfo
      });
    } catch (error: any) {
      console.error("Debug API error:", error);
      res.status(500).json({ message: "Failed to debug care records" });
    }
  });

  // 今日の記録一覧取得API
  app.get('/api/daily-records', isAuthenticated, async (req, res) => {
    try {
      const { date, recordTypes, includeNextDay } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: '日付パラメータが必要です' });
      }

      // recordTypesがクエリパラメータで渡された場合は配列に変換
      let recordTypesArray: string[] | undefined;
      if (recordTypes) {
        if (typeof recordTypes === 'string') {
          recordTypesArray = recordTypes.split(',');
        } else if (Array.isArray(recordTypes)) {
          recordTypesArray = recordTypes as string[];
        }
      }
      
      // includeNextDayパラメータがtrueの場合、翌日の早朝記録も含める
      const includeNextDayRecords = includeNextDay === 'true';

      const records = await storage.getDailyRecords(date, recordTypesArray, includeNextDayRecords);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching daily records:", error);
      res.status(500).json({ message: "今日の記録一覧の取得に失敗しました" });
    }
  });

  // Journal Checkbox API
  app.get('/api/journal-checkboxes/:date', isAuthenticated, async (req, res) => {
    try {
      const { date } = req.params;
      const checkboxes = await storage.getJournalCheckboxes(date);
      res.json(checkboxes);
    } catch (error: any) {
      console.error("Error fetching journal checkboxes:", error);
      res.status(500).json({ message: "日誌チェック状態の取得に失敗しました" });
    }
  });

  app.post('/api/journal-checkboxes', isAuthenticated, async (req, res) => {
    try {
      const { recordId, recordType, checkboxType, isChecked, recordDate } = req.body;
      
      if (!recordId || !recordType || !checkboxType || typeof isChecked !== 'boolean' || !recordDate) {
        return res.status(400).json({ message: "必要なパラメータが不足しています" });
      }

      await storage.upsertJournalCheckbox(recordId, recordType, checkboxType, isChecked, recordDate);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error updating journal checkbox:", error);
      res.status(500).json({ message: "日誌チェック状態の更新に失敗しました" });
    }
  });

  // Journal Entry エンドポイント
  app.get('/api/journal-entries', isAuthenticated, async (req, res) => {
    try {
      const { dateFrom, dateTo, recordType, floor } = req.query;

      const entries = await storage.getJournalEntries(
        dateFrom as string | undefined,
        dateTo as string | undefined,
        recordType as string | undefined,
        floor as string | undefined
      );

      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "日誌エントリの取得に失敗しました" });
    }
  });

  app.post('/api/journal-entries', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertJournalEntrySchema.parse(req.body);

      // createdByにユーザーIDを設定
      const staffSession = (req as any).session?.staff;
      const user = req.user as any;
      const userId = staffSession ? staffSession.id : (user?.claims?.sub || user?.sub || null);
      validatedData.createdBy = userId;

      const entry = await storage.createJournalEntry(validatedData);
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Error creating journal entry:", error);
      res.status(400).json({ message: "日誌エントリの作成に失敗しました" });
    }
  });

  app.put('/api/journal-entries/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertJournalEntrySchema.partial().parse(req.body);

      const entry = await storage.updateJournalEntry(id, validatedData);
      res.json(entry);
    } catch (error: any) {
      console.error("Error updating journal entry:", error);
      res.status(400).json({ message: "日誌エントリの更新に失敗しました" });
    }
  });

  app.post('/api/journal-entries/upsert', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertJournalEntrySchema.parse(req.body);

      // createdByにユーザーIDを設定
      const staffSession = (req as any).session?.staff;
      const user = req.user as any;
      const userId = staffSession ? staffSession.id : (user?.claims?.sub || user?.sub || null);
      validatedData.createdBy = userId;

      const entry = await storage.upsertJournalEntry(validatedData);
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("❌ Zod validation error:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ message: "入力データの検証に失敗しました", errors: error.errors });
      } else {
        console.error("❌ Database/Storage error:", error);
        console.error("Error details:", error.message, error.stack);
        res.status(400).json({ message: "日誌エントリの更新に失敗しました", details: error.message });
      }
    }
  });

  app.delete('/api/journal-entries/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteJournalEntry(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "日誌エントリの削除に失敗しました" });
    }
  });

  // 食事・水分チェック一覧の印刷
  app.get('/api/meals-medication/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. データを取得
      const [mealsData, residents] = await Promise.all([
        storage.getMealsAndMedication(),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      const filteredMeals = mealsData.filter((meal: any) => {
        const mealDate = new Date(meal.recordDate);
        return mealDate >= startDate && mealDate <= endDate && meal.type === 'meal';
      });

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) =>
          resident.floor === selectedFloor || resident.floor === `${selectedFloor}階`
        );
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 利用者ごとにデータをグループ化
      const residentMealData = filteredResidents.map((resident: any) => {
        const residentMeals = filteredMeals.filter((meal: any) =>
          meal.residentId === resident.id
        );

        // 日付範囲内のすべての日付を生成
        const dateRange: string[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
          dateRange.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }

        // 日付ごとに食事データを整理
        const dailyMeals = dateRange.map(date => {
          const dayMeals = residentMeals.filter((meal: any) =>
            meal.recordDate.toISOString().split('T')[0] === date
          );

          const mealsByType: { [key: string]: any } = {};
          dayMeals.forEach((meal: any) => {
            if (meal.mealType) {
              mealsByType[meal.mealType] = meal;
            }
          });

          return {
            date,
            meals: mealsByType
          };
        });

        return {
          resident,
          dailyMeals
        };
      });

      // 6. HTMLテンプレート生成
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = dayNames[date.getDay()];
        return `${date.getMonth() + 1}月${date.getDate()}日(${dayOfWeek})`;
      };

      const formatDateRange = (from: string, to: string) => {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return `${fromDate.getMonth() + 1}月${fromDate.getDate()}日〜${toDate.getMonth() + 1}月${toDate.getDate()}日`;
      };

      // 水分トータル計算関数
      const calculateWaterTotal = (meals: { [key: string]: any }) => {
        let total = 0;
        ["朝", "昼", "夕", "10時", "15時"].forEach(mealType => {
          const meal = meals[mealType];
          if (meal?.waterIntake) {
            const value = parseInt(meal.waterIntake);
            if (!isNaN(value)) {
              total += value;
            }
          }
        });
        return total > 0 ? total.toString() : "";
      };

      let htmlContent = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: 'MS Gothic', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 0;
            }
            .page {
              page-break-after: always;
              min-height: 260mm;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .resident-info {
              text-align: left;
              font-size: 12px;
              margin-bottom: 3mm;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
              border: 1px solid #000;
            }
            th, td {
              border: 1px solid #000;
              padding: 1mm;
              text-align: center;
              vertical-align: middle;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .date-col { width: 10%; }
            .meal-col { width: 7%; }
            .water-col { width: 7%; }
            .total-col { width: 7%; background-color: #e6e6e6; border-right: 2px solid #000; }
            .category-header {
              background-color: #d0d0d0;
              font-weight: bold;
              text-align: center;
            }
            .sub-header {
              background-color: #e8e8e8;
              font-size: 10px;
            }
            .header-right-edge {
              border-right: 2px solid #000;
            }
          </style>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </head>
        <body>
      `;

      residentMealData.forEach((residentData, index) => {
        const { resident, dailyMeals } = residentData;

        htmlContent += `
          <div class="page">
            <div class="header">
              <div class="title">ケース記録（食事）</div>
              <div class="resident-info">
                利用者氏名：${resident.roomNumber}：${resident.name}<br>
                日付：${formatDateRange(dateFrom, dateTo)}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th rowspan="3" class="date-col">日付</th>
                  <th colspan="2" class="category-header">朝食</th>
                  <th colspan="2" class="category-header">昼食</th>
                  <th colspan="2" class="category-header">夕食</th>
                  <th colspan="6" class="category-header header-right-edge">水分量</th>
                </tr>
                <tr>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">朝</th>
                  <th class="sub-header">10時</th>
                  <th class="sub-header">昼</th>
                  <th class="sub-header">3時</th>
                  <th class="sub-header">夕</th>
                  <th class="sub-header header-right-edge">トータル</th>
                </tr>
                <tr>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header header-right-edge">cc</th>
                </tr>
              </thead>
              <tbody>
        `;

        dailyMeals.forEach((dailyMeal) => {
          const { date, meals } = dailyMeal;

          htmlContent += `
            <tr>
              <td class="date-col">${formatDate(date)}</td>
              <td class="meal-col">${meals["朝"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["朝"]?.sideAmount || ""}</td>
              <td class="meal-col">${meals["昼"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["昼"]?.sideAmount || ""}</td>
              <td class="meal-col">${meals["夕"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["夕"]?.sideAmount || ""}</td>
              <td class="water-col">${meals["朝"]?.waterIntake || ""}</td>
              <td class="water-col">${meals["10時"]?.waterIntake || ""}</td>
              <td class="water-col">${meals["昼"]?.waterIntake || ""}</td>
              <td class="water-col">${meals["15時"]?.waterIntake || ""}</td>
              <td class="water-col">${meals["夕"]?.waterIntake || ""}</td>
              <td class="total-col">${calculateWaterTotal(meals)}</td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error) {
      console.error('食事・水分チェック一覧印刷エラー:', error);
      res.status(500).json({ message: '印刷処理中にエラーが発生しました' });
    }
  });

  // 食事・水分チェック一覧の印刷（その他含む）
  app.get('/api/meals-medication/print-with-supplement', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. データを取得
      const [mealsData, residents] = await Promise.all([
        storage.getMealsAndMedication(),
        storage.getResidents()
      ]);

      // 2. 日付範囲でフィルタリング
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      const filteredMeals = mealsData.filter((meal: any) => {
        const mealDate = new Date(meal.recordDate);
        return mealDate >= startDate && mealDate <= endDate && meal.type === 'meal';
      });

      // 3. 階数フィルタ
      let filteredResidents = residents;
      if (selectedFloor !== "all") {
        filteredResidents = residents.filter((resident: any) =>
          resident.floor === selectedFloor || resident.floor === `${selectedFloor}階`
        );
      }

      // 4. 利用者フィルタ
      if (selectedResident !== "all") {
        filteredResidents = filteredResidents.filter((resident: any) =>
          resident.id === selectedResident
        );
      }

      // 5. 利用者ごとにデータをグループ化
      const residentMealData = filteredResidents.map((resident: any) => {
        const residentMeals = filteredMeals.filter((meal: any) =>
          meal.residentId === resident.id
        );

        // 日付範囲内のすべての日付を生成
        const dateRange: string[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
          dateRange.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }

        // 日付ごとに食事データを整理
        const dailyMeals = dateRange.map(date => {
          const dayMeals = residentMeals.filter((meal: any) =>
            meal.recordDate.toISOString().split('T')[0] === date
          );

          const mealsByType: { [key: string]: any } = {};
          dayMeals.forEach((meal: any) => {
            if (meal.mealType) {
              mealsByType[meal.mealType] = meal;
            }
          });

          return {
            date,
            meals: mealsByType
          };
        });

        return {
          resident,
          dailyMeals
        };
      });

      // 6. HTMLテンプレート生成
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = dayNames[date.getDay()];
        return `${date.getMonth() + 1}月${date.getDate()}日(${dayOfWeek})`;
      };

      const formatDateRange = (from: string, to: string) => {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return `${fromDate.getMonth() + 1}月${fromDate.getDate()}日〜${toDate.getMonth() + 1}月${toDate.getDate()}日`;
      };

      // 水分トータル計算関数
      const calculateWaterTotal = (meals: { [key: string]: any }) => {
        let total = 0;
        ["朝", "昼", "夕", "10時", "15時"].forEach(mealType => {
          const meal = meals[mealType];
          if (meal?.waterIntake) {
            const value = parseInt(meal.waterIntake);
            if (!isNaN(value)) {
              total += value;
            }
          }
        });
        return total > 0 ? total.toString() : "";
      };

      let htmlContent = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: 'MS Gothic', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 0;
            }
            .page {
              page-break-after: always;
              min-height: 260mm;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .resident-info {
              text-align: left;
              font-size: 12px;
              margin-bottom: 3mm;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
              border: 1px solid #000;
            }
            th, td {
              border: 1px solid #000;
              padding: 1mm;
              text-align: center;
              vertical-align: middle;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .date-col { width: 10%; }
            .meal-col { width: 7%; }
            .water-col { width: 7%; }
            .total-col { width: 7%; background-color: #e6e6e6; border-right: 2px solid #000; }
            .category-header {
              background-color: #d0d0d0;
              font-weight: bold;
              text-align: center;
            }
            .sub-header {
              background-color: #e8e8e8;
              font-size: 10px;
            }
            .header-right-edge {
              border-right: 2px solid #000;
            }
            .supplement-row {
              font-size: 8px;
              color: #333;
              padding: 1px;
              vertical-align: top;
              min-height: 15px;
              height: 15px;
            }
            .main-meal-row {
              min-height: 15px;
              height: 15px;
            }
          </style>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </head>
        <body>
      `;

      residentMealData.forEach((residentData, index) => {
        const { resident, dailyMeals } = residentData;

        htmlContent += `
          <div class="page">
            <div class="header">
              <div class="title">ケース記録（食事）</div>
              <div class="resident-info">
                利用者氏名：${resident.roomNumber}：${resident.name}<br>
                日付：${formatDateRange(dateFrom, dateTo)}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th rowspan="3" class="date-col">日付</th>
                  <th colspan="2" class="category-header">朝食</th>
                  <th colspan="2" class="category-header">昼食</th>
                  <th colspan="2" class="category-header">夕食</th>
                  <th colspan="6" class="category-header header-right-edge">水分量</th>
                </tr>
                <tr>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">主食</th>
                  <th class="sub-header">副食</th>
                  <th class="sub-header">朝</th>
                  <th class="sub-header">10時</th>
                  <th class="sub-header">昼</th>
                  <th class="sub-header">3時</th>
                  <th class="sub-header">夕</th>
                  <th class="sub-header header-right-edge">トータル</th>
                </tr>
                <tr>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">割</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header">cc</th>
                  <th class="sub-header header-right-edge">cc</th>
                </tr>
              </thead>
              <tbody>
        `;

        dailyMeals.forEach((dailyMeal) => {
          const { date, meals } = dailyMeal;

          // 1行目：主食・副食の数値データ
          htmlContent += `
            <tr class="main-meal-row">
              <td class="date-col" rowspan="2">${formatDate(date)}</td>
              <td class="meal-col">${meals["朝"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["朝"]?.sideAmount || ""}</td>
              <td class="meal-col">${meals["昼"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["昼"]?.sideAmount || ""}</td>
              <td class="meal-col">${meals["夕"]?.mainAmount || ""}</td>
              <td class="meal-col">${meals["夕"]?.sideAmount || ""}</td>
              <td class="water-col" rowspan="2">${meals["朝"]?.waterIntake || ""}</td>
              <td class="water-col" rowspan="2">${meals["10時"]?.waterIntake || ""}</td>
              <td class="water-col" rowspan="2">${meals["昼"]?.waterIntake || ""}</td>
              <td class="water-col" rowspan="2">${meals["15時"]?.waterIntake || ""}</td>
              <td class="water-col" rowspan="2">${meals["夕"]?.waterIntake || ""}</td>
              <td class="total-col" rowspan="2">${calculateWaterTotal(meals)}</td>
            </tr>
          `;

          // 2行目：その他データ（colspanで主食・副食を結合）
          htmlContent += `
            <tr>
              <td class="meal-col supplement-row" colspan="2">${meals["朝"]?.supplement || ""}</td>
              <td class="meal-col supplement-row" colspan="2">${meals["昼"]?.supplement || ""}</td>
              <td class="meal-col supplement-row" colspan="2">${meals["夕"]?.supplement || ""}</td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error) {
      console.error('食事・水分チェック一覧印刷（その他含む）エラー:', error);
      res.status(500).json({ message: '印刷処理中にエラーが発生しました' });
    }
  });

  // ケース記録PDF生成エンドポイント
  app.get('/api/care-records/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const recordCategory = req.query.recordCategory as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. 全テーブルからデータを取得
      const [
        careRecords,
        vitalSigns,
        mealsAndMedication,
        medicationRecords,
        excretionData,
        weightRecords,
        cleaningLinen,
        nursingRecords,
        residents,
        staffList
      ] = await Promise.all([
        storage.getCareRecords(),
        storage.getVitalSigns(),
        storage.getMealsAndMedication(),
        storage.getAllMedicationRecords(),
        storage.getExcretionRecords(),
        storage.getWeightRecords(),
        storage.getAllCleaningLinenRecords(),
        storage.getNursingRecords(),
        storage.getResidents(),
        storage.getStaffManagement()
      ]);

      // 2. 統合データ作成（care-records-check.tsxのロジックと同じ）
      const allRecords: any[] = [];

      // 各テーブルのデータを統合
      careRecords.forEach((record: any) => {
        const recordContent = record.description || record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "様子",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      vitalSigns.forEach((record: any) => {
        const recordContent = record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "バイタル",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      mealsAndMedication.forEach((record: any) => {
        const recordContent = record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "食事",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      medicationRecords.forEach((record: any) => {
        const recordContent = record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.createdBy);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "服薬",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      excretionData.forEach((record: any) => {
        const recordContent = record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "排泄",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      weightRecords.forEach((record: any) => {
        const recordContent = record.notes || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "体重",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      cleaningLinen.forEach((record: any) => {
        const recordContent = record.recordNote || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.staffId);

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: "清掃リネン",
            recorder: staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      nursingRecords.forEach((record: any) => {
        const recordContent = record.description || '';
        if (recordContent && recordContent.trim()) {
          const resident = residents.find((r: any) => r.id === record.residentId);
          const staff = staffList.find((s: any) => s.id === record.nurseId);

          let category = "看護記録";
          if (record.category === '処置') {
            category = "処置";
          }

          allRecords.push({
            recordDate: new Date(record.recordDate),
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '',
            residentId: record.residentId,
            category: category,
            recorder: record.staffName || staff?.staffName || '',
            content: recordContent,
            floor: resident?.floor?.toString() || ''
          });
        }
      });

      // 3. フィルタリング
      const getCategoryMapping = (recordCategory: string) => {
        const categoryMap: { [key: string]: string[] } = {
          "介護": ["体重", "食事", "排泄", "様子", "清掃リネン", "服薬"],
          "看護": ["バイタル", "看護記録", "処置"],
          "様子": ["様子"],
        };
        return categoryMap[recordCategory] || [];
      };

      const filteredRecords = allRecords.filter((record) => {
        const recordDate = record.recordDate.toISOString().split('T')[0];

        // 日付範囲フィルタ
        if (recordDate < dateFrom || recordDate > dateTo) return false;

        // カテゴリフィルタ
        if (recordCategory && recordCategory !== "all") {
          const allowedCategories = getCategoryMapping(recordCategory);
          if (allowedCategories.length > 0 && !allowedCategories.includes(record.category)) {
            return false;
          }
        }

        // 階数フィルタ
        if (selectedFloor !== "all" && record.floor !== selectedFloor) return false;

        // 利用者フィルタ
        if (selectedResident !== "all" && record.residentId !== selectedResident) return false;

        return true;
      });

      // 4. 利用者ごとにグループ化
      const recordsByResident = filteredRecords.reduce((acc: any, record) => {
        if (!acc[record.residentId]) {
          acc[record.residentId] = {
            resident: {
              roomNumber: record.roomNumber,
              name: record.residentName
            },
            records: []
          };
        }
        acc[record.residentId].records.push(record);
        return acc;
      }, {});

      // 5. 日付順でソート
      Object.values(recordsByResident).forEach((group: any) => {
        group.records.sort((a: any, b: any) => a.recordDate.getTime() - b.recordDate.getTime());
      });

      // 6. HTMLテンプレート作成
      const formatDate = (date: Date) => {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      };

      const formatTime = (date: Date) => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      };

      const formatDateTime = (date: Date) => {
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = dayNames[date.getDay()];
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}月${day}日(${dayOfWeek}) ${formatTime(date)}`;
      };

      let htmlContent = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: 'MS Gothic', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 0;
            }
            .page {
              page-break-after: always;
              min-height: 260mm;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .resident-info {
              text-align: left;
              font-size: 12px;
              margin-bottom: 3mm;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #000;
              padding: 2mm;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            .datetime-col { width: 15%; }
            .category-col { width: 12%; }
            .content-col { width: 58%; }
            .recorder-col { width: 15%; }
            .content-cell {
              word-break: break-all;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
      `;

      Object.values(recordsByResident).forEach((group: any, index) => {
        const { resident, records } = group;

        htmlContent += `
          <div class="page">
            <div class="header">
              <div class="title">ケース記録（記録）</div>
              <div class="resident-info">
                　利用者氏名：${resident.roomNumber}：${resident.name}<br>
                　　　　日付：${formatDate(new Date(dateFrom))}〜${formatDate(new Date(dateTo))}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="datetime-col">日時</th>
                  <th class="category-col">分類名称</th>
                  <th class="content-col">内容</th>
                  <th class="recorder-col">担当者</th>
                </tr>
              </thead>
              <tbody>
        `;

        records.forEach((record: any) => {
          htmlContent += `
            <tr>
              <td class="datetime-col">${formatDateTime(record.recordDate)}</td>
              <td class="category-col">${record.category}</td>
              <td class="content-col content-cell">${record.content}</td>
              <td class="recorder-col">${record.recorder}</td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      // 7. HTMLレスポンスを返し、ブラウザ側で印刷
      // Puppeteerの代わりに、印刷用HTMLを直接返す
      const printableHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <title>ケース記録一覧</title>
          <style>
            ${htmlContent.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}
            @media print {
              .no-print { display: none !important; }
              body { margin: 0; }
            }
          </style>
          <script>
            // ページ読み込み後に自動で印刷ダイアログを開く
            window.onload = function() {
              window.print();
            }
          </script>
        </head>
        ${htmlContent.match(/<body>([\s\S]*?)<\/body>/)?.[1] || ''}
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(printableHtml);

    } catch (error: any) {
      console.error('❌ Error generating care records PDF:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        error: 'Failed to generate care records PDF',
        details: error.message
      });
    }
  });

  // PDF生成エンドポイント
  app.post('/api/generate-journal-pdf', isAuthenticated, async (req, res) => {
    try {
      const { html } = req.body;

      if (!html) {
        console.error('❌ HTML content missing');
        return res.status(400).json({ error: 'HTML content is required' });
      }

      // Puppeteerの動的インポート
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'domcontentloaded'
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="nursing-journal.pdf"');
      res.send(pdf);

    } catch (error: any) {
      console.error('❌ Error generating PDF:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        error: 'Failed to generate PDF',
        details: error.message
      });
    }
  });

  // 服薬チェック一覧PDF生成エンドポイント
  app.get('/api/medication-records/print', isAuthenticated, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const selectedTiming = req.query.selectedTiming as string;
      const selectedFloor = req.query.selectedFloor as string;
      const selectedResident = req.query.selectedResident as string;

      // 1. 服薬記録データを取得
      const medicationRecords = await storage.getMedicationRecordsByDateRange(
        dateFrom || '',
        dateTo || '',
        selectedTiming || 'all',
        selectedFloor || 'all'
      );

      // 2. 入居者情報を取得
      const residents = await storage.getResidents();

      // 3. 利用者フィルタリング
      let filteredRecords = medicationRecords;
      if (selectedResident !== 'all') {
        filteredRecords = medicationRecords.filter(record => record.residentId === selectedResident);
      }

      // 4. 利用者ごとにレコードをグループ化
      const recordsByResident = new Map<string, any[]>();
      filteredRecords.forEach(record => {
        const residentId = record.residentId;
        if (!recordsByResident.has(residentId)) {
          recordsByResident.set(residentId, []);
        }
        recordsByResident.get(residentId)!.push(record);
      });

      // 5. 日付フォーマット用の関数
      const formatDateWithWeekday = (dateStr: string) => {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekday = weekdays[date.getDay()];
        return `${month.toString().padStart(2, '0')}月${day.toString().padStart(2, '0')}日(${weekday})`;
      };

      const formatDateRange = (from: string, to: string) => {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const fromMonth = fromDate.getMonth() + 1;
        const fromDay = fromDate.getDate();
        const toMonth = toDate.getMonth() + 1;
        const toDay = toDate.getDate();
        return `${fromMonth.toString().padStart(2, '0')}月${fromDay.toString().padStart(2, '0')}日〜${toMonth.toString().padStart(2, '0')}月${toDay.toString().padStart(2, '0')}日`;
      };

      // 6. HTML生成
      let htmlContent = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>服薬チェック一覧</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'メイリオ', 'Meiryo', sans-serif;
              color: #000;
            }
            .page {
              width: 100%;
              page-break-after: always;
              position: relative;
            }
            .page:last-child {
              page-break-after: auto;
            }
            .header {
              margin-bottom: 10mm;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 5mm;
            }
            .resident-info {
              font-size: 12px;
              margin-bottom: 3mm;
              line-height: 1.6;
            }
            .service-type {
              font-size: 11px;
              margin-bottom: 2mm;
            }
            .date-info {
              font-size: 11px;
              margin-bottom: 5mm;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              border: 1px solid #000;
            }
            th, td {
              border: 1px solid #000;
              padding: 2mm 1mm;
              text-align: center;
              vertical-align: middle;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .date-time-col {
              width: 15%;
            }
            .presence-col {
              width: 10%;
            }
            .absence-col {
              width: 10%;
            }
            .result-col {
              width: 65%;
              text-align: left;
              padding-left: 3mm;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </head>
        <body>
      `;

      // 7. 利用者ごとにページを生成
      const sortedResidents = Array.from(recordsByResident.entries()).sort((a, b) => {
        const residentA = residents.find(r => r.id === a[0]);
        const residentB = residents.find(r => r.id === b[0]);
        const roomA = parseInt(residentA?.roomNumber || '0');
        const roomB = parseInt(residentB?.roomNumber || '0');
        return roomA - roomB;
      });

      sortedResidents.forEach(([residentId, records]) => {
        const resident = residents.find(r => r.id === residentId);
        if (!resident) return;

        // 記録を日付・時間帯でソート
        const sortedRecords = records.sort((a, b) => {
          const dateCompare = new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime();
          if (dateCompare !== 0) return dateCompare;

          const timingOrder = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
          const timingIndexA = timingOrder.indexOf(a.timing);
          const timingIndexB = timingOrder.indexOf(b.timing);
          return timingIndexA - timingIndexB;
        });

        htmlContent += `
          <div class="page">
            <div class="header">
              <div class="title">ケース記録（服薬・点眼）</div>
              <div class="resident-info">
                利用者氏名：${resident.roomNumber}：${resident.name}
              </div>
              <div class="service-type">
                サービス種類：特定施設
              </div>
              <div class="date-info">
                指定年月日：${formatDateRange(dateFrom, dateTo)}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="date-time-col">日　曜</th>
                  <th class="presence-col">在籍</th>
                  <th class="absence-col">外泊</th>
                  <th class="result-col">服薬</th>
                </tr>
              </thead>
              <tbody>
        `;

        // 日付ごとにレコードをグループ化
        const recordsByDate = new Map<string, any[]>();
        sortedRecords.forEach(record => {
          const dateKey = record.recordDate;
          if (!recordsByDate.has(dateKey)) {
            recordsByDate.set(dateKey, []);
          }
          recordsByDate.get(dateKey)!.push(record);
        });

        // 日付ごとに表示
        recordsByDate.forEach((dateRecords, date) => {
          const dateDisplay = formatDateWithWeekday(date);

          dateRecords.forEach((record, index) => {
            const resultDisplay = record.result ?
              `${record.timing}　${record.type || '服薬'}：${record.result}` :
              `${record.timing}`;

            htmlContent += `
              <tr>
                ${index === 0 ? `<td rowspan="${dateRecords.length}" class="date-time-col">${dateDisplay.replace('月', '(').replace('日', ')').replace('(', '月').replace(')', '日')}</td>` : ''}
                ${index === 0 ? `<td rowspan="${dateRecords.length}" class="presence-col"></td>` : ''}
                ${index === 0 ? `<td rowspan="${dateRecords.length}" class="absence-col"></td>` : ''}
                <td class="result-col">${resultDisplay}</td>
              </tr>
            `;
          });
        });

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      // 8. HTMLレスポンスを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);

    } catch (error: any) {
      console.error('❌ Error generating medication records print:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        error: 'Failed to generate medication records print',
        details: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
