const MOCK = process.env.THYROCARE_MOCK !== "false";

export interface ThyrocareOrderInput {
  packageCode: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientPhone: string;
  slotDate: string;
  slotTime: string;
  collectionType: "home" | "centre";
}

export interface ThyrocareOrder {
  orderId: string;
  status: string;
  message: string;
}

export interface ThyrocareReportParam {
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  section: string;
}

export async function createOrder(input: ThyrocareOrderInput): Promise<ThyrocareOrder> {
  if (MOCK) {
    await delay(80);
    return {
      orderId: `THYRO-${Date.now().toString(36).toUpperCase()}`,
      status: "booked",
      message: "Order placed successfully (mock)",
    };
  }
  throw new Error("Thyrocare live mode not implemented");
}

export async function getStatus(orderId: string): Promise<{ status: string }> {
  if (MOCK) {
    await delay(40);
    return { status: "booked" };
  }
  throw new Error("Thyrocare live mode not implemented");
}

export async function fetchReport(orderId: string): Promise<{ parameters: ThyrocareReportParam[] }> {
  if (MOCK) {
    await delay(60);
    return {
      parameters: [
        { name: "TSH", value: 6.8, unit: "mIU/L", refLow: 0.4, refHigh: 4.0, section: "Thyroid" },
        { name: "T3 (Total)", value: 1.2, unit: "ng/mL", refLow: 0.8, refHigh: 2.0, section: "Thyroid" },
        { name: "T4 (Total)", value: 8.3, unit: "μg/dL", refLow: 5.1, refHigh: 14.1, section: "Thyroid" },
        { name: "Vitamin D (25-OH)", value: 14.2, unit: "ng/mL", refLow: 30, refHigh: 100, section: "Vitamins" },
        { name: "Vitamin B12", value: 310, unit: "pg/mL", refLow: 200, refHigh: 900, section: "Vitamins" },
        { name: "Haemoglobin", value: 13.8, unit: "g/dL", refLow: 12.0, refHigh: 17.5, section: "CBC" },
        { name: "WBC Count", value: 7200, unit: "cells/μL", refLow: 4000, refHigh: 11000, section: "CBC" },
        { name: "Platelet Count", value: 185000, unit: "cells/μL", refLow: 150000, refHigh: 400000, section: "CBC" },
      ],
    };
  }
  throw new Error("Thyrocare live mode not implemented");
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
