// ─── Types ────────────────────────────────────────────────────────────────────

export type DietStatus = 'Active' | 'Draft' | 'Needs Update' | 'Archived';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS: Record<DayKey, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const DAY_SHORT: Record<DayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export type UnitType = 'g' | 'ml' | 'cups' | 'pcs' | 'tbsp' | 'tsp' | 'bowl' | 'plate' | 'glass' | 'handful' | 'katori';
export const UNITS: UnitType[] = ['g', 'ml', 'cups', 'pcs', 'tbsp', 'tsp', 'bowl', 'plate', 'glass', 'handful', 'katori'];

// Approximate grams per unit for nutritional conversion
export const UNIT_TO_GRAMS: Record<UnitType, number> = {
  g: 1, ml: 1, cups: 200, pcs: 50, tbsp: 15, tsp: 5,
  bowl: 200, plate: 300, glass: 240, handful: 30, katori: 150,
};

// ─── Food Database ─────────────────────────────────────────────────────────────
// All nutritional values per 100g / 100ml

export interface FoodEntry {
  id: string;
  name: string;
  nameHi?: string; // Hindi name
  category: string;
  calories: number;
  protein: number; // g
  carbs: number;   // g
  fat: number;     // g
  fiber: number;   // g
  defaultUnit: UnitType;
  defaultQty: number;
  // Micro-nutrients per 100g (mg unless noted)
  iron?: number;      // mg
  calcium?: number;   // mg
  vitaminD?: number;  // IU
  vitaminB12?: number; // mcg
  sodium?: number;    // mg
  isAllergen?: string; // e.g. 'nuts', 'dairy', 'gluten', 'eggs'
  notes?: string;
}

