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
  journalCheckboxes,
  journalEntries,
  tenants,
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
  type UpdateStaffManagementApi,
  type ResidentAttachment,
  type InsertResidentAttachment,
  type JournalCheckbox,
  type InsertJournalCheckbox,
  type JournalEntry,
  type InsertJournalEntry,
  type Tenant,
  type InsertTenant,
  type UpdateTenantApi,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql, like, isNull, isNotNull, not, ne } from "drizzle-orm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// JST時間を取得するユーティリティ関数
function getJSTTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

// テナントに職員情報をJOINした型
export type TenantWithStaff = Tenant & {
  createdByName?: string | null;
  updatedByName?: string | null;
};

export interface IStorage {
  // Tenants
  getTenants(): Promise<TenantWithStaff[]>;
  getTenantById(id: string): Promise<TenantWithStaff | undefined>;
  createTenant(data: InsertTenant, userId: string): Promise<Tenant>;
  updateTenant(data: UpdateTenantApi, userId: string): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;

  // Tenant utility
  setCurrentTenant(tenantId: string | null): void;
  getCurrentTenant(): string | null;

  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  findUserByStaffInfo(staffId: string, staffName: string): Promise<User | undefined>;

  // Resident operations
  getResidents(tenantId?: string): Promise<Resident[]>;
  getResident(id: string, tenantId?: string): Promise<Resident | undefined>;
  createResident(resident: InsertResident): Promise<Resident>;
  updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident>;
  deleteResident(id: string): Promise<void>;

  // Care record operations
  getCareRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<{
    id: string;
    residentId: string;
    staffId: string;
    recordDate: Date;
    category: string;
    description: string;
    notes: string | null;
    createdAt: Date | null;
  }[]>;
  createCareRecord(record: InsertCareRecord): Promise<CareRecord>;
  updateCareRecord(id: string, data: Partial<InsertCareRecord>): Promise<CareRecord>;
  deleteCareRecord(id: string): Promise<void>;

  // Nursing record operations
  getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<{
    id: string;
    residentId: string | null;
    nurseId: string;
    recordDate: Date;
    category: string;
    description: string | null;
    notes: string | null;
    interventions: string | null;
    outcomes: string | null;
    createdAt: Date | null;
  }[]>;
  getAllNursingRecords(floor?: string): Promise<any[]>;
  getNursingRecordById(id: string): Promise<{
    id: string;
    residentId: string | null;
    nurseId: string;
    recordDate: Date;
    category: string;
    description: string | null;
    notes: string | null;
    interventions: string | null;
    outcomes: string | null;
    createdAt: Date | null;
  } | null>;
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
  getMealsAndMedicationById(id: string): Promise<MealsAndMedication | null>;
  createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  getMealList(recordDate: string, mealTime: string, floor: string): Promise<any[]>;

