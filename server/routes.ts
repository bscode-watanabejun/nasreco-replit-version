import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertResidentSchema,
  insertCareRecordSchema,
  insertNursingRecordSchema,
  insertVitalSignsSchema,
  insertMealsAndMedicationSchema,
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
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Residents routes
  app.get('/api/residents', isAuthenticated, async (req, res) => {
    try {
      const residents = await storage.getResidents();
      res.json(residents);
    } catch (error) {
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
    } catch (error) {
      console.error("Error fetching resident:", error);
      res.status(500).json({ message: "Failed to fetch resident" });
    }
  });

  app.post('/api/residents', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertResidentSchema.parse(req.body);
      const resident = await storage.createResident(validatedData);
      res.status(201).json(resident);
    } catch (error) {
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
    } catch (error) {
      console.error("Error updating resident:", error);
      res.status(400).json({ message: "Invalid resident data" });
    }
  });

  app.delete('/api/residents/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteResident(id);
      res.status(204).send();
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating nursing record:", error);
      res.status(400).json({ message: "Invalid nursing record data" });
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating bathing record:", error);
      res.status(400).json({ message: "Invalid bathing record data" });
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating weight record:", error);
      res.status(400).json({ message: "Invalid weight record data" });
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating communication:", error);
      res.status(400).json({ message: "Invalid communication data" });
    }
  });

  app.patch('/api/communications/:id/read', isAuthenticated, async (req, res) => {
    try {
      await storage.markCommunicationAsRead(req.params.id);
      res.json({ message: "Communication marked as read" });
    } catch (error) {
      console.error("Error marking communication as read:", error);
      res.status(500).json({ message: "Failed to mark communication as read" });
    }
  });

  // Meals Medication routes (新仕様)
  app.get('/api/meals-medication', isAuthenticated, async (req, res) => {
    try {
      const { recordDate, mealTime, floor } = req.query;
      // Use the correct method with proper parameters
      const records = await storage.getMealsAndMedication(
        undefined, // residentId
        recordDate ? new Date(recordDate as string) : undefined, 
        recordDate ? new Date(recordDate as string) : undefined
      );
      res.json(records);
    } catch (error) {
      console.error("Error fetching meals medication:", error);
      res.status(500).json({ message: "Failed to fetch meals medication" });
    }
  });

  app.post('/api/meals-medication', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMealsAndMedicationSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
        type: 'meal'
      });
      const record = await storage.createMealsAndMedication(validatedData);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating meals medication:", error);
      res.status(400).json({ message: "Invalid meals medication data" });
    }
  });

  app.put('/api/meals-medication/:id', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMealsAndMedicationSchema.parse({
        ...req.body,
        staffId: req.user.claims.sub,
        type: 'meal'
      });
      const record = await storage.updateMealsAndMedication(req.params.id, validatedData);
      res.json(record);
    } catch (error) {
      console.error("Error updating meals medication:", error);
      res.status(400).json({ message: "Invalid meals medication data" });
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating round record:", error);
      res.status(400).json({ message: "Invalid round record data" });
    }
  });

  app.delete('/api/round-records/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteRoundRecord(req.params.id);
      res.json({ message: "Round record deleted" });
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error deleting medication record:", error);
      res.status(500).json({ message: "Failed to delete medication record" });
    }
  });

  // Facility settings routes
  app.get('/api/facility-settings', isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getFacilitySettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching facility settings:", error);
      res.status(500).json({ message: "Failed to fetch facility settings" });
    }
  });

  app.post('/api/facility-settings', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertFacilitySettingsSchema.parse(req.body);
      const settings = await storage.createFacilitySettings(validatedData);
      res.json(settings);
    } catch (error) {
      console.error("Error creating facility settings:", error);
      res.status(500).json({ message: "Failed to create facility settings" });
    }
  });

  app.put('/api/facility-settings/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertFacilitySettingsSchema.parse(req.body);
      const settings = await storage.updateFacilitySettings(req.params.id, validatedData);
      res.json(settings);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error creating staff notice:", error);
      res.status(400).json({ message: "Invalid staff notice data" });
    }
  });

  app.delete('/api/staff-notices/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteStaffNotice(req.params.id);
      res.json({ message: "Staff notice deleted" });
    } catch (error) {
      console.error("Error deleting staff notice:", error);
      res.status(500).json({ message: "Failed to delete staff notice" });
    }
  });

  // Staff notice read status routes
  app.get('/api/staff-notices/:id/read-status', isAuthenticated, async (req, res) => {
    try {
      const readStatus = await storage.getStaffNoticeReadStatus(req.params.id);
      res.json(readStatus);
    } catch (error) {
      console.error("Error fetching staff notice read status:", error);
      res.status(500).json({ message: "Failed to fetch read status" });
    }
  });

  app.post('/api/staff-notices/:id/mark-read', isAuthenticated, async (req: any, res) => {
    try {
      const readStatus = await storage.markStaffNoticeAsRead(req.params.id, req.user.claims.sub);
      res.status(201).json(readStatus);
    } catch (error) {
      console.error("Error marking staff notice as read:", error);
      res.status(400).json({ message: "Failed to mark as read" });
    }
  });

  app.post('/api/staff-notices/:id/mark-unread', isAuthenticated, async (req: any, res) => {
    try {
      await storage.markStaffNoticeAsUnread(req.params.id, req.user.claims.sub);
      res.status(200).json({ message: "Marked as unread" });
    } catch (error) {
      console.error("Error marking staff notice as unread:", error);
      res.status(400).json({ message: "Failed to mark as unread" });
    }
  });

  // Cleaning Linen routes (清掃リネン管理)
  app.get('/api/cleaning-linen', isAuthenticated, async (req, res) => {
    try {
      const { weekStartDate, floor } = req.query;
      const startDate = new Date(weekStartDate as string);
      const records = await storage.getCleaningLinenRecords(startDate, floor as string);
      res.json(records);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error upserting cleaning linen record:", error);
      res.status(400).json({ message: "Invalid cleaning linen data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
