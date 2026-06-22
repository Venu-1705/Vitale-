import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { users } from "./identity";

// Immutable-create helper (no updatedAt; rows never mutate after insert)
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// =============================================================================
// D11 — Lab Domain (new conventions: UUID PKs, users FK, RLS-ready)
// =============================================================================

// lab_packages — catalog of test packages offered by lab vendors [C]
export const labPackages = pgTable(
  "lab_packages",
  {
    id: pkV7(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    testsCount: integer("tests_count").notNull().default(0),
    pricePaise: integer("price_paise").notNull(),
    mrpPaise: integer("mrp_paise").notNull(),
    turnaroundDays: integer("turnaround_days").notNull().default(2),
    isActive: boolean("is_active").notNull().default(true),
    imageUrl: text("image_url"),
    popular: boolean("popular").notNull().default(false),
    sampleType: text("sample_type").notNull().default("Blood"),
    fastingRequired: boolean("fasting_required").notNull().default(false),
    whyThisTest: text("why_this_test"),
    recommendedFor: jsonb("recommended_for").$type<string[]>().notNull().default([]),
    niche: text("niche"),
    color: text("color").notNull().default("#2563EB"),
    thyrocareCode: text("thyrocare_code"),
    testNames: jsonb("test_names").$type<string[]>().notNull().default([]),
    ...createdAtOnly,
  },
);

// lab_tests — individual tests within a package [C]
export const labTests = pgTable(
  "lab_tests",
  {
    id: pkV7(),
    packageId: uuid("package_id").references(() => labPackages.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    unit: text("unit"),
    referenceRangeLow: real("reference_range_low"),
    referenceRangeHigh: real("reference_range_high"),
    description: text("description"),
    section: text("section"),
    ...createdAtOnly,
  },
  (t) => [index("lab_tests_package_idx").on(t.packageId)],
);

// lab_bookings — user's booking of a lab package [C]
export const labBookings = pgTable(
  "lab_bookings",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    packageId: uuid("package_id").notNull().references(() => labPackages.id),
    addressId: uuid("address_id"), // FK to addresses once commerce migrated
    status: text("status").notNull().default("pending"),
    slotDate: text("slot_date").notNull(),
    slotTime: text("slot_time").notNull(),
    collectionType: text("collection_type").notNull().default("home"),
    patientName: text("patient_name"),
    patientAge: integer("patient_age"),
    patientGender: text("patient_gender"),
    patientPhone: text("patient_phone"),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    amountPaise: integer("amount_paise").notNull().default(0),
    thyrocareOrderId: text("thyrocare_order_id"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("lab_bookings_user_idx").on(t.userId)],
);

// lab_reports — delivered report for a booking [B immutable after delivery]
export const labReports = pgTable(
  "lab_reports",
  {
    id: pkV7(),
    bookingId: uuid("booking_id").references(() => labBookings.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    reportDate: timestamp("report_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("ready"),
    abnormalCount: integer("abnormal_count").notNull().default(0),
    packageName: text("package_name"),
    thyrocareReportId: text("thyrocare_report_id"),
    ...createdAtOnly,
  },
  (t) => [index("lab_reports_user_idx").on(t.userId)],
);

// lab_report_results — individual result rows within a report [B immutable]
export const labReportResults = pgTable(
  "lab_report_results",
  {
    id: pkV7(),
    reportId: uuid("report_id").notNull().references(() => labReports.id, { onDelete: "cascade" }),
    testId: uuid("test_id").references(() => labTests.id),
    testName: text("test_name").notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    referenceRangeLow: real("reference_range_low"),
    referenceRangeHigh: real("reference_range_high"),
    isAbnormal: boolean("is_abnormal").notNull().default(false),
    flag: text("flag").notNull().default("normal"),
    section: text("section").notNull().default("General"),
    ...createdAtOnly,
  },
  (t) => [index("lab_results_report_idx").on(t.reportId)],
);

// coach_lab_recommendations — coach recommends a package to a patient [C]
export const coachLabRecommendations = pgTable(
  "coach_lab_recommendations",
  {
    id: pkV7(),
    coachId: uuid("coach_id").notNull().references(() => users.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    packageId: uuid("package_id").notNull().references(() => labPackages.id),
    note: text("note"),
    ...createdAtOnly,
  },
  (t) => [index("coach_lab_rec_user_idx").on(t.userId)],
);

// =============================================================================
// Validators
// =============================================================================
export const insertLabPackageSchema        = createInsertSchema(labPackages);
export const selectLabPackageSchema        = createSelectSchema(labPackages);
export const insertLabTestSchema           = createInsertSchema(labTests);
export const selectLabTestSchema           = createSelectSchema(labTests);
export const insertLabBookingSchema        = createInsertSchema(labBookings);
export const selectLabBookingSchema        = createSelectSchema(labBookings);
export const insertLabReportSchema         = createInsertSchema(labReports);
export const selectLabReportSchema         = createSelectSchema(labReports);
export const insertLabReportResultSchema   = createInsertSchema(labReportResults);
export const selectLabReportResultSchema   = createSelectSchema(labReportResults);
export const insertCoachLabRecSchema       = createInsertSchema(coachLabRecommendations);
export const selectCoachLabRecSchema       = createSelectSchema(coachLabRecommendations);
