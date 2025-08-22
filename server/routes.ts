import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertResidentSchema,
  insertCareRecordSchema,
  insertNursingRecordSchema,
  insertVitalSignsSchema,
  insertMealsAndMedicationSchema,
  insertMealsMedicationSchema,
  insertBathingRecordSchema,
  insertExcretionRecordSchema,
  insertWeightRecordSchema,
  insertCommunicationSchema,
  insertRoundRecordSchema,
  insertMedicationRecordSchema,
  insertFacilitySettingsSchema,
  insertStaffNoticeSchema,
  insertStaffNoticeReadStatusSchema,
  insertCleaningLinenRecordSchema,
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
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
      res.json(staff);
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
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching care records:", error);
      res.status(500).json({ message: "Failed to fetch care records" });
    }
  });

  app.post('/api/care-records', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCareRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
      const record = await storage.createCareRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating care record:", error);
      res.status(400).json({ message: "Invalid care record data" });
    }
  });

  app.patch('/api/care-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.recordDate) {
        updateData.recordDate = new Date(updateData.recordDate);
      }
      const record = await storage.updateCareRecord(req.params.id, updateData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating care record:", error);
      res.status(500).json({ message: "Failed to update care record" });
    }
  });

  // Nursing records routes
  app.get('/api/nursing-records', isAuthenticated, async (req, res) => {
    try {
      const { residentId, startDate, endDate } = req.query;
      const records = await storage.getNursingRecords(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching nursing records:", error);
      res.status(500).json({ message: "Failed to fetch nursing records" });
    }
  });

  app.post('/api/nursing-records', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertNursingRecordSchema.parse({
        ...req.body,
        nurseId: req.user.claims.sub,
      });
      const record = await storage.createNursingRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating nursing record:", error);
      res.status(400).json({ message: "Invalid nursing record data", error: error.message });
    }
  });

  app.patch('/api/nursing-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.recordDate) {
        updateData.recordDate = new Date(updateData.recordDate);
      }
      const record = await storage.updateNursingRecord(req.params.id, updateData);
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
      const record = await storage.getMealRecordById(id);
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
      res.json(vitals);
    } catch (error: any) {
      console.error("Error fetching vital signs:", error);
      res.status(500).json({ message: "Failed to fetch vital signs" });
    }
  });

  app.post('/api/vital-signs', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertVitalSignsSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
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
      const validatedData = insertVitalSignsSchema.partial().parse(req.body);
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
      const { residentId, startDate, endDate } = req.query;
      const records = await storage.getMealsAndMedication(
        residentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching meals and medication:", error);
      res.status(500).json({ message: "Failed to fetch meals and medication records" });
    }
  });

  app.post('/api/meals-medication', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMealsAndMedicationSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
        type: 'meal' // Set default type as meal
      });
      const record = await storage.createMealsAndMedication(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating meals/medication record:", error);
      res.status(400).json({ message: "Invalid meals/medication data" });
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
      const validatedData = insertBathingRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
      const record = await storage.createBathingRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating bathing record:", error);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ 
          message: "Invalid bathing record data", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: "Invalid bathing record data" });
      }
    }
  });

  app.patch('/api/bathing-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log("=== PATCH /api/bathing-records Debug ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      console.log("Request body keys:", Object.keys(req.body));
      console.log("Request body types:", Object.keys(req.body).map(key => `${key}: ${typeof req.body[key]} (${req.body[key]})`));
      
      const validatedData = insertBathingRecordSchema.partial().parse(req.body);
      console.log("Validation successful:", validatedData);
      const record = await storage.updateBathingRecord(id, validatedData);
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
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching excretion records:", error);
      res.status(500).json({ message: "Failed to fetch excretion records" });
    }
  });

  app.post('/api/excretion-records', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertExcretionRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
      const record = await storage.createExcretionRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating excretion record:", error);
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
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching weight records:", error);
      res.status(500).json({ message: "Failed to fetch weight records" });
    }
  });

  app.post('/api/weight-records', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertWeightRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
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
      const validatedData = insertWeightRecordSchema.partial().parse(req.body);
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
      const validatedData = insertCommunicationSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
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

  // Meals Medication routes (新仕様)
  app.get('/api/meals-medication', isAuthenticated, async (req, res) => {
    try {
      const { recordDate, mealTime, floor } = req.query;
      const records = await storage.getMealsMedication(
        recordDate as string || new Date().toISOString().split('T')[0],
        mealTime as string || '朝',
        floor as string || 'all'
      );
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching meals medication:", error);
      res.status(500).json({ message: "Failed to fetch meals medication" });
    }
  });

  app.post('/api/meals-medication', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertMealsMedicationSchema.parse(req.body);
      console.log("Validated data:", JSON.stringify(validatedData, null, 2));
      const record = await storage.createMealsMedication(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating meals medication:", error);
      if (error.issues) {
        console.error("Validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Invalid meals medication data",
        error: error.message,
        issues: error.issues || []
      });
    }
  });

  app.put('/api/meals-medication/:id', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Update request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertMealsMedicationSchema.parse(req.body);
      console.log("Validated update data:", JSON.stringify(validatedData, null, 2));
      const record = await storage.updateMealsMedication(req.params.id, validatedData);
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
      const validatedData = insertRoundRecordSchema.parse({
        ...req.body,
        createdBy: req.user.claims.sub,
      });
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
      const records = await storage.getMedicationRecords(
        recordDate as string || new Date().toISOString().split('T')[0],
        timing as string || 'all',
        floor as string || 'all'
      );
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching medication records:", error);
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  app.post('/api/medication-records', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMedicationRecordSchema.parse({
        ...req.body,
        createdBy: req.user.claims.sub,
      });
      const record = await storage.createMedicationRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating medication record:", error);
      res.status(400).json({ message: "Invalid medication record data" });
    }
  });

  app.put('/api/medication-records/:id', isAuthenticated, async (req: any, res) => {
    try {
      // 部分更新用のスキーマ - 必須フィールドをオプションにする
      const partialMedicationRecordSchema = insertMedicationRecordSchema.partial();
      const validatedData = partialMedicationRecordSchema.parse(req.body);
      const record = await storage.updateMedicationRecord(req.params.id, validatedData);
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
      const validatedData = insertStaffNoticeSchema.parse({
        ...req.body,
        createdBy: req.user.claims.sub,
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
      const readStatus = await storage.markStaffNoticeAsRead(req.params.id, req.user.claims.sub);
      res.status(201).json(readStatus);
    } catch (error: any) {
      console.error("Error marking staff notice as read:", error);
      res.status(400).json({ message: "Failed to mark as read" });
    }
  });

  app.post('/api/staff-notices/:id/mark-unread', isAuthenticated, async (req: any, res) => {
    try {
      await storage.markStaffNoticeAsUnread(req.params.id, req.user.claims.sub);
      res.status(200).json({ message: "Marked as unread" });
    } catch (error: any) {
      console.error("Error marking staff notice as unread:", error);
      res.status(400).json({ message: "Failed to mark as unread" });
    }
  });

  app.get('/api/staff-notices/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const count = await storage.getUnreadStaffNoticesCount(req.user.claims.sub);
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
      const startDate = new Date(weekStartDate as string);
      const records = await storage.getCleaningLinenRecords(startDate, floor as string);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching cleaning linen records:", error);
      res.status(500).json({ message: "Failed to fetch cleaning linen records" });
    }
  });

  app.post('/api/cleaning-linen', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCleaningLinenRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
      const record = await storage.createCleaningLinenRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      console.error("Error creating cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  app.put('/api/cleaning-linen/:id', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCleaningLinenRecordSchema.partial().parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
      const record = await storage.updateCleaningLinenRecord(req.params.id, validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error updating cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  app.post('/api/cleaning-linen/upsert', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCleaningLinenRecordSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
      });
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
      const userId = req.user.claims.sub;
      const file = req.file;
      
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

  const httpServer = createServer(app);
  return httpServer;
}
