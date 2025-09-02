import {
  users,
  residents,
  careRecords,
  nursingRecords,
  vitalSigns,
  mealsAndMedication,
  bathingRecords,
  excretionRecords,
  weightRecords,
  communications,
  roundRecords,
  medicationRecords,
  facilitySettings,
  staffNotices,
  staffNoticeReadStatus,
  cleaningLinenRecords,
  staffManagement,
  residentAttachments,
  type User,
  type UpsertUser,
  type Resident,
  type InsertResident,
  type CareRecord,
  type InsertCareRecord,
  type NursingRecord,
  type InsertNursingRecord,
  type VitalSigns,
  type InsertVitalSigns,
  type MealsAndMedication,
  type InsertMealsAndMedication,
  type BathingRecord,
  type InsertBathingRecord,
  type ExcretionRecord,
  type InsertExcretionRecord,
  type WeightRecord,
  type InsertWeightRecord,
  type Communication,
  type InsertCommunication,
  type RoundRecord,
  type InsertRoundRecord,
  type MedicationRecord,
  type InsertMedicationRecord,
  type FacilitySettings,
  type InsertFacilitySettings,
  type StaffNotice,
  type InsertStaffNotice,
  type StaffNoticeReadStatus,
  type InsertStaffNoticeReadStatus,
  type CleaningLinenRecord,
  type InsertCleaningLinenRecord,
  type StaffManagement,
  type InsertStaffManagement,
  type UpdateStaffManagement,
  type ResidentAttachment,
  type InsertResidentAttachment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql, like, isNull, isNotNull, not } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  findUserByStaffInfo(staffId: string, staffName: string): Promise<User | undefined>;

  // Resident operations
  getResidents(): Promise<Resident[]>;
  getResident(id: string): Promise<Resident | undefined>;
  createResident(resident: InsertResident): Promise<Resident>;
  updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident>;
  deleteResident(id: string): Promise<void>;

  // Care record operations
  getCareRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<CareRecord[]>;
  createCareRecord(record: InsertCareRecord): Promise<CareRecord>;
  updateCareRecord(id: string, data: Partial<InsertCareRecord>): Promise<CareRecord>;

  // Nursing record operations
  getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<NursingRecord[]>;
  getNursingRecordById(id: string): Promise<NursingRecord | null>;
  createNursingRecord(record: InsertNursingRecord): Promise<NursingRecord>;
  updateNursingRecord(id: string, record: Partial<InsertNursingRecord>): Promise<NursingRecord>;
  deleteNursingRecord(id: string): Promise<void>;

  // Vital signs operations
  getVitalSigns(residentId?: string, startDate?: Date, endDate?: Date): Promise<VitalSigns[]>;
  getVitalSignsById(id: string): Promise<VitalSigns | undefined>;
  createVitalSigns(vitals: InsertVitalSigns): Promise<VitalSigns>;
  updateVitalSigns(id: string, data: Partial<InsertVitalSigns>): Promise<VitalSigns>;
  deleteVitalSigns(id: string): Promise<void>;

  // Meals and medication operations
  getMealsAndMedication(residentId?: string, startDate?: Date, endDate?: Date): Promise<MealsAndMedication[]>;
  createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  getMealList(recordDate: string, mealTime: string, floor: string): Promise<any[]>;

  // Bathing record operations
  getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]>;
  createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord>;
  updateBathingRecord(id: string, record: Partial<InsertBathingRecord>): Promise<BathingRecord>;
  deleteBathingRecord(id: string): Promise<void>;

  // Excretion record operations
  getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<ExcretionRecord[]>;
  createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord>;
  updateExcretionRecord(id: string, record: Partial<InsertExcretionRecord>): Promise<ExcretionRecord>;

  // Weight record operations
  getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]>;
  createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord>;
  updateWeightRecord(id: string, record: Partial<InsertWeightRecord>): Promise<WeightRecord>;
  deleteWeightRecord(id: string): Promise<void>;

  // Communication operations
  getCommunications(residentId?: string, startDate?: Date, endDate?: Date): Promise<Communication[]>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  markCommunicationAsRead(id: string): Promise<void>;

  // Round record operations
  getRoundRecords(recordDate: Date): Promise<RoundRecord[]>;
  createRoundRecord(record: InsertRoundRecord): Promise<RoundRecord>;
  deleteRoundRecord(id: string): Promise<void>;

  // Medication record operations
  getMedicationRecords(recordDate: string, timing: string, floor: string): Promise<MedicationRecord[]>;
  createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord>;
  upsertMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord>;
  updateMedicationRecord(id: string, record: Partial<InsertMedicationRecord>): Promise<MedicationRecord>;
  deleteMedicationRecord(id: string): Promise<void>;

  // Facility settings operations
  getFacilitySettings(): Promise<FacilitySettings | undefined>;
  createFacilitySettings(settings: InsertFacilitySettings): Promise<FacilitySettings>;
  updateFacilitySettings(id: string, settings: InsertFacilitySettings): Promise<FacilitySettings>;

  // Staff notice operations
  getStaffNotices(facilityId?: string): Promise<StaffNotice[]>;
  createStaffNotice(notice: InsertStaffNotice): Promise<StaffNotice>;
  deleteStaffNotice(id: string): Promise<void>;
  getStaffNoticeReadStatus(noticeId: string): Promise<StaffNoticeReadStatus[]>;
  markStaffNoticeAsRead(noticeId: string, staffId: string): Promise<StaffNoticeReadStatus>;
  markStaffNoticeAsUnread(noticeId: string, staffId: string): Promise<void>;
  getUnreadStaffNoticesCount(staffId: string): Promise<number>;

  // Cleaning Linen operations
  getCleaningLinenRecords(weekStartDate: Date, floor?: string): Promise<CleaningLinenRecord[]>;
  createCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord>;
  updateCleaningLinenRecord(id: string, record: Partial<InsertCleaningLinenRecord>): Promise<CleaningLinenRecord>;
  upsertCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord>;

  // Staff authentication
  authenticateStaff(staffId: string, password: string): Promise<StaffManagement | null>;
  getStaffByUserId(userId: string): Promise<StaffManagement | null>;
  getDefaultStaff(): Promise<StaffManagement | null>;

  // Staff Management operations
  getStaffManagement(): Promise<StaffManagement[]>;
  getStaffManagementById(id: string): Promise<StaffManagement | null>;
  createStaffManagement(staff: InsertStaffManagement): Promise<StaffManagement>;
  updateStaffManagement(staff: UpdateStaffManagement): Promise<StaffManagement>;
  deleteStaffManagement(id: string): Promise<void>;
  unlockStaffAccount(id: string, password: string): Promise<StaffManagement>;
  lockStaffAccount(id: string): Promise<StaffManagement>;

  // Resident Attachment operations
  getResidentAttachments(residentId: string): Promise<ResidentAttachment[]>;
  getResidentAttachment(id: string): Promise<ResidentAttachment | null>;
  createResidentAttachment(attachment: InsertResidentAttachment): Promise<ResidentAttachment>;
  deleteResidentAttachment(id: string): Promise<void>;

  // Daily Records operations  
  getDailyRecords(date: string, recordTypes?: string[]): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async findUserByStaffInfo(staffId: string, staffName: string): Promise<User | undefined> {
    console.log("🔍 🆕 UPDATED findUserByStaffInfo called with:", { staffId, staffName });
    
    // パラメータの安全性チェック - null, undefined, 空文字列を厳密にチェック
    if (!staffId || staffId === null || staffId === undefined || typeof staffId !== 'string' || staffId.trim() === '') {
      console.log("⚠️ Invalid staffId for findUserByStaffInfo:", { staffId, type: typeof staffId });
      return undefined;
    }

    // staffNameも安全性チェック
    const safeStaffName = staffName && typeof staffName === 'string' ? staffName.trim() : '';
    console.log("🔍 Cleaned parameters:", { staffId: staffId.trim(), staffName: safeStaffName });

    try {
      // 段階的に検索を試行（最も安全な方法から）
      const cleanStaffId = staffId.trim();
      
      // 1. 正確なemailマッチを試行
      console.log("🔍 Step 1: Trying exact email match");
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, `${cleanStaffId}@bigsmall.co.jp`))
        .limit(1);
      
      if (user) {
        console.log("✅ Found user by exact email:", user);
        return user;
      }

      // 2. staffIdがそのままemailに含まれている場合を検索（likeを使わない方法）
      console.log("🔍 Step 2: Trying to find users containing staffId in email");
      const allUsers = await db.select().from(users);
      const emailMatchUser = allUsers.find(u => 
        u.email && u.email.includes(cleanStaffId)
      );
      
      if (emailMatchUser) {
        console.log("✅ Found user by email containing staffId:", emailMatchUser);
        return emailMatchUser;
      }

      // 3. staffNameがある場合、名前での検索を試行
      if (safeStaffName && safeStaffName.length > 0) {
        console.log("🔍 Step 3: Trying name-based search");
        const firstName = safeStaffName.split(' ')[0] || safeStaffName;
        
        if (firstName && firstName.length > 0) {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.firstName, firstName))
            .limit(1);
            
          if (user) {
            console.log("✅ Found user by firstName:", user);
            return user;
          }
          
          // 4. 名前の部分一致検索（likeを使わない方法）
          const nameMatchUser = allUsers.find(u => 
            u.firstName && u.firstName.includes(firstName)
          );
          
          if (nameMatchUser) {
            console.log("✅ Found user by firstName containing:", nameMatchUser);
            return nameMatchUser;
          }
        }
      }

      console.log("❌ No user found for staffId:", cleanStaffId);
      return undefined;
      
    } catch (error) {
      console.error("❌ Error in findUserByStaffInfo:", error);
      return undefined;
    }
  }

  // Resident operations
  async getResidents(): Promise<Resident[]> {
    return await db.select().from(residents).where(eq(residents.isActive, true)).orderBy(residents.name);
  }

  async getResident(id: string): Promise<Resident | undefined> {
    const [resident] = await db.select().from(residents).where(eq(residents.id, id));
    return resident;
  }

  async createResident(resident: InsertResident): Promise<Resident> {
    const [newResident] = await db.insert(residents).values(resident).returning();
    return newResident;
  }

  async updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident> {
    // null値をデータベースに明示的に設定するため、undefined値や空文字列もnullに変換
    const processedUpdates = Object.keys(updates).reduce((acc: any, key) => {
      const value = (updates as any)[key];
      // 日付フィールドでundefined、null、または空文字列の場合は明示的にnullに設定
      if (['dateOfBirth', 'admissionDate', 'retirementDate', 'careAuthorizationPeriodStart', 'careAuthorizationPeriodEnd'].includes(key)) {
        acc[key] = value === undefined || value === null || value === '' ? null : value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    const [updatedResident] = await db
      .update(residents)
      .set({ ...processedUpdates, updatedAt: new Date() })
      .where(eq(residents.id, id))
      .returning();
      
    return updatedResident;
  }

  async deleteResident(id: string): Promise<void> {
    await db.update(residents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(residents.id, id));
  }

  // Care record operations
  async getCareRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<CareRecord[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(careRecords.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(careRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(careRecords.recordDate, endDate));
    }

    return await db.select()
      .from(careRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(careRecords.recordDate));
  }

  async createCareRecord(record: InsertCareRecord): Promise<CareRecord> {
    const [newRecord] = await db.insert(careRecords).values(record).returning();
    return newRecord;
  }

  async updateCareRecord(id: string, data: Partial<InsertCareRecord>): Promise<CareRecord> {
    const [record] = await db
      .update(careRecords)
      .set(data)
      .where(eq(careRecords.id, id))
      .returning();
    return record;
  }

  // Nursing record operations
  async getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<NursingRecord[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(nursingRecords.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(nursingRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(nursingRecords.recordDate, endDate));
    }

    return await db.select()
      .from(nursingRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(nursingRecords.recordDate));
  }

  async getNursingRecordById(id: string): Promise<NursingRecord | null> {
    const record = await db
      .select()
      .from(nursingRecords)
      .where(eq(nursingRecords.id, id))
      .limit(1);
    return record[0] || null;
  }

  async createNursingRecord(record: InsertNursingRecord): Promise<NursingRecord> {
    const [newRecord] = await db.insert(nursingRecords).values(record).returning();
    return newRecord;
  }

  async updateNursingRecord(id: string, record: Partial<InsertNursingRecord>): Promise<NursingRecord> {
    const [updatedRecord] = await db
      .update(nursingRecords)
      .set(record)
      .where(eq(nursingRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteNursingRecord(id: string): Promise<void> {
    await db
      .delete(nursingRecords)
      .where(eq(nursingRecords.id, id));
  }

  // Vital signs operations
  async getVitalSigns(residentId?: string, startDate?: Date, endDate?: Date): Promise<VitalSigns[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(vitalSigns.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(vitalSigns.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(vitalSigns.recordDate, endDate));
    }

    return await db.select()
      .from(vitalSigns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vitalSigns.recordDate));
  }

  async createVitalSigns(vitals: InsertVitalSigns): Promise<VitalSigns> {
    const [newVitals] = await db.insert(vitalSigns).values([vitals]).returning();
    return newVitals;
  }

  async updateVitalSigns(id: string, data: Partial<InsertVitalSigns>): Promise<VitalSigns> {
    const [record] = await db
      .update(vitalSigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vitalSigns.id, id))
      .returning();
    return record;
  }

  async deleteVitalSigns(id: string): Promise<void> {
    await db.delete(vitalSigns).where(eq(vitalSigns.id, id));
  }

  async getVitalSignsById(id: string): Promise<VitalSigns | undefined> {
    const [record] = await db.select()
      .from(vitalSigns)
      .where(eq(vitalSigns.id, id))
      .limit(1);
    return record;
  }

  // Meals and medication operations
  async getMealsAndMedication(residentId?: string, startDate?: Date, endDate?: Date): Promise<MealsAndMedication[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(mealsAndMedication.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(mealsAndMedication.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(mealsAndMedication.recordDate, endDate));
    }

    return await db.select()
      .from(mealsAndMedication)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mealsAndMedication.recordDate));
  }

  async createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication> {
    const recordToInsert = {
      ...record,
      staffId: record.staffId || 'unknown' // Ensure staffId is not undefined
    };
    const [newRecord] = await db.insert(mealsAndMedication).values([recordToInsert]).returning();
    return newRecord;
  }

  async updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication> {
    const [updatedRecord] = await db
      .update(mealsAndMedication)
      .set(record)
      .where(eq(mealsAndMedication.id, id))
      .returning();
    return updatedRecord;
  }

  async getMealList(recordDate: string, mealTime: string, floor: string): Promise<any[]> {
    const targetDate = new Date(recordDate + 'T00:00:00');
    
    let whereConditions = and(
      eq(mealsAndMedication.recordDate, targetDate),
      eq(mealsAndMedication.type, 'meal')
    );

    if (mealTime && mealTime !== 'all') {
      whereConditions = and(
        whereConditions,
        eq(mealsAndMedication.mealType, mealTime)
      );
    }

    if (floor && floor !== 'all') {
      whereConditions = and(
        whereConditions,
        eq(residents.floor, floor)
      );
    }

    return await db
      .select({
        id: mealsAndMedication.id,
        residentId: mealsAndMedication.residentId,
        recordDate: mealsAndMedication.recordDate,
        mealType: mealsAndMedication.mealType,
        mainAmount: mealsAndMedication.mainAmount,
        sideAmount: mealsAndMedication.sideAmount,
        waterIntake: mealsAndMedication.waterIntake,
        supplement: mealsAndMedication.supplement,
        staffName: mealsAndMedication.staffName,
        notes: mealsAndMedication.notes,
        staffId: mealsAndMedication.staffId,
        createdAt: mealsAndMedication.createdAt,
        residentName: residents.name,
        roomNumber: residents.roomNumber,
        floor: residents.floor,
      })
      .from(mealsAndMedication)
      .leftJoin(residents, eq(mealsAndMedication.residentId, residents.id))
      .where(whereConditions);
  }

  // Bathing record operations
  async getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]> {
    
    const conditions = [];

    if (residentId) {
      conditions.push(eq(bathingRecords.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(bathingRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(bathingRecords.recordDate, endDate));
    }

    try {
      const result = await db.select()
        .from(bathingRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bathingRecords.recordDate));
      
      return result;
    } catch (error) {
      console.error("Error in getBathingRecords:", error);
      throw error;
    }
  }

  async createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord> {
    const [newRecord] = await db.insert(bathingRecords).values(record).returning();
    return newRecord;
  }

  async updateBathingRecord(id: string, record: Partial<InsertBathingRecord>): Promise<BathingRecord> {
    // Check if there are any fields to update
    const fieldsToUpdate = Object.keys(record).filter(key => record[key as keyof typeof record] !== undefined);
    
    if (fieldsToUpdate.length === 0) {
      // If no fields to update, just return the existing record
      const [existingRecord] = await db.select()
        .from(bathingRecords)
        .where(eq(bathingRecords.id, id))
        .limit(1);
      return existingRecord;
    }

    const [updatedRecord] = await db
      .update(bathingRecords)
      .set(record)
      .where(eq(bathingRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteBathingRecord(id: string): Promise<void> {
    await db.delete(bathingRecords).where(eq(bathingRecords.id, id));
  }

  // Excretion record operations
  async getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<ExcretionRecord[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(excretionRecords.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(excretionRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(excretionRecords.recordDate, endDate));
    }

    return await db.select()
      .from(excretionRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(excretionRecords.recordDate));
  }

  async createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord> {
    const [newRecord] = await db.insert(excretionRecords).values(record).returning();
    return newRecord;
  }

  async updateExcretionRecord(id: string, record: Partial<InsertExcretionRecord>): Promise<ExcretionRecord> {
    const [updatedRecord] = await db
      .update(excretionRecords)
      .set(record)
      .where(eq(excretionRecords.id, id))
      .returning();
    return updatedRecord;
  }

  // Weight record operations
  async getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(weightRecords.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(weightRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(weightRecords.recordDate, endDate));
    }

    return await db.select()
      .from(weightRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(weightRecords.recordDate));
  }

  async createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord> {
    const [newRecord] = await db.insert(weightRecords).values(record).returning();
    return newRecord;
  }

  async updateWeightRecord(id: string, record: Partial<InsertWeightRecord>): Promise<WeightRecord> {
    const [updatedRecord] = await db
      .update(weightRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(weightRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteWeightRecord(id: string): Promise<void> {
    await db.delete(weightRecords).where(eq(weightRecords.id, id));
  }

  // Communication operations
  async getCommunications(residentId?: string, startDate?: Date, endDate?: Date): Promise<Communication[]> {
    const conditions = [];

    if (residentId) {
      conditions.push(eq(communications.residentId, residentId));
    }
    if (startDate) {
      conditions.push(gte(communications.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(communications.recordDate, endDate));
    }

    return await db.select()
      .from(communications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(communications.recordDate));
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const [newCommunication] = await db.insert(communications).values(communication).returning();
    return newCommunication;
  }

  async markCommunicationAsRead(id: string): Promise<void> {
    await db.update(communications).set({ isRead: true }).where(eq(communications.id, id));
  }


  // Round record operations
  async getRoundRecords(recordDate: Date): Promise<RoundRecord[]> {
    const formattedDate = recordDate.toISOString().split('T')[0];
    return await db.select().from(roundRecords).where(eq(roundRecords.recordDate, formattedDate)).orderBy(roundRecords.hour);
  }

  async createRoundRecord(record: InsertRoundRecord): Promise<RoundRecord> {
    const recordToInsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
    };
    const [newRecord] = await db.insert(roundRecords).values([recordToInsert]).returning();
    return newRecord;
  }

  async deleteRoundRecord(id: string): Promise<void> {
    await db.delete(roundRecords).where(eq(roundRecords.id, id));
  }

  // Medication record operations
  async getMedicationRecords(recordDate: string, timing: string, floor: string): Promise<any[]> {
    const conditions = [eq(medicationRecords.recordDate, recordDate)];
    
    if (timing && timing !== 'all') {
      conditions.push(eq(medicationRecords.timing, timing));
    }

    if (floor && floor !== 'all') {
      conditions.push(eq(residents.floor, floor));
    }

    const results = await db.select({
      // medication_records のフィールド
      id: medicationRecords.id,
      residentId: medicationRecords.residentId,
      recordDate: medicationRecords.recordDate,
      timing: medicationRecords.timing,
      confirmer1: medicationRecords.confirmer1,
      confirmer2: medicationRecords.confirmer2,
      notes: medicationRecords.notes,
      type: medicationRecords.type,
      result: medicationRecords.result,
      createdBy: medicationRecords.createdBy,
      createdAt: medicationRecords.createdAt,
      updatedAt: medicationRecords.updatedAt,
      // residents のフィールド
      residentName: residents.name,
      roomNumber: residents.roomNumber,
      floor: residents.floor,
    })
      .from(medicationRecords)
      .leftJoin(residents, eq(medicationRecords.residentId, residents.id))
      .where(and(...conditions));
      
    console.log('Raw results from DB:', JSON.stringify(results, null, 2));

    const flattenedResults = results;

    console.log('Final flattened results on server:', JSON.stringify(flattenedResults, null, 2));
    return flattenedResults;
  }

  async createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    const recordToInsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
      createdBy: record.createdBy || 'unknown' // Ensure createdBy is not undefined
    };
    const [newRecord] = await db.insert(medicationRecords).values([recordToInsert]).returning();
    return newRecord;
  }

  async upsertMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    const recordToUpsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
      createdBy: record.createdBy || 'unknown' // Ensure createdBy is not undefined
    };
    
    
    // PostgreSQLのON CONFLICTを使用してupsert操作を実行
    const [upsertedRecord] = await db
      .insert(medicationRecords)
      .values([recordToUpsert])
      .onConflictDoUpdate({
        target: [medicationRecords.residentId, medicationRecords.recordDate, medicationRecords.timing, medicationRecords.type],
        set: {
          confirmer1: sql`EXCLUDED.confirmer1`,
          confirmer2: sql`EXCLUDED.confirmer2`,
          notes: sql`EXCLUDED.notes`,
          result: sql`EXCLUDED.result`,
          createdBy: sql`EXCLUDED.created_by`,
          updatedAt: sql`NOW()`
        }
      })
      .returning();
      
    return upsertedRecord;
  }

  async updateMedicationRecord(id: string, record: Partial<InsertMedicationRecord>): Promise<MedicationRecord> {
    const recordToUpdate = {
      ...record,
      recordDate: record.recordDate && typeof record.recordDate !== 'string' ? record.recordDate.toISOString().split('T')[0] : record.recordDate,
    };
    const [updatedRecord] = await db
      .update(medicationRecords)
      .set(recordToUpdate)
      .where(eq(medicationRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteMedicationRecord(id: string): Promise<void> {
    await db.delete(medicationRecords).where(eq(medicationRecords.id, id));
  }

  // Facility settings operations
  async getFacilitySettings(): Promise<FacilitySettings | undefined> {
    const [settings] = await db.select().from(facilitySettings).limit(1);
    return settings;
  }

  async createFacilitySettings(settings: InsertFacilitySettings): Promise<FacilitySettings> {
    const settingsToInsert = {
      ...settings,
      weightBaseline: settings.weightBaseline?.toString(),
      excretionBaseline: settings.excretionBaseline,
    };
    const [created] = await db.insert(facilitySettings).values([settingsToInsert]).returning();
    return created;
  }

  async updateFacilitySettings(id: string, settings: InsertFacilitySettings): Promise<FacilitySettings> {
    const settingsToUpdate = {
      ...settings,
      weightBaseline: settings.weightBaseline?.toString(),
      excretionBaseline: settings.excretionBaseline,
    };
    const [updated] = await db.update(facilitySettings)
      .set(settingsToUpdate)
      .where(eq(facilitySettings.id, id))
      .returning();
    return updated;
  }

  // Staff notice operations
  async getStaffNotices(facilityId?: string): Promise<StaffNotice[]> {
    const conditions = [eq(staffNotices.isActive, true)];
    if (facilityId) {
      conditions.push(eq(staffNotices.facilityId, facilityId));
    }
    return await db.select().from(staffNotices)
      .where(and(...conditions))
      .orderBy(desc(staffNotices.createdAt));
  }

  async createStaffNotice(notice: InsertStaffNotice): Promise<StaffNotice> {
    const [created] = await db.insert(staffNotices).values([notice]).returning();
    return created;
  }

  async deleteStaffNotice(id: string): Promise<void> {
    await db.update(staffNotices)
      .set({ isActive: false })
      .where(eq(staffNotices.id, id));
  }

  async getStaffNoticeReadStatus(noticeId: string): Promise<StaffNoticeReadStatus[]> {
    return await db.select({
      id: staffNoticeReadStatus.id,
      noticeId: staffNoticeReadStatus.noticeId,
      staffId: staffNoticeReadStatus.staffId,
      readAt: staffNoticeReadStatus.readAt,
      createdAt: staffNoticeReadStatus.createdAt,
      staffName: users.firstName,
      staffLastName: users.lastName,
    })
    .from(staffNoticeReadStatus)
    .leftJoin(users, eq(staffNoticeReadStatus.staffId, users.id))
    .where(eq(staffNoticeReadStatus.noticeId, noticeId))
    .orderBy(desc(staffNoticeReadStatus.readAt));
  }

  async markStaffNoticeAsRead(noticeId: string, staffId: string): Promise<StaffNoticeReadStatus> {
    const [created] = await db.insert(staffNoticeReadStatus)
      .values([{ noticeId, staffId }])
      .returning();
    return created;
  }

  async markStaffNoticeAsUnread(noticeId: string, staffId: string): Promise<void> {
    await db.delete(staffNoticeReadStatus)
      .where(
        and(
          eq(staffNoticeReadStatus.noticeId, noticeId),
          eq(staffNoticeReadStatus.staffId, staffId)
        )
      );
  }

  async getUnreadStaffNoticesCount(staffId: string): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)`.as('count') })
      .from(staffNotices)
      .leftJoin(
        staffNoticeReadStatus,
        and(
          eq(staffNotices.id, staffNoticeReadStatus.noticeId),
          eq(staffNoticeReadStatus.staffId, staffId)
        )
      )
      .where(
        and(
          eq(staffNotices.isActive, true),
          lte(staffNotices.startDate, sql`CURRENT_DATE`),
          gte(staffNotices.endDate, sql`CURRENT_DATE`),
          isNull(staffNoticeReadStatus.id)
        )
      );
    
    return Number(result[0]?.count) || 0;
  }

  // Cleaning Linen operations
  async getCleaningLinenRecords(weekStartDate: Date, floor?: string): Promise<CleaningLinenRecord[]> {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const startDateStr = weekStartDate.toISOString().split('T')[0];
    const endDateStr = weekEndDate.toISOString().split('T')[0];
    

    let query = db.select({
      id: cleaningLinenRecords.id,
      residentId: cleaningLinenRecords.residentId,
      recordDate: cleaningLinenRecords.recordDate,
      recordTime: cleaningLinenRecords.recordTime,
      dayOfWeek: cleaningLinenRecords.dayOfWeek,
      cleaningValue: cleaningLinenRecords.cleaningValue,
      linenValue: cleaningLinenRecords.linenValue,
      recordNote: cleaningLinenRecords.recordNote,
      staffId: cleaningLinenRecords.staffId,
      createdAt: cleaningLinenRecords.createdAt,
      updatedAt: cleaningLinenRecords.updatedAt,
      residentName: residents.name,
      residentFloor: residents.floor,
      residentRoom: residents.roomNumber,
      staffName: users.firstName,
    })
    .from(cleaningLinenRecords)
    .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
    .leftJoin(users, eq(cleaningLinenRecords.staffId, users.id))
    .where(
      and(
        gte(cleaningLinenRecords.recordDate, startDateStr),
        lte(cleaningLinenRecords.recordDate, endDateStr)
      )
    );

    if (floor && floor !== "全階") {
      // フロア名の変換（"1階" -> "1F" など）
      let floorToMatch = floor;
      if (floor.includes('階')) {
        const floorNumber = floor.replace('階', '');
        floorToMatch = `${floorNumber}F`;
      }
      
      // フィルターを重複しないよう、新しいクエリを作る
      query = db.select({
        id: cleaningLinenRecords.id,
        residentId: cleaningLinenRecords.residentId,
        recordDate: cleaningLinenRecords.recordDate,
        recordTime: cleaningLinenRecords.recordTime,
        dayOfWeek: cleaningLinenRecords.dayOfWeek,
        cleaningValue: cleaningLinenRecords.cleaningValue,
        linenValue: cleaningLinenRecords.linenValue,
        recordNote: cleaningLinenRecords.recordNote,
        staffId: cleaningLinenRecords.staffId,
        createdAt: cleaningLinenRecords.createdAt,
        updatedAt: cleaningLinenRecords.updatedAt,
        residentName: residents.name,
        residentFloor: residents.floor,
        residentRoom: residents.roomNumber,
        staffName: users.firstName,
      })
      .from(cleaningLinenRecords)
      .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
      .leftJoin(users, eq(cleaningLinenRecords.staffId, users.id))
      .where(
        and(
          gte(cleaningLinenRecords.recordDate, startDateStr),
          lte(cleaningLinenRecords.recordDate, endDateStr),
          or(
            eq(residents.floor, floorToMatch),
            eq(residents.floor, floor), // 元の値でもマッチ
            eq(residents.floor, floor.replace('階', '')) // 数字のみでもマッチ
          )
        )
      );
    }

    const result = await query.orderBy(cleaningLinenRecords.recordDate, residents.roomNumber);
    return result;
  }

  async createCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord> {
    const recordWithStringDate: any = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0]
    };
    
    const [created] = await db.insert(cleaningLinenRecords)
      .values(recordWithStringDate)
      .returning();
    return created;
  }

  async updateCleaningLinenRecord(id: string, record: Partial<InsertCleaningLinenRecord>): Promise<CleaningLinenRecord> {
    const updateData: any = {
      ...record,
      updatedAt: new Date()
    };
    
    if (record.recordDate) {
      updateData.recordDate = record.recordDate.toISOString().split('T')[0];
    }
    
    const [updated] = await db.update(cleaningLinenRecords)
      .set(updateData)
      .where(eq(cleaningLinenRecords.id, id))
      .returning();
    return updated;
  }

  async upsertCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord> {
    const recordDateStr = record.recordDate.toISOString().split('T')[0];
    const recordTime = record.recordTime || new Date(); // recordTimeが指定されていない場合は現在時刻を使用
    
    // まず既存レコードを検索
    const existing = await db.select()
      .from(cleaningLinenRecords)
      .where(
        and(
          eq(cleaningLinenRecords.residentId, record.residentId),
          eq(cleaningLinenRecords.recordDate, recordDateStr)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // 既存レコードを更新（記録内容に変更があった場合にrecordTimeを更新）
      const hasContentChange = 
        existing[0].cleaningValue !== record.cleaningValue ||
        existing[0].linenValue !== record.linenValue ||
        existing[0].recordNote !== record.recordNote;
      
      const [updated] = await db.update(cleaningLinenRecords)
        .set({
          cleaningValue: record.cleaningValue,
          linenValue: record.linenValue,
          recordNote: record.recordNote,
          recordTime: hasContentChange ? recordTime : existing[0].recordTime, // 内容変更時のみrecordTimeを更新
          staffId: record.staffId,
          updatedAt: new Date(),
        })
        .where(eq(cleaningLinenRecords.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // 新規レコードを作成
      const recordWithStringDate = {
        ...record,
        recordDate: recordDateStr,
        recordTime: recordTime
      };
      
      const [created] = await db.insert(cleaningLinenRecords)
        .values(recordWithStringDate)
        .returning();
      return created;
    }
  }

  // Staff Management methods
  async getStaffManagement(): Promise<StaffManagement[]> {
    return await db.select().from(staffManagement).orderBy(staffManagement.sortOrder, staffManagement.createdAt);
  }

  async getStaffManagementById(id: string): Promise<StaffManagement | null> {
    const result = await db.select().from(staffManagement).where(eq(staffManagement.id, id));
    return result[0] || null;
  }

  async createStaffManagement(record: InsertStaffManagement): Promise<StaffManagement> {
    try {
      
      // 職員IDの重複チェック
      const existing = await db.select().from(staffManagement).where(eq(staffManagement.staffId, record.staffId));
      
      if (existing.length > 0) {
        throw new Error("この職員IDは既に使用されています");
      }

      // パスワードのハッシュ化（実装簡略化のため、実際の本番環境ではbcryptを使用）
      const hashedPassword = record.password ? Buffer.from(record.password).toString('base64') : null;

      const insertData = {
        ...record,
        password: hashedPassword,
        lastModifiedAt: new Date(),
      };

      const [created] = await db.insert(staffManagement).values(insertData).returning();
      
      return created;
    } catch (error: any) {
      console.error("❌ Database error in createStaffManagement:", error);
      throw error;
    }
  }

  async updateStaffManagement(record: UpdateStaffManagement): Promise<StaffManagement> {
    if (!record.id) {
      throw new Error("IDが必要です");
    }

    // 職員IDの重複チェック（自分以外）
    if (record.staffId) {
      const existing = await db.select().from(staffManagement)
        .where(and(
          eq(staffManagement.staffId, record.staffId),
          sql`${staffManagement.id} != ${record.id}`
        ));
      if (existing.length > 0) {
        throw new Error("この職員IDは既に使用されています");
      }
    }

    const updateData: any = { ...record };
    delete updateData.id;
    updateData.lastModifiedAt = new Date();
    updateData.updatedAt = new Date();

    const [updated] = await db.update(staffManagement)
      .set(updateData)
      .where(eq(staffManagement.id, record.id))
      .returning();
    return updated;
  }

  async deleteStaffManagement(id: string): Promise<void> {
    await db.delete(staffManagement).where(eq(staffManagement.id, id));
  }

  async unlockStaffAccount(id: string, password: string): Promise<StaffManagement> {
    // パスワードのハッシュ化（実装簡略化のため、実際の本番環境ではbcryptを使用）
    const hashedPassword = Buffer.from(password).toString('base64');

    const [updated] = await db.update(staffManagement)
      .set({
        status: "ロック解除",
        password: hashedPassword,
        lastModifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffManagement.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("職員が見つかりません");
    }
    
    return updated;
  }

  async lockStaffAccount(id: string): Promise<StaffManagement> {
    const [updated] = await db.update(staffManagement)
      .set({
        status: "ロック",
        lastModifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffManagement.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("職員が見つかりません");
    }
    
    return updated;
  }

  async authenticateStaff(staffId: string, password: string): Promise<StaffManagement | null> {
    const hashedPassword = Buffer.from(password).toString('base64');
    const [staff] = await db.select()
      .from(staffManagement)
      .where(
        and(
          eq(staffManagement.staffId, staffId),
          eq(staffManagement.password, hashedPassword)
        )
      );
    
    return staff || null;
  }

  async getStaffByUserId(userId: string): Promise<StaffManagement | null> {
    // ユーザーIDから職員を検索（まだ実装していないため、現在はnullを返す）
    // 将来的に users テーブルと staff_management テーブルを連携させる場合に実装
    return null;
  }

  async getDefaultStaff(): Promise<StaffManagement | null> {
    // デフォルト職員を取得（最初の職員またはアクティブな職員を返す）
    const [staff] = await db.select()
      .from(staffManagement)
      .where(eq(staffManagement.status, "ロック解除"))
      .orderBy(staffManagement.sortOrder, staffManagement.createdAt)
      .limit(1);
    
    return staff || null;
  }

  // Meals Medication operations (新スキーマ)
  async getMealsMedication(recordDate: string, mealTime: string, floor: string): Promise<any[]> {
    console.log(`📋 getMealsMedication called with:`, {
      recordDate,
      mealTime,
      floor
    });
    
    const targetDate = new Date(recordDate + 'T00:00:00');
    console.log(`📅 Target date:`, targetDate);
    
    let whereConditions = and(
      eq(mealsAndMedication.recordDate, targetDate),
      eq(mealsAndMedication.type, 'meal')
    );

    // mealTimeが指定されている場合は条件に追加
    if (mealTime && mealTime !== 'all') {
      console.log(`🍽️ Filtering by mealTime: ${mealTime}`);
      whereConditions = and(
        whereConditions,
        eq(mealsAndMedication.mealType, mealTime)
      );
    }

    if (floor !== 'all') {
      console.log(`🏢 Filtering by floor: ${floor}`);
      whereConditions = and(
        whereConditions,
        eq(residents.floor, floor)
      );
    }

    const results = await db
      .select({
        id: mealsAndMedication.id,
        residentId: mealsAndMedication.residentId,
        recordDate: mealsAndMedication.recordDate,
        mealType: mealsAndMedication.mealType,
        mainAmount: mealsAndMedication.mainAmount,
        sideAmount: mealsAndMedication.sideAmount,
        waterIntake: mealsAndMedication.waterIntake,
        supplement: mealsAndMedication.supplement,
        staffName: mealsAndMedication.staffName,
        notes: mealsAndMedication.notes,
        createdBy: mealsAndMedication.staffId,
        createdAt: mealsAndMedication.createdAt,
        updatedAt: mealsAndMedication.createdAt,
        residentName: residents.name,
        roomNumber: residents.roomNumber,
        floor: residents.floor,
      })
      .from(mealsAndMedication)
      .leftJoin(residents, eq(mealsAndMedication.residentId, residents.id))
      .where(whereConditions);

    console.log(`🔍 Query results count: ${results.length}`);
    console.log(`📊 Raw results:`, JSON.stringify(results, null, 2));
    
    return results;
  }

  async createMealsMedication(record: any): Promise<any> {
    const [newRecord] = await db.insert(mealsAndMedication).values(record).returning();
    return newRecord;
  }

  async updateMealsMedication(id: string, record: any): Promise<any> {
    const [updatedRecord] = await db
      .update(mealsAndMedication)
      .set({ ...record })
      .where(eq(mealsAndMedication.id, id))
      .returning();
    
    return updatedRecord;
  }

  // Resident Attachment operations
  async getResidentAttachments(residentId: string): Promise<ResidentAttachment[]> {
    return await db
      .select()
      .from(residentAttachments)
      .where(eq(residentAttachments.residentId, residentId))
      .orderBy(desc(residentAttachments.createdAt));
  }

  async getResidentAttachment(id: string): Promise<ResidentAttachment | null> {
    const [attachment] = await db
      .select()
      .from(residentAttachments)
      .where(eq(residentAttachments.id, id));
    return attachment || null;
  }

  async createResidentAttachment(attachment: InsertResidentAttachment): Promise<ResidentAttachment> {
    const [newAttachment] = await db
      .insert(residentAttachments)
      .values(attachment)
      .returning();
    
    if (!newAttachment) {
      throw new Error("Failed to create resident attachment");
    }
    
    return newAttachment;
  }

  async deleteResidentAttachment(id: string): Promise<void> {
    await db.delete(residentAttachments).where(eq(residentAttachments.id, id));
  }

  // Daily Records operations - 統合記録取得
  async getDailyRecords(date: string, recordTypes?: string[]): Promise<any[]> {
    const allRecords: any[] = [];
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    // residentデータを先に取得してキャッシュ
    const residentsData = await this.getResidents();
    const residentsMap = new Map(residentsData.map(r => [r.id, r]));

    // staffデータを先に取得してキャッシュ
    const staffData = await this.getStaffManagement();
    const staffMap = new Map(staffData.map(s => [s.id, s.staffName]));
    // usersテーブルも確認してマッピングを作成
    const usersData = await db.select().from(users);
    const usersMap = new Map(usersData.map(u => [u.id, u.firstName || u.email || u.id]));

    // 時間帯判定ヘルパー関数
    const getTimeCategory = (recordTime: Date) => {
      const hour = recordTime.getHours();
      const minute = recordTime.getMinutes();
      const totalMinutes = hour * 60 + minute;
      
      // 8:31〜17:30 = 日中 (511分〜1050分)
      // 17:31〜8:30 = 夜間 (1051分〜510分、ただし翌日の0:00〜8:30も含む)
      if (totalMinutes >= 511 && totalMinutes <= 1050) {
        return '日中';
      } else {
        return '夜間';
      }
    };

    // 服薬記録の時間マッピング
    const getMedicationTime = (timing: string, customTime?: string) => {
      const JST_OFFSET = '+09:00';
      let hour = 12, minute = 0;

      switch (timing) {
        case '起床後': hour = 7; minute = 0; break;
        case '朝前':   hour = 7; minute = 30; break;
        case '朝後':   hour = 8; minute = 30; break;
        case '昼前':   hour = 11; minute = 30; break;
        case '昼後':   hour = 12; minute = 30; break;
        case '夕前':   hour = 17; minute = 30; break;
        case '夕後':   hour = 18; minute = 30; break;
        case '眠前':   hour = 20; minute = 30; break;
        case '頓服':   hour = 12; minute = 0; break;
      }

      if (customTime) {
        const [customHour, customMinute] = customTime.split(':').map(Number);
        if (!isNaN(customHour) && !isNaN(customMinute)) {
          hour = customHour;
          minute = customMinute;
        }
      }

      const jstDateString = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${JST_OFFSET}`;
      return new Date(jstDateString);
    };


    // 介護記録
    if (!recordTypes || recordTypes.includes('様子')) {
      try {
        const careRecordsData = await db
          .select({
            id: careRecords.id,
            residentId: careRecords.residentId,
            staffId: careRecords.staffId,
            recordDate: careRecords.recordDate,
            description: careRecords.description,
            notes: careRecords.notes,
            createdAt: careRecords.createdAt
          })
          .from(careRecords)
          .where(and(
            gte(careRecords.recordDate, startDate),
            lte(careRecords.recordDate, endDate)
          ));

        careRecordsData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const mappedStaffName = staffMap.get(record.staffId);
            const fallbackUserName = usersMap.get(record.staffId);
            const finalStaffName = mappedStaffName || fallbackUserName || record.staffId;
            
            allRecords.push({
              id: record.id,
              recordType: '様子',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: record.recordDate,
              content: record.description,
              staffName: finalStaffName,
              createdAt: record.createdAt,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('介護記録の取得でエラー:', error);
      }
    }

    // 食事記録 - スタンプされている記録のみ表示
    if (!recordTypes || recordTypes.includes('食事')) {
      try {
        const mealsData = await db
          .select()
          .from(mealsAndMedication)
          .where(and(
            gte(mealsAndMedication.recordDate, startDate),
            lte(mealsAndMedication.recordDate, endDate),
            eq(mealsAndMedication.type, 'meal'),
            // スタンプされている記録のみ
            isNotNull(mealsAndMedication.staffName),
            not(eq(mealsAndMedication.staffName, ''))
          ));

        mealsData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const content = record.notes || '';
            const mappedStaffName = staffMap.get(record.staffId);
            const fallbackUserName = usersMap.get(record.staffId);
            const finalStaffName = mappedStaffName || fallbackUserName || record.staffId;
            
            allRecords.push({
              id: record.id,
              recordType: '食事',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: record.recordDate,
              content,
              staffName: finalStaffName,
              createdAt: record.createdAt,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('食事記録の取得でエラー:', error);
      }
    }

    // 服薬記録
    if (!recordTypes || recordTypes.includes('服薬')) {
      try {
        const medicationData = await db
          .select()
          .from(medicationRecords)
          .where(and(
            eq(medicationRecords.recordDate, date),
            isNotNull(medicationRecords.confirmer1),
            not(eq(medicationRecords.confirmer1, '')),
            isNotNull(medicationRecords.confirmer2),
            not(eq(medicationRecords.confirmer2, ''))
          ));

        medicationData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const content = record.notes || '';
            const rawStaffName = record.confirmer1 || record.confirmer2 || '';
            const mappedStaffName = staffMap.get(rawStaffName);
            const fallbackUserName = usersMap.get(rawStaffName);
            const finalStaffName = mappedStaffName || fallbackUserName || rawStaffName;
            
            const recordTime = getMedicationTime(record.timing);

            allRecords.push({
              id: record.id,
              recordType: '服薬',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: recordTime,
              content: `${record.timing}: ${content}`,
              staffName: finalStaffName,
              createdAt: record.createdAt,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('服薬記録の取得でエラー:', error);
      }
    }

    // バイタル記録
    if (!recordTypes || recordTypes.includes('バイタル')) {
      try {
        const vitalData = await db
          .select()
          .from(vitalSigns)
          .where(and(
            gte(vitalSigns.recordDate, startDate),
            lte(vitalSigns.recordDate, endDate)
          ));

        vitalData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            // バイタル数値を個別に送信（フロントで枠分け表示用）
            const vitalInfo = [];
            if (record.temperature) vitalInfo.push(`体温:${record.temperature}℃`);
            if (record.bloodPressureSystolic && record.bloodPressureDiastolic) vitalInfo.push(`血圧:${record.bloodPressureSystolic}/${record.bloodPressureDiastolic}`);
            if (record.pulseRate) vitalInfo.push(`脈拍:${record.pulseRate}`);
            if (record.oxygenSaturation) vitalInfo.push(`SpO2:${record.oxygenSaturation}%`);
            if (record.bloodSugar) vitalInfo.push(`血糖:${record.bloodSugar}`);
            if (record.respirationRate) vitalInfo.push(`呼吸:${record.respirationRate}`);
            
            const vitalString = vitalInfo.length > 0 ? vitalInfo.join(' ') : '';
            const notes = record.notes || '';
            
            // 後方互換性のためcontentも保持
            const content = vitalString && notes ? `${vitalString} ${notes}` : vitalString || notes;

            // バイタル記録のスタッフ名もマッピングを適用
            const safeStaffName = record.staffName || '';
            const mappedStaffName = staffMap.get(safeStaffName);
            const fallbackUserName = usersMap.get(safeStaffName);
            const finalStaffName = mappedStaffName || fallbackUserName || record.staffName;
            

            // バイタル一覧画面と同じ記録日時の表示を作成
            let recordTimeDisplay = record.recordDate;
            console.log(`🔍 バイタル記録の時刻情報:`, {
              id: record.id,
              timing: record.timing,
              hour: record.hour,
              minute: record.minute,
              recordDate: record.recordDate
            });
            
            if (record.timing && record.hour !== null && record.minute !== null) {
              // timing + 時:分 の形式で表示
              console.log(`🕐 時刻設定前 - baseDate:`, new Date(record.recordDate));
              console.log(`🕐 時刻設定前 - hour:${record.hour}, minute:${record.minute}`);
              
              // JST での日時文字列を直接作成してからDateオブジェクト化
              const baseDate = new Date(record.recordDate);
              const year = baseDate.getFullYear();
              const month = String(baseDate.getMonth() + 1).padStart(2, '0');
              const day = String(baseDate.getDate()).padStart(2, '0');
              const hour = String(record.hour).padStart(2, '0');
              const minute = String(record.minute).padStart(2, '0');
              
              // JST時刻として解釈されるような文字列を作成
              const jstDateString = `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;
              recordTimeDisplay = new Date(jstDateString);
              
              console.log(`🎯 JST文字列:`, jstDateString);
              console.log(`✅ 作成した記録時刻:`, recordTimeDisplay);
              console.log(`✅ 表示用時刻文字列:`, recordTimeDisplay.toLocaleString('ja-JP'));
            } else if (record.timing) {
              // timingのみの場合はrecordDateを使用
              recordTimeDisplay = record.recordDate;
              console.log(`⚠️ timing のみ利用:`, recordTimeDisplay);
            } else {
              console.log(`❌ 時刻情報なし、recordDate使用:`, recordTimeDisplay);
            }

            allRecords.push({
              id: record.id,
              recordType: 'バイタル',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: recordTimeDisplay,
              timing: record.timing, // バイタル一覧との互換性のため追加
              hour: record.hour,     // バイタル一覧との互換性のため追加  
              minute: record.minute, // バイタル一覧との互換性のため追加
              content: content.trim(), // 後方互換性のため保持
              vitalValues: vitalString.trim(), // バイタル数値のみ（上枠用）
              notes: notes.trim(), // 記録内容のみ（下枠用）
              staffName: finalStaffName,
              createdAt: record.createdAt,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('バイタル記録の取得でエラー:', error);
      }
    }

    // 排泄記録（記録内容 + 関連排泄データ）
    if (!recordTypes || recordTypes.includes('排泄')) {
      try {
        // 記録内容（general_note）を取得（前日も含めて検索）
        const extendedStartDate = new Date(startDate);
        extendedStartDate.setDate(extendedStartDate.getDate() - 1); // 前日も含める
        
        const excretionNotesData = await db
          .select()
          .from(excretionRecords)
          .where(and(
            gte(excretionRecords.recordDate, extendedStartDate),
            lte(excretionRecords.recordDate, endDate),
            eq(excretionRecords.type, 'general_note')
          ));

        // 同日の全排泄データも取得（便記録・尿記録）
        const allExcretionData = await db
          .select()
          .from(excretionRecords)
          .where(and(
            gte(excretionRecords.recordDate, startDate),
            lte(excretionRecords.recordDate, endDate),
            or(
              eq(excretionRecords.type, 'bowel_movement'),
              eq(excretionRecords.type, 'urination')
            )
          ));

        console.log('📊 全排泄データ取得:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalRecords: allExcretionData.length,
          records: allExcretionData.map(r => ({
            id: r.id,
            residentId: r.residentId,
            type: r.type,
            recordDate: r.recordDate,
            consistency: r.consistency,
            amount: r.amount,
            urineVolumeCc: r.urineVolumeCc,
            notes: r.notes
          }))
        });

        // 記録内容（general_note）と排泄データを組み合わせて処理
        // 利用者ごとにデータをグループ化
        const residentGroups = new Map<string, { notes?: any, excretionData: any[] }>();

        // general_noteを追加
        excretionNotesData.forEach(record => {
          const existing = residentGroups.get(record.residentId) || { excretionData: [] };
          existing.notes = record;
          residentGroups.set(record.residentId, existing);
        });

        // 排泄データを追加
        allExcretionData.forEach(record => {
          const existing = residentGroups.get(record.residentId) || { excretionData: [] };
          existing.excretionData.push(record);
          residentGroups.set(record.residentId, existing);
        });

        // 利用者ごとにレコードを作成
        residentGroups.forEach((data, residentId) => {
          const resident = residentsMap.get(residentId);
          if (resident) {
            const notesRecord = data.notes;
            const content = notesRecord?.notes || '';
            // 記録内容の作成日時を優先、なければ排泄データの作成日時を使用
            const recordTime = notesRecord?.createdAt || (data.excretionData[0]?.createdAt) || new Date();
            
            const mappedStaffName = staffMap.get(notesRecord?.staffId);
            const fallbackUserName = usersMap.get(notesRecord?.staffId);
            const finalStaffName = mappedStaffName || fallbackUserName || notesRecord?.staffId || '不明';
            
            const timeCategory = getTimeCategory(new Date(recordTime));
            
            // recordTypesフィルタリング: 日中/夜間が指定された場合はその時間帯のみ
            if (recordTypes && (recordTypes.includes('日中') || recordTypes.includes('夜間'))) {
              if (!recordTypes.includes(timeCategory)) {
                return; // この記録をスキップ
              }
            }

            // この利用者の排泄データを使用（既にフィルタリング済み）
            const relatedExcretionData = data.excretionData;

            // 時間別に排泄データを整理
            const timeGroupedData: Record<string, { stool?: any, urine?: any }> = {};

            console.log('🔍 relatedExcretionData:', {
              residentId: residentId,
              totalRecords: relatedExcretionData.length,
              records: relatedExcretionData.map(r => ({
                id: r.id,
                type: r.type,
                recordDate: r.recordDate,
                consistency: r.consistency,
                amount: r.amount,
                urineVolumeCc: r.urineVolumeCc
              }))
            });

            relatedExcretionData.forEach(excretionRecord => {
              // UTCからJSTに変換してからフォーマット
              const jstDate = toZonedTime(new Date(excretionRecord.recordDate), 'Asia/Tokyo');
              const timeKey = format(jstDate, 'HH:mm');
              console.log('🕐 Processing record:', { timeKey, type: excretionRecord.type, recordDate: excretionRecord.recordDate });
              
              if (!timeGroupedData[timeKey]) {
                timeGroupedData[timeKey] = {};
              }

              if (excretionRecord.type === 'bowel_movement') {
                timeGroupedData[timeKey].stool = {
                  state: excretionRecord.consistency || '',
                  amount: excretionRecord.amount || ''
                };
              } else if (excretionRecord.type === 'urination') {
                timeGroupedData[timeKey].urine = {
                  amount: excretionRecord.amount || '',
                  volumeCc: excretionRecord.urineVolumeCc || null
                };
              }
            });

            console.log('📊 timeGroupedData:', timeGroupedData);

            // フォーマット済みの文字列配列を作成
            const formattedEntries = Object.keys(timeGroupedData)
              .sort() // 時間順にソート
              .map(time => {
                const data = timeGroupedData[time];
                let line = `${time}`;
                
                // 便データ
                if (data.stool && (data.stool.state || data.stool.amount)) {
                  const stoolPart = `便: ${data.stool.state}${data.stool.amount ? ` (${data.stool.amount})` : ''}`;
                  line += ` ${stoolPart}`;
                }
                
                // 尿データ
                if (data.urine && (data.urine.amount || data.urine.volumeCc)) {
                  const urinePart = `尿: ${data.urine.amount}${data.urine.volumeCc ? ` (${data.urine.volumeCc}CC)` : ''}`;
                  if (data.stool && (data.stool.state || data.stool.amount)) {
                    line += ` / ${urinePart}`;
                  } else {
                    line += ` ${urinePart}`;
                  }
                }
                
                return line;
              })
              .filter(line => line.length > 5); // 時間のみの行（データなし）を除外

            console.log('📝 formattedEntries:', formattedEntries);

            const excretionDetails = {
              formattedEntries
            };
            
            allRecords.push({
              id: notesRecord?.id || `excretion-${residentId}`,
              recordType: '排泄',
              residentId: residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: recordTime,
              content,
              staffName: finalStaffName,
              createdAt: notesRecord?.createdAt || new Date(),
              timeCategory: timeCategory,
              originalData: notesRecord,
              excretionDetails // 排泄データを追加
            });
          }
        });
      } catch (error) {
        console.error('排泄記録の取得でエラー:', error);
      }
    }

    // 清掃リネン記録
    if (!recordTypes || recordTypes.includes('清掃リネン')) {
      try {
        const cleaningData = await db
          .select()
          .from(cleaningLinenRecords)
          .where(eq(cleaningLinenRecords.recordDate, date));

        cleaningData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const content = record.recordNote || '';
            const mappedStaffName = staffMap.get(record.staffId);
            const fallbackUserName = usersMap.get(record.staffId);
            const finalStaffName = mappedStaffName || fallbackUserName || record.staffId;
            
            // 清掃リネン記録の時刻処理を修正
            // recordTimeが存在する場合はそれを使用し、ない場合のみデフォルト時刻を使用
            let recordTime;
            if (record.recordTime && record.recordTime instanceof Date) {
              recordTime = record.recordTime;
            } else if (record.recordTime) {
              // 文字列の場合は日付に変換
              recordTime = new Date(record.recordTime);
            } else {
              // recordTimeが存在しない場合のみデフォルトの12:00を使用
              recordTime = new Date(`${record.recordDate}T12:00:00`);
            }
            const timeCategory = getTimeCategory(recordTime);
            
            // recordTypesフィルタリング: 日中/夜間が指定された場合はその時間帯のみ
            if (recordTypes && (recordTypes.includes('日中') || recordTypes.includes('夜間'))) {
              if (!recordTypes.includes(timeCategory)) {
                return; // この記録をスキップ
              }
            }

            allRecords.push({
              id: record.id,
              recordType: '清掃リネン',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: recordTime,
              content: content.trim(),
              staffName: finalStaffName, 
              createdAt: record.createdAt,
              timeCategory: timeCategory,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('清掃リネン記録の取得でエラー:', error);
      }
    }

    // 入浴記録は除外（バイタル一覧と相互記録されるため表示不要）

    // 体重記録
    if (!recordTypes || recordTypes.includes('体重')) {
      try {
        const weightData = await db
          .select()
          .from(weightRecords)
          .where(and(
            gte(weightRecords.recordDate, startDate),
            lte(weightRecords.recordDate, endDate)
          ));

        weightData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const content = record.notes || '';
            
            // 体重記録の時刻処理を修正
            // recordTimeが存在する場合はそれを使用、ない場合はhour/minuteから時刻を構築
            let recordTime;
            if (record.recordTime && record.recordTime instanceof Date) {
              recordTime = record.recordTime;
            } else if (record.recordTime) {
              // 文字列の場合は日付に変換
              recordTime = new Date(record.recordTime);
            } else if (record.hour !== null && record.minute !== null) {
              // hour/minuteフィールドから時刻を構築
              recordTime = new Date(`${date}T${String(record.hour).padStart(2, '0')}:${String(record.minute).padStart(2, '0')}:00`);
            } else {
              // どちらもない場合はrecordDateを使用
              recordTime = new Date(record.recordDate);
            }
            
            const timeCategory = getTimeCategory(recordTime);
            
            // recordTypesフィルタリング: 日中/夜間が指定された場合はその時間帯のみ
            if (recordTypes && (recordTypes.includes('日中') || recordTypes.includes('夜間'))) {
              if (!recordTypes.includes(timeCategory)) {
                return; // この記録をスキップ
              }
            }

            allRecords.push({
              id: record.id,
              recordType: '体重',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: recordTime,
              content: content.trim(),
              staffName: record.staffName,
              createdAt: record.createdAt,
              timeCategory: timeCategory,
              originalData: record
            });
          }
        });
      } catch (error) {
        console.error('体重記録の取得でエラー:', error);
      }
    }

    // 看護記録・処置記録
    if (!recordTypes || recordTypes.includes('看護記録') || recordTypes.includes('医療記録') || recordTypes.includes('処置')) {
      try {
        
        // 看護記録を取得
        const nursingData = await db
          .select()
          .from(nursingRecords)
          .where(and(
            gte(nursingRecords.recordDate, startDate),
            lte(nursingRecords.recordDate, endDate)
          ));

        // すべてのユーザー情報を取得（職員名マッピング用）
        const allUsers = await db.select().from(users);
        const usersMap = new Map(allUsers.map(user => [user.id, user.firstName || user.email || user.id]));
        
        console.log(`看護記録取得結果: ${nursingData.length}件`);
        
        // 処置関連の記録を特別にログ出力
        const treatmentRecords = nursingData.filter(r => 
          r.category === '処置' || 
          r.category === 'treatment' ||
          (r.notes && r.interventions) ||
          r.description?.includes('処置')
        );
        console.log(`処置関連記録数: ${treatmentRecords.length}件`);
        treatmentRecords.forEach(r => {
          console.log(`  処置記録: ID=${r.id}, category="${r.category}", notes="${r.notes}", interventions="${r.interventions}"`);
        });

        nursingData.forEach(record => {
          const resident = record.residentId ? residentsMap.get(record.residentId) : null;
          
          // 職員名をマップから取得（staffMapを優先、次にusersMap）
          const staffName = staffMap.get(record.nurseId) || usersMap.get(record.nurseId) || record.nurseId;
          
          // カテゴリー判定ロジック：既存データとの互換性を考慮
          let recordType = '看護記録';
          
          // 新しいフォーマット（直接的なカテゴリー名）
          if (record.category === '医療記録') {
            recordType = '医療記録';
          } else if (record.category === '処置') {
            recordType = '処置';
          } else if (record.category === '看護記録') {
            recordType = '看護記録';
          }
          // 古いフォーマット（英語カテゴリー）との互換性
          else if (record.category === 'intervention') {
            recordType = '医療記録';
          } else if (record.category === 'assessment') {
            // 処置の判定：notesとinterventionsが両方ある場合は処置として扱う
            if (record.notes && record.interventions) {
              recordType = '処置';
            } else {
              recordType = '看護記録';
            }
          } else if (record.category === 'evaluation') {
            recordType = '看護記録';
          } else if (record.category === 'observation') {
            recordType = '看護記録';
          }
          // カテゴリーが設定されていない場合のデフォルト
          else if (!record.category) {
            recordType = '看護記録';
          }
          // その他のカスタムカテゴリー
          else {
            recordType = record.category;
          }

          // フィルタリングに該当しない場合はスキップ
          if (recordTypes && !recordTypes.includes(recordType)) return;

          // 記録内容のみを表示（看護記録、医療記録、処置共通）
          let content = '';
          if (recordType === '処置') {
            // 処置の場合は description（処置内容）のみを表示
            content = record.description || record.interventions || '';
          } else {
            // 看護記録・医療記録の場合は description のみを表示
            content = record.description || '';
          }

          allRecords.push({
            id: record.id,
            recordType,
            residentId: record.residentId,
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '全体',
            recordTime: record.recordDate,
            content: content.trim(),
            staffName: staffName, // 職員名を表示
            createdAt: record.createdAt,
            originalData: record
          });
        });
      } catch (error) {
        console.error('看護記録の取得でエラー:', error);
      }
    }

    // 記録時間順にソート
    allRecords.sort((a, b) => new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime());

    return allRecords;
  }
}

export const storage = new DatabaseStorage();
