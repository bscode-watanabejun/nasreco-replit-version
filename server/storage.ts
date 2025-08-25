import {
  users,
  residents,
  careRecords,
  nursingRecords,
  vitalSigns,
  mealsAndMedication,
  mealsMedication,
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
  type MealsMedication,
  type InsertMealsMedication,
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
import { eq, desc, and, gte, lte, or, sql, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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
  getMealRecordById(id: string): Promise<MealsAndMedication | undefined>;
  createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication>;

  // Meals Medication operations (新仕様)
  getMealsMedication(recordDate: string, mealTime: string, floor: string): Promise<MealsMedication[]>;
  createMealsMedication(record: InsertMealsMedication): Promise<MealsMedication>;
  updateMealsMedication(id: string, record: InsertMealsMedication): Promise<MealsMedication>;

  // Bathing record operations
  getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]>;
  createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord>;
  updateBathingRecord(id: string, record: Partial<InsertBathingRecord>): Promise<BathingRecord>;
  deleteBathingRecord(id: string): Promise<void>;

  // Excretion record operations
  getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<ExcretionRecord[]>;
  createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord>;

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
    console.log(`Attempting to delete resident with id: ${id}`);
    const result = await db.update(residents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(residents.id, id))
      .returning({ id: residents.id, isActive: residents.isActive });
    console.log(`Delete result:`, result);
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
    const [newRecord] = await db.insert(mealsAndMedication).values(record).returning();
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

  async getMealRecordById(id: string): Promise<MealsAndMedication | undefined> {
    const [record] = await db.select()
      .from(mealsAndMedication)
      .where(eq(mealsAndMedication.id, id))
      .limit(1);
    return record;
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

    return await db.select()
      .from(bathingRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bathingRecords.recordDate));
  }

  async createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord> {
    const [newRecord] = await db.insert(bathingRecords).values(record).returning();
    return newRecord;
  }

  async updateBathingRecord(id: string, record: Partial<InsertBathingRecord>): Promise<BathingRecord> {
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

    return await db.select()
      .from(medicationRecords)
      .leftJoin(residents, eq(medicationRecords.residentId, residents.id))
      .where(and(...conditions));
  }

  async createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    const recordToInsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
    };
    const [newRecord] = await db.insert(medicationRecords).values([recordToInsert]).returning();
    return newRecord;
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
    
    console.log('Fetching cleaning linen records:', { 
      weekStartDate: weekStartDate.toISOString(),
      floor, 
      startDateStr, 
      endDateStr 
    });

    let query = db.select({
      id: cleaningLinenRecords.id,
      residentId: cleaningLinenRecords.residentId,
      recordDate: cleaningLinenRecords.recordDate,
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
    console.log('Query result count:', result.length);
    if (result.length > 0) {
      console.log('Sample record:', result[0]);
    }
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
      // 既存レコードを更新
      const [updated] = await db.update(cleaningLinenRecords)
        .set({
          cleaningValue: record.cleaningValue,
          linenValue: record.linenValue,
          recordNote: record.recordNote,
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
        recordDate: recordDateStr
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
      console.log("💾 Creating staff record:", record);
      
      // 職員IDの重複チェック
      console.log("🔍 Checking for duplicate staffId:", record.staffId);
      const existing = await db.select().from(staffManagement).where(eq(staffManagement.staffId, record.staffId));
      console.log("📊 Found existing records:", existing.length);
      
      if (existing.length > 0) {
        throw new Error("この職員IDは既に使用されています");
      }

      // パスワードのハッシュ化（実装簡略化のため、実際の本番環境ではbcryptを使用）
      const hashedPassword = record.password ? Buffer.from(record.password).toString('base64') : null;
      console.log("🔐 Password hashed");

      const insertData = {
        ...record,
        password: hashedPassword,
        lastModifiedAt: new Date(),
      };
      console.log("📝 Inserting data:", insertData);

      const [created] = await db.insert(staffManagement).values(insertData).returning();
      console.log("✅ Staff created successfully:", created);
      
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

  // Meals Medication operations (新スキーマ)
  async getMealsMedication(recordDate: string, mealTime: string, floor: string): Promise<MealsMedication[]> {
    let whereConditions = and(
      eq(mealsMedication.recordDate, recordDate),
      eq(mealsMedication.mealTime, mealTime)
    );

    if (floor !== 'all') {
      whereConditions = and(
        eq(mealsMedication.recordDate, recordDate),
        eq(mealsMedication.mealTime, mealTime),
        eq(residents.floor, floor)
      );
    }

    const results = await db
      .select({
        id: mealsMedication.id,
        residentId: mealsMedication.residentId,
        recordDate: mealsMedication.recordDate,
        mealTime: mealsMedication.mealTime,
        mainAmount: mealsMedication.mainAmount,
        sideAmount: mealsMedication.sideAmount,
        waterIntake: mealsMedication.waterIntake,
        supplement1: mealsMedication.supplement1,
        amount1: mealsMedication.amount1,
        supplement2: mealsMedication.supplement2,
        amount2: mealsMedication.amount2,
        totalAmount: mealsMedication.totalAmount,
        staffName: mealsMedication.staffName,
        notes: mealsMedication.notes,
        createdBy: mealsMedication.createdBy,
        createdAt: mealsMedication.createdAt,
        updatedAt: mealsMedication.updatedAt,
        residentName: residents.name,
        roomNumber: residents.roomNumber,
        floor: residents.floor,
      })
      .from(mealsMedication)
      .leftJoin(residents, eq(mealsMedication.residentId, residents.id))
      .where(whereConditions);

    return results;
  }

  async createMealsMedication(record: InsertMealsMedication): Promise<MealsMedication> {
    const [newRecord] = await db.insert(mealsMedication).values(record).returning();
    return newRecord;
  }

  async updateMealsMedication(id: string, record: InsertMealsMedication): Promise<MealsMedication> {
    const [updatedRecord] = await db
      .update(mealsMedication)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(mealsMedication.id, id))
      .returning();
    
    if (!updatedRecord) {
      throw new Error("Meals medication record not found");
    }
    
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
}

export const storage = new DatabaseStorage();