export const FOOD_DB: FoodEntry[] = [
  // ── Grains & Cereals ──
  { id: 'f001', name: 'Roti (Wheat Chapati)', nameHi: 'गेहूँ की रोटी', category: 'Grains', calories: 297, protein: 10.6, carbs: 56.7, fat: 4.1, fiber: 1.9, defaultUnit: 'pcs', defaultQty: 2, iron: 2.7, calcium: 30, sodium: 5 },
  { id: 'f002', name: 'Steamed White Rice', nameHi: 'उबला चावल', category: 'Grains', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, defaultUnit: 'katori', defaultQty: 1, iron: 0.2, calcium: 3, sodium: 1 },
  { id: 'f003', name: 'Brown Rice', category: 'Grains', calories: 150, protein: 3.2, carbs: 31, fat: 1.1, fiber: 1.8, defaultUnit: 'katori', defaultQty: 1, iron: 0.5, calcium: 10, sodium: 1 },
  { id: 'f004', name: 'Dosa', nameHi: 'डोसा', category: 'Grains', calories: 168, protein: 3.5, carbs: 29, fat: 4.5, fiber: 1.2, defaultUnit: 'pcs', defaultQty: 2, iron: 0.6, calcium: 8, sodium: 150 },
  { id: 'f005', name: 'Idli', nameHi: 'इडली', category: 'Grains', calories: 58, protein: 2.0, carbs: 12, fat: 0.5, fiber: 0.8, defaultUnit: 'pcs', defaultQty: 3, iron: 0.4, calcium: 4, sodium: 80 },
  { id: 'f006', name: 'Upma', nameHi: 'उपमा', category: 'Grains', calories: 135, protein: 4.2, carbs: 23, fat: 4.1, fiber: 1.6, defaultUnit: 'bowl', defaultQty: 1, iron: 1.0, calcium: 10, sodium: 280 },
  { id: 'f007', name: 'Poha (Flattened Rice)', nameHi: 'पोहा', category: 'Grains', calories: 118, protein: 3.5, carbs: 24, fat: 1.5, fiber: 0.8, defaultUnit: 'bowl', defaultQty: 1, iron: 1.2, calcium: 5, sodium: 200 },
  { id: 'f008', name: 'Oats (Rolled)', category: 'Grains', calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, defaultUnit: 'g', defaultQty: 50, iron: 4.7, calcium: 52, sodium: 2 },
  { id: 'f009', name: 'Millet (Bajra) Roti', category: 'Grains', calories: 361, protein: 10.6, carbs: 67, fat: 5.0, fiber: 1.2, defaultUnit: 'pcs', defaultQty: 2, iron: 8.0, calcium: 42, sodium: 3 },
  { id: 'f010', name: 'Khichdi (Moong Dal + Rice)', nameHi: 'खिचड़ी', category: 'Grains', calories: 110, protein: 4.8, carbs: 19, fat: 1.2, fiber: 1.5, defaultUnit: 'bowl', defaultQty: 1, iron: 1.5, calcium: 15, sodium: 220 },
  { id: 'f011', name: 'Wheat Bran', category: 'Grains', calories: 216, protein: 15.6, carbs: 65, fat: 4.3, fiber: 42.8, defaultUnit: 'tbsp', defaultQty: 2, iron: 10.6, calcium: 73, sodium: 2 },
  { id: 'f012', name: 'Quinoa (Cooked)', category: 'Grains', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8, defaultUnit: 'katori', defaultQty: 1, iron: 1.5, calcium: 17, sodium: 7 },

  // ── Dals & Legumes ──
  { id: 'f013', name: 'Moong Dal (Cooked)', nameHi: 'मूंग दाल', category: 'Dals & Legumes', calories: 105, protein: 7.0, carbs: 17, fat: 0.4, fiber: 4.5, defaultUnit: 'katori', defaultQty: 1, iron: 1.8, calcium: 25, sodium: 15 },
  { id: 'f014', name: 'Masoor Dal (Cooked)', nameHi: 'मसूर दाल', category: 'Dals & Legumes', calories: 116, protein: 9.0, carbs: 19, fat: 0.4, fiber: 7.9, defaultUnit: 'katori', defaultQty: 1, iron: 3.3, calcium: 19, sodium: 10 },
  { id: 'f015', name: 'Toor Dal (Cooked)', nameHi: 'तूर दाल', category: 'Dals & Legumes', calories: 118, protein: 7.2, carbs: 20, fat: 0.4, fiber: 5.0, defaultUnit: 'katori', defaultQty: 1, iron: 1.6, calcium: 30, sodium: 12 },
  { id: 'f016', name: 'Chana Dal (Cooked)', nameHi: 'चना दाल', category: 'Dals & Legumes', calories: 164, protein: 8.9, carbs: 27, fat: 2.7, fiber: 7.6, defaultUnit: 'katori', defaultQty: 1, iron: 2.9, calcium: 42, sodium: 8 },
  { id: 'f017', name: 'Rajma (Cooked)', nameHi: 'राजमा', category: 'Dals & Legumes', calories: 127, protein: 8.7, carbs: 22.8, fat: 0.5, fiber: 6.4, defaultUnit: 'katori', defaultQty: 1, iron: 2.9, calcium: 50, sodium: 5 },
  { id: 'f018', name: 'Chole (Cooked Chickpeas)', nameHi: 'छोले', category: 'Dals & Legumes', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, defaultUnit: 'katori', defaultQty: 1, iron: 2.9, calcium: 49, sodium: 6 },
  { id: 'f019', name: 'Mixed Sprouts', category: 'Dals & Legumes', calories: 100, protein: 8.0, carbs: 16, fat: 0.5, fiber: 4.5, defaultUnit: 'katori', defaultQty: 1, iron: 2.0, calcium: 30, sodium: 5 },

  // ── Vegetables ──
  { id: 'f020', name: 'Palak (Spinach)', nameHi: 'पालक', category: 'Vegetables', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, defaultUnit: 'bowl', defaultQty: 1, iron: 2.7, calcium: 99, vitaminD: 0, sodium: 79 },
  { id: 'f021', name: 'Gobi (Cauliflower)', nameHi: 'गोभी', category: 'Vegetables', calories: 25, protein: 1.9, carbs: 5.0, fat: 0.3, fiber: 2.0, defaultUnit: 'bowl', defaultQty: 1, iron: 0.4, calcium: 22, sodium: 30 },
  { id: 'f022', name: 'Bhindi (Okra)', nameHi: 'भिंडी', category: 'Vegetables', calories: 33, protein: 1.9, carbs: 7.5, fat: 0.2, fiber: 3.2, defaultUnit: 'bowl', defaultQty: 1, iron: 0.5, calcium: 81, sodium: 8 },
  { id: 'f023', name: 'Lauki (Bottle Gourd)', nameHi: 'लौकी', category: 'Vegetables', calories: 14, protein: 0.6, carbs: 3.4, fat: 0.02, fiber: 0.5, defaultUnit: 'bowl', defaultQty: 1, iron: 0.2, calcium: 26, sodium: 2 },
  { id: 'f024', name: 'Methi (Fenugreek Leaves)', nameHi: 'मेथी', category: 'Vegetables', calories: 49, protein: 4.4, carbs: 6.0, fat: 0.9, fiber: 2.3, defaultUnit: 'bowl', defaultQty: 1, iron: 1.9, calcium: 395, sodium: 12 },
  { id: 'f025', name: 'Cucumber', nameHi: 'खीरा', category: 'Vegetables', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, defaultUnit: 'bowl', defaultQty: 1, iron: 0.3, calcium: 16, sodium: 2 },
  { id: 'f026', name: 'Tomato', nameHi: 'टमाटर', category: 'Vegetables', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, defaultUnit: 'pcs', defaultQty: 1, iron: 0.3, calcium: 10, sodium: 5 },
  { id: 'f027', name: 'Broccoli', category: 'Vegetables', calories: 34, protein: 2.8, carbs: 7.0, fat: 0.4, fiber: 2.6, defaultUnit: 'bowl', defaultQty: 1, iron: 0.7, calcium: 47, vitaminD: 0, sodium: 33 },
  { id: 'f028', name: 'Mixed Green Salad', category: 'Vegetables', calories: 15, protein: 1.5, carbs: 2.5, fat: 0.2, fiber: 1.8, defaultUnit: 'plate', defaultQty: 1, iron: 0.8, calcium: 30, sodium: 10 },
  { id: 'f029', name: 'Beetroot', nameHi: 'चुकंदर', category: 'Vegetables', calories: 43, protein: 1.6, carbs: 10, fat: 0.2, fiber: 2.8, defaultUnit: 'pcs', defaultQty: 1, iron: 0.8, calcium: 16, sodium: 78 },

  // ── Dairy & Eggs ──
  { id: 'f030', name: 'Dahi (Curd)', nameHi: 'दही', category: 'Dairy', calories: 61, protein: 3.1, carbs: 4.7, fat: 3.4, fiber: 0, defaultUnit: 'katori', defaultQty: 1, iron: 0.1, calcium: 110, vitaminB12: 0.4, sodium: 46, isAllergen: 'dairy' },
  { id: 'f031', name: 'Low-Fat Curd', category: 'Dairy', calories: 36, protein: 3.5, carbs: 5.1, fat: 0.4, fiber: 0, defaultUnit: 'katori', defaultQty: 1, iron: 0.1, calcium: 120, vitaminB12: 0.3, sodium: 50, isAllergen: 'dairy' },
  { id: 'f032', name: 'Paneer', nameHi: 'पनीर', category: 'Dairy', calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, fiber: 0, defaultUnit: 'g', defaultQty: 100, iron: 0.4, calcium: 490, vitaminD: 0, sodium: 50, isAllergen: 'dairy' },
  { id: 'f033', name: 'Skimmed Milk', nameHi: 'टोंड दूध', category: 'Dairy', calories: 34, protein: 3.4, carbs: 5.0, fat: 0.1, fiber: 0, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 124, vitaminD: 40, vitaminB12: 0.5, sodium: 52, isAllergen: 'dairy' },
  { id: 'f034', name: 'Full-Fat Milk', nameHi: 'फुल क्रीम दूध', category: 'Dairy', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 113, vitaminB12: 0.4, sodium: 43, isAllergen: 'dairy' },
  { id: 'f035', name: 'Boiled Egg', category: 'Eggs', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, defaultUnit: 'pcs', defaultQty: 1, iron: 1.2, calcium: 50, vitaminD: 87, vitaminB12: 1.1, sodium: 124, isAllergen: 'eggs' },
  { id: 'f036', name: 'Egg White (Boiled)', category: 'Eggs', calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, defaultUnit: 'pcs', defaultQty: 2, iron: 0.1, calcium: 7, sodium: 166, isAllergen: 'eggs' },
  { id: 'f037', name: 'Scrambled Eggs', category: 'Eggs', calories: 148, protein: 10, carbs: 1.6, fat: 11, fiber: 0, defaultUnit: 'pcs', defaultQty: 2, iron: 1.2, calcium: 57, vitaminB12: 0.9, sodium: 140, isAllergen: 'eggs' },
  { id: 'f038', name: 'Raita (Curd with Veggies)', nameHi: 'रायता', category: 'Dairy', calories: 45, protein: 2.5, carbs: 4.5, fat: 1.8, fiber: 0.5, defaultUnit: 'katori', defaultQty: 1, iron: 0.2, calcium: 90, sodium: 60, isAllergen: 'dairy' },
  { id: 'f039', name: 'Buttermilk (Chaas)', nameHi: 'छाछ', category: 'Dairy', calories: 22, protein: 1.0, carbs: 2.5, fat: 0.5, fiber: 0, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 45, sodium: 115, isAllergen: 'dairy' },

  // ── Non-Vegetarian ──
  { id: 'f040', name: 'Chicken Breast (Grilled)', category: 'Non-Veg', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, defaultUnit: 'g', defaultQty: 150, iron: 1.0, calcium: 15, vitaminB12: 0.3, sodium: 74 },
  { id: 'f041', name: 'Chicken (Curry)', nameHi: 'चिकन करी', category: 'Non-Veg', calories: 190, protein: 22, carbs: 5, fat: 9, fiber: 0.5, defaultUnit: 'bowl', defaultQty: 1, iron: 1.5, calcium: 20, sodium: 480 },
  { id: 'f042', name: 'Fish (Rohu, Grilled)', nameHi: 'मछली', category: 'Non-Veg', calories: 95, protein: 18, carbs: 0, fat: 2.2, fiber: 0, defaultUnit: 'g', defaultQty: 150, iron: 0.9, calcium: 29, vitaminD: 100, vitaminB12: 2.0, sodium: 57 },
  { id: 'f043', name: 'Salmon (Baked)', category: 'Non-Veg', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, defaultUnit: 'g', defaultQty: 100, iron: 0.3, calcium: 9, vitaminD: 360, vitaminB12: 3.2, sodium: 59 },
  { id: 'f044', name: 'Mutton Keema (Cooked)', nameHi: 'मटन कीमा', category: 'Non-Veg', calories: 246, protein: 25, carbs: 2, fat: 15, fiber: 0, defaultUnit: 'bowl', defaultQty: 0.5, iron: 2.7, calcium: 18, vitaminB12: 2.5, sodium: 350 },
  { id: 'f045', name: 'Tuna (Canned)', category: 'Non-Veg', calories: 132, protein: 29, carbs: 0, fat: 1.0, fiber: 0, defaultUnit: 'g', defaultQty: 100, iron: 1.3, calcium: 10, vitaminD: 40, vitaminB12: 2.5, sodium: 396 },

  // ── Fruits ──
  { id: 'f046', name: 'Banana', nameHi: 'केला', category: 'Fruits', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, defaultUnit: 'pcs', defaultQty: 1, iron: 0.3, calcium: 5, sodium: 1 },
  { id: 'f047', name: 'Apple', category: 'Fruits', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, defaultUnit: 'pcs', defaultQty: 1, iron: 0.1, calcium: 6, sodium: 1 },
  { id: 'f048', name: 'Mixed Fruit Plate', category: 'Fruits', calories: 70, protein: 1.0, carbs: 17, fat: 0.3, fiber: 2.0, defaultUnit: 'plate', defaultQty: 1, iron: 0.5, calcium: 20, sodium: 5 },
  { id: 'f049', name: 'Guava', nameHi: 'अमरूद', category: 'Fruits', calories: 68, protein: 2.6, carbs: 14, fat: 1.0, fiber: 5.4, defaultUnit: 'pcs', defaultQty: 1, iron: 0.3, calcium: 18, sodium: 2 },
  { id: 'f050', name: 'Papaya', nameHi: 'पपीता', category: 'Fruits', calories: 43, protein: 0.5, carbs: 11, fat: 0.3, fiber: 1.7, defaultUnit: 'bowl', defaultQty: 1, iron: 0.3, calcium: 20, sodium: 8 },

  // ── Snacks & Nuts ──
  { id: 'f051', name: 'Makhana (Lotus Seeds)', category: 'Snacks', calories: 347, protein: 9.7, carbs: 77, fat: 0.1, fiber: 0.2, defaultUnit: 'g', defaultQty: 30, iron: 1.4, calcium: 60, sodium: 17 },
  { id: 'f052', name: 'Roasted Chana', nameHi: 'भुना चना', category: 'Snacks', calories: 380, protein: 22, carbs: 57, fat: 6.0, fiber: 17, defaultUnit: 'g', defaultQty: 30, iron: 4.3, calcium: 93, sodium: 64 },
  { id: 'f053', name: 'Almonds', nameHi: 'बादाम', category: 'Nuts', calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, defaultUnit: 'pcs', defaultQty: 8, iron: 3.7, calcium: 264, sodium: 1, isAllergen: 'nuts' },
  { id: 'f054', name: 'Walnuts', category: 'Nuts', calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, defaultUnit: 'pcs', defaultQty: 4, iron: 2.9, calcium: 98, sodium: 2, isAllergen: 'nuts' },
  { id: 'f055', name: 'Peanuts (Roasted)', nameHi: 'मूंगफली', category: 'Nuts', calories: 585, protein: 25, carbs: 16, fat: 49, fiber: 8.5, defaultUnit: 'g', defaultQty: 30, iron: 2.3, calcium: 92, sodium: 380, isAllergen: 'nuts' },
  { id: 'f056', name: 'Sprouts Chaat', category: 'Snacks', calories: 78, protein: 6.0, carbs: 12, fat: 0.5, fiber: 3.5, defaultUnit: 'bowl', defaultQty: 1, iron: 1.8, calcium: 28, sodium: 180 },
  { id: 'f057', name: 'Coconut Water', nameHi: 'नारियल पानी', category: 'Beverages', calories: 19, protein: 0.7, carbs: 3.7, fat: 0.2, fiber: 1.1, defaultUnit: 'glass', defaultQty: 1, iron: 0.3, calcium: 24, sodium: 105 },
  { id: 'f058', name: 'Green Tea', category: 'Beverages', calories: 2, protein: 0.2, carbs: 0.5, fat: 0, fiber: 0, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 0, sodium: 1 },
  { id: 'f059', name: 'Black Coffee', category: 'Beverages', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 5, sodium: 5 },
  { id: 'f060', name: 'Lemon Water', category: 'Beverages', calories: 10, protein: 0.2, carbs: 2.5, fat: 0, fiber: 0.3, defaultUnit: 'glass', defaultQty: 1, iron: 0.1, calcium: 5, sodium: 2 },
  { id: 'f061', name: 'Whey Protein Shake', category: 'Supplements', calories: 120, protein: 24, carbs: 5, fat: 1.5, fiber: 0, defaultUnit: 'g', defaultQty: 30, iron: 0.5, calcium: 100, sodium: 130, isAllergen: 'dairy' },
  { id: 'f062', name: 'Ghee', nameHi: 'घी', category: 'Fats & Oils', calories: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, defaultUnit: 'tsp', defaultQty: 1, iron: 0, calcium: 1, sodium: 2, isAllergen: 'dairy' },
  { id: 'f063', name: 'Peanut Butter', category: 'Fats & Oils', calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, defaultUnit: 'tbsp', defaultQty: 1, iron: 1.9, calcium: 49, sodium: 417, isAllergen: 'nuts' },
];

