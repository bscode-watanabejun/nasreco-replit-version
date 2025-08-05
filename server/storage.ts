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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Resident operations
  getResidents(): Promise<Resident[]>;
  getResident(id: string): Promise<Resident | undefined>;
  createResident(resident: InsertResident): Promise<Resident>;
  updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident>;

  // Care record operations
  getCareRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<CareRecord[]>;
  createCareRecord(record: InsertCareRecord): Promise<CareRecord>;
  updateCareRecord(id: string, data: Partial<InsertCareRecord>): Promise<CareRecord>;

  // Nursing record operations
  getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<NursingRecord[]>;
  createNursingRecord(record: InsertNursingRecord): Promise<NursingRecord>;

  // Vital signs operations
  getVitalSigns(residentId?: string, startDate?: Date, endDate?: Date): Promise<VitalSigns[]>;
  createVitalSigns(vitals: InsertVitalSigns): Promise<VitalSigns>;

  // Meals and medication operations
  getMealsAndMedication(residentId?: string, startDate?: Date, endDate?: Date): Promise<MealsAndMedication[]>;
  createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication>;
  updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication>;

  // Meals Medication operations (新仕様)
  getMealsMedication(recordDate: string, mealTime: string, floor: string): Promise<MealsMedication[]>;
  createMealsMedication(record: InsertMealsMedication): Promise<MealsMedication>;
  updateMealsMedication(id: string, record: InsertMealsMedication): Promise<MealsMedication>;

  // Bathing record operations
  getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]>;
  createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord>;

  // Excretion record operations
  getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<ExcretionRecord[]>;
  createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord>;

  // Weight record operations
  getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]>;
  createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord>;

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
    const [updatedResident] = await db
      .update(residents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(residents.id, id))
      .returning();
    return updatedResident;
  }

  // Care record operations
  async getCareRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<CareRecord[]> {
    let query = db.select().from(careRecords);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(careRecords.recordDate));
  }

  async createCareRecord(record: InsertCareRecord): Promise<CareRecord> {
    const [newRecord] = await db.insert(careRecords).values(record).returning();
    return newRecord;
  }

  async updateCareRecord(id: string, data: Partial<InsertCareRecord>): Promise<CareRecord> {
    const [record] = await db
      .update(careRecords)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(careRecords.id, id))
      .returning();
    return record;
  }

  // Nursing record operations
  async getNursingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<NursingRecord[]> {
    let query = db.select().from(nursingRecords);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(nursingRecords.recordDate));
  }

  async createNursingRecord(record: InsertNursingRecord): Promise<NursingRecord> {
    const [newRecord] = await db.insert(nursingRecords).values(record).returning();
    return newRecord;
  }

  // Vital signs operations
  async getVitalSigns(residentId?: string, startDate?: Date, endDate?: Date): Promise<VitalSigns[]> {
    let query = db.select().from(vitalSigns);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(vitalSigns.recordDate));
  }

  async createVitalSigns(vitals: InsertVitalSigns): Promise<VitalSigns> {
    const [newVitals] = await db.insert(vitalSigns).values(vitals).returning();
    return newVitals;
  }

  // Meals and medication operations
  async getMealsAndMedication(residentId?: string, startDate?: Date, endDate?: Date): Promise<MealsAndMedication[]> {
    let query = db.select().from(mealsAndMedication);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(mealsAndMedication.recordDate));
  }

  async createMealsAndMedication(record: InsertMealsAndMedication): Promise<MealsAndMedication> {
    const [newRecord] = await db.insert(mealsAndMedication).values(record).returning();
    return newRecord;
  }

  async updateMealsAndMedication(id: string, record: InsertMealsAndMedication): Promise<MealsAndMedication> {
    const [updatedRecord] = await db
      .update(mealsAndMedication)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(mealsAndMedication.id, id))
      .returning();
    return updatedRecord;
  }

  // Bathing record operations
  async getBathingRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<BathingRecord[]> {
    let query = db.select().from(bathingRecords);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(bathingRecords.recordDate));
  }

  async createBathingRecord(record: InsertBathingRecord): Promise<BathingRecord> {
    const [newRecord] = await db.insert(bathingRecords).values(record).returning();
    return newRecord;
  }

  // Excretion record operations
  async getExcretionRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<ExcretionRecord[]> {
    let query = db.select().from(excretionRecords);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(excretionRecords.recordDate));
  }

  async createExcretionRecord(record: InsertExcretionRecord): Promise<ExcretionRecord> {
    const [newRecord] = await db.insert(excretionRecords).values(record).returning();
    return newRecord;
  }

  // Weight record operations
  async getWeightRecords(residentId?: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]> {
    let query = db.select().from(weightRecords);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(weightRecords.recordDate));
  }

  async createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord> {
    const [newRecord] = await db.insert(weightRecords).values(record).returning();
    return newRecord;
  }

  // Communication operations
  async getCommunications(residentId?: string, startDate?: Date, endDate?: Date): Promise<Communication[]> {
    let query = db.select().from(communications);
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(communications.recordDate));
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const [newCommunication] = await db.insert(communications).values(communication).returning();
    return newCommunication;
  }

  async markCommunicationAsRead(id: string): Promise<void> {
    await db.update(communications).set({ isRead: true }).where(eq(communications.id, id));
  }

  // Meals Medication operations (新仕様)
  async getMealsMedication(recordDate: string, mealTime: string, floor: string): Promise<MealsMedication[]> {
    let query = db.select({
      ...mealsMedication,
      residentName: residents.name,
      roomNumber: residents.roomNumber,
      floor: residents.floor,
    }).from(mealsMedication)
      .leftJoin(residents, eq(mealsMedication.residentId, residents.id));

    const conditions = [];
    conditions.push(eq(mealsMedication.recordDate, recordDate));
    
    if (mealTime && mealTime !== 'all') {
      conditions.push(eq(mealsMedication.mealTime, mealTime));
    }

    if (floor && floor !== 'all') {
      conditions.push(eq(residents.floor, floor));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(residents.roomNumber);
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
    return updatedRecord;
  }

  // Round record operations
  async getRoundRecords(recordDate: Date): Promise<RoundRecord[]> {
    return await db.select().from(roundRecords).where(eq(roundRecords.recordDate, recordDate)).orderBy(roundRecords.hour);
  }

  async createRoundRecord(record: InsertRoundRecord): Promise<RoundRecord> {
    const [newRecord] = await db.insert(roundRecords).values(record).returning();
    return newRecord;
  }

  async deleteRoundRecord(id: string): Promise<void> {
    await db.delete(roundRecords).where(eq(roundRecords.id, id));
  }

  // Medication record operations
  async getMedicationRecords(recordDate: string, timing: string, floor: string): Promise<MedicationRecord[]> {
    let query = db.select({
      ...medicationRecords,
      residentName: residents.name,
      roomNumber: residents.roomNumber,
      floor: residents.floor,
    }).from(medicationRecords)
      .leftJoin(residents, eq(medicationRecords.residentId, residents.id));

    const conditions = [];
    conditions.push(eq(medicationRecords.recordDate, recordDate));
    
    if (timing && timing !== 'all') {
      conditions.push(eq(medicationRecords.timing, timing));
    }

    if (floor && floor !== 'all') {
      conditions.push(eq(residents.floor, floor));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(residents.roomNumber);
  }

  async createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord> {
    const [newRecord] = await db.insert(medicationRecords).values(record).returning();
    return newRecord;
  }

  async updateMedicationRecord(id: string, record: Partial<InsertMedicationRecord>): Promise<MedicationRecord> {
    const [updatedRecord] = await db
      .update(medicationRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(medicationRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteMedicationRecord(id: string): Promise<void> {
    await db.delete(medicationRecords).where(eq(medicationRecords.id, id));
  }
}

export const storage = new DatabaseStorage();
