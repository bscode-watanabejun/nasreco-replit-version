import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("staff"), // staff, nurse, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Residents/Patients table
export const residents = pgTable("residents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  nameKana: varchar("name_kana"),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender"), // male, female, other
  roomNumber: varchar("room_number"),
  floor: varchar("floor"),
  admissionDate: date("admission_date"),
  emergencyContact: varchar("emergency_contact"),
  medicalHistory: text("medical_history"),
  allergies: text("allergies"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Care records
export const careRecords = pgTable("care_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // daily_care, assistance, observation
  description: text("description").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Nursing records
export const nursingRecords = pgTable("nursing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  nurseId: varchar("nurse_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // assessment, intervention, evaluation
  description: text("description").notNull(),
  interventions: text("interventions"),
  outcomes: text("outcomes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vital signs
export const vitalSigns = pgTable("vital_signs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  temperature: decimal("temperature", { precision: 4, scale: 1 }),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  pulseRate: integer("pulse_rate"),
  respirationRate: integer("respiration_rate"),
  oxygenSaturation: decimal("oxygen_saturation", { precision: 5, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Meals and medication
export const mealsAndMedication = pgTable("meals_and_medication", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  type: varchar("type").notNull(), // meal, medication
  mealType: varchar("meal_type"), // breakfast, lunch, dinner, snack
  mealIntake: varchar("meal_intake"), // full, partial, minimal, none
  medicationName: varchar("medication_name"),
  dosage: varchar("dosage"),
  administeredTime: timestamp("administered_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bathing records
export const bathingRecords = pgTable("bathing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  bathType: varchar("bath_type").notNull(), // shower, bath, bed_bath
  assistance: varchar("assistance"), // independent, partial, full
  skinCondition: text("skin_condition"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Excretion records
export const excretionRecords = pgTable("excretion_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  type: varchar("type").notNull(), // urination, bowel_movement
  consistency: varchar("consistency"), // normal, soft, hard, liquid
  amount: varchar("amount"), // small, medium, large
  assistance: varchar("assistance"), // independent, partial, full
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Weight records
export const weightRecords = pgTable("weight_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Communication/notes
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id").references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // handover, incident, general
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertResidentSchema = createInsertSchema(residents, {
  dateOfBirth: z.string().optional().transform((str) => str ? str : undefined),
  admissionDate: z.string().optional().transform((str) => str ? str : undefined),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCareRecordSchema = createInsertSchema(careRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertNursingRecordSchema = createInsertSchema(nursingRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertVitalSignsSchema = createInsertSchema(vitalSigns, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertMealsAndMedicationSchema = createInsertSchema(mealsAndMedication, {
  recordDate: z.string().transform((str) => new Date(str)),
  administeredTime: z.string().optional().transform((str) => str ? new Date(str) : undefined),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBathingRecordSchema = createInsertSchema(bathingRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertExcretionRecordSchema = createInsertSchema(excretionRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertWeightRecordSchema = createInsertSchema(weightRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCommunicationSchema = createInsertSchema(communications, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Resident = typeof residents.$inferSelect;
export type InsertResident = z.infer<typeof insertResidentSchema>;
export type CareRecord = typeof careRecords.$inferSelect;
export type InsertCareRecord = z.infer<typeof insertCareRecordSchema>;
export type NursingRecord = typeof nursingRecords.$inferSelect;
export type InsertNursingRecord = z.infer<typeof insertNursingRecordSchema>;
export type VitalSigns = typeof vitalSigns.$inferSelect;
export type InsertVitalSigns = z.infer<typeof insertVitalSignsSchema>;
export type MealsAndMedication = typeof mealsAndMedication.$inferSelect;
export type InsertMealsAndMedication = z.infer<typeof insertMealsAndMedicationSchema>;
export type BathingRecord = typeof bathingRecords.$inferSelect;
export type InsertBathingRecord = z.infer<typeof insertBathingRecordSchema>;
export type ExcretionRecord = typeof excretionRecords.$inferSelect;
export type InsertExcretionRecord = z.infer<typeof insertExcretionRecordSchema>;
export type WeightRecord = typeof weightRecords.$inferSelect;
export type InsertWeightRecord = z.infer<typeof insertWeightRecordSchema>;
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
