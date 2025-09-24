import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
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

// Multi-tenant Management table (must be defined first for references)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").unique().notNull(), // テナントID（一意識別子）
  tenantName: varchar("tenant_name").notNull(), // テナント名
  status: varchar("status").default("有効").notNull(), // ステータス（有効/無効）
  createdBy: varchar("created_by"), // 登録者（後でstaffManagementとの循環参照を解決）
  updatedBy: varchar("updated_by"), // 更新者（後でstaffManagementとの循環参照を解決）
  createdAt: timestamp("created_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
    tenantId: varchar("tenant_id"),
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
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Residents/Patients table
export const residents = pgTable("residents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  roomNumber: varchar("room_number"), // 居室番号
  floor: varchar("floor"), // 階
  name: varchar("name").notNull(), // 利用者名
  gender: varchar("gender"), // 性別 (男性/女性)
  admissionDate: date("admission_date"), // 入居日
  retirementDate: date("retirement_date"), // 退居日
  dateOfBirth: date("date_of_birth"), // 生年月日
  age: integer("age"), // 年齢
  postalCode: varchar("postal_code"), // 郵便番号
  address: text("address"), // 住所
  attendingPhysician: varchar("attending_physician"), // 主治医
  careLevel: varchar("care_level"), // 介護度
  careLevelRatio: varchar("care_level_ratio"), // 割合
  insuranceNumber: varchar("insurance_number"), // 被保険者番号
  careAuthorizationPeriodStart: date("care_authorization_period_start"), // 介護認定期間From
  careAuthorizationPeriodEnd: date("care_authorization_period_end"), // 介護認定期間To
  isAdmitted: boolean("is_admitted").default(false), // 入院
  
  // 緊急連絡先1
  emergencyContact1Name: varchar("emergency_contact1_name"), // 氏名
  emergencyContact1Relationship: varchar("emergency_contact1_relationship"), // 続柄
  emergencyContact1Phone1: varchar("emergency_contact1_phone1"), // 電話1
  emergencyContact1Phone2: varchar("emergency_contact1_phone2"), // 電話2
  emergencyContact1Address: text("emergency_contact1_address"), // 住所
  
  // 緊急連絡先2
  emergencyContact2Name: varchar("emergency_contact2_name"), // 氏名
  emergencyContact2Relationship: varchar("emergency_contact2_relationship"), // 続柄
  emergencyContact2Phone1: varchar("emergency_contact2_phone1"), // 電話1
  emergencyContact2Phone2: varchar("emergency_contact2_phone2"), // 電話2
  emergencyContact2Address: text("emergency_contact2_address"), // 住所
  
  // 服薬情報
  medicationWakeup: boolean("medication_wakeup").default(false), // 起床後
  medicationMorningBefore: boolean("medication_morning_before").default(false), // 朝前
  medicationMorning: boolean("medication_morning").default(false), // 朝後
  medicationNoonBefore: boolean("medication_noon_before").default(false), // 昼前
  medicationBedtime: boolean("medication_bedtime").default(false), // 昼後
  medicationEveningBefore: boolean("medication_evening_before").default(false), // 夕前
  medicationEvening: boolean("medication_evening").default(false), // 夕後
  medicationSleep: boolean("medication_sleep").default(false), // 眠前
  medicationAsNeeded: boolean("medication_as_needed").default(false), // 頓服
  
  // 点眼情報
  eyeDropsWakeup: boolean("eye_drops_wakeup").default(false), // 起床後
  eyeDropsMorningBefore: boolean("eye_drops_morning_before").default(false), // 朝前
  eyeDropsMorning: boolean("eye_drops_morning").default(false), // 朝後
  eyeDropsNoonBefore: boolean("eye_drops_noon_before").default(false), // 昼前
  eyeDropsBedtime: boolean("eye_drops_bedtime").default(false), // 昼後
  eyeDropsEveningBefore: boolean("eye_drops_evening_before").default(false), // 夕前
  eyeDropsEvening: boolean("eye_drops_evening").default(false), // 夕後
  eyeDropsSleep: boolean("eye_drops_sleep").default(false), // 眠前
  eyeDropsAsNeeded: boolean("eye_drops_as_needed").default(false), // 頓服
  
  // 清拭情報
  bathingSunday: boolean("bathing_sunday").default(false), // 月曜日
  bathingMonday: boolean("bathing_monday").default(false), // 火曜日
  bathingTuesday: boolean("bathing_tuesday").default(false), // 水曜日
  bathingWednesday: boolean("bathing_wednesday").default(false), // 木曜日
  bathingThursday: boolean("bathing_thursday").default(false), // 金曜日
  bathingFriday: boolean("bathing_friday").default(false), // 土曜日
  bathingSaturday: boolean("bathing_saturday").default(false), // 日曜日
  
  // 入浴情報
  bathSunday: boolean("bath_sunday").default(false), // 月曜日
  bathMonday: boolean("bath_monday").default(false), // 火曜日
  bathTuesday: boolean("bath_tuesday").default(false), // 水曜日
  bathWednesday: boolean("bath_wednesday").default(false), // 木曜日
  bathThursday: boolean("bath_thursday").default(false), // 金曜日
  bathFriday: boolean("bath_friday").default(false), // 土曜日
  bathSaturday: boolean("bath_saturday").default(false), // 日曜日
  
  // 服薬時間
  medicationTimeSunday: boolean("medication_time_sunday").default(false), // 月曜日
  medicationTimeMonday: boolean("medication_time_monday").default(false), // 火曜日
  medicationTimeTuesday: boolean("medication_time_tuesday").default(false), // 水曜日
  medicationTimeWednesday: boolean("medication_time_wednesday").default(false), // 木曜日
  medicationTimeThursday: boolean("medication_time_thursday").default(false), // 金曜日
  medicationTimeFriday: boolean("medication_time_friday").default(false), // 土曜日
  medicationTimeSaturday: boolean("medication_time_saturday").default(false), // 日曜日
  
  // 排泄情報
  excretionTimeUrineStanding: boolean("excretion_time_urine_standing").default(false), // 自立便
  excretionTimeUrineAssisted: boolean("excretion_time_urine_assisted").default(false), // 介助便
  excretionTime: varchar("excretion_time"), // 排泄時間
  diaperSize: varchar("diaper_size"), // おむつサイズ
  diaperType: varchar("diaper_type"), // おむつコース
  
  // 服薬週次情報
  medicationWeekMonday: boolean("medication_week_monday").default(false), // 月曜日
  medicationWeekTuesday: boolean("medication_week_tuesday").default(false), // 火曜日
  medicationWeekWednesday: boolean("medication_week_wednesday").default(false), // 水曜日
  medicationWeekThursday: boolean("medication_week_thursday").default(false), // 木曜日
  medicationWeekFriday: boolean("medication_week_friday").default(false), // 金曜日
  medicationWeekSaturday: boolean("medication_week_saturday").default(false), // 土曜日
  medicationWeekSunday: boolean("medication_week_sunday").default(false), // 日曜日
  
  // 腹膜透析時間
  medicationFrequency: varchar("medication_frequency"), // 月次
  mealLunch: boolean("meal_lunch").default(false), // 経口
  mealDinner: boolean("meal_dinner").default(false), // 経口
  
  notes: text("notes"), // 備考
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
});