  // Bathing record operations
  getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]>;
  createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord>;
  updateBathingRecord(id: string, record: Partial<InsertBathingRecord>): Promise<BathingRecord>;
  deleteBathingRecord(id: string): Promise<void>;

  // Excretion record operations
  getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<{
    id: string;
    residentId: string;
    staffId: string;
    recordDate: Date;
    type: string;
    consistency: string | null;
    amount: string | null;
    urineVolumeCc: number | null;
    assistance: string | null;
    notes: string | null;
    createdAt: Date | null;
  }[]>;
  createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord>;
  updateExcretionRecord(id: string, record: Partial<InsertExcretionRecord>): Promise<ExcretionRecord>;

  // Weight record operations
  getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]>;
  createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord>;
  updateWeightRecord(id: string, record: Partial<InsertWeightRecord>): Promise<WeightRecord>;
  deleteWeightRecord(id: string): Promise<void>;

  // Communication operations
  getCommunications(residentId?: string, startDate?: Date, endDate?: Date): Promise<Communication[]>;

  // Journal checkbox operations
  getJournalCheckboxes(recordDate: string): Promise<JournalCheckbox[]>;
  upsertJournalCheckbox(recordId: string, recordType: string, checkboxType: string, isChecked: boolean, recordDate: string): Promise<void>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  markCommunicationAsRead(id: string): Promise<void>;

  // Round record operations
  getRoundRecords(recordDate: Date): Promise<{
    id: string;
    residentId: string;
    recordDate: string;
    hour: number;
    recordType: string;
    staffName: string;
    positionValue: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: Date | null;
  }[]>;
  createRoundRecord(record: InsertRoundRecord): Promise<RoundRecord>;
  updateRoundRecord(id: string, data: Partial<RoundRecord>): Promise<RoundRecord>;
  deleteRoundRecord(id: string): Promise<void>;

  // Medication record operations
  getMedicationRecords(recordDate: string, timing: string, floor: string): Promise<MedicationRecord[]>;
  getMedicationRecordsByDateRange(dateFrom: string, dateTo: string, timing: string, floor: string): Promise<MedicationRecord[]>;
  getAllMedicationRecords(floor?: string): Promise<MedicationRecord[]>;
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
  getStaffNoticeReadStatus(noticeId: string): Promise<{
    id: string;
    noticeId: string;
    staffId: string;
    readAt: Date | null;
    createdAt: Date | null;
    staffName: string | null;
    staffLastName: string | null;
  }[]>;
  markStaffNoticeAsRead(noticeId: string, staffId: string): Promise<StaffNoticeReadStatus>;
  markStaffNoticeAsUnread(noticeId: string, staffId: string): Promise<void>;
  getUnreadStaffNoticesCount(staffId: string): Promise<number>;

  // Cleaning Linen operations
  getCleaningLinenRecords(weekStartDate: Date, floor?: string): Promise<CleaningLinenRecord[]>;
  getAllCleaningLinenRecords(floor?: string): Promise<CleaningLinenRecord[]>;
  getCleaningLinenRecordsByDateRange(startDate: Date, endDate: Date, floor?: string): Promise<CleaningLinenRecord[]>;
  createCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord>;
  updateCleaningLinenRecord(id: string, record: Partial<InsertCleaningLinenRecord>): Promise<CleaningLinenRecord>;
  upsertCleaningLinenRecord(record: InsertCleaningLinenRecord): Promise<CleaningLinenRecord>;
  deleteCleaningLinenRecord(id: string): Promise<void>;

  // Staff authentication
  authenticateStaff(staffId: string, password: string): Promise<StaffManagement | null>;
  getStaffByUserId(userId: string): Promise<StaffManagement | null>;
  getDefaultStaff(): Promise<StaffManagement | null>;

  // Staff Management operations
  getStaffManagement(): Promise<StaffManagement[]>;
  getStaffManagementById(id: string): Promise<StaffManagement | null>;
  getStaffByUserId(userId: string): Promise<StaffManagement | null>;
  createStaffManagement(staff: InsertStaffManagement): Promise<StaffManagement>;
  updateStaffManagement(staff: UpdateStaffManagementApi): Promise<StaffManagement>;
  deleteStaffManagement(id: string): Promise<void>;
  unlockStaffAccount(id: string, password: string): Promise<StaffManagement>;
  lockStaffAccount(id: string): Promise<StaffManagement>;
  changeStaffPassword(staffId: string, newPassword: string): Promise<void>;

  // Resident Attachment operations
  getResidentAttachments(residentId: string): Promise<ResidentAttachment[]>;
  getResidentAttachment(id: string): Promise<ResidentAttachment | null>;
  createResidentAttachment(attachment: InsertResidentAttachment): Promise<ResidentAttachment>;
  deleteResidentAttachment(id: string): Promise<void>;

  // Daily Records operations
  getDailyRecords(date: string, recordTypes?: string[], includeNextDay?: boolean): Promise<any[]>;

  // Journal Entry operations
  getJournalEntries(dateFrom?: string, dateTo?: string, recordType?: string, floor?: string): Promise<JournalEntry[]>;
  getJournalEntry(recordDate: string, recordType: string, floor?: string): Promise<JournalEntry | null>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: string, entry: Partial<InsertJournalEntry>): Promise<JournalEntry>;
  upsertJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  deleteJournalEntry(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private currentTenantId: string | null = null;

  // Tenant utility
  setCurrentTenant(tenantId: string | null): void {
    this.currentTenantId = tenantId;
    console.log(`🔧 Storage currentTenantId set to:`, tenantId);
  }

  getCurrentTenant(): string | null {
    return this.currentTenantId;
  }

  // Tenants
  async getTenants(): Promise<TenantWithStaff[]> {
    const result = await db
      .select({
        id: tenants.id,
        tenantId: tenants.tenantId,
        tenantName: tenants.tenantName,
        status: tenants.status,
        createdBy: tenants.createdBy,
        updatedBy: tenants.updatedBy,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        createdByName: sql<string>`created_by_staff.staff_name`.as('created_by_name'),
        updatedByName: sql<string>`updated_by_staff.staff_name`.as('updated_by_name'),
      })
      .from(tenants)
      .leftJoin(
        sql`${staffManagement} AS created_by_staff`,
        sql`${tenants.createdBy} = created_by_staff.id`
      )
      .leftJoin(
        sql`${staffManagement} AS updated_by_staff`,
        sql`${tenants.updatedBy} = updated_by_staff.id`
      )
      .orderBy(desc(tenants.createdAt));

    return result as TenantWithStaff[];
  }

  async getTenantById(id: string): Promise<TenantWithStaff | undefined> {
    const result = await db
      .select({
        id: tenants.id,
        tenantId: tenants.tenantId,
        tenantName: tenants.tenantName,
        status: tenants.status,
        createdBy: tenants.createdBy,
        updatedBy: tenants.updatedBy,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        createdByName: sql<string>`created_by_staff.staff_name`.as('created_by_name'),
        updatedByName: sql<string>`updated_by_staff.staff_name`.as('updated_by_name'),
      })
      .from(tenants)
      .leftJoin(
        sql`${staffManagement} AS created_by_staff`,
        sql`${tenants.createdBy} = created_by_staff.id`
      )
      .leftJoin(
        sql`${staffManagement} AS updated_by_staff`,
        sql`${tenants.updatedBy} = updated_by_staff.id`
      )
      .where(eq(tenants.id, id));

    return result[0] as TenantWithStaff | undefined;
  }

  async createTenant(data: InsertTenant, userId: string): Promise<Tenant> {
    // テナントIDの重複チェック
    const existing = await db.select().from(tenants).where(eq(tenants.tenantId, data.tenantId));
    if (existing.length > 0) {
      throw new Error(`テナントID「${data.tenantId}」は既に使用されています`);
    }

    const [tenant] = await db.insert(tenants).values({
      ...data,
      createdBy: userId,
      updatedBy: userId,
      createdAt: getJSTTime(),
      updatedAt: getJSTTime(),
    }).returning();

    return tenant;
  }

  async updateTenant(data: UpdateTenantApi, userId: string): Promise<Tenant> {
    const { id, ...updateData } = data;

    // テナントIDの重複チェック（更新時）
    if (updateData.tenantId) {
      const existing = await db
        .select()
        .from(tenants)
        .where(and(
          eq(tenants.tenantId, updateData.tenantId),
          ne(tenants.id, id)
        ));

      if (existing.length > 0) {
        throw new Error(`テナントID「${updateData.tenantId}」は既に使用されています`);
      }
    }

    const [tenant] = await db
      .update(tenants)
      .set({
        ...updateData,
        updatedBy: userId,
        updatedAt: getJSTTime(),
      })
      .where(eq(tenants.id, id))
      .returning();

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

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
    // パラメータの安全性チェック - null, undefined, 空文字列を厳密にチェック
    if (!staffId || staffId === null || staffId === undefined || typeof staffId !== 'string' || staffId.trim() === '') {
      return undefined;
    }

    // staffNameも安全性チェック
    const safeStaffName = staffName && typeof staffName === 'string' ? staffName.trim() : '';

    try {
      // 段階的に検索を試行（最も安全な方法から）
      const cleanStaffId = staffId.trim();
      
      // 1. 正確なemailマッチを試行
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, `${cleanStaffId}@bigsmall.co.jp`))
        .limit(1);
      
      if (user) {
        return user;
      }

      // 2. staffIdがそのままemailに含まれている場合を検索（likeを使わない方法）
      const allUsers = await db.select().from(users);
      const emailMatchUser = allUsers.find(u => 
        u.email && u.email.includes(cleanStaffId)
      );
      
      if (emailMatchUser) {
        return emailMatchUser;
      }

      // 3. staffNameがある場合、名前での検索を試行
      if (safeStaffName && safeStaffName.length > 0) {
        const firstName = safeStaffName.split(' ')[0] || safeStaffName;
        
        if (firstName && firstName.length > 0) {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.firstName, firstName))
            .limit(1);
            
          if (user) {
            return user;
          }
          
          // 4. 名前の部分一致検索（likeを使わない方法）
          const nameMatchUser = allUsers.find(u => 
            u.firstName && u.firstName.includes(firstName)
          );
          
          if (nameMatchUser) {
            return nameMatchUser;
          }
        }
      }

      return undefined;
      
    } catch (error) {
      console.error("❌ Error in findUserByStaffInfo:", error);
      return undefined;
    }
  }

  // Resident operations
  async getResidents(tenantId?: string): Promise<Resident[]> {
    // テナントIDが指定されている場合、テナントフィルタを追加
    if (tenantId) {
      return await db.select().from(residents)
        .where(and(eq(residents.isActive, true), eq(residents.tenantId, tenantId)))
        .orderBy(residents.name);
    }
    // 現在のテナントIDがある場合
    else if (this.currentTenantId) {
      return await db.select().from(residents)
        .where(and(eq(residents.isActive, true), eq(residents.tenantId, this.currentTenantId)))
        .orderBy(residents.name);
    }

    // テナントIDがない場合（親環境） - NULLデータのみ表示
    return await db.select().from(residents)
      .where(and(eq(residents.isActive, true), isNull(residents.tenantId)))
      .orderBy(residents.name);
  }

  async getResident(id: string, tenantId?: string): Promise<Resident | undefined> {
    // テナントIDが指定されている場合、テナントフィルタを追加
    if (tenantId) {
      const [resident] = await db.select().from(residents)
        .where(and(eq(residents.id, id), eq(residents.tenantId, tenantId)));
      return resident;
    }
    // 現在のテナントIDがある場合
    else if (this.currentTenantId) {
      const [resident] = await db.select().from(residents)
        .where(and(eq(residents.id, id), eq(residents.tenantId, this.currentTenantId)));
      return resident;
    }

    const [resident] = await db.select().from(residents).where(eq(residents.id, id));
    return resident;
  }

  async createResident(resident: InsertResident): Promise<Resident> {
    // 現在のテナントIDを自動設定（未指定の場合）
    const residentData = {
      ...resident,
      tenantId: resident.tenantId || this.currentTenantId
    };

    const [newResident] = await db.insert(residents).values(residentData).returning();
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
      .set({ ...processedUpdates, updatedAt: getJSTTime() })
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
  async getCareRecords(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<{
    id: string;
    residentId: string;
    staffId: string;
    recordDate: Date;
    category: string;
    description: string;
    notes: string | null;
    createdAt: Date | null;
  }[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(careRecords.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(careRecords.tenantId, this.currentTenantId));
    } else {
      // 親環境では tenant_id が NULL のデータのみ
      conditions.push(isNull(careRecords.tenantId));
    }

    return await db.select({
      id: careRecords.id,
      residentId: careRecords.residentId,
      staffId: careRecords.staffId,
      recordDate: careRecords.recordDate,
      category: careRecords.category,
      description: careRecords.description,
      notes: careRecords.notes,
      createdAt: careRecords.createdAt,
    })
      .from(careRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(careRecords.recordDate));
  }

  async createCareRecord(record: InsertCareRecord): Promise<CareRecord> {
    const recordData = {
      ...record,
      tenantId: record.tenantId || this.currentTenantId
    };
    const [newRecord] = await db.insert(careRecords).values(recordData).returning();
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

  async deleteCareRecord(id: string): Promise<void> {
    await db.delete(careRecords).where(eq(careRecords.id, id));
  }

  // Nursing record operations
  async getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<{
    id: string;
    residentId: string | null;
    nurseId: string;
    recordDate: Date;
    category: string;
    description: string | null;
    notes: string | null;
    interventions: string | null;
    outcomes: string | null;
    createdAt: Date | null;
  }[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(nursingRecords.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(nursingRecords.tenantId, this.currentTenantId));
    }

    return await db.select({
      id: nursingRecords.id,
      residentId: nursingRecords.residentId,
      nurseId: nursingRecords.nurseId,
      recordDate: nursingRecords.recordDate,
      category: nursingRecords.category,
      description: nursingRecords.description,
      notes: nursingRecords.notes,
      interventions: nursingRecords.interventions,
      outcomes: nursingRecords.outcomes,
      createdAt: nursingRecords.createdAt,
    })
      .from(nursingRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(nursingRecords.recordDate));
  }

  async getNursingRecordById(id: string): Promise<{
    id: string;
    residentId: string | null;
    nurseId: string;
    recordDate: Date;
    category: string;
    description: string | null;
    notes: string | null;
    interventions: string | null;
    outcomes: string | null;
    createdAt: Date | null;
  } | null> {
    const record = await db
      .select({
        id: nursingRecords.id,
        residentId: nursingRecords.residentId,
        nurseId: nursingRecords.nurseId,
        recordDate: nursingRecords.recordDate,
        category: nursingRecords.category,
        description: nursingRecords.description,
        notes: nursingRecords.notes,
        interventions: nursingRecords.interventions,
        outcomes: nursingRecords.outcomes,
        createdAt: nursingRecords.createdAt,
      })
      .from(nursingRecords)
      .where(eq(nursingRecords.id, id))
      .limit(1);
    return record[0] || null;
  }

  async createNursingRecord(record: InsertNursingRecord): Promise<NursingRecord> {
    const recordData = {
      ...record,
      tenantId: record.tenantId || this.currentTenantId
    };
    const [newRecord] = await db.insert(nursingRecords).values(recordData).returning();
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
  async getVitalSigns(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<VitalSigns[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(vitalSigns.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(vitalSigns.tenantId, this.currentTenantId));
    } else {
      // 親環境では tenant_id が NULL のデータのみ
      conditions.push(isNull(vitalSigns.tenantId));
    }

    return await db.select()
      .from(vitalSigns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vitalSigns.recordDate));
  }

  async createVitalSigns(vitals: InsertVitalSigns): Promise<VitalSigns> {
    const vitalsData = {
      ...vitals,
      tenantId: vitals.tenantId || this.currentTenantId
    };
    const [newVitals] = await db.insert(vitalSigns).values([vitalsData]).returning();
    return newVitals;
  }

  async updateVitalSigns(id: string, data: Partial<InsertVitalSigns>): Promise<VitalSigns> {
    const [record] = await db
      .update(vitalSigns)
      .set(data) // dataに含まれるupdatedAtを使用
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
  async getMealsAndMedication(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<MealsAndMedication[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(mealsAndMedication.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(mealsAndMedication.tenantId, this.currentTenantId));
    }

    return await db.select()
      .from(mealsAndMedication)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mealsAndMedication.recordDate));
  }

  async getMealsAndMedicationById(id: string): Promise<MealsAndMedication | null> {
    const [record] = await db
      .select()
      .from(mealsAndMedication)
      .where(eq(mealsAndMedication.id, id))
      .limit(1);
    return record || null;
  }

  async createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication> {
    const recordToInsert = {
      ...record,
      staffId: record.staffId || 'unknown', // Ensure staffId is not undefined
      tenantId: record.tenantId || this.currentTenantId
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
  async getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<BathingRecord[]> {

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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(bathingRecords.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(bathingRecords.tenantId, this.currentTenantId));
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
    const recordData = {
      ...record,
      tenantId: record.tenantId || this.currentTenantId
    };
    const [newRecord] = await db.insert(bathingRecords).values(recordData).returning();
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
  async getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<{
    id: string;
    residentId: string;
    staffId: string;
    recordDate: Date;
    type: string;
    consistency: string | null;
    amount: string | null;
    urineVolumeCc: number | null;
    assistance: string | null;
    notes: string | null;
    createdAt: Date | null;
  }[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(excretionRecords.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(excretionRecords.tenantId, this.currentTenantId));
    }

    return await db.select({
      id: excretionRecords.id,
      residentId: excretionRecords.residentId,
      staffId: excretionRecords.staffId,
      recordDate: excretionRecords.recordDate,
      type: excretionRecords.type,
      consistency: excretionRecords.consistency,
      amount: excretionRecords.amount,
      urineVolumeCc: excretionRecords.urineVolumeCc,
      assistance: excretionRecords.assistance,
      notes: excretionRecords.notes,
      createdAt: excretionRecords.createdAt,
    })
      .from(excretionRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(excretionRecords.recordDate));
  }

  async createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord> {
    const recordData = {
      ...record,
      tenantId: record.tenantId || this.currentTenantId
    };
    const [newRecord] = await db.insert(excretionRecords).values(recordData).returning();
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
  async getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<WeightRecord[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(weightRecords.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(weightRecords.tenantId, this.currentTenantId));
    }

    return await db.select()
      .from(weightRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(weightRecords.recordDate));
  }

  async createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord> {
    const recordData = {
      ...record,
      tenantId: record.tenantId || this.currentTenantId
    };
    const [newRecord] = await db.insert(weightRecords).values(recordData).returning();
    return newRecord;
  }

  async updateWeightRecord(id: string, record: Partial<InsertWeightRecord>): Promise<WeightRecord> {
    const [updatedRecord] = await db
      .update(weightRecords)
      .set(record) // recordに含まれるupdatedAtを使用
      .where(eq(weightRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteWeightRecord(id: string): Promise<void> {
    await db.delete(weightRecords).where(eq(weightRecords.id, id));
  }

  // Communication operations
  async getCommunications(residentId?: string, startDate?: Date, endDate?: Date, tenantId?: string): Promise<Communication[]> {
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

    // テナントフィルタリング
    if (tenantId) {
      conditions.push(eq(communications.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(communications.tenantId, this.currentTenantId));
    }

    return await db.select()
      .from(communications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(communications.recordDate));
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const communicationData = {
      ...communication,
      tenantId: communication.tenantId || this.currentTenantId
    };
    const [newCommunication] = await db.insert(communications).values(communicationData).returning();
    return newCommunication;
  }

  async markCommunicationAsRead(id: string): Promise<void> {
    await db.update(communications).set({ isRead: true }).where(eq(communications.id, id));
  }


  // Round record operations
  async getRoundRecords(recordDate: Date, tenantId?: string): Promise<{
    id: string;
    residentId: string;
    recordDate: string;
    hour: number;
    recordType: string;
    staffName: string;
    positionValue: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: Date | null;
  }[]> {
    const formattedDate = recordDate.toISOString().split('T')[0];

    // テナントフィルタリング
    if (tenantId) {
      return await db.select({
        id: roundRecords.id,
        residentId: roundRecords.residentId,
        recordDate: roundRecords.recordDate,
        hour: roundRecords.hour,
        recordType: roundRecords.recordType,
        staffName: roundRecords.staffName,
        positionValue: roundRecords.positionValue,
        notes: roundRecords.notes,
        createdBy: roundRecords.createdBy,
        createdAt: roundRecords.createdAt,
      }).from(roundRecords)
      .where(and(eq(roundRecords.recordDate, formattedDate), eq(roundRecords.tenantId, tenantId)))
      .orderBy(roundRecords.hour);
    } else if (this.currentTenantId) {
      return await db.select({
        id: roundRecords.id,
        residentId: roundRecords.residentId,
        recordDate: roundRecords.recordDate,
        hour: roundRecords.hour,
        recordType: roundRecords.recordType,
        staffName: roundRecords.staffName,
        positionValue: roundRecords.positionValue,
        notes: roundRecords.notes,
        createdBy: roundRecords.createdBy,
        createdAt: roundRecords.createdAt,
      }).from(roundRecords)
      .where(and(eq(roundRecords.recordDate, formattedDate), eq(roundRecords.tenantId, this.currentTenantId)))
      .orderBy(roundRecords.hour);
    }

    return await db.select({
      id: roundRecords.id,
      residentId: roundRecords.residentId,
      recordDate: roundRecords.recordDate,
      hour: roundRecords.hour,
      recordType: roundRecords.recordType,
      staffName: roundRecords.staffName,
      positionValue: roundRecords.positionValue,
      notes: roundRecords.notes,
      createdBy: roundRecords.createdBy,
      createdAt: roundRecords.createdAt,
    }).from(roundRecords).where(eq(roundRecords.recordDate, formattedDate)).orderBy(roundRecords.hour);
  }

  async createRoundRecord(record: InsertRoundRecord): Promise<RoundRecord> {
    const jstTime = getJSTTime();
    const recordToInsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
      tenantId: record.tenantId || this.currentTenantId,
      createdAt: jstTime,
      updatedAt: jstTime,
    };
    const [newRecord] = await db.insert(roundRecords).values([recordToInsert]).returning();
    return newRecord;
  }

  async updateRoundRecord(id: string, data: Partial<RoundRecord>): Promise<RoundRecord> {
    const jstTime = getJSTTime();
    const [updatedRecord] = await db
      .update(roundRecords)
      .set({ ...data, updatedAt: jstTime })
      .where(eq(roundRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteRoundRecord(id: string): Promise<void> {
    await db.delete(roundRecords).where(eq(roundRecords.id, id));
  }

  // Nursing record operations - parameterless query for all records
  async getAllNursingRecords(floor?: string): Promise<any[]> {
    const results = await db.select({
      // nursing_records のフィールド
      id: nursingRecords.id,
      residentId: nursingRecords.residentId,
      nurseId: nursingRecords.nurseId,
      recordDate: nursingRecords.recordDate,
      category: nursingRecords.category,
      description: nursingRecords.description,
      notes: nursingRecords.notes,
      interventions: nursingRecords.interventions,
      outcomes: nursingRecords.outcomes,
      createdAt: nursingRecords.createdAt,
      // residents のフィールド
      residentName: residents.name,
      roomNumber: residents.roomNumber,
      floor: residents.floor,
      // staffManagement (nurse) のフィールド
      staffName: staffManagement.staffName,
    })
    .from(nursingRecords)
    .leftJoin(residents, eq(nursingRecords.residentId, residents.id))
    .leftJoin(staffManagement, eq(nursingRecords.nurseId, staffManagement.id))
    .orderBy(desc(nursingRecords.recordDate));

    // 階数でフィルタリング（JavaScriptで処理）
    if (floor && floor !== "all" && floor !== "全階") {
      return results.filter(record => record.floor === floor);
    }

    return results;
  }

  // Medication record operations
  async getAllMedicationRecords(floor?: string): Promise<any[]> {
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
    .orderBy(desc(medicationRecords.recordDate));

    // 階数でフィルタリング（JavaScriptで処理）
    if (floor && floor !== "all" && floor !== "全階") {
      return results.filter(record => record.floor === floor);
    }

    return results;
  }

  async getMedicationRecords(recordDate: string, timing: string, floor: string): Promise<any[]> {
    // 服薬タイミングと利用者の服薬時間帯設定のマッピング
    const getTimingFieldMapping = (timing: string) => {
      const mappings: Record<string, string[]> = {
        "起床後": ["medicationWakeup"],
        "朝前": ["medicationMorningBefore"], 
        "朝後": ["medicationMorning"],
        "昼前": ["medicationNoonBefore"],
        "昼後": ["medicationBedtime"],
        "夕前": ["medicationEveningBefore"],
        "夕後": ["medicationEvening"],
        "眠前": ["medicationSleep"],
        "頓服": ["medicationAsNeeded"]
      };
      return mappings[timing] || [];
    };

    // 曜日から服薬時間フィールドを取得（修正：medicationTime*フィールド群を使用）
    const getWeeklyFieldFromDate = (dateString: string): string => {
      const date = new Date(dateString);
      const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
      const weeklyFields = [
        'medicationTimeSunday',    // Week → Time に変更
        'medicationTimeMonday',    // Week → Time に変更
        'medicationTimeTuesday',   // Week → Time に変更
        'medicationTimeWednesday', // Week → Time に変更
        'medicationTimeThursday',  // Week → Time に変更
        'medicationTimeFriday',    // Week → Time に変更
        'medicationTimeSaturday'   // Week → Time に変更
      ];
      return weeklyFields[dayOfWeek];
    };

    // 1. 既存の服薬記録を取得
    const conditions = [eq(medicationRecords.recordDate, recordDate)];
    
    if (timing && timing !== 'all') {
      conditions.push(eq(medicationRecords.timing, timing));
    }

    if (floor && floor !== 'all') {
      conditions.push(eq(residents.floor, floor));
    }

    const existingRecords = await db.select({
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

    // 2. 条件に合致する利用者の初期表示カードを生成
    if (timing && timing !== 'all') {
      // 利用者を取得（フロアフィルタ適用）
      let residentConditions = [eq(residents.isActive, true)];
      if (floor && floor !== 'all') {
        residentConditions.push(eq(residents.floor, floor));
      }

      const allResidents = await db.select().from(residents).where(and(...residentConditions));
      
      const timingFields = getTimingFieldMapping(timing);
      const weeklyField = getWeeklyFieldFromDate(recordDate);
      
      // 既存記録がある利用者のIDセット
      const existingRecordResidentIds = new Set(existingRecords.map(r => r.residentId));
      
      // 条件に合致する利用者の空カードを生成
      const additionalCards = [];
      
      for (const resident of allResidents) {
        // 既に記録がある場合はスキップ
        if (existingRecordResidentIds.has(resident.id)) {
          continue;
        }
        
        // 服薬時間帯設定をチェック
        let hasTimingSetting = false;
        if (timingFields.length > 0) {
          for (const field of timingFields) {
            if (resident[field as keyof typeof resident]) {
              hasTimingSetting = true;
              break;
            }
          }
        }
        
        // 週次設定をチェック
        const hasWeeklySetting = resident[weeklyField as keyof typeof resident] === true;
        
        // 両方の条件に合致する場合のみカードを生成
        if (hasTimingSetting && hasWeeklySetting) {
          additionalCards.push({
            id: `placeholder-${resident.id}-${timing}`,
            residentId: resident.id,
            recordDate: recordDate,
            timing: timing,
            confirmer1: null,
            confirmer2: null,
            notes: null,
            type: "服薬", // デフォルトタイプ
            result: null,
            createdBy: null,
            createdAt: null,
            updatedAt: null,
            residentName: resident.name,
            roomNumber: resident.roomNumber,
            floor: resident.floor,
          });
        }
      }
      
      // 既存記録と生成されたカードを結合
      const allRecords = [...existingRecords, ...additionalCards];
      
      // 居室番号でソート
      return allRecords.sort((a, b) => {
        const roomA = parseInt(a.roomNumber || "0");
        const roomB = parseInt(b.roomNumber || "0");
        return roomA - roomB;
      });
    }
    
    // timing が 'all' の場合は全ての服薬時間帯に対してプレースホルダーカードを生成
    if (timing === 'all') {
      // 全利用者を取得
      const residentsConditions = [];
      if (floor && floor !== 'all') {
        residentsConditions.push(eq(residents.floor, floor));
      }
      
      const allResidents = residentsConditions.length > 0
        ? await db.select().from(residents).where(and(...residentsConditions))
        : await db.select().from(residents);
      
      // 曜日から服薬時間フィールドを取得
      const weeklyField = getWeeklyFieldFromDate(recordDate);
      
      // 全ての服薬時間帯
      const allTimings = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
      
      // 既存記録がある利用者と時間帯の組み合わせをセットで管理
      const existingRecordKeys = new Set(
        existingRecords.map(r => `${r.residentId}-${r.timing}`)
      );
      
      // 条件に合致する利用者の空カードを生成
      const additionalCards = [];
      
      for (const resident of allResidents) {
        for (const currentTiming of allTimings) {
          // 既に記録がある場合はスキップ
          const recordKey = `${resident.id}-${currentTiming}`;
          if (existingRecordKeys.has(recordKey)) {
            continue;
          }
          
          // 現在の時間帯に対応するフィールドを取得
          const currentTimingFields = getTimingFieldMapping(currentTiming);
          
          // 服薬時間帯設定をチェック
          let hasTimingSetting = false;
          if (currentTimingFields.length > 0) {
            for (const field of currentTimingFields) {
              if (resident[field as keyof typeof resident]) {
                hasTimingSetting = true;
                break;
              }
            }
          }
          
          // 週次設定をチェック
          const hasWeeklySetting = resident[weeklyField as keyof typeof resident] === true;
          
          // 両方の条件に合致する場合のみカードを生成
          if (hasTimingSetting && hasWeeklySetting) {
            additionalCards.push({
              id: `placeholder-${resident.id}-${currentTiming}`,
              residentId: resident.id,
              recordDate: recordDate,
              timing: currentTiming,
              confirmer1: null,
              confirmer2: null,
              notes: null,
              type: "服薬", // デフォルトタイプ
              result: null,
              createdBy: null,
              createdAt: null,
              updatedAt: null,
              residentName: resident.name,
              roomNumber: resident.roomNumber,
              floor: resident.floor,
            });
          }
        }
      }
      
      // 既存記録と生成されたカードを結合
      const allRecords = [...existingRecords, ...additionalCards];
      
      // 居室番号と服薬時間帯でソート
      return allRecords.sort((a, b) => {
        const roomA = parseInt(a.roomNumber || "0");
        const roomB = parseInt(b.roomNumber || "0");
        if (roomA !== roomB) return roomA - roomB;
        
        // 服薬時間帯の順序でソート
        const timingOrder = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
        const timingIndexA = timingOrder.indexOf(a.timing);
        const timingIndexB = timingOrder.indexOf(b.timing);
        return timingIndexA - timingIndexB;
      });
    }
    
    // その他の場合は既存の記録のみ返す
    return existingRecords;
  }

  async getMedicationRecordsByDateRange(dateFrom: string, dateTo: string, timing: string, floor: string): Promise<any[]> {
    // 服薬タイミングと利用者の服薬時間帯設定のマッピング
    const getTimingFieldMapping = (timing: string) => {
      const mappings: Record<string, string[]> = {
        "起床後": ["medicationWakeup"],
        "朝前": ["medicationMorningBefore"], 
        "朝後": ["medicationMorning"],
        "昼前": ["medicationNoonBefore"],
        "昼後": ["medicationBedtime"],
        "夕前": ["medicationEveningBefore"],
        "夕後": ["medicationEvening"],
        "眠前": ["medicationSleep"],
        "頓服": ["medicationAsNeeded"]
      };
      return mappings[timing] || [];
    };

    // 曜日から服薬時間フィールドを取得
    const getWeeklyFieldFromDate = (dateString: string): string => {
      const date = new Date(dateString);
      const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
      const weeklyFields = [
        'medicationTimeSunday',
        'medicationTimeMonday',
        'medicationTimeTuesday',
        'medicationTimeWednesday',
        'medicationTimeThursday',
        'medicationTimeFriday',
        'medicationTimeSaturday'
      ];
      return weeklyFields[dayOfWeek];
    };

    // 日付範囲の条件を作成
    const conditions = [
      gte(medicationRecords.recordDate, dateFrom),
      lte(medicationRecords.recordDate, dateTo)
    ];
    
    if (timing && timing !== 'all') {
      conditions.push(eq(medicationRecords.timing, timing));
    }
    if (floor && floor !== 'all') {
      conditions.push(eq(residents.floor, floor));
    }

    // 日付範囲内の既存記録を一括取得
    const existingRecords = await db.select({
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

    // プレースホルダーカード生成のため、全利用者を取得
    const residentConditions = [eq(residents.isActive, true)];
    if (floor && floor !== 'all') {
      residentConditions.push(eq(residents.floor, floor));
    }
    const allResidents = await db.select().from(residents).where(and(...residentConditions));

    // 日付範囲を生成
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const dateRange = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 全ての服薬時間帯
    const allTimings = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
    const targetTimings = timing === 'all' ? allTimings : [timing];

    // 既存記録のキーセットを作成
    const existingKeys = new Set(
      existingRecords.map(record => `${record.residentId}-${record.recordDate}-${record.timing}`)
    );

    // プレースホルダーカードを生成
    const placeholderCards = [];
    
    for (const resident of allResidents) {
      for (const dateStr of dateRange) {
        const weeklyField = getWeeklyFieldFromDate(dateStr);
        const hasWeeklySetting = resident[weeklyField as keyof typeof resident] === true;
        
        // 週次設定がない場合はスキップ
        if (!hasWeeklySetting) continue;
        
        for (const currentTiming of targetTimings) {
          const recordKey = `${resident.id}-${dateStr}-${currentTiming}`;
          
          // 既存記録がある場合はスキップ
          if (existingKeys.has(recordKey)) continue;
          
          // 現在の時間帯に対応するフィールドを取得
          const currentTimingFields = getTimingFieldMapping(currentTiming);
          
          // 服薬時間帯設定をチェック
          let hasTimingSetting = false;
          if (currentTimingFields.length > 0) {
            for (const field of currentTimingFields) {
              if (resident[field as keyof typeof resident]) {
                hasTimingSetting = true;
                break;
              }
            }
          }
          
          // 両方の条件に合致する場合のみカードを生成
          if (hasTimingSetting && hasWeeklySetting) {
            placeholderCards.push({
              id: `placeholder-${resident.id}-${dateStr}-${currentTiming}`,
              residentId: resident.id,
              recordDate: dateStr,
              timing: currentTiming,
              confirmer1: null,
              confirmer2: null,
              notes: null,
              type: "服薬",
              result: null,
              createdBy: null,
              createdAt: null,
              updatedAt: null,
              residentName: resident.name,
              roomNumber: resident.roomNumber,
              floor: resident.floor,
            });
          }
        }
      }
    }

    // 既存記録とプレースホルダーカードを結合
    const allRecords = [...existingRecords, ...placeholderCards];

    // 居室番号と日付でソート
    return allRecords.sort((a, b) => {
      const roomA = parseInt(a.roomNumber || "0");
      const roomB = parseInt(b.roomNumber || "0");
      if (roomA !== roomB) return roomA - roomB;
      
      // 日付でソート
      const dateA = new Date(a.recordDate).getTime();
      const dateB = new Date(b.recordDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      
      // 服薬時間帯の順序でソート
      const timingOrder = ["起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"];
      const timingIndexA = timingOrder.indexOf(a.timing);
      const timingIndexB = timingOrder.indexOf(b.timing);
      return timingIndexA - timingIndexB;
    });
  }

  async createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    const recordToInsert = {
      ...record,
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
      tenantId: record.tenantId || this.currentTenantId,
      createdBy: record.createdBy || 'unknown' // Ensure createdBy is not undefined
    };
    const [newRecord] = await db.insert(medicationRecords).values([recordToInsert]).returning();
    return newRecord;
  }

  async upsertMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    try {
      const recordToUpsert = {
        ...record,
        recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
        tenantId: record.tenantId || this.currentTenantId,
        createdBy: record.createdBy || 'unknown' // Ensure createdBy is not undefined
      };
      
      console.log("🔄 DB Upserting record:", recordToUpsert);
      
      // PostgreSQLのON CONFLICTを使用してupsert操作を実行
      const result = await db
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
            updatedAt: sql`EXCLUDED.updated_at`
          }
        })
        .returning();
        
      console.log("🔄 DB Upsert result:", result);
      
      if (!result || result.length === 0) {
        throw new Error("Upsert operation returned no results");
      }
      
      const upsertedRecord = result[0];
      return upsertedRecord;
    } catch (error) {
      console.error("❌ Error in upsertMedicationRecord:", error);
      throw error;
    }
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
      updatedAt: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })),
    };
    const [updated] = await db.update(facilitySettings)
      .set(settingsToUpdate)
      .where(eq(facilitySettings.id, id))
      .returning();
    return updated;
  }

  // Staff notice operations
  async getStaffNotices(tenantId?: string): Promise<StaffNotice[]> {
    const conditions = [eq(staffNotices.isActive, true)];
    if (tenantId) {
      conditions.push(eq(staffNotices.tenantId, tenantId));
    } else if (this.currentTenantId) {
      conditions.push(eq(staffNotices.tenantId, this.currentTenantId));
    }
    return await db.select().from(staffNotices)
      .where(and(...conditions))
      .orderBy(desc(staffNotices.createdAt));
  }

  async createStaffNotice(notice: InsertStaffNotice): Promise<StaffNotice> {
    const noticeData = {
      ...notice,
      tenantId: notice.tenantId || this.currentTenantId
    };
    const [created] = await db.insert(staffNotices).values([noticeData]).returning();
    return created;
  }

  async deleteStaffNotice(id: string): Promise<void> {
    await db.update(staffNotices)
      .set({ isActive: false })
      .where(eq(staffNotices.id, id));
  }

  async getStaffNoticeReadStatus(noticeId: string): Promise<{
    id: string;
    noticeId: string;
    staffId: string;
    readAt: Date | null;
    createdAt: Date | null;
    staffName: string | null;
    staffLastName: string | null;
  }[]> {
    return await db.select({
      id: staffNoticeReadStatus.id,
      noticeId: staffNoticeReadStatus.noticeId,
      staffId: staffNoticeReadStatus.staffId,
      readAt: staffNoticeReadStatus.readAt,
      createdAt: staffNoticeReadStatus.createdAt,
      staffName: staffManagement.staffName,
      staffLastName: sql<string | null>`NULL`,
    })
    .from(staffNoticeReadStatus)
    .leftJoin(staffManagement, eq(staffNoticeReadStatus.staffId, staffManagement.id))
    .where(eq(staffNoticeReadStatus.noticeId, noticeId))
    .orderBy(desc(staffNoticeReadStatus.readAt));
  }

  async markStaffNoticeAsRead(noticeId: string, staffId: string): Promise<StaffNoticeReadStatus> {
    // JST時刻を手動設定
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // 9時間のオフセット（ミリ秒）
    const jstNow = new Date(now.getTime() + jstOffset);

    const [created] = await db.insert(staffNoticeReadStatus)
      .values([{
        noticeId,
        staffId,
        readAt: jstNow,
        createdAt: jstNow,
        updatedAt: jstNow
      }])
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
  async getAllCleaningLinenRecords(floor?: string): Promise<CleaningLinenRecord[]> {
    const results = await db.select({
      id: cleaningLinenRecords.id,
      tenantId: cleaningLinenRecords.tenantId,
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
      staffName: staffManagement.staffName,
    })
    .from(cleaningLinenRecords)
    .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
    .leftJoin(staffManagement, eq(cleaningLinenRecords.staffId, staffManagement.id))
    .orderBy(desc(cleaningLinenRecords.recordDate));

    // 階数でフィルタリング（JavaScriptで処理）
    if (floor && floor !== "all" && floor !== "全階") {
      return results.filter(record => record.residentFloor === floor);
    }

    return results;
  }

  async getCleaningLinenRecords(weekStartDate: Date, floor?: string): Promise<CleaningLinenRecord[]> {
    // 日付の妥当性チェック
    if (!weekStartDate || isNaN(weekStartDate.getTime())) {
      console.error('Invalid weekStartDate:', weekStartDate);
      return [];
    }

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const startDateStr = weekStartDate.toISOString().split('T')[0];
    const endDateStr = weekEndDate.toISOString().split('T')[0];


    let query = db.select({
      id: cleaningLinenRecords.id,
      tenantId: cleaningLinenRecords.tenantId,
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
      staffName: staffManagement.staffName,
    })
    .from(cleaningLinenRecords)
    .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
    .leftJoin(staffManagement, eq(cleaningLinenRecords.staffId, staffManagement.id))
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
        tenantId: cleaningLinenRecords.tenantId,
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
        staffName: staffManagement.staffName,
      })
      .from(cleaningLinenRecords)
      .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
      .leftJoin(staffManagement, eq(cleaningLinenRecords.staffId, staffManagement.id))
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

  async getCleaningLinenRecordsByDateRange(startDate: Date, endDate: Date, floor?: string): Promise<CleaningLinenRecord[]> {
    // 日付の妥当性チェック
    if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
      console.error('Invalid date range:', startDate, endDate);
      return [];
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    let query = db.select({
      id: cleaningLinenRecords.id,
      tenantId: cleaningLinenRecords.tenantId,
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
      staffName: staffManagement.staffName,
    })
    .from(cleaningLinenRecords)
    .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
    .leftJoin(staffManagement, eq(cleaningLinenRecords.staffId, staffManagement.id))
    .where(
      and(
        gte(cleaningLinenRecords.recordDate, startDateStr),
        lte(cleaningLinenRecords.recordDate, endDateStr)
      )
    );

    if (floor && floor !== "all" && floor !== "全階") {
      // フロア名の変換（"1階" -> "1F" など）
      let floorToMatch = floor;
      if (floor.includes('階')) {
        const floorNumber = floor.replace('階', '');
        floorToMatch = `${floorNumber}F`;
      }

      query = db.select({
        id: cleaningLinenRecords.id,
        tenantId: cleaningLinenRecords.tenantId,
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
        staffName: staffManagement.staffName,
      })
      .from(cleaningLinenRecords)
      .leftJoin(residents, eq(cleaningLinenRecords.residentId, residents.id))
      .leftJoin(staffManagement, eq(cleaningLinenRecords.staffId, staffManagement.id))
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
      recordDate: typeof record.recordDate === 'string' ? record.recordDate : record.recordDate.toISOString().split('T')[0],
      tenantId: record.tenantId || this.currentTenantId
    };

    const [created] = await db.insert(cleaningLinenRecords)
      .values(recordWithStringDate)
      .returning();
    return created;
  }

  async updateCleaningLinenRecord(id: string, record: Partial<InsertCleaningLinenRecord>): Promise<CleaningLinenRecord> {
    const updateData: any = {
      ...record
    };
    
    // updatedAtフィールドが設定されていない場合のみJST時刻を設定
    if (!updateData.updatedAt) {
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      updateData.updatedAt = new Date(now.getTime() + jstOffset);
    }
    
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
      // 既存レコードを更新（記録内容またはrecordTimeに変更があった場合にrecordTimeを更新）
      const hasContentChange =
        existing[0].cleaningValue !== record.cleaningValue ||
        existing[0].linenValue !== record.linenValue ||
        existing[0].recordNote !== record.recordNote ||
        (existing[0].recordTime?.getTime() || 0) !== recordTime.getTime();
      
      const [updated] = await db.update(cleaningLinenRecords)
        .set({
          cleaningValue: record.cleaningValue,
          linenValue: record.linenValue,
          recordNote: record.recordNote,
          recordTime: hasContentChange ? recordTime : existing[0].recordTime, // 内容変更時のみrecordTimeを更新
          staffId: record.staffId,
          updatedAt: (record as any).updatedAt || (() => {
            const now = new Date();
            const jstOffset = 9 * 60 * 60 * 1000;
            return new Date(now.getTime() + jstOffset);
          })(), // JST時刻で更新
        })
        .where(eq(cleaningLinenRecords.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // 新規レコードを作成
      const recordWithStringDate = {
        ...record,
        recordDate: recordDateStr,
        recordTime: recordTime,
        tenantId: record.tenantId || this.currentTenantId
      };

      const [created] = await db.insert(cleaningLinenRecords)
        .values(recordWithStringDate)
        .returning();
      return created;
    }
  }
  async deleteCleaningLinenRecord(id: string): Promise<void> {
    await db.delete(cleaningLinenRecords).where(eq(cleaningLinenRecords.id, id));
  }

  // Staff Management methods
  async getStaffManagement(tenantId?: string): Promise<StaffManagement[]> {
    // テナントフィルタリング
    if (tenantId) {
      return await db.select().from(staffManagement)
        .where(eq(staffManagement.tenantId, tenantId))
        .orderBy(staffManagement.sortOrder, staffManagement.createdAt);
    } else if (this.currentTenantId) {
      return await db.select().from(staffManagement)
        .where(eq(staffManagement.tenantId, this.currentTenantId))
        .orderBy(staffManagement.sortOrder, staffManagement.createdAt);
    }

    return await db.select().from(staffManagement)
      .orderBy(staffManagement.sortOrder, staffManagement.createdAt);
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

      // JST時間を明示的に設定
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);

      const insertData = {
        ...record,
        password: hashedPassword,
        tenantId: record.tenantId || this.currentTenantId,
        lastModifiedAt: jstNow,
        createdAt: jstNow,
        updatedAt: jstNow,
      };

      const [created] = await db.insert(staffManagement).values(insertData).returning();
      
      return created;
    } catch (error: any) {
      console.error("❌ Database error in createStaffManagement:", error);
      throw error;
    }
  }

  async updateStaffManagement(record: UpdateStaffManagementApi): Promise<StaffManagement> {
    if (!record.id) {
      throw new Error("IDが必要です");
    }

    // 職員IDの重複チェック（自分以外）
    if (record.staffId) {
      const existing = await db.select().from(staffManagement)
        .where(and(
          eq(staffManagement.staffId, record.staffId),
          ne(staffManagement.id, record.id)
        ));
      if (existing.length > 0) {
        throw new Error("この職員IDは既に使用されています");
      }
    }

    // JST時間を明示的に設定
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);

    const updateData: any = { ...record };
    delete updateData.id;
    updateData.lastModifiedAt = jstNow;
    updateData.updatedAt = jstNow;

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

    // 日本時間を取得
    const japanTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

    const [updated] = await db.update(staffManagement)
      .set({
        status: "ロック解除",
        password: hashedPassword,
        lastModifiedAt: japanTime,
        updatedAt: japanTime,
      })
      .where(eq(staffManagement.id, id))
      .returning();

    if (!updated) {
      throw new Error("職員が見つかりません");
    }

    return updated;
  }

  async lockStaffAccount(id: string): Promise<StaffManagement> {
    // 日本時間を取得
    const japanTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

    const [updated] = await db.update(staffManagement)
      .set({
        status: "ロック",
        lastModifiedAt: japanTime,
        updatedAt: japanTime,
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

  async changeStaffPassword(staffId: string, newPassword: string): Promise<void> {
    // パスワードのハッシュ化（既存の方式に合わせてBase64を使用）
    const hashedPassword = Buffer.from(newPassword).toString('base64');

    // 日本時間を取得
    const japanTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

    const result = await db.update(staffManagement)
      .set({
        password: hashedPassword,
        lastModifiedAt: japanTime,
        updatedAt: japanTime,
      })
      .where(eq(staffManagement.id, staffId));

    if (result.rowCount === 0) {
      throw new Error("職員が見つかりません");
    }
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
    
    const targetDate = new Date(recordDate + 'T00:00:00');
    
    let whereConditions = and(
      eq(mealsAndMedication.recordDate, targetDate),
      eq(mealsAndMedication.type, 'meal')
    );

    // mealTimeが指定されている場合は条件に追加
    if (mealTime && mealTime !== 'all') {
      whereConditions = and(
        whereConditions,
        eq(mealsAndMedication.mealType, mealTime)
      );
    }

    if (floor !== 'all') {
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
  async getDailyRecords(date: string, recordTypes?: string[], includeNextDay?: boolean): Promise<any[]> {
    const allRecords: any[] = [];
    
    // DBがJST設定なので、ローカル時刻として日付範囲を設定
    const startDate = new Date(`${date}T00:00:00`);
    let endDate: Date;
    
    // includeNextDayがtrueの場合、翌日の8:30までの記録も含める
    if (includeNextDay) {
      const targetDate = new Date(date);
      targetDate.setDate(targetDate.getDate() + 1);
      const nextDateStr = targetDate.toISOString().split('T')[0];
      endDate = new Date(`${nextDateStr}T08:30:59`);
    } else {
      endDate = new Date(`${date}T23:59:59`);
    }
    
    
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

      // JST時刻を直接設定（タイムゾーン情報なし）
      const jstDateString = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
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
            
            // DBから取得したJST時刻をそのまま使用（タイムゾーンオフセットなし）
            const recordDate = new Date(record.recordDate);
            
            // DBの値が既にJST時刻（11:45）として正しく保存されているので、
            // toISOString()でUTC表記にしてZを+09:00に置換するだけ
            const jstTimeString = recordDate.toISOString().replace('Z', '+09:00');
            
            allRecords.push({
              id: record.id,
              recordType: '様子',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
        // 基本的な食事記録取得（朝食は除外 - 別途専用処理）
        const mealsData = await db
          .select({
            id: mealsAndMedication.id,
            residentId: mealsAndMedication.residentId,
            staffId: mealsAndMedication.staffId,
            recordDate: mealsAndMedication.recordDate,
            type: mealsAndMedication.type,
            mealType: mealsAndMedication.mealType,
            mainAmount: mealsAndMedication.mainAmount,
            sideAmount: mealsAndMedication.sideAmount,
            waterIntake: mealsAndMedication.waterIntake,
            supplement: mealsAndMedication.supplement,
            staffName: mealsAndMedication.staffName,
            notes: mealsAndMedication.notes,
            createdAt: mealsAndMedication.createdAt,
          })
          .from(mealsAndMedication)
          .where(and(
            gte(mealsAndMedication.recordDate, startDate),
            lte(mealsAndMedication.recordDate, endDate),
            eq(mealsAndMedication.type, 'meal'),
            not(eq(mealsAndMedication.mealType, '朝')), // 朝食は除外
            // スタンプされている記録のみ
            isNotNull(mealsAndMedication.staffName),
            not(eq(mealsAndMedication.staffName, ''))
          ));
        
        // 朝食記録を別途取得
        let breakfastData: any[] = [];
        if (includeNextDay) {
          // 夜間フィルタの場合、翌日の朝食記録を取得
          const nextDayStart = new Date(endDate);
          nextDayStart.setHours(0, 0, 0, 0);
          const nextDayEnd = new Date(endDate);
          nextDayEnd.setHours(23, 59, 59, 999);
          
          breakfastData = await db
            .select({
              id: mealsAndMedication.id,
              residentId: mealsAndMedication.residentId,
              staffId: mealsAndMedication.staffId,
              recordDate: mealsAndMedication.recordDate,
              type: mealsAndMedication.type,
              mealType: mealsAndMedication.mealType,
              mainAmount: mealsAndMedication.mainAmount,
              sideAmount: mealsAndMedication.sideAmount,
              waterIntake: mealsAndMedication.waterIntake,
              supplement: mealsAndMedication.supplement,
              staffName: mealsAndMedication.staffName,
              notes: mealsAndMedication.notes,
              createdAt: mealsAndMedication.createdAt,
            })
            .from(mealsAndMedication)
            .where(and(
              gte(mealsAndMedication.recordDate, nextDayStart),
              lte(mealsAndMedication.recordDate, nextDayEnd),
              eq(mealsAndMedication.type, 'meal'),
              eq(mealsAndMedication.mealType, '朝'),
              // スタンプされている記録のみ
              isNotNull(mealsAndMedication.staffName),
              not(eq(mealsAndMedication.staffName, ''))
            ));
        } else {
          // 日中/夜間フィルタの場合、当日の朝食記録を取得
          breakfastData = await db
            .select({
              id: mealsAndMedication.id,
              residentId: mealsAndMedication.residentId,
              staffId: mealsAndMedication.staffId,
              recordDate: mealsAndMedication.recordDate,
              type: mealsAndMedication.type,
              mealType: mealsAndMedication.mealType,
              mainAmount: mealsAndMedication.mainAmount,
              sideAmount: mealsAndMedication.sideAmount,
              waterIntake: mealsAndMedication.waterIntake,
              supplement: mealsAndMedication.supplement,
              staffName: mealsAndMedication.staffName,
              notes: mealsAndMedication.notes,
              createdAt: mealsAndMedication.createdAt,
            })
            .from(mealsAndMedication)
            .where(and(
              gte(mealsAndMedication.recordDate, startDate),
              lte(mealsAndMedication.recordDate, endDate),
              eq(mealsAndMedication.type, 'meal'),
              eq(mealsAndMedication.mealType, '朝'),
              // スタンプされている記録のみ
              isNotNull(mealsAndMedication.staffName),
              not(eq(mealsAndMedication.staffName, ''))
            ));
        }
        
        // 両方の結果をマージ
        const allMealsData = [...mealsData, ...breakfastData];

        allMealsData.forEach(record => {
          const resident = residentsMap.get(record.residentId);
          if (resident) {
            const content = record.notes || '';
            const mappedStaffName = staffMap.get(record.staffId);
            const fallbackUserName = usersMap.get(record.staffId);
            const finalStaffName = mappedStaffName || fallbackUserName || record.staffId;
            
            // 食事タイミングに応じた時刻マッピング（JST基準）
            const getMealTime = (timing: string) => {
              let hour = 12, minute = 0;

              switch (timing) {
                case '朝': hour = 8; minute = 0; break;
                case '10時': hour = 10; minute = 0; break;
                case '昼': hour = 13; minute = 0; break;
                case '15時': hour = 15; minute = 0; break;
                case '夕': hour = 18; minute = 0; break;
              }

              // recordDateから日付部分を取得し、指定時刻を設定
              const recordDateObj = new Date(record.recordDate);
              const year = recordDateObj.getFullYear();
              const month = recordDateObj.getMonth();
              const day = recordDateObj.getDate();
              
              return new Date(year, month, day, hour, minute, 0);
            };
            
            const mealTime = getMealTime(record.mealType || '昼');
            
            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = mealTime.toISOString().replace('Z', '+09:00');
            
            
            allRecords.push({
              id: record.id,
              recordType: '食事',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
            
            // 昼前、夕前、頓服の場合は記録日時を使用、その他は固定時刻を使用
            let recordTime;
            if (record.timing === '昼前' || record.timing === '夕前' || record.timing === '頓服') {
              // createdAtの時刻部分とrecordDateの日付部分を組み合わせる
              if (record.createdAt) {
                const createdTime = new Date(record.createdAt);
                const hour = createdTime.getHours();
                const minute = createdTime.getMinutes();
                const second = createdTime.getSeconds();
                // recordDateの日付に作成時刻を設定
                recordTime = new Date(`${record.recordDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`);
              } else {
                // createdAtがない場合はデフォルトの時刻を使用
                recordTime = getMedicationTime(record.timing);
              }
            } else {
              recordTime = getMedicationTime(record.timing);
            }
            
            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = new Date(recordTime || new Date()).toISOString().replace('Z', '+09:00');

            allRecords.push({
              id: record.id,
              recordType: '服薬',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
            
            if (record.timing && record.hour !== null && record.minute !== null) {
              // timing + 時:分 の形式で表示
              
              // JST での日時文字列を直接作成してからDateオブジェクト化
              const baseDate = new Date(record.recordDate);
              const year = baseDate.getFullYear();
              const month = String(baseDate.getMonth() + 1).padStart(2, '0');
              const day = String(baseDate.getDate()).padStart(2, '0');
              const hour = String(record.hour).padStart(2, '0');
              const minute = String(record.minute).padStart(2, '0');
              
              // JST時刻を直接設定（タイムゾーン情報なし）
              const jstDateString = `${year}-${month}-${day}T${hour}:${minute}:00`;
              recordTimeDisplay = new Date(jstDateString);
              
            } else if (record.timing) {
              // timingのみの場合はrecordDateを使用
              recordTimeDisplay = record.recordDate;
            } else {
            }

            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = new Date(recordTimeDisplay).toISOString().replace('Z', '+09:00');
            
            allRecords.push({
              id: record.id,
              recordType: 'バイタル',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
          .select({
            id: excretionRecords.id,
            residentId: excretionRecords.residentId,
            staffId: excretionRecords.staffId,
            recordDate: excretionRecords.recordDate,
            type: excretionRecords.type,
            consistency: excretionRecords.consistency,
            amount: excretionRecords.amount,
            urineVolumeCc: excretionRecords.urineVolumeCc,
            assistance: excretionRecords.assistance,
            notes: excretionRecords.notes,
            createdAt: excretionRecords.createdAt,
          })
          .from(excretionRecords)
          .where(and(
            gte(excretionRecords.recordDate, extendedStartDate),
            lte(excretionRecords.recordDate, endDate),
            eq(excretionRecords.type, 'general_note')
          ));

        // 同日の全排泄データも取得（便記録・尿記録）
        const allExcretionData = await db
          .select({
            id: excretionRecords.id,
            residentId: excretionRecords.residentId,
            staffId: excretionRecords.staffId,
            recordDate: excretionRecords.recordDate,
            type: excretionRecords.type,
            consistency: excretionRecords.consistency,
            amount: excretionRecords.amount,
            urineVolumeCc: excretionRecords.urineVolumeCc,
            assistance: excretionRecords.assistance,
            notes: excretionRecords.notes,
            createdAt: excretionRecords.createdAt,
          })
          .from(excretionRecords)
          .where(and(
            gte(excretionRecords.recordDate, startDate),
            lte(excretionRecords.recordDate, endDate),
            or(
              eq(excretionRecords.type, 'bowel_movement'),
              eq(excretionRecords.type, 'urination')
            )
          ));


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


            relatedExcretionData.forEach(excretionRecord => {
              // UTCからJSTに変換してからフォーマット
              const jstDate = toZonedTime(new Date(excretionRecord.recordDate), 'Asia/Tokyo');
              const timeKey = format(jstDate, 'HH:mm');
              
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


            const excretionDetails = {
              formattedEntries
            };
            
            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = new Date(recordTime).toISOString().replace('Z', '+09:00');
            
            allRecords.push({
              id: notesRecord?.id || `excretion-${residentId}`,
              recordType: '排泄',
              residentId: residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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

            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = new Date(recordTime).toISOString().replace('Z', '+09:00');
            
            allRecords.push({
              id: record.id,
              recordType: '清掃リネン',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
            
            // 体重記録の時刻処理を簡素化
            // recordDateをそのまま使用（nullの場合はスキップ）
            if (!record.recordDate) return;
            const recordTime = new Date(record.recordDate);
            
            const timeCategory = getTimeCategory(recordTime);
            
            // recordTypesフィルタリング: 日中/夜間が指定された場合はその時間帯のみ
            if (recordTypes && (recordTypes.includes('日中') || recordTypes.includes('夜間'))) {
              if (!recordTypes.includes(timeCategory)) {
                return; // この記録をスキップ
              }
            }

            // JST時刻をJST表記で送信（+09:00付き）
            const jstTimeString = new Date(recordTime).toISOString().replace('Z', '+09:00');
            
            allRecords.push({
              id: record.id,
              recordType: '体重',
              residentId: record.residentId,
              roomNumber: resident.roomNumber,
              residentName: resident.name,
              recordTime: jstTimeString,
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
          .select({
            id: nursingRecords.id,
            residentId: nursingRecords.residentId,
            nurseId: nursingRecords.nurseId,
            recordDate: nursingRecords.recordDate,
            category: nursingRecords.category,
            description: nursingRecords.description,
            notes: nursingRecords.notes,
            interventions: nursingRecords.interventions,
            outcomes: nursingRecords.outcomes,
            createdAt: nursingRecords.createdAt,
          })
          .from(nursingRecords)
          .where(and(
            gte(nursingRecords.recordDate, startDate),
            lte(nursingRecords.recordDate, endDate)
          ));

        // すべてのユーザー情報を取得（職員名マッピング用）
        const allUsers = await db.select().from(users);
        const usersMap = new Map(allUsers.map(user => [user.id, user.firstName || user.email || user.id]));
        
        // 処置関連の記録を特別にログ出力
        const treatmentRecords = nursingData.filter(r => 
          r.category === '処置' || 
          r.category === 'treatment' ||
          (r.notes && r.interventions) ||
          r.description?.includes('処置')
        );

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

          // JST時刻をJST表記で送信（+09:00付き）
          const jstTimeString = new Date(record.recordDate).toISOString().replace('Z', '+09:00');
          
          allRecords.push({
            id: record.id,
            recordType,
            residentId: record.residentId,
            roomNumber: resident?.roomNumber || '',
            residentName: resident?.name || '全体',
            recordTime: jstTimeString,
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

  // Journal checkbox operations
  async getJournalCheckboxes(recordDate: string): Promise<JournalCheckbox[]> {
    return await db.select()
      .from(journalCheckboxes)
      .where(eq(journalCheckboxes.recordDate, recordDate));
  }

  async upsertJournalCheckbox(
    recordId: string,
    recordType: string,
    checkboxType: string,
    isChecked: boolean,
    recordDate: string
  ): Promise<void> {
    // 既存のチェック状態を取得
    const existing = await db.select()
      .from(journalCheckboxes)
      .where(
        and(
          eq(journalCheckboxes.recordId, recordId),
          eq(journalCheckboxes.recordType, recordType),
          eq(journalCheckboxes.checkboxType, checkboxType),
          eq(journalCheckboxes.recordDate, recordDate)
        )
      );

    if (existing.length > 0) {
      // 更新
      await db.update(journalCheckboxes)
        .set({
          isChecked: isChecked,
          updatedAt: getJSTTime()
        })
        .where(eq(journalCheckboxes.id, existing[0].id));
    } else {
      // 新規作成
      await db.insert(journalCheckboxes).values({
        recordId,
        recordType,
        checkboxType,
        isChecked,
        recordDate,
        createdAt: getJSTTime(),
        updatedAt: getJSTTime()
      });
    }
  }

  // Journal Entry operations
  async getJournalEntries(
    dateFrom?: string,
    dateTo?: string,
    recordType?: string,
    floor?: string
  ): Promise<JournalEntry[]> {
    const conditions = [];

    // 日付範囲フィルタ
    if (dateFrom) {
      conditions.push(gte(journalEntries.recordDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(journalEntries.recordDate, dateTo));
    }

    // 種別フィルタ
    if (recordType && recordType !== "all") {
      conditions.push(eq(journalEntries.recordType, recordType));
    }

    // 階数フィルタ
    if (floor && floor !== "all") {
      const floorValue = floor.replace("階", "");
      conditions.push(eq(journalEntries.floor, floorValue));
    }

    if (conditions.length > 0) {
      return await db.select().from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.recordDate), desc(journalEntries.recordType));
    } else {
      return await db.select().from(journalEntries)
        .orderBy(desc(journalEntries.recordDate), desc(journalEntries.recordType));
    }
  }

  async getJournalEntry(
    recordDate: string | Date,
    recordType: string,
    floor?: string
  ): Promise<JournalEntry | null> {
    // recordDateを文字列形式に正規化（YYYY-MM-DD）
    const dateString = recordDate instanceof Date
      ? recordDate.toISOString().split('T')[0]
      : recordDate.split('T')[0];

    const conditions = [
      eq(journalEntries.recordDate, dateString),
      eq(journalEntries.recordType, recordType)
    ];

    if (floor && floor !== "all") {
      const floorValue = floor.replace("階", "");
      conditions.push(eq(journalEntries.floor, floorValue));
    }

    const [entry] = await db.select()
      .from(journalEntries)
      .where(and(...conditions));

    return entry || null;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    // recordDateを文字列に統一（DBは date型なので YYYY-MM-DD 形式）
    let recordDateString: string;
    if (entry.recordDate instanceof Date) {
      recordDateString = format(entry.recordDate, 'yyyy-MM-dd');
    } else {
      // 文字列の場合、YYYY-MM-DD形式に正規化
      recordDateString = (entry.recordDate as string).split('T')[0];
    }

    // サーバー環境の現在時刻を使用（既にJSTとして設定済み）
    const jstNow = new Date();

    const insertData = {
      recordDate: recordDateString,
      recordType: entry.recordType,
      enteredBy: entry.enteredBy,
      residentCount: entry.residentCount,
      hospitalizedCount: entry.hospitalizedCount,
      floor: entry.floor,
      createdBy: entry.createdBy,
      createdAt: jstNow,
      updatedAt: jstNow
    };


    const [created] = await db.insert(journalEntries)
      .values(insertData)
      .returning();
    return created;
  }

  async updateJournalEntry(id: string, entry: Partial<InsertJournalEntry>): Promise<JournalEntry> {
    // recordDateを文字列に統一（更新の場合）
    let recordDateString: string | undefined;
    if (entry.recordDate) {
      if (entry.recordDate instanceof Date) {
        recordDateString = format(entry.recordDate, 'yyyy-MM-dd');
      } else {
        recordDateString = (entry.recordDate as string).split('T')[0];
      }
    }

    // サーバー環境の現在時刻を使用（既にJSTとして設定済み）
    const jstNow = new Date();

    const updateData: any = {
      updatedAt: jstNow // JST時刻を手動設定
    };

    // 更新可能なフィールドのみを設定
    if (recordDateString !== undefined) updateData.recordDate = recordDateString;
    if (entry.recordType !== undefined) updateData.recordType = entry.recordType;
    if (entry.enteredBy !== undefined) updateData.enteredBy = entry.enteredBy;
    if (entry.residentCount !== undefined) updateData.residentCount = entry.residentCount;
    if (entry.hospitalizedCount !== undefined) updateData.hospitalizedCount = entry.hospitalizedCount;
    if (entry.floor !== undefined) updateData.floor = entry.floor;
    // createdByは更新時には変更しない（作成時のみ設定）


    const [updated] = await db.update(journalEntries)
      .set(updateData)
      .where(eq(journalEntries.id, id))
      .returning();
    return updated;
  }

  async upsertJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    // 既存のエントリを探す
    const existing = await this.getJournalEntry(
      entry.recordDate,
      entry.recordType,
      entry.floor || undefined
    );

    if (existing) {
      // 更新
      return await this.updateJournalEntry(existing.id, entry);
    } else {
      // 新規作成
      return await this.createJournalEntry(entry);
    }
  }

  async deleteJournalEntry(id: string): Promise<void> {
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
  }
}

export const storage = new DatabaseStorage();
