import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";
import { storage } from "./storage";
import { db } from "./db";
import { users, excretionRecords, staffManagement } from "../shared/schema";
import { and, gte, lte, desc, eq } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
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
  updateStaffManagementSchema,
  insertResidentAttachmentSchema,
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

      // セッションに職員情報を保存
      (req as any).session.staff = {
        id: staff.id,
        staffId: staff.staffId,
        staffName: staff.staffName,
        authority: staff.authority,
        floor: staff.floor,
        jobRole: staff.jobRole,
      };

      res.json({
        id: staff.id,
        staffId: staff.staffId,
        staffName: staff.staffName,
        authority: staff.authority,
        floor: staff.floor,
        jobRole: staff.jobRole,
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
      
      const staffWithUserId = {
        ...staff,
        userId: correspondingUser?.id || null, // 対応するusersテーブルのIDを追加
      };
      
      res.json(staffWithUserId);
    } catch (error: any) {
      console.error("Error fetching staff user:", error);
      res.status(500).json({ message: "Failed to fetch staff user" });
    }
  });

  // Residents routes
  app.get('/api/residents', isAuthenticated, async (req, res) => {
    try {
      const residents = await storage.getResidents();
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
      
      // created_atをJST時刻として明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      (validatedData as any).createdAt = jstNow;
      
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
              return res.status(401).json({ message: "有効な職員情報が見つかりません。" });
            }
          }
        } catch (staffError) {
          return res.status(500).json({ message: "職員情報の取得に失敗しました" });
        }
      }

      const validatedData = insertMealsAndMedicationSchema.parse({
        ...req.body,
        staffId: staffId,
      });
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
      const communications = await storage.getCommunications(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
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
      const { recordDate, timing, floor } = req.query;
      
      // パラメータが指定されていない場合は全データを取得
      const records = recordDate 
        ? await storage.getMedicationRecords(
            recordDate as string,
            timing as string || 'all',
            floor as string || 'all'
          )
        : await storage.getAllMedicationRecords(floor as string);
      
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
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error upserting medication record:", error);
      res.status(400).json({ message: "Invalid medication record data", error: error.message });
    }
  });

  app.put('/api/medication-records/:id', isAuthenticated, async (req: any, res) => {
    try {
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
      res.json(record);
    } catch (error: any) {
      console.error("Error updating medication record:", error);
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
      const { facilityId } = req.query;
      const notices = await storage.getStaffNotices(facilityId as string);
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
      const notice = await storage.createStaffNotice(validatedData);
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
      const userId = staffSession ? staffSession.staffId : (req.user?.claims?.sub || null);

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
      const userId = staffSession ? staffSession.staffId : (req.user?.claims?.sub || null);

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
      const userId = staffSession ? staffSession.staffId : (req.user?.claims?.sub || null);

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
      const { weekStartDate, floor } = req.query;
      
      // weekStartDateが指定されていない場合は全データを取得
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
      
      // weekStartDateが指定されている場合は週単位で取得
      const startDate = new Date(weekStartDate as string);
      const records = await storage.getCleaningLinenRecords(startDate, floor as string);
      
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
      const validatedData = updateStaffManagementSchema.parse({
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

  // PDF生成エンドポイント
  app.post('/api/generate-journal-pdf', isAuthenticated, async (req, res) => {
    try {
      const { html } = req.body;
      
      if (!html) {
        console.error('❌ HTML content missing');
        return res.status(400).json({ error: 'HTML content is required' });
      }

      const browser = await puppeteer.launch({
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

  const httpServer = createServer(app);
  return httpServer;
}