// ─── Meal Slot Defaults ───────────────────────────────────────────────────────

export interface MealSlotDef {
  id: string;
  name: string;
  time: string;
}

export const DEFAULT_MEAL_SLOTS: MealSlotDef[] = [
  { id: 'slot1', name: 'Early Morning', time: '6:00 AM – 7:00 AM' },
  { id: 'slot2', name: 'Breakfast', time: '8:00 AM – 9:00 AM' },
  { id: 'slot3', name: 'Mid-Morning Snack', time: '10:30 AM – 11:00 AM' },
  { id: 'slot4', name: 'Lunch', time: '1:00 PM – 2:00 PM' },
  { id: 'slot5', name: 'Evening Snack', time: '4:30 PM – 5:00 PM' },
  { id: 'slot6', name: 'Dinner', time: '7:30 PM – 8:30 PM' },
];

// ─── Diet Chart Types ─────────────────────────────────────────────────────────

export interface MealItem {
  id: string;
  foodId: string;
  foodName: string;
  qty: number;
  unit: UnitType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  customCalories?: boolean; // true if manually overridden
}

export interface Alternative {
  id: string;
  original: string;
  substitutes: string[];
}

export interface MealSlot {
  id: string;
  name: string;
  time: string;
  items: MealItem[];
  prepNotes: string;
  alternatives: Alternative[];
  specialInstructions: string[];
}