// Care records
export const careRecords = pgTable("care_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // daily_care, assistance, observation
  description: text("description").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Nursing records
export const nursingRecords = pgTable("nursing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").references(() => residents.id), // notNull()を削除してオプショナルに
  nurseId: varchar("nurse_id").notNull().references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // assessment, intervention, evaluation
  description: text("description"), // notNull()を削除して空白での登録を可能に
  notes: text("notes"), // 処置部位などの追加情報
  interventions: text("interventions"),
  outcomes: text("outcomes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vital signs
export const vitalSigns = pgTable("vital_signs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  timing: varchar("timing"), // 午前, 午後, 臨時, 前日
  hour: integer("hour"), // 時間 (0-23)
  minute: integer("minute"), // 分 (0, 15, 30, 45)
  staffName: varchar("staff_name"), // 記入者名
  temperature: decimal("temperature", { precision: 4, scale: 1 }),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  pulseRate: integer("pulse_rate"),
  respirationRate: integer("respiration_rate"),
  oxygenSaturation: decimal("oxygen_saturation", { precision: 5, scale: 2 }),
  bloodSugar: varchar("blood_sugar"), // 血糖値（フリー入力対応）
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Meals and medication
export const mealsAndMedication = pgTable("meals_and_medication", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  type: varchar("type").notNull(), // meal, medication
  mealType: varchar("meal_type"), // 朝, 10時, 昼, 15時, 夕
  // 食事関連フィールド
  mainAmount: varchar("main_amount"), // 主食摂取量
  sideAmount: varchar("side_amount"), // 副食摂取量 
  waterIntake: varchar("water_intake"), // 水分摂取量
  supplement: varchar("supplement"), // その他・補助食品
  staffName: varchar("staff_name"), // 記入者名
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bathing records (入浴一覧用)
export const bathingRecords = pgTable("bathing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").references(() => residents.id),
  staffId: varchar("staff_id").references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  timing: varchar("timing"), // 午前, 午後, 臨時, 前日
  hour: varchar("hour"), // 時間 (0-23)
  minute: varchar("minute"), // 分 (0, 15, 30, 45)
  staffName: varchar("staff_name"), // 承認者
  bathType: varchar("bath_type"), // 区分: 入浴, シャワー浴, 清拭, ×
  temperature: varchar("temperature"), // 体温
  weight: varchar("weight"), // 体重
  bloodPressureSystolic: varchar("blood_pressure_systolic"),
  bloodPressureDiastolic: varchar("blood_pressure_diastolic"),
  pulseRate: varchar("pulse_rate"),
  oxygenSaturation: varchar("oxygen_saturation"),
  notes: text("notes"), // 記録
  rejectionReason: text("rejection_reason"), // 差し戻し
  nursingCheck: boolean("nursing_check").default(false), // 看護チェックボックス
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Excretion records
export const excretionRecords = pgTable("excretion_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  type: varchar("type").notNull(), // urination, bowel_movement
  consistency: varchar("consistency"), // normal, soft, hard, liquid
  amount: varchar("amount"), // small, medium, large
  urineVolumeCc: integer("urine_volume_cc"), // 尿量(CC)
  assistance: varchar("assistance"), // independent, partial, full
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Weight records
export const weightRecords = pgTable("weight_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  staffId: varchar("staff_id").references(() => staffManagement.id),
  recordDate: timestamp("record_date"), // 記録日時（年月日時分を一元管理）- optionalに変更
  staffName: varchar("staff_name"), // 承認者名
  weight: decimal("weight", { precision: 5, scale: 2 }), // 体重（必須から任意に変更）
  notes: text("notes"), // 記録
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Communication/notes
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").references(() => residents.id),
  staffId: varchar("staff_id").notNull().references(() => staffManagement.id),
  recordDate: timestamp("record_date").notNull(),
  category: varchar("category").notNull(), // handover, incident, general
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff notices/announcements (連絡事項管理)
export const staffNotices = pgTable("staff_notices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  createdBy: varchar("created_by").notNull().references(() => staffManagement.id), // 作成者（管理者）
  title: varchar("title"), // タイトル (optional)
  content: text("content").notNull(), // 連絡事項内容
  startDate: date("start_date").notNull(), // 閲覧期間From
  endDate: date("end_date").notNull(), // 閲覧期間To
  targetFloor: varchar("target_floor").notNull(), // 閲覧所属階 (全階,1階,2階,3階,4階)
  targetJobRole: varchar("target_job_role").notNull(), // 閲覧職種 (全体,介護,施設看護,訪問看護)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff notice read status (既読情報)
export const staffNoticeReadStatus = pgTable("staff_notice_read_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  noticeId: varchar("notice_id").notNull().references(() => staffNotices.id, { onDelete: 'cascade' }),
  staffId: varchar("staff_id").notNull().references(() => staffManagement.id),
  readAt: timestamp("read_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertResidentSchema = createInsertSchema(residents, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  dateOfBirth: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }),
  admissionDate: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }),
  retirementDate: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }),
  careAuthorizationPeriodStart: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }),
  careAuthorizationPeriodEnd: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }),
  age: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResidentSchema = insertResidentSchema.partial().extend({
  tenantId: z.string().optional().nullable(),
});

export const insertCareRecordSchema = createInsertSchema(careRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.string().transform((str) => new Date(str)),
  staffId: z.string().uuid("有効な職員IDを指定してください"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertNursingRecordSchema = createInsertSchema(nursingRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.string().transform((str) => new Date(str)),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  residentId: z.string().nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVitalSignsSchema = createInsertSchema(vitalSigns, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  staffId: z.string().optional(), // オプションに変更（サーバー側で設定）
  hour: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  minute: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  temperature: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val.toString() : val;
  }),
  bloodPressureSystolic: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  bloodPressureDiastolic: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  pulseRate: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  respirationRate: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val : parseInt(val, 10);
  }),
  oxygenSaturation: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val.toString() : val;
  }),
  bloodSugar: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMealsAndMedicationSchema = z.object({
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  residentId: z.string(),
  staffId: z.string().optional(), // オプションに変更（サーバー側で設定）
  recordDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  type: z.string(),
  mealType: z.string().nullable().optional(),
  mainAmount: z.string().nullable().optional(),
  sideAmount: z.string().nullable().optional(),
  waterIntake: z.string().nullable().optional(),
  supplement: z.string().nullable().optional(),
  staffName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const insertBathingRecordSchema = createInsertSchema(bathingRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  timing: z.string().optional(),
  hour: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  minute: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  staffName: z.string().optional(),
  bathType: z.string().optional(),
  temperature: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  weight: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  bloodPressureSystolic: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  bloodPressureDiastolic: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  pulseRate: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  oxygenSaturation: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
  nursingCheck: z.boolean().optional(),
}).omit({
  id: true,
  residentId: true,
  staffId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExcretionRecordSchema = createInsertSchema(excretionRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertWeightRecordSchema = createInsertSchema(weightRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  staffId: z.string().optional(), // オプションに変更（サーバー側で設定）
  weight: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'number' ? val.toString() : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunicationSchema = createInsertSchema(communications, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffNoticeSchema = createInsertSchema(staffNotices, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  startDate: z.string().transform((str) => str),
  endDate: z.string().transform((str) => str),
  targetFloor: z.enum(["全階", "1階", "2階", "3階", "4階"]),
  targetJobRole: z.enum(["全体", "介護", "施設看護", "訪問看護"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffNoticeReadStatusSchema = createInsertSchema(staffNoticeReadStatus, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Round Records table - ラウンド記録
export const roundRecords = pgTable("round_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull(),
  recordDate: date("record_date").notNull(),
  hour: integer("hour").notNull(), // 0-23 (時間)
  recordType: varchar("record_type").notNull(), // 'patrol' or 'position_change' or 'notes'
  staffName: varchar("staff_name").notNull(), // スタッフ名のスタンプ
  positionValue: varchar("position_value"), // 体位交換の場合: '右', '左', '仰'
  notes: text("notes"), // 記録内容
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRoundRecordSchema = createInsertSchema(roundRecords, {
  recordDate: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Medication Records table - 服薬記録
export const medicationRecords = pgTable("medication_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull(),
  recordDate: date("record_date").notNull(), // 記録日
  timing: varchar("timing").notNull(), // 服薬タイミング: "起床後", "朝前", "朝後", "昼前", "昼後", "夕前", "夕後", "眠前", "頓服"
  confirmer1: varchar("confirmer1"), // 確認者1
  confirmer2: varchar("confirmer2"), // 確認者2
  notes: text("notes"), // 記録(フリー入力)
  type: varchar("type").notNull(), // "服薬", "点眼"
  result: varchar("result"), // "○", "−", "拒否", "外出", 空欄
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: One medication record per resident per date per timing per type
  uniqueMedicationRecord: uniqueIndex("unique_medication_record").on(table.residentId, table.recordDate, table.timing, table.type),
}));

export const insertMedicationRecordSchema = createInsertSchema(medicationRecords, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([
    z.string().transform((str) => new Date(str)),
    z.date()
  ]).transform((val) => val instanceof Date ? val : new Date(val)),
  createdBy: z.string().optional(), // オプションに変更（サーバー側で設定）
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Resident = typeof residents.$inferSelect;
export type InsertResident = z.infer<typeof insertResidentSchema>;
export type UpdateResident = z.infer<typeof updateResidentSchema>;
export type CareRecord = typeof careRecords.$inferSelect;
export type InsertCareRecord = z.infer<typeof insertCareRecordSchema>;
export type NursingRecord = typeof nursingRecords.$inferSelect;
export type InsertNursingRecord = z.infer<typeof insertNursingRecordSchema>;
// Update schema for vital signs
export const updateVitalSignsSchema = insertVitalSignsSchema.partial().extend({
  updatedAt: z.date().optional(),
});

export type VitalSigns = typeof vitalSigns.$inferSelect;
export type InsertVitalSigns = z.infer<typeof insertVitalSignsSchema>;
export type UpdateVitalSigns = z.infer<typeof updateVitalSignsSchema>;
export type MealsAndMedication = typeof mealsAndMedication.$inferSelect;
export type InsertMealsAndMedication = z.infer<typeof insertMealsAndMedicationSchema>;
export type BathingRecord = typeof bathingRecords.$inferSelect;
export type InsertBathingRecord = z.infer<typeof insertBathingRecordSchema>;
// Update schema for excretion records
export const updateExcretionRecordSchema = insertExcretionRecordSchema.partial().extend({
  updatedAt: z.date().optional(),
});

export type ExcretionRecord = typeof excretionRecords.$inferSelect;
export type InsertExcretionRecord = z.infer<typeof insertExcretionRecordSchema>;
export type UpdateExcretionRecord = z.infer<typeof updateExcretionRecordSchema>;
// Update schema for weight records
export const updateWeightRecordSchema = insertWeightRecordSchema.partial().extend({
  updatedAt: z.date().optional(),
});

export type WeightRecord = typeof weightRecords.$inferSelect;
export type InsertWeightRecord = z.infer<typeof insertWeightRecordSchema>;
export type UpdateWeightRecord = z.infer<typeof updateWeightRecordSchema>;
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type StaffNotice = typeof staffNotices.$inferSelect;
export type InsertStaffNotice = z.infer<typeof insertStaffNoticeSchema>;
export type StaffNoticeReadStatus = typeof staffNoticeReadStatus.$inferSelect;
export type InsertStaffNoticeReadStatus = z.infer<typeof insertStaffNoticeReadStatusSchema>;
export type RoundRecord = typeof roundRecords.$inferSelect;
export type InsertRoundRecord = z.infer<typeof insertRoundRecordSchema>;
export type MedicationRecord = typeof medicationRecords.$inferSelect;
export type InsertMedicationRecord = z.infer<typeof insertMedicationRecordSchema>;

// Facility Settings table
export const facilitySettings = pgTable("facility_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  careType: varchar("care_type"), // 介護施設種別: 訪問介護, デイケア, デイサービス
  facilityName: varchar("facility_name"), // 施設名
  facilityAddress: varchar("facility_address"), // 施設住所
  dayShiftFrom: varchar("day_shift_from"), // 日勤時間帯開始 (HH:MM format)
  dayShiftTo: varchar("day_shift_to"), // 日勤時間帯終了 (HH:MM format)
  weightBaseline: decimal("weight_baseline", { precision: 5, scale: 2 }), // 体重基準値
  excretionBaseline: integer("excretion_baseline"), // 排泄基準値 (1-5)
  vitalSetting: varchar("vital_setting"), // バイタル設定: 前日, 午前/午後
  diarySettings: varchar("diary_settings"), // 施設日誌設定: フロア, 全体
  detailSettings: varchar("detail_settings"), // 施設詳細設定: シンプル, アドバンス
  surveyUrl: text("survey_url"), // アンケートURL
  createdAt: timestamp("created_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
});

// Facility Settings insert schema
export const insertFacilitySettingsSchema = createInsertSchema(facilitySettings, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  careType: z.enum(["訪問介護", "デイケア", "デイサービス"]).optional(),
  facilityName: z.string().min(1, "施設名を入力してください").optional(),
  facilityAddress: z.string().optional(),
  dayShiftFrom: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "正しい時刻形式で入力してください (HH:MM)").optional(),
  dayShiftTo: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "正しい時刻形式で入力してください (HH:MM)").optional(),
  weightBaseline: z.coerce.number().min(0.1, "体重基準値は0.1以上で入力してください").optional(),
  excretionBaseline: z.coerce.number().int().min(1).max(5, "排泄基準値は1から5の間で選択してください").optional(),
  vitalSetting: z.enum(["前日", "午前/午後"]).optional(),
  diarySettings: z.enum(["フロア", "全体"]).optional(),
  detailSettings: z.enum(["シンプル", "アドバンス"]).optional(),
  surveyUrl: z.string().url("正しいURL形式で入力してください").optional().or(z.literal("")),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type FacilitySettings = typeof facilitySettings.$inferSelect;
export type InsertFacilitySettings = z.infer<typeof insertFacilitySettingsSchema>;

// Cleaning Linen Records table
export const cleaningLinenRecords = pgTable("cleaning_linen_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull(),
  recordDate: date("record_date").notNull(), // 記録日
  recordTime: timestamp("record_time").defaultNow(), // 記録時刻（記録内容の作成・更新時刻）
  dayOfWeek: integer("day_of_week").notNull(), // 曜日 (0=日曜, 1=月曜, ..., 6=土曜)
  cleaningValue: varchar("cleaning_value"), // 清掃の値 ("○", "2", "3", または空白)
  linenValue: varchar("linen_value"), // リネンの値 ("○", "2", "3", または空白)
  recordNote: text("record_note"), // 記録欄のメモ
  staffId: varchar("staff_id").notNull(), // 記録者のスタッフID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // ユニーク制約を追加: 同じ利用者・同じ日付のレコードは1つのみ
  uniqueResidentDate: index("unique_resident_date").on(table.residentId, table.recordDate),
}));

// Cleaning Linen Records insert schema
export const insertCleaningLinenRecordSchema = createInsertSchema(cleaningLinenRecords, {
  residentId: z.string().min(1, "利用者IDは必須です"),
  recordDate: z.string().transform((str) => new Date(str)),
  recordTime: z.string().optional().transform((str) => str ? new Date(str) : new Date()), // 記録時刻（デフォルトは現在時刻）
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  cleaningValue: z.enum(["○", "2", "3", ""]).optional(),
  linenValue: z.enum(["○", "2", "3", ""]).optional(),
  recordNote: z.string().optional(),
  staffId: z.string().min(1, "スタッフIDは必須です"),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Update schema for cleaning linen records
export const updateCleaningLinenRecordSchema = insertCleaningLinenRecordSchema.partial().extend({
  updatedAt: z.date().optional(),
});

export type CleaningLinenRecord = typeof cleaningLinenRecords.$inferSelect;
export type InsertCleaningLinenRecord = z.infer<typeof insertCleaningLinenRecordSchema>;
export type UpdateCleaningLinenRecord = z.infer<typeof updateCleaningLinenRecordSchema>;

// Staff Management table
export const staffManagement = pgTable("staff_management", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  staffId: varchar("staff_id").unique().notNull(), // 職員ID（ログインID）
  staffName: varchar("staff_name").notNull(), // 職員名
  staffNameKana: varchar("staff_name_kana").notNull(), // 職員名フリガナ
  floor: varchar("floor").notNull(), // 所属階
  jobRole: varchar("job_role").notNull(), // 職種
  authority: varchar("authority").notNull(), // 権限
  status: varchar("status").default("ロック").notNull(), // ステータス（ロック/ロック解除）
  sortOrder: integer("sort_order").default(0), // ソート順
  password: varchar("password"), // パスワード（ハッシュ化）
  lastModifiedAt: timestamp("last_modified_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))), // 最終修正日時
  createdAt: timestamp("created_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
});

// Tenant外部キー参照を後で追加（循環参照回避のため）
// これらはAPIレベルで制御します

// Staff Management insert schema
export const insertStaffManagementSchema = createInsertSchema(staffManagement, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  staffId: z.string()
    .min(1, "職員IDを入力してください")
    .regex(/^[a-zA-Z0-9]+$/, "職員IDは英字と数字のみ使用できます"),
  staffName: z.string().min(1, "職員名を入力してください"),
  staffNameKana: z.string()
    .min(1, "職員名フリガナを入力してください")
    .regex(/^[ァ-ヶー\s]+$/, "職員名フリガナはカタカナのみ使用できます"),
  floor: z.enum(["全階", "1階", "2階", "3階"]),
  jobRole: z.enum(["全体", "介護", "施設看護", "訪問看護"]),
  authority: z.enum(["システム管理者", "管理者", "準管理者", "職員"]),
  status: z.enum(["ロック", "ロック解除"]).default("ロック"),
  sortOrder: z.coerce.number().int().default(0),
  password: z.string().min(6, "パスワードは6文字以上で入力してください")
    .regex(/^[a-zA-Z0-9]+$/, "パスワードは英数字のみ使用できます").optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, lastModifiedAt: true });

// Update schema - パスワードフィールドを除外（編集時は別機能で管理）
// idはフォームではなくAPIレベルで処理するため除外
export const updateStaffManagementSchema = insertStaffManagementSchema
  .omit({ password: true })
  .partial();

// API用の更新スキーマ（idを含む）
export const updateStaffManagementApiSchema = updateStaffManagementSchema.extend({
  id: z.string(),
});

export type StaffManagement = typeof staffManagement.$inferSelect;
export type InsertStaffManagement = z.infer<typeof insertStaffManagementSchema>;
export type UpdateStaffManagement = z.infer<typeof updateStaffManagementSchema>;
export type UpdateStaffManagementApi = z.infer<typeof updateStaffManagementApiSchema>;

// Journal Entries table (日誌エントリテーブル)
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  recordDate: date("record_date").notNull(), // 記録日
  recordType: varchar("record_type").notNull(), // 種別（日中/夜間/看護）
  enteredBy: varchar("entered_by"), // 記入者（NULL可能）
  residentCount: integer("resident_count").notNull().default(0), // 入居者数
  hospitalizedCount: integer("hospitalized_count").notNull().default(0), // 入院者数
  floor: varchar("floor"), // 階数
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by"), // 作成者ID
});

// Resident Attachments table
export const residentAttachments = pgTable("resident_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  residentId: varchar("resident_id").notNull().references(() => residents.id),
  fileName: varchar("file_name").notNull(), // 元のファイル名
  filePath: varchar("file_path").notNull(), // サーバー上のファイルパス
  fileSize: integer("file_size").notNull(), // ファイルサイズ（バイト）
  mimeType: varchar("mime_type").notNull(), // ファイルタイプ
  uploadedBy: varchar("uploaded_by").notNull().references(() => staffManagement.id), // アップロードした職員
  description: text("description"), // ファイルの説明
  createdAt: timestamp("created_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))),
});

// Journal Entries insert schema
export const insertJournalEntrySchema = createInsertSchema(journalEntries, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([z.string(), z.date()]).transform((val) => {
    // データベースはdate型なので、Date objectのままにする
    // ただし、stringの場合は有効なDateオブジェクトに変換
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  recordType: z.enum(["日中", "夜間", "看護"], { message: "有効な種別を選択してください" }),
  enteredBy: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === "" || val === undefined) return null;
    return val;
  }),
  residentCount: z.coerce.number().int().min(0).default(0),
  hospitalizedCount: z.coerce.number().int().min(0).default(0),
  floor: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Journal Entries types
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;

// Resident Attachments insert schema
export const insertResidentAttachmentSchema = createInsertSchema(residentAttachments, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  fileName: z.string().min(1, "ファイル名は必須です"),
  filePath: z.string().min(1, "ファイルパスは必須です"),
  fileSize: z.coerce.number().int().min(1, "ファイルサイズは必須です"),
  mimeType: z.string().min(1, "ファイルタイプは必須です"),
  uploadedBy: z.string().min(1, "アップロードユーザーは必須です"),
  description: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type ResidentAttachment = typeof residentAttachments.$inferSelect;
export type InsertResidentAttachment = z.infer<typeof insertResidentAttachmentSchema>;


// サブドメイン名として使用不可の予約語リスト
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog',
  'test', 'dev', 'staging', 'prod', 'production',
  'support', 'help', 'docs', 'status', 'security',
  'assets', 'static', 'cdn', 'media', 'files',
  'login', 'logout', 'signin', 'signup', 'register',
  'dashboard', 'portal', 'console', 'manage'
];

// Tenant insert schema
export const insertTenantSchema = createInsertSchema(tenants, {
  tenantId: z.string()
    .min(3, "テナントIDは3文字以上で入力してください")
    .max(20, "テナントIDは20文字以下で入力してください")
    .regex(/^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$/, "テナントIDは英小文字・数字・ハイフンのみ使用可能で、ハイフンで開始・終了はできません")
    .refine((val) => !RESERVED_SUBDOMAINS.includes(val.toLowerCase()), "このテナントIDは予約語のため使用できません")
    .transform((val) => val.toLowerCase()),
  tenantName: z.string().min(1, "テナント名を入力してください"),
  status: z.enum(["有効", "無効"]).default("有効"),
}).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true });

// Update schema（テナントIDの変更を禁止）
export const updateTenantSchema = insertTenantSchema.partial().omit({ tenantId: true });

// API用の更新スキーマ（idを含む）
export const updateTenantApiSchema = updateTenantSchema.extend({
  id: z.string(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;
export type UpdateTenantApi = z.infer<typeof updateTenantApiSchema>;

// Journal Checkboxes table (日誌チェック状態管理)
export const journalCheckboxes = pgTable("journal_checkboxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.tenantId),
  recordDate: date("record_date").notNull(), // 記録日
  recordId: varchar("record_id").notNull(), // 記録ID（care_records, nursing_records, etc.の各ID）
  recordType: varchar("record_type").notNull(), // 記録タイプ（care_records, nursing_records, etc.）
  checkboxType: varchar("checkbox_type").notNull(), // チェックタイプ（日中、夜間、看護）
  isChecked: boolean("is_checked").notNull().default(false), // チェック状態
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Journal Checkboxes insert schema
export const insertJournalCheckboxSchema = createInsertSchema(journalCheckboxes, {
  tenantId: z.string().min(1, "テナントIDは必須です").optional(),
  recordDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  recordId: z.string().min(1, "記録IDは必須です"),
  recordType: z.string().min(1, "記録タイプは必須です"),
  checkboxType: z.enum(["日中", "夜間", "看護"], { message: "有効なチェックタイプを選択してください" }),
  isChecked: z.boolean(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type JournalCheckbox = typeof journalCheckboxes.$inferSelect;
export type InsertJournalCheckbox = z.infer<typeof insertJournalCheckboxSchema>;

// パスワード変更用スキーマ
export const changePasswordSchema = z.object({
  newPassword: z.string().min(4, "パスワードは4文字以上で入力してください"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