export interface DayPlan {
  slots: MealSlot[];
  water: string;
  supplements: string[];
}

export type WeekPlan = Record<DayKey, DayPlan>;

export interface DietChart {
  id: string;
  clientId: string;
  clientName: string;
  clientAge: number;
  clientGender: 'Male' | 'Female';
  clientHeight: number; // cm
  clientWeight: number; // kg
  clientGoal: string;
  clientAllergies: string[];
  clientConditions: string[];
  clientDiet: 'Vegetarian' | 'Non-Vegetarian' | 'Vegan' | 'Eggetarian';
  programId: string;
  programName: string;
  title: string;
  version: number;
  status: DietStatus;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  validFrom: string;
  validTo: string;
  notes: string;
  internalNotes: string;
  createdBy: string;
  createdByInitials: string;
  createdAt: string;
  updatedAt: string;
  weekPlan: WeekPlan;
}

// ─── Helper: calculate macros from food + qty + unit ─────────────────────────

export function calcMacros(food: FoodEntry, qty: number, unit: UnitType) {
  const grams = qty * UNIT_TO_GRAMS[unit];
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}

export function slotTotals(slot: MealSlot) {
  return slot.items.reduce((acc, item) => ({
    calories: acc.calories + item.calories,
    protein: Math.round((acc.protein + item.protein) * 10) / 10,
    carbs: Math.round((acc.carbs + item.carbs) * 10) / 10,
    fat: Math.round((acc.fat + item.fat) * 10) / 10,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function dayTotals(plan: DayPlan) {
  return plan.slots.reduce((acc, slot) => {
    const t = slotTotals(slot);
    return {
      calories: acc.calories + t.calories,
      protein: Math.round((acc.protein + t.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + t.carbs) * 10) / 10,
      fat: Math.round((acc.fat + t.fat) * 10) / 10,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── Helper: build a meal item from a food + optional overrides ───────────────

let itemIdCounter = 100;
export function makeMealItem(food: FoodEntry, qty?: number, unit?: UnitType): MealItem {
  const q = qty ?? food.defaultQty;
  const u = unit ?? food.defaultUnit;
  const macros = calcMacros(food, q, u);
  return {
    id: `mi-${++itemIdCounter}`,
    foodId: food.id,
    foodName: food.name,
    qty: q,
    unit: u,
    ...macros,
  };
}

// ─── Helper: build an empty day plan ─────────────────────────────────────────

export function makeEmptyDayPlan(): DayPlan {
  return {
    slots: DEFAULT_MEAL_SLOTS.map(s => ({
      id: s.id,
      name: s.name,
      time: s.time,
      items: [],
      prepNotes: '',
      alternatives: [],
      specialInstructions: [],
    })),
    water: '3L',
    supplements: [],
  };
}

// ─── Mock Week Plans ─────────────────────────────────────────────────────────

function findFood(id: string): FoodEntry {
  return FOOD_DB.find(f => f.id === id) || FOOD_DB[0];
}

function buildSlot(def: MealSlotDef, foods: Array<[string, number?, UnitType?]>, notes?: string): MealSlot {
  return {
    ...def,
    items: foods.map(([id, qty, unit]) => makeMealItem(findFood(id), qty, unit)),
    prepNotes: notes || '',
    alternatives: [],
    specialInstructions: [],
  };
}

function buildWeekPlan(createDayFn: (day: DayKey) => DayPlan): WeekPlan {
  return Object.fromEntries(DAY_KEYS.map(d => [d, createDayFn(d)])) as WeekPlan;
}

// Transform 90 — Weight Loss (1800 kcal/day, Non-Veg days vary)
const transform90WeekPlan = buildWeekPlan(day => ({
  slots: [
    buildSlot(DEFAULT_MEAL_SLOTS[0], [['f060', 1, 'glass'], ['f053', 8, 'pcs']], 'Have lemon water at room temperature. Follow with almonds 10 minutes after.'),
    buildSlot(DEFAULT_MEAL_SLOTS[1], [['f007', 1, 'bowl'], ['f035', 2, 'pcs'], ['f031', 1, 'katori']], 'Cook poha with 1 tsp olive oil, mustard seeds, and curry leaves.'),
    buildSlot(DEFAULT_MEAL_SLOTS[2], [['f057', 1, 'glass'], ['f051', 30, 'g']]),
    buildSlot(DEFAULT_MEAL_SLOTS[3],
      day === 'mon' || day === 'wed' || day === 'fri' || day === 'sun'
        ? [['f001', 2, 'pcs'], ['f013', 1, 'katori'], ['f020', 1, 'bowl'], ['f028', 1, 'plate'], ['f038', 1, 'katori']]
        : [['f002', 1, 'katori'], ['f040', 150, 'g'], ['f028', 1, 'plate'], ['f038', 1, 'katori']],
      'Have salad 15 minutes before the main meal. Eat slowly and mindfully.'),
    buildSlot(DEFAULT_MEAL_SLOTS[4], [['f056', 1, 'bowl'], ['f039', 1, 'glass']], 'Sprouts chaat with lemon juice and roasted cumin. No added salt.'),
    buildSlot(DEFAULT_MEAL_SLOTS[5], [['f001', 2, 'pcs'], ['f015', 1, 'katori'], ['f020', 1, 'bowl']], 'Dinner at least 2 hours before bedtime.'),
  ],
  water: '3L',
  supplements: ['Vitamin D3 (60,000 IU weekly)', 'Omega-3 (1000mg)', 'Iron (if menstruating)'],
}));

// PCOS Wellness — 1500 kcal/day Vegetarian, anti-inflammatory
const pcosWeekPlan = buildWeekPlan(_day => ({
  slots: [
    buildSlot(DEFAULT_MEAL_SLOTS[0], [['f058', 1, 'glass'], ['f054', 4, 'pcs']], 'Green tea without sugar. 4 walnuts soaked overnight.'),
    buildSlot(DEFAULT_MEAL_SLOTS[1], [['f008', 50, 'g'], ['f031', 1, 'katori'], ['f049', 1, 'pcs']], 'Cook oats with water not milk. Add 1/2 tsp cinnamon powder (anti-inflammatory).'),
    buildSlot(DEFAULT_MEAL_SLOTS[2], [['f057', 1, 'glass']]),
    buildSlot(DEFAULT_MEAL_SLOTS[3], [['f009', 2, 'pcs'], ['f013', 1, 'katori'], ['f024', 1, 'bowl'], ['f038', 1, 'katori']], 'Bajra roti preferred over wheat — lower GI.'),
    buildSlot(DEFAULT_MEAL_SLOTS[4], [['f052', 30, 'g'], ['f039', 1, 'glass']]),
    buildSlot(DEFAULT_MEAL_SLOTS[5], [['f010', 1, 'bowl'], ['f020', 1, 'bowl']], 'Light khichdi dinner — easy to digest. Avoid heavy dinners.'),
  ],
  water: '2.5L',
  supplements: ['Inositol (2000mg)', 'Vitamin D3 (2000 IU)', 'Omega-3 (1000mg)', 'Magnesium (200mg)'],
}));

// Muscle Building — 2500 kcal, high protein
const muscleWeekPlan = buildWeekPlan(day => ({
  slots: [
    buildSlot(DEFAULT_MEAL_SLOTS[0], [['f060', 1, 'glass'], ['f061', 30, 'g']], 'Protein shake in water immediately after waking up.'),
    buildSlot(DEFAULT_MEAL_SLOTS[1], [['f035', 4, 'pcs'], ['f007', 1, 'bowl'], ['f034', 1, 'glass']], 'High protein breakfast. Eggs can be boiled or scrambled with minimal oil.'),
    buildSlot(DEFAULT_MEAL_SLOTS[2], [['f053', 8, 'pcs'], ['f047', 1, 'pcs']]),
    buildSlot(DEFAULT_MEAL_SLOTS[3], [['f002', 1, 'katori'], ['f040', 200, 'g'], ['f028', 1, 'plate'], ['f016', 1, 'katori']], 'Pre-workout meal if training in afternoon. Eat 90 minutes before workout.'),
    buildSlot(DEFAULT_MEAL_SLOTS[4], [['f061', 30, 'g'], ['f046', 1, 'pcs']], 'Post-workout: protein shake with banana for glycogen replenishment.'),
    buildSlot(DEFAULT_MEAL_SLOTS[5],
      day === 'sat' || day === 'sun'
        ? [['f032', 100, 'g'], ['f001', 3, 'pcs'], ['f017', 1, 'katori']]
        : [['f040', 150, 'g'], ['f003', 1, 'katori'], ['f027', 1, 'bowl']],
      'High protein dinner. Avoid high carbs at night.'),
  ],
  water: '4L',
  supplements: ['Whey Protein (post-workout)', 'Creatine (5g daily)', 'Vitamin D3 (2000 IU)', 'B-Complex'],
}));

// ─── Mock Diet Charts ─────────────────────────────────────────────────────────

export const MOCK_DIET_CHARTS: DietChart[] = [
  {
    id: 'dc-001',
    clientId: 'cl-001',
    clientName: 'Aarav Sharma',
    clientAge: 32,
    clientGender: 'Male',
    clientHeight: 175,
    clientWeight: 88,
    clientGoal: 'Lose 10kg in 12 weeks',
    clientAllergies: [],
    clientConditions: ['Insulin Resistance'],
    clientDiet: 'Non-Vegetarian',
    programId: 'prog-001',
    programName: 'Transform 90',
    title: 'Aarav Sharma — Weight Loss Week 1-4',
    version: 2,
    status: 'Active',
    calorieTarget: 1800,
    proteinTarget: 140,
    carbsTarget: 180,
    fatTarget: 55,
    validFrom: '2026-03-01',
    validTo: '2026-03-28',
    notes: 'Avoid processed sugar entirely. Prefer home-cooked meals. Have small frequent meals.',
    internalNotes: 'Client shows good compliance. Weight dropped 2.1kg in first 2 weeks. Adjust protein up if plateau occurs.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-02-28',
    updatedAt: '2026-03-10',
    weekPlan: transform90WeekPlan,
  },
  {
    id: 'dc-002',
    clientId: 'cl-002',
    clientName: 'Priya Mehta',
    clientAge: 27,
    clientGender: 'Female',
    clientHeight: 162,
    clientWeight: 68,
    clientGoal: 'Manage PCOS symptoms and lose 5kg',
    clientAllergies: ['Gluten'],
    clientConditions: ['PCOS', 'Thyroid (Hypothyroid)'],
    clientDiet: 'Vegetarian',
    programId: 'prog-002',
    programName: 'PCOS Wellness Journey',
    title: 'Priya Mehta — PCOS Anti-Inflammatory Diet',
    version: 3,
    status: 'Active',
    calorieTarget: 1500,
    proteinTarget: 90,
    carbsTarget: 170,
    fatTarget: 50,
    validFrom: '2026-03-15',
    validTo: '2026-04-12',
    notes: 'Avoid gluten, dairy limited to curd only. Include anti-inflammatory spices: turmeric, cinnamon, ginger daily.',
    internalNotes: 'Gluten intolerance confirmed — avoid wheat roti, replace with bajra. Thyroid meds at 6am before any food.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-03-14',
    updatedAt: '2026-04-01',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-003',
    clientId: 'cl-003',
    clientName: 'Rahul Gupta',
    clientAge: 28,
    clientGender: 'Male',
    clientHeight: 178,
    clientWeight: 72,
    clientGoal: 'Gain 8kg muscle in 8 weeks',
    clientAllergies: [],
    clientConditions: [],
    clientDiet: 'Non-Vegetarian',
    programId: 'prog-003',
    programName: 'Muscle Building Pro',
    title: 'Rahul Gupta — High Protein Muscle Plan',
    version: 1,
    status: 'Active',
    calorieTarget: 2500,
    proteinTarget: 190,
    carbsTarget: 260,
    fatTarget: 75,
    validFrom: '2026-03-20',
    validTo: '2026-05-15',
    notes: 'Ensure protein is distributed across all 6 meals. Post-workout meal within 30 minutes of training.',
    internalNotes: 'Training schedule: Mon/Wed/Fri — Upper Body, Tue/Thu — Lower Body, Sat — Full Body. Rest Sun.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-03-19',
    updatedAt: '2026-03-19',
    weekPlan: muscleWeekPlan,
  },
  {
    id: 'dc-004',
    clientId: 'cl-004',
    clientName: 'Sneha Patel',
    clientAge: 45,
    clientGender: 'Female',
    clientHeight: 158,
    clientWeight: 75,
    clientGoal: 'Control blood sugar and lose 6kg',
    clientAllergies: [],
    clientConditions: ['Type 2 Diabetes', 'High Blood Pressure'],
    clientDiet: 'Vegetarian',
    programId: 'prog-005',
    programName: 'Diabetic Diet Control',
    title: 'Sneha Patel — Diabetic Meal Plan Phase 1',
    version: 1,
    status: 'Active',
    calorieTarget: 1400,
    proteinTarget: 85,
    carbsTarget: 160,
    fatTarget: 45,
    validFrom: '2026-04-01',
    validTo: '2026-04-28',
    notes: 'Low GI foods only. No refined sugar, white rice, or maida. Check blood sugar before and after each meal.',
    internalNotes: 'BP medication at night. Metformin with breakfast and dinner. Monitor HbA1c monthly.',
    createdBy: 'Neha Kapoor',
    createdByInitials: 'NK',
    createdAt: '2026-03-30',
    updatedAt: '2026-04-05',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-005',
    clientId: 'cl-005',
    clientName: 'Kavya Nair',
    clientAge: 30,
    clientGender: 'Female',
    clientHeight: 165,
    clientWeight: 63,
    clientGoal: 'Pre-pregnancy nutritional preparation',
    clientAllergies: ['Nuts'],
    clientConditions: [],
    clientDiet: 'Vegetarian',
    programId: 'prog-006',
    programName: 'Pre-Pregnancy Prep',
    title: 'Kavya Nair — Preconception Nutrition Plan',
    version: 1,
    status: 'Active',
    calorieTarget: 1800,
    proteinTarget: 75,
    carbsTarget: 220,
    fatTarget: 60,
    validFrom: '2026-04-05',
    validTo: '2026-05-03',
    notes: 'Folate-rich foods daily — leafy greens, lentils, fortified foods. No raw papaya, pineapple, or unpasteurised dairy.',
    internalNotes: 'NUT ALLERGY — NO ALMONDS, WALNUTS, PEANUTS. Replace with pumpkin seeds, sunflower seeds.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-04-04',
    updatedAt: '2026-04-04',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-006',
    clientId: 'cl-006',
    clientName: 'Vikram Singh',
    clientAge: 38,
    clientGender: 'Male',
    clientHeight: 180,
    clientWeight: 95,
    clientGoal: 'Corporate wellness — lose 5kg and improve energy',
    clientAllergies: [],
    clientConditions: ['High Cholesterol'],
    clientDiet: 'Non-Vegetarian',
    programId: 'prog-007',
    programName: 'Corporate Wellness 101',
    title: 'Vikram Singh — 4-Week Corporate Wellness Plan',
    version: 1,
    status: 'Needs Update',
    calorieTarget: 2000,
    proteinTarget: 120,
    carbsTarget: 220,
    fatTarget: 65,
    validFrom: '2026-03-10',
    validTo: '2026-04-07',
    notes: 'Office-friendly meal preps. Batch cook on Sunday. Healthy lunch box ideas included.',
    internalNotes: 'Client travels Mon-Wed every week — plan for easy restaurant ordering and hotel breakfast options.',
    createdBy: 'Neha Kapoor',
    createdByInitials: 'NK',
    createdAt: '2026-03-09',
    updatedAt: '2026-03-12',
    weekPlan: transform90WeekPlan,
  },
  {
    id: 'dc-007',
    clientId: 'cl-007',
    clientName: 'Ananya Iyer',
    clientAge: 24,
    clientGender: 'Female',
    clientHeight: 160,
    clientWeight: 55,
    clientGoal: 'Mindful eating and weight maintenance',
    clientAllergies: [],
    clientConditions: [],
    clientDiet: 'Vegan',
    programId: 'prog-004',
    programName: 'Mindful Eating Mastery',
    title: 'Ananya Iyer — Plant-Based Maintenance Plan',
    version: 2,
    status: 'Active',
    calorieTarget: 1600,
    proteinTarget: 65,
    carbsTarget: 210,
    fatTarget: 55,
    validFrom: '2026-04-10',
    validTo: '2026-05-08',
    notes: 'Vegan diet — no animal products whatsoever. Ensure B12 supplementation. Fortified plant milk preferred.',
    internalNotes: 'B12 deficiency detected on last blood work. Supplement mandatory. Recheck in 8 weeks.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-04-09',
    updatedAt: '2026-04-11',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-008',
    clientId: 'cl-008',
    clientName: 'Diya Joshi',
    clientAge: 52,
    clientGender: 'Female',
    clientHeight: 155,
    clientWeight: 70,
    clientGoal: 'Post-menopause weight management and bone health',
    clientAllergies: [],
    clientConditions: ['Osteopenia', 'High Blood Pressure'],
    clientDiet: 'Vegetarian',
    programId: 'prog-001',
    programName: 'Transform 90',
    title: 'Diya Joshi — Menopause Nutrition Plan',
    version: 1,
    status: 'Draft',
    calorieTarget: 1500,
    proteinTarget: 90,
    carbsTarget: 175,
    fatTarget: 50,
    validFrom: '2026-04-20',
    validTo: '2026-05-18',
    notes: 'Calcium-rich foods at every meal. Vitamin D supplementation. Limit sodium for blood pressure management.',
    internalNotes: 'Osteopenia confirmed — calcium 1200mg/day essential. Discuss weight-bearing exercise with programme.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-04-19',
    updatedAt: '2026-04-19',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-009',
    clientId: 'cl-009',
    clientName: 'Rohan Verma',
    clientAge: 35,
    clientGender: 'Male',
    clientHeight: 172,
    clientWeight: 80,
    clientGoal: 'Improve gut health and reduce bloating',
    clientAllergies: ['Dairy'],
    clientConditions: ['IBS'],
    clientDiet: 'Non-Vegetarian',
    programId: 'prog-001',
    programName: 'Transform 90',
    title: 'Rohan Verma — Gut Health Reset Diet',
    version: 1,
    status: 'Draft',
    calorieTarget: 1900,
    proteinTarget: 130,
    carbsTarget: 200,
    fatTarget: 60,
    validFrom: '2026-04-22',
    validTo: '2026-05-20',
    notes: 'DAIRY FREE. Low-FODMAP diet for first 4 weeks. Introduce high-fiber foods gradually. Probiotic foods daily.',
    internalNotes: 'IBS-D subtype — avoid high fat meals, spicy food, caffeine. Introduce foods systematically.',
    createdBy: 'Neha Kapoor',
    createdByInitials: 'NK',
    createdAt: '2026-04-21',
    updatedAt: '2026-04-21',
    weekPlan: transform90WeekPlan,
  },
  {
    id: 'dc-010',
    clientId: 'cl-010',
    clientName: 'Arjun Kumar',
    clientAge: 26,
    clientGender: 'Male',
    clientHeight: 176,
    clientWeight: 69,
    clientGoal: 'Yoga-supportive nutrition and improve flexibility',
    clientAllergies: [],
    clientConditions: [],
    clientDiet: 'Vegetarian',
    programId: 'prog-008',
    programName: 'Yoga & Nutrition Fusion',
    title: 'Arjun Kumar — Sattvic Yoga Diet',
    version: 1,
    status: 'Active',
    calorieTarget: 2000,
    proteinTarget: 80,
    carbsTarget: 260,
    fatTarget: 65,
    validFrom: '2026-04-15',
    validTo: '2026-06-10',
    notes: 'Sattvic diet — fresh, lightly cooked foods. No onion, garlic, or excessive spices. Eat in silence when possible.',
    internalNotes: 'Client is a yoga teacher — schedule meals around 2x daily yoga practice (6am and 6pm).',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-04-14',
    updatedAt: '2026-04-15',
    weekPlan: pcosWeekPlan,
  },
  {
    id: 'dc-011',
    clientId: 'cl-011',
    clientName: 'Meera Patel',
    clientAge: 29,
    clientGender: 'Female',
    clientHeight: 163,
    clientWeight: 60,
    clientGoal: 'Gain 5kg with clean bulk — no excess fat',
    clientAllergies: ['Eggs'],
    clientConditions: [],
    clientDiet: 'Eggetarian',
    programId: 'prog-003',
    programName: 'Muscle Building Pro',
    title: 'Meera Patel — Lean Gain Vegetarian Plan',
    version: 1,
    status: 'Archived',
    calorieTarget: 2200,
    proteinTarget: 110,
    carbsTarget: 280,
    fatTarget: 70,
    validFrom: '2026-01-10',
    validTo: '2026-03-05',
    notes: 'Eggs are fine — no other animal products. High calorie, high protein focus.',
    internalNotes: 'Completed programme successfully. Gained 4.2kg over 8 weeks. Maintained low body fat %.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-01-09',
    updatedAt: '2026-03-05',
    weekPlan: muscleWeekPlan,
  },
  {
    id: 'dc-012',
    clientId: 'cl-012',
    clientName: 'Shreya Mehta',
    clientAge: 31,
    clientGender: 'Female',
    clientHeight: 164,
    clientWeight: 72,
    clientGoal: 'Post-partum weight loss and recovery nutrition',
    clientAllergies: [],
    clientConditions: ['Post-partum (6 months)'],
    clientDiet: 'Non-Vegetarian',
    programId: 'prog-001',
    programName: 'Transform 90',
    title: 'Shreya Mehta — Post-Partum Recovery Plan',
    version: 2,
    status: 'Active',
    calorieTarget: 1900,
    proteinTarget: 100,
    carbsTarget: 230,
    fatTarget: 65,
    validFrom: '2026-04-01',
    validTo: '2026-04-28',
    notes: 'Breastfeeding — calorie needs are higher. Ensure iron and calcium are adequate. No crash dieting.',
    internalNotes: 'Client is breastfeeding — extra 300kcal/day above baseline. Iron levels low — supplement essential.',
    createdBy: 'Dr. Priya Sharma',
    createdByInitials: 'PS',
    createdAt: '2026-03-31',
    updatedAt: '2026-04-10',
    weekPlan: transform90WeekPlan,
  },
];

// ─── Templates ────────────────────────────────────────────────────────────────

export interface DietTemplate {
  id: string;
  name: string;
  calorieRange: string;
  dietType: string;
  targetGoal: string;
  description: string;
  tags: string[];
  isCustom?: boolean;
}

export const DIET_TEMPLATES: DietTemplate[] = [
  { id: 'tpl-01', name: '1200 Cal Vegetarian', calorieRange: '1,150–1,250 kcal', dietType: 'Vegetarian', targetGoal: 'Weight Loss', description: 'Calorie-controlled vegetarian plan with high fiber and protein to keep hunger at bay.', tags: ['weight-loss', 'vegetarian', 'high-fiber'] },
  { id: 'tpl-02', name: '1500 Cal Balanced', calorieRange: '1,450–1,550 kcal', dietType: 'Mixed', targetGoal: 'Maintenance', description: 'Balanced macros for weight maintenance with flexible food choices.', tags: ['maintenance', 'balanced', 'flexible'] },
  { id: 'tpl-03', name: '1800 Cal High Protein (Non-Veg)', calorieRange: '1,750–1,850 kcal', dietType: 'Non-Vegetarian', targetGoal: 'Muscle Gain', description: 'High protein plan for muscle building and body recomposition.', tags: ['muscle-gain', 'high-protein', 'non-veg'] },
  { id: 'tpl-04', name: '2000 Cal Diabetic Friendly', calorieRange: '1,950–2,050 kcal', dietType: 'Mixed', targetGoal: 'Disease Management', description: 'Low GI foods with controlled carbohydrate distribution for blood sugar management.', tags: ['diabetic', 'low-GI', 'disease-management'] },
  { id: 'tpl-05', name: 'PCOS Management Diet', calorieRange: '1,400–1,600 kcal', dietType: 'Vegetarian', targetGoal: 'Hormonal Balance', description: 'Anti-inflammatory, low-glycaemic plan targeting hormonal balance and insulin sensitivity.', tags: ['PCOS', 'anti-inflammatory', 'hormonal'] },
  { id: 'tpl-06', name: 'Pregnancy Diet (Trimester 1)', calorieRange: '1,800–2,000 kcal', dietType: 'Vegetarian', targetGoal: 'Prenatal Nutrition', description: 'First trimester nutrition focusing on folate, iron, and managing nausea.', tags: ['pregnancy', 'trimester-1', 'prenatal'] },
  { id: 'tpl-07', name: 'Pregnancy Diet (Trimester 2)', calorieRange: '2,000–2,200 kcal', dietType: 'Mixed', targetGoal: 'Prenatal Nutrition', description: 'Second trimester with increased calcium, protein, and iron requirements.', tags: ['pregnancy', 'trimester-2', 'calcium'] },
  { id: 'tpl-08', name: 'Pregnancy Diet (Trimester 3)', calorieRange: '2,200–2,400 kcal', dietType: 'Mixed', targetGoal: 'Prenatal Nutrition', description: 'Third trimester with high energy needs and preparation for labour.', tags: ['pregnancy', 'trimester-3', 'prenatal'] },
  { id: 'tpl-09', name: 'Post-Workout Recovery', calorieRange: '2,200–2,500 kcal', dietType: 'Non-Vegetarian', targetGoal: 'Athletic Performance', description: 'High protein, moderate carb plan optimised around training schedule.', tags: ['recovery', 'high-protein', 'athletic'] },
  { id: 'tpl-10', name: 'Keto Indian', calorieRange: '1,600–1,800 kcal', dietType: 'Non-Vegetarian', targetGoal: 'Weight Loss / Epilepsy', description: 'High fat, very low carb ketogenic plan with Indian food adaptations.', tags: ['keto', 'low-carb', 'high-fat'] },
];
