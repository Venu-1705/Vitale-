import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  productCategories,
  products,
  productVariants,
  productReviews,
  shopBanners,
  coachProductRecommendations,
  labPackages,
  labTests,
  labReports,
  labReportResults,
  coachLabRecommendations,
  organizationMembers,
  metricDefinitions,
  users,
  coachOrganizations,
  foodItems,
  recipes,
  recipeIngredients,
  programs,
  programModules,
  programSessions,
  coachingSessions,
} from "@workspace/db/schema";

// Deterministic UUIDs for re-runnable seeds. prefix = 2 hex chars, n zero-padded to 10.
const mkId = (prefix: string, n: number) =>
  `00000000-0000-0000-0000-${prefix}${String(n).padStart(10, "0")}`;

// ── Stable shop entity IDs ──────────────────────────────────────────────────
// Categories
const CAT_PROTEIN  = "00000000-0000-0000-0000-000000001001";
const CAT_VITAMINS = "00000000-0000-0000-0000-000000001002";
const CAT_AYURVEDA = "00000000-0000-0000-0000-000000001003";
const CAT_SNACKS   = "00000000-0000-0000-0000-000000001004";
const CAT_CARE     = "00000000-0000-0000-0000-000000001005";

// Products
const PROD_WHEY        = "00000000-0000-0000-0000-000000002001";
const PROD_CASEIN      = "00000000-0000-0000-0000-000000002002";
const PROD_PLANT       = "00000000-0000-0000-0000-000000002003";
const PROD_MASS        = "00000000-0000-0000-0000-000000002004";
const PROD_BCAA        = "00000000-0000-0000-0000-000000002005";
const PROD_VITD        = "00000000-0000-0000-0000-000000002006";
const PROD_OMEGA       = "00000000-0000-0000-0000-000000002007";
const PROD_MAGNESIUM   = "00000000-0000-0000-0000-000000002008";
const PROD_MULTIVIT    = "00000000-0000-0000-0000-000000002009";
const PROD_PROBIOTIC   = "00000000-0000-0000-0000-000000002010";
const PROD_ASHWAGANDHA = "00000000-0000-0000-0000-000000002011";
const PROD_TURMERIC    = "00000000-0000-0000-0000-000000002012";
const PROD_TRIPHALA    = "00000000-0000-0000-0000-000000002013";
const PROD_SHATAVARI   = "00000000-0000-0000-0000-000000002014";
const PROD_MAKHANA     = "00000000-0000-0000-0000-000000002015";
const PROD_BAR         = "00000000-0000-0000-0000-000000002016";
const PROD_GRANOLA     = "00000000-0000-0000-0000-000000002017";
const PROD_ALMONDS     = "00000000-0000-0000-0000-000000002018";
const PROD_SEEDS       = "00000000-0000-0000-0000-000000002019";
const PROD_COLLAGEN    = "00000000-0000-0000-0000-000000002020";
const PROD_BIOTIN      = "00000000-0000-0000-0000-000000002021";
const PROD_GLUTATHIONE = "00000000-0000-0000-0000-000000002022";
const PROD_HAIRVIT     = "00000000-0000-0000-0000-000000002023";

// Variants
const VAR_WHEY_500     = "00000000-0000-0000-0000-000000003001";
const VAR_WHEY_1000    = "00000000-0000-0000-0000-000000003002";
const VAR_WHEY_2000    = "00000000-0000-0000-0000-000000003003";
const VAR_CASEIN_500   = "00000000-0000-0000-0000-000000003004";
const VAR_CASEIN_1000  = "00000000-0000-0000-0000-000000003005";
const VAR_PLANT_500    = "00000000-0000-0000-0000-000000003006";
const VAR_PLANT_1000   = "00000000-0000-0000-0000-000000003007";
const VAR_MASS_1000    = "00000000-0000-0000-0000-000000003008";
const VAR_MASS_3000    = "00000000-0000-0000-0000-000000003009";
const VAR_BCAA_200     = "00000000-0000-0000-0000-000000003010";
const VAR_VITD_60      = "00000000-0000-0000-0000-000000003011";
const VAR_VITD_120     = "00000000-0000-0000-0000-000000003012";
const VAR_OMEGA_60     = "00000000-0000-0000-0000-000000003013";
const VAR_OMEGA_120    = "00000000-0000-0000-0000-000000003014";
const VAR_MAG_60       = "00000000-0000-0000-0000-000000003015";
const VAR_MULTI_30     = "00000000-0000-0000-0000-000000003016";
const VAR_MULTI_90     = "00000000-0000-0000-0000-000000003017";
const VAR_PROB_30      = "00000000-0000-0000-0000-000000003018";
const VAR_ASHWA_60     = "00000000-0000-0000-0000-000000003019";
const VAR_ASHWA_120    = "00000000-0000-0000-0000-000000003020";
const VAR_TURMERIC_60  = "00000000-0000-0000-0000-000000003021";
const VAR_TRIPHALA_100 = "00000000-0000-0000-0000-000000003022";
const VAR_SHATAVARI_60 = "00000000-0000-0000-0000-000000003023";
const VAR_MAKHANA_70   = "00000000-0000-0000-0000-000000003024";
const VAR_MAKHANA_200  = "00000000-0000-0000-0000-000000003025";
const VAR_BAR_6        = "00000000-0000-0000-0000-000000003026";
const VAR_BAR_12       = "00000000-0000-0000-0000-000000003027";
const VAR_GRANOLA_400  = "00000000-0000-0000-0000-000000003028";
const VAR_ALMONDS_250  = "00000000-0000-0000-0000-000000003029";
const VAR_SEEDS_250    = "00000000-0000-0000-0000-000000003030";
const VAR_COLLAGEN_200 = "00000000-0000-0000-0000-000000003031";
const VAR_BIOTIN_60    = "00000000-0000-0000-0000-000000003032";
const VAR_GLUT_60      = "00000000-0000-0000-0000-000000003033";
const VAR_HAIRVIT_30   = "00000000-0000-0000-0000-000000003034";
const VAR_HAIRVIT_90   = "00000000-0000-0000-0000-000000003035";

// Banners
const BAN_1 = "00000000-0000-0000-0000-000000004001";
const BAN_2 = "00000000-0000-0000-0000-000000004002";
const BAN_3 = "00000000-0000-0000-0000-000000004003";

// Coach product recommendations
const REC_1 = "00000000-0000-0000-0000-000000005001";
const REC_2 = "00000000-0000-0000-0000-000000005002";
const REC_3 = "00000000-0000-0000-0000-000000005003";

// Reviews
const REV_1 = "00000000-0000-0000-0000-000000006001";
const REV_2 = "00000000-0000-0000-0000-000000006002";

// Lab packages
const LAB_CBC           = "00000000-0000-0000-0000-000000007001";
const LAB_THYROID       = "00000000-0000-0000-0000-000000007002";
const LAB_DIABETES      = "00000000-0000-0000-0000-000000007003";
const LAB_LIVER         = "00000000-0000-0000-0000-000000007004";
const LAB_VITD          = "00000000-0000-0000-0000-000000007005";
const LAB_COMPREHENSIVE = "00000000-0000-0000-0000-000000007006";
const LAB_PCOD          = "00000000-0000-0000-0000-000000007007";

// Lab tests
const LT_TSH  = "00000000-0000-0000-0000-000000008001";
const LT_T3   = "00000000-0000-0000-0000-000000008002";
const LT_T4   = "00000000-0000-0000-0000-000000008003";
const LT_VITD = "00000000-0000-0000-0000-000000008004";
const LT_HB   = "00000000-0000-0000-0000-000000008005";

// Lab report + results
const REPORT_DEMO_1 = "00000000-0000-0000-0000-000000009001";
const RR_1          = "00000000-0000-0000-0000-000000009101";
const RR_2          = "00000000-0000-0000-0000-000000009102";
const RR_3          = "00000000-0000-0000-0000-000000009103";
const RR_4          = "00000000-0000-0000-0000-000000009104";

// Coach lab recommendations
const CLR_1 = "00000000-0000-0000-0000-000000009201";
const CLR_2 = "00000000-0000-0000-0000-000000009202";

async function seed() {
  console.log("🌱 Seeding database…");

  // ── Resolve real user/org IDs ─────────────────────────────────────────────
  // Users are JIT-provisioned on first Supabase login. The coach must have
  // logged in before running this seed. The mobile user (for demo lab reports
  // and reviews) is optional.
  const [coachRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "sevchenko696@gmail.com"))
    .limit(1);

  if (!coachRow) {
    console.error("❌ Coach user (sevchenko696@gmail.com) not found. Log in as the coach first.");
    process.exit(1);
  }

  const [orgRow] = await db
    .select({ id: coachOrganizations.id })
    .from(coachOrganizations)
    .where(eq(coachOrganizations.ownerCoachId, coachRow.id))
    .limit(1);

  if (!orgRow) {
    console.error("❌ Coach org not found. Has the coach completed onboarding (created an organization)?");
    process.exit(1);
  }

  const COACH_ID = coachRow.id;
  const ORG_ID   = orgRow.id;

  const [mobileUserRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "venu.190599@gmail.com"))
    .limit(1);

  const MOBILE_USER_ID = mobileUserRow?.id ?? null;

  console.log(`  Coach ID:  ${COACH_ID}`);
  console.log(`  Org ID:    ${ORG_ID}`);
  console.log(`  User ID:   ${MOBILE_USER_ID ?? "(not found — user-specific data will be skipped)"}`);

  // ── Categories ──────────────────────────────────────────────────────────────
  const cats = [
    { id: CAT_PROTEIN,  name: "Protein & Mass Gainers",  slug: "protein",       description: "High-quality whey, casein and plant-based proteins",   imageUrl: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", sortOrder: 1 },
    { id: CAT_VITAMINS, name: "Vitamins & Supplements",  slug: "vitamins",       description: "Essential vitamins and mineral supplements",            imageUrl: "https://images.unsplash.com/photo-1550572017-26b5655c75e9?w=400", sortOrder: 2 },
    { id: CAT_AYURVEDA, name: "Ayurveda & Herbs",        slug: "ayurveda",       description: "Ancient wisdom in modern formulations",                 imageUrl: "https://images.unsplash.com/photo-1611071536226-3aae5c93b7f7?w=400", sortOrder: 3 },
    { id: CAT_SNACKS,   name: "Healthy Snacks & Foods",  slug: "snacks",         description: "Guilt-free snacking for every craving",                 imageUrl: "https://images.unsplash.com/photo-1543362906-acfc16c67564?w=400", sortOrder: 4 },
    { id: CAT_CARE,     name: "Personal Care",           slug: "personal-care",  description: "Wellness products for daily care",                      imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400", sortOrder: 5 },
  ];
  for (const cat of cats) {
    await db.insert(productCategories).values(cat).onConflictDoNothing({ target: productCategories.id });
  }
  console.log("  ✓ 5 categories");

  // ── Products ─────────────────────────────────────────────────────────────────
  const productData = [
    // Protein (5)
    {
      id: PROD_WHEY,
      organizationId: ORG_ID,
      name: "Whey Protein Isolate",
      slug: "whey-protein-isolate",
      shortDescription: "25g protein per serve, zero sugar",
      description: "Cold-processed whey isolate with 25g of pure protein per serving. No artificial colours or sweeteners. Available in Chocolate Fudge and Vanilla Bean.",
      categoryId: CAT_PROTEIN,
      brand: "Vitalé Nutrition",
      images: ["https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600", "https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=600"],
      benefits: ["25g protein per serve", "Zero added sugar", "Instant mixability"],
      tags: ["whey", "isolate", "protein"],
      isBestseller: true,
      isFeatured: true,
      avgRating: 46,
      reviewCount: 312,
      gstRate: 18,
    },
    {
      id: PROD_CASEIN,
      organizationId: ORG_ID,
      name: "Micellar Casein",
      slug: "micellar-casein",
      shortDescription: "Slow-release overnight protein",
      description: "Slow-digesting micellar casein that delivers a sustained amino acid release for 7-8 hours — ideal before bed.",
      categoryId: CAT_PROTEIN,
      brand: "Vitalé Nutrition",
      images: ["https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=600"],
      benefits: ["8hr sustained release", "Anti-catabolic", "Creamy texture"],
      tags: ["casein", "protein", "night"],
      isBestseller: false,
      avgRating: 43,
      reviewCount: 87,
      gstRate: 18,
    },
    {
      id: PROD_PLANT,
      organizationId: ORG_ID,
      name: "Plant Protein Blend",
      slug: "plant-protein-blend",
      shortDescription: "Pea + rice + hemp — 22g protein",
      description: "Complete plant-based protein combining pea, brown rice, and hemp protein for a full amino acid profile. Vegan-certified.",
      categoryId: CAT_PROTEIN,
      brand: "Vitalé Nutrition",
      images: ["https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=600"],
      benefits: ["Vegan certified", "Full amino profile", "No soy"],
      tags: ["vegan", "plant", "protein"],
      isNewInStore: true,
      avgRating: 44,
      reviewCount: 56,
      gstRate: 18,
    },
    {
      id: PROD_MASS,
      organizationId: ORG_ID,
      name: "Mass Gainer Pro",
      slug: "mass-gainer-pro",
      shortDescription: "1200 kcal · 52g protein per serve",
      description: "High-calorie mass gainer with complex carbohydrates, MCT oil and 52g protein per serving. Designed for hardgainers.",
      categoryId: CAT_PROTEIN,
      brand: "Vitalé Nutrition",
      images: ["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600"],
      benefits: ["1200 kcal per serve", "52g protein", "Digestive enzymes"],
      tags: ["mass", "gainer", "bulking"],
      isBestseller: true,
      avgRating: 42,
      reviewCount: 143,
      gstRate: 18,
    },
    {
      id: PROD_BCAA,
      organizationId: ORG_ID,
      name: "BCAA 2:1:1",
      slug: "bcaa-2-1-1",
      shortDescription: "Intra-workout recovery blend",
      description: "Branched-chain amino acids in the proven 2:1:1 ratio with electrolytes for hydration during training.",
      categoryId: CAT_PROTEIN,
      brand: "Vitalé Nutrition",
      images: ["https://images.unsplash.com/photo-1594911772125-07fc7a2d8d9f?w=600"],
      benefits: ["Reduces soreness", "Electrolyte blend", "Intra-workout"],
      tags: ["bcaa", "amino", "recovery"],
      avgRating: 45,
      reviewCount: 201,
      gstRate: 18,
    },
    // Vitamins (5)
    {
      id: PROD_VITD,
      organizationId: ORG_ID,
      name: "Vitamin D3 + K2",
      slug: "vitamin-d3-k2",
      shortDescription: "5000 IU D3 with MK-7 K2",
      description: "High-potency Vitamin D3 (5000 IU) paired with Vitamin K2 (MK-7) to ensure calcium is directed to bones, not arteries.",
      categoryId: CAT_VITAMINS,
      brand: "Vitalé Essentials",
      images: ["https://images.unsplash.com/photo-1550572017-26b5655c75e9?w=600"],
      benefits: ["Bone & immune health", "MK-7 form K2", "Vegetarian capsule"],
      tags: ["vitamin d", "vitamin k", "bones"],
      isBestseller: true,
      avgRating: 48,
      reviewCount: 419,
      gstRate: 12,
    },
    {
      id: PROD_OMEGA,
      organizationId: ORG_ID,
      name: "Omega-3 Fish Oil",
      slug: "omega-3-fish-oil",
      shortDescription: "1000mg EPA + DHA per serve",
      description: "Triple-strength, mercury-tested omega-3 fish oil delivering 1000mg combined EPA+DHA per serving. Enteric coated to prevent fishy burps.",
      categoryId: CAT_VITAMINS,
      brand: "Vitalé Essentials",
      images: ["https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=600"],
      benefits: ["Heart & brain health", "No fishy burps", "Mercury tested"],
      tags: ["omega3", "fish oil", "heart"],
      isBestseller: true,
      avgRating: 47,
      reviewCount: 287,
      gstRate: 12,
    },
    {
      id: PROD_MAGNESIUM,
      organizationId: ORG_ID,
      name: "Magnesium Glycinate",
      slug: "magnesium-glycinate",
      shortDescription: "Highly bioavailable sleep & calm support",
      description: "Chelated magnesium glycinate for superior absorption. Supports deep sleep, muscle relaxation and stress relief.",
      categoryId: CAT_VITAMINS,
      brand: "Vitalé Essentials",
      images: ["https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600"],
      benefits: ["Improves sleep", "Reduces anxiety", "Chelated form"],
      tags: ["magnesium", "sleep", "calm"],
      isNewInStore: true,
      avgRating: 47,
      reviewCount: 192,
      gstRate: 12,
    },
    {
      id: PROD_MULTIVIT,
      organizationId: ORG_ID,
      name: "Daily Multivitamin",
      slug: "daily-multivitamin",
      shortDescription: "25 essential nutrients in one tablet",
      description: "Comprehensive once-daily multivitamin with 25 vitamins and minerals including methylated B12 and folate.",
      categoryId: CAT_VITAMINS,
      brand: "Vitalé Essentials",
      images: ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600"],
      benefits: ["25 nutrients", "Methylated B vitamins", "Once daily"],
      tags: ["multivitamin", "daily", "essential"],
      avgRating: 44,
      reviewCount: 321,
      gstRate: 12,
    },
    {
      id: PROD_PROBIOTIC,
      organizationId: ORG_ID,
      name: "Probiotic 50 Billion CFU",
      slug: "probiotic-50b",
      shortDescription: "10 clinically studied strains",
      description: "50 billion live cultures across 10 clinically studied strains including Lactobacillus and Bifidobacterium. Shelf-stable formula.",
      categoryId: CAT_VITAMINS,
      brand: "Vitalé Essentials",
      images: ["https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600"],
      benefits: ["50B CFU guaranteed", "10 strains", "Gut & immune support"],
      tags: ["probiotic", "gut", "immune"],
      isBestseller: true,
      avgRating: 46,
      reviewCount: 178,
      gstRate: 12,
    },
    // Ayurveda (4)
    {
      id: PROD_ASHWAGANDHA,
      organizationId: ORG_ID,
      name: "KSM-66 Ashwagandha",
      slug: "ksm66-ashwagandha",
      shortDescription: "600mg full-spectrum root extract",
      description: "Clinically studied KSM-66 ashwagandha root extract at 600mg. Proven to reduce cortisol, improve strength and enhance sleep quality.",
      categoryId: CAT_AYURVEDA,
      brand: "Vitalé Herbs",
      images: ["https://images.unsplash.com/photo-1611071536226-3aae5c93b7f7?w=600"],
      benefits: ["Reduces cortisol 27%", "Improves strength", "Better sleep quality"],
      tags: ["ashwagandha", "adaptogen", "stress"],
      isBestseller: true,
      avgRating: 48,
      reviewCount: 534,
      gstRate: 12,
    },
    {
      id: PROD_TURMERIC,
      organizationId: ORG_ID,
      name: "Turmeric Curcumin C3",
      slug: "turmeric-curcumin-c3",
      shortDescription: "95% curcuminoids + BioPerine",
      description: "Certified C3 Complex turmeric with 95% curcuminoids and BioPerine (black pepper extract) for 2000% better absorption.",
      categoryId: CAT_AYURVEDA,
      brand: "Vitalé Herbs",
      images: ["https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600"],
      benefits: ["2000% better absorption", "Anti-inflammatory", "Joint support"],
      tags: ["turmeric", "curcumin", "anti-inflammatory"],
      isNewInStore: true,
      avgRating: 47,
      reviewCount: 267,
      gstRate: 12,
    },
    {
      id: PROD_TRIPHALA,
      organizationId: ORG_ID,
      name: "Triphala Churna",
      slug: "triphala-churna",
      shortDescription: "Classic tridoshic digestive formula",
      description: "Traditional Ayurvedic formula of Amalaki, Bibhitaki and Haritaki. Gentle daily detox and digestive support.",
      categoryId: CAT_AYURVEDA,
      brand: "Vitalé Herbs",
      images: ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=600"],
      benefits: ["Gentle detox", "Digestive support", "Classic formula"],
      tags: ["triphala", "digestion", "ayurveda"],
      avgRating: 45,
      reviewCount: 89,
      gstRate: 12,
    },
    {
      id: PROD_SHATAVARI,
      organizationId: ORG_ID,
      name: "Shatavari Root Extract",
      slug: "shatavari-root",
      shortDescription: "Women's hormonal balance support",
      description: "Concentrated Shatavari root extract standardised to 20% saponins. Traditional support for female hormonal health and lactation.",
      categoryId: CAT_AYURVEDA,
      brand: "Vitalé Herbs",
      images: ["https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=600"],
      benefits: ["Hormonal balance", "Lactation support", "Standardised extract"],
      tags: ["shatavari", "women", "hormones"],
      isNewInStore: true,
      avgRating: 46,
      reviewCount: 112,
      gstRate: 12,
    },
    // Snacks (5)
    {
      id: PROD_MAKHANA,
      organizationId: ORG_ID,
      name: "Roasted Makhana",
      slug: "roasted-makhana",
      shortDescription: "High protein fox nuts — 4 flavours",
      description: "Crunchy roasted fox nuts (makhana) with 8g protein per serve. Available in Himalayan Salt, Masala, Peri Peri and Cheese & Herb.",
      categoryId: CAT_SNACKS,
      brand: "Vitalé Bites",
      images: ["https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600"],
      benefits: ["8g protein per serve", "Low GI", "Air popped"],
      tags: ["makhana", "snack", "high-protein"],
      isBestseller: true,
      avgRating: 47,
      reviewCount: 623,
      gstRate: 5,
    },
    {
      id: PROD_BAR,
      organizationId: ORG_ID,
      name: "Protein Bar Variety Pack",
      slug: "protein-bar-variety",
      shortDescription: "15g protein · No refined sugar",
      description: "Pack of 6 assorted protein bars with 15g protein each, sweetened with dates and stevia. No palm oil, no refined sugar.",
      categoryId: CAT_SNACKS,
      brand: "Vitalé Bites",
      images: ["https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600"],
      benefits: ["15g protein", "No refined sugar", "6 flavours"],
      tags: ["protein bar", "snack", "no sugar"],
      isBestseller: true,
      avgRating: 45,
      reviewCount: 445,
      gstRate: 5,
    },
    {
      id: PROD_GRANOLA,
      organizationId: ORG_ID,
      name: "Low-Sugar Granola",
      slug: "low-sugar-granola",
      shortDescription: "Toasted oats, seeds & berries",
      description: "Artisan granola with whole rolled oats, pumpkin seeds, sunflower seeds, dried cranberries and a touch of honey. Only 4g sugar per serve.",
      categoryId: CAT_SNACKS,
      brand: "Vitalé Bites",
      images: ["https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600"],
      benefits: ["4g sugar per serve", "Prebiotic fibre", "No seed oils"],
      tags: ["granola", "breakfast", "oats"],
      avgRating: 44,
      reviewCount: 198,
      gstRate: 5,
    },
    {
      id: PROD_ALMONDS,
      organizationId: ORG_ID,
      name: "Activated Almonds",
      slug: "activated-almonds",
      shortDescription: "Sprouted for better nutrient absorption",
      description: "Almonds soaked and dehydrated to break down phytic acid, dramatically improving mineral and nutrient absorption.",
      categoryId: CAT_SNACKS,
      brand: "Vitalé Bites",
      images: ["https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=600"],
      benefits: ["Better absorption", "Anti-nutrient free", "Satisfying crunch"],
      tags: ["almonds", "nuts", "activated"],
      isNewInStore: true,
      avgRating: 46,
      reviewCount: 89,
      gstRate: 5,
    },
    {
      id: PROD_SEEDS,
      organizationId: ORG_ID,
      name: "Super Seed Mix",
      slug: "super-seed-mix",
      shortDescription: "Chia, flax, pumpkin & sunflower",
      description: "Premium blend of chia seeds, golden flaxseeds, pumpkin seeds and sunflower seeds. Rich in omega-3 and plant protein.",
      categoryId: CAT_SNACKS,
      brand: "Vitalé Bites",
      images: ["https://images.unsplash.com/photo-1501523460185-2aa5d2a0f981?w=600"],
      benefits: ["Omega-3 rich", "6g protein per serve", "Versatile topping"],
      tags: ["seeds", "omega3", "superfood"],
      avgRating: 45,
      reviewCount: 156,
      gstRate: 5,
    },
    // Personal Care (4)
    {
      id: PROD_COLLAGEN,
      organizationId: ORG_ID,
      name: "Marine Collagen Peptides",
      slug: "marine-collagen",
      shortDescription: "5000mg hydrolysed — skin & joints",
      description: "Hydrolysed type I & III marine collagen from deep-sea fish with added Vitamin C for synthesis. Unflavoured, dissolves in any drink.",
      categoryId: CAT_CARE,
      brand: "Vitalé Glow",
      images: ["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600"],
      benefits: ["5000mg per serve", "Skin & joint support", "Marine source type I & III"],
      tags: ["collagen", "skin", "joints"],
      isBestseller: true,
      avgRating: 47,
      reviewCount: 389,
      gstRate: 18,
    },
    {
      id: PROD_BIOTIN,
      organizationId: ORG_ID,
      name: "Biotin 10000mcg",
      slug: "biotin-10000",
      shortDescription: "Hair, skin & nail growth",
      description: "High-dose Biotin (10,000 mcg) with added Bamboo extract (silica) and Zinc. Clinically studied doses for visible hair growth in 90 days.",
      categoryId: CAT_CARE,
      brand: "Vitalé Glow",
      images: ["https://images.unsplash.com/photo-1579091337633-a8b4b72a3428?w=600"],
      benefits: ["10,000mcg dose", "Visible results in 90 days", "Hair + skin + nails"],
      tags: ["biotin", "hair", "nails"],
      isNewInStore: true,
      avgRating: 46,
      reviewCount: 278,
      gstRate: 18,
    },
    {
      id: PROD_GLUTATHIONE,
      organizationId: ORG_ID,
      name: "L-Glutathione + Vitamin C",
      slug: "l-glutathione-vc",
      shortDescription: "Master antioxidant for skin glow",
      description: "Reduced L-Glutathione (500mg) combined with Vitamin C (1000mg) to maximise bioavailability and antioxidant synergy.",
      categoryId: CAT_CARE,
      brand: "Vitalé Glow",
      images: ["https://images.unsplash.com/photo-1615490133411-faa5efcf6e80?w=600"],
      benefits: ["Master antioxidant", "Skin brightening", "Immune support"],
      tags: ["glutathione", "antioxidant", "skin"],
      avgRating: 45,
      reviewCount: 167,
      gstRate: 18,
    },
    {
      id: PROD_HAIRVIT,
      organizationId: ORG_ID,
      name: "Hair Vitality Complex",
      slug: "hair-vitality-complex",
      shortDescription: "12 nutrients for thick, strong hair",
      description: "Comprehensive hair supplement with Biotin, Iron, Zinc, Selenium, Vitamin D3 and specialised keratin precursors.",
      categoryId: CAT_CARE,
      brand: "Vitalé Glow",
      images: ["https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600"],
      benefits: ["12 nutrients", "Reduces shedding", "Keratin precursors"],
      tags: ["hair", "biotin", "keratin"],
      avgRating: 44,
      reviewCount: 203,
      gstRate: 18,
    },
  ];

  for (const p of productData) {
    await db.insert(products).values(p).onConflictDoNothing({ target: products.id });
  }
  console.log(`  ✓ ${productData.length} products`);

  // ── Variants ─────────────────────────────────────────────────────────────────
  const variantData = [
    { id: VAR_WHEY_500,     productId: PROD_WHEY,        name: "500g",          sku: "VN-WPI-500",  pricePaise: 179900, mrpPaise: 219900, stockQty: 120, weightG: 500 },
    { id: VAR_WHEY_1000,    productId: PROD_WHEY,        name: "1kg",           sku: "VN-WPI-1000", pricePaise: 299900, mrpPaise: 389900, stockQty: 85,  weightG: 1000 },
    { id: VAR_WHEY_2000,    productId: PROD_WHEY,        name: "2kg",           sku: "VN-WPI-2000", pricePaise: 519900, mrpPaise: 699900, stockQty: 40,  weightG: 2000 },
    { id: VAR_CASEIN_500,   productId: PROD_CASEIN,      name: "500g",          sku: "VN-CAS-500",  pricePaise: 159900, mrpPaise: 199900, stockQty: 60,  weightG: 500 },
    { id: VAR_CASEIN_1000,  productId: PROD_CASEIN,      name: "1kg",           sku: "VN-CAS-1000", pricePaise: 279900, mrpPaise: 349900, stockQty: 35,  weightG: 1000 },
    { id: VAR_PLANT_500,    productId: PROD_PLANT,       name: "500g",          sku: "VN-PP-500",   pricePaise: 169900, mrpPaise: 209900, stockQty: 45,  weightG: 500 },
    { id: VAR_PLANT_1000,   productId: PROD_PLANT,       name: "1kg",           sku: "VN-PP-1000",  pricePaise: 289900, mrpPaise: 359900, stockQty: 28,  weightG: 1000 },
    { id: VAR_MASS_1000,    productId: PROD_MASS,        name: "1kg",           sku: "VN-MG-1000",  pricePaise: 159900, mrpPaise: 199900, stockQty: 50,  weightG: 1000 },
    { id: VAR_MASS_3000,    productId: PROD_MASS,        name: "3kg",           sku: "VN-MG-3000",  pricePaise: 399900, mrpPaise: 529900, stockQty: 22,  weightG: 3000 },
    { id: VAR_BCAA_200,     productId: PROD_BCAA,        name: "200g",          sku: "VN-BCAA-200", pricePaise: 89900,  mrpPaise: 119900, stockQty: 90,  weightG: 200 },
    { id: VAR_VITD_60,      productId: PROD_VITD,        name: "60 capsules",   sku: "VE-VD-060",   pricePaise: 59900,  mrpPaise: 79900,  stockQty: 150 },
    { id: VAR_VITD_120,     productId: PROD_VITD,        name: "120 capsules",  sku: "VE-VD-120",   pricePaise: 99900,  mrpPaise: 139900, stockQty: 95 },
    { id: VAR_OMEGA_60,     productId: PROD_OMEGA,       name: "60 softgels",   sku: "VE-O3-060",   pricePaise: 79900,  mrpPaise: 99900,  stockQty: 110 },
    { id: VAR_OMEGA_120,    productId: PROD_OMEGA,       name: "120 softgels",  sku: "VE-O3-120",   pricePaise: 139900, mrpPaise: 179900, stockQty: 75 },
    { id: VAR_MAG_60,       productId: PROD_MAGNESIUM,   name: "60 capsules",   sku: "VE-MG-060",   pricePaise: 69900,  mrpPaise: 89900,  stockQty: 80 },
    { id: VAR_MULTI_30,     productId: PROD_MULTIVIT,    name: "30 tablets",    sku: "VE-MV-030",   pricePaise: 49900,  mrpPaise: 64900,  stockQty: 200 },
    { id: VAR_MULTI_90,     productId: PROD_MULTIVIT,    name: "90 tablets",    sku: "VE-MV-090",   pricePaise: 129900, mrpPaise: 169900, stockQty: 140 },
    { id: VAR_PROB_30,      productId: PROD_PROBIOTIC,   name: "30 capsules",   sku: "VE-PB-030",   pricePaise: 89900,  mrpPaise: 119900, stockQty: 70 },
    { id: VAR_ASHWA_60,     productId: PROD_ASHWAGANDHA, name: "60 capsules",   sku: "VH-AW-060",   pricePaise: 79900,  mrpPaise: 99900,  stockQty: 130 },
    { id: VAR_ASHWA_120,    productId: PROD_ASHWAGANDHA, name: "120 capsules",  sku: "VH-AW-120",   pricePaise: 139900, mrpPaise: 179900, stockQty: 85 },
    { id: VAR_TURMERIC_60,  productId: PROD_TURMERIC,    name: "60 capsules",   sku: "VH-TC-060",   pricePaise: 69900,  mrpPaise: 89900,  stockQty: 95 },
    { id: VAR_TRIPHALA_100, productId: PROD_TRIPHALA,    name: "100g",          sku: "VH-TR-100",   pricePaise: 29900,  mrpPaise: 39900,  stockQty: 120, weightG: 100 },
    { id: VAR_SHATAVARI_60, productId: PROD_SHATAVARI,   name: "60 capsules",   sku: "VH-SH-060",   pricePaise: 64900,  mrpPaise: 84900,  stockQty: 75 },
    { id: VAR_MAKHANA_70,   productId: PROD_MAKHANA,     name: "70g",           sku: "VB-MK-070",   pricePaise: 9900,   mrpPaise: 12900,  stockQty: 300, weightG: 70 },
    { id: VAR_MAKHANA_200,  productId: PROD_MAKHANA,     name: "200g",          sku: "VB-MK-200",   pricePaise: 24900,  mrpPaise: 32900,  stockQty: 180, weightG: 200 },
    { id: VAR_BAR_6,        productId: PROD_BAR,         name: "Pack of 6",     sku: "VB-PB-006",   pricePaise: 44900,  mrpPaise: 54900,  stockQty: 120, weightG: 360 },
    { id: VAR_BAR_12,       productId: PROD_BAR,         name: "Pack of 12",    sku: "VB-PB-012",   pricePaise: 84900,  mrpPaise: 104900, stockQty: 80,  weightG: 720 },
    { id: VAR_GRANOLA_400,  productId: PROD_GRANOLA,     name: "400g",          sku: "VB-GR-400",   pricePaise: 39900,  mrpPaise: 49900,  stockQty: 90,  weightG: 400 },
    { id: VAR_ALMONDS_250,  productId: PROD_ALMONDS,     name: "250g",          sku: "VB-AL-250",   pricePaise: 34900,  mrpPaise: 44900,  stockQty: 110, weightG: 250 },
    { id: VAR_SEEDS_250,    productId: PROD_SEEDS,       name: "250g",          sku: "VB-SS-250",   pricePaise: 29900,  mrpPaise: 39900,  stockQty: 140, weightG: 250 },
    { id: VAR_COLLAGEN_200, productId: PROD_COLLAGEN,    name: "200g",          sku: "VG-MC-200",   pricePaise: 149900, mrpPaise: 189900, stockQty: 65,  weightG: 200 },
    { id: VAR_BIOTIN_60,    productId: PROD_BIOTIN,      name: "60 capsules",   sku: "VG-BT-060",   pricePaise: 69900,  mrpPaise: 89900,  stockQty: 88 },
    { id: VAR_GLUT_60,      productId: PROD_GLUTATHIONE, name: "60 capsules",   sku: "VG-GL-060",   pricePaise: 129900, mrpPaise: 169900, stockQty: 50 },
    { id: VAR_HAIRVIT_30,   productId: PROD_HAIRVIT,     name: "30 capsules",   sku: "VG-HV-030",   pricePaise: 89900,  mrpPaise: 119900, stockQty: 75 },
    { id: VAR_HAIRVIT_90,   productId: PROD_HAIRVIT,     name: "90 capsules",   sku: "VG-HV-090",   pricePaise: 229900, mrpPaise: 299900, stockQty: 45 },
  ];

  for (const v of variantData) {
    await db.insert(productVariants).values(v).onConflictDoNothing({ target: productVariants.id });
  }
  console.log(`  ✓ ${variantData.length} variants`);

  // ── Banners ───────────────────────────────────────────────────────────────────
  const banners = [
    { id: BAN_1, organizationId: ORG_ID, title: "New Year, New You",       subtitle: "Up to 40% off on bestsellers",       imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800", bgColor: "#0F4C2A", link: "/resources/shop",                  sortOrder: 1 },
    { id: BAN_2, organizationId: ORG_ID, title: "Coach-Curated Stacks",   subtitle: "Personalised supplement protocols",  imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800", bgColor: "#1E3A5F", link: "/resources/shop?filter=coach-curated", sortOrder: 2 },
    { id: BAN_3, organizationId: ORG_ID, title: "Lab Tests at Home",       subtitle: "Book in 60 seconds · Results in 48hrs", imageUrl: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800", bgColor: "#4C0F0F", link: "/resources/lab",                 sortOrder: 3 },
  ];
  for (const b of banners) {
    await db.insert(shopBanners).values(b).onConflictDoNothing({ target: shopBanners.id });
  }
  console.log("  ✓ 3 banners");

  // ── Coach Product Recommendations ─────────────────────────────────────────────
  const recs = [
    { id: REC_1, organizationId: ORG_ID, recommendedByUserId: COACH_ID, coachId: COACH_ID, coachName: "Coach Sevchenko", coachAvatarUrl: null, productId: PROD_VITD,        clinicalNote: "85% of my clients are deficient. I recommend D3+K2 for all who sit indoors >8hrs/day.",             sortOrder: 1 },
    { id: REC_2, organizationId: ORG_ID, recommendedByUserId: COACH_ID, coachId: COACH_ID, coachName: "Coach Sevchenko", coachAvatarUrl: null, productId: PROD_ASHWAGANDHA, clinicalNote: "Cortisol-driven weight gain responds well to KSM-66 in 12 weeks. Evidence-backed.",               sortOrder: 2 },
    { id: REC_3, organizationId: ORG_ID, recommendedByUserId: COACH_ID, coachId: COACH_ID, coachName: "Coach Sevchenko", coachAvatarUrl: null, productId: PROD_OMEGA,       clinicalNote: "Essential for reducing systemic inflammation — especially important for PCOD management.", sortOrder: 3 },
  ];
  for (const r of recs) {
    await db.insert(coachProductRecommendations).values(r).onConflictDoNothing({ target: coachProductRecommendations.id });
  }
  console.log("  ✓ 3 coach product recommendations");

  // ── Reviews (only if mobile user exists) ─────────────────────────────────────
  if (MOBILE_USER_ID) {
    const reviews = [
      { id: REV_1, productId: PROD_WHEY,        userId: MOBILE_USER_ID, rating: 5, title: "Best whey I've tried",      body: "Mixes perfectly, no clumps, and the chocolate flavour is amazing. Been using for 3 months.", isVerified: true },
      { id: REV_2, productId: PROD_ASHWAGANDHA, userId: MOBILE_USER_ID, rating: 5, title: "Noticed a real difference", body: "Stress levels down noticeably after 3 weeks. Sleep has improved dramatically.",               isVerified: true },
    ];
    for (const r of reviews) {
      await db.insert(productReviews).values(r).onConflictDoNothing({ target: productReviews.id });
    }
    console.log("  ✓ 2 product reviews");
  }

  // ── Lab Packages ──────────────────────────────────────────────────────────────
  const labPkgs = [
    {
      id: LAB_CBC,
      name: "Complete Blood Count",
      slug: "complete-blood-count",
      description: "Comprehensive blood panel covering RBC, WBC, platelets, haemoglobin and differentials.",
      testsCount: 22, pricePaise: 39900, mrpPaise: 59900, turnaroundDays: 1, popular: true,
      sampleType: "Blood", fastingRequired: false,
      whyThisTest: "CBC is the most fundamental diagnostic test. It reveals anaemia, infection, inflammation, clotting disorders, and nutritional deficiencies in a single draw.",
      recommendedFor: ["Women with fatigue", "Anyone with suspected anaemia", "Pre-operative screening", "Annual wellness check"],
      niche: "general", color: "#2563EB", thyrocareCode: "CBC",
      testNames: ["Haemoglobin", "WBC Count", "RBC Count", "Platelet Count", "MCV", "MCH", "MCHC", "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils"],
    },
    {
      id: LAB_THYROID,
      name: "Thyroid Panel (T3, T4, TSH)",
      slug: "thyroid-panel",
      description: "Complete thyroid function test including T3, T4, and TSH to assess thyroid health.",
      testsCount: 3, pricePaise: 59900, mrpPaise: 89900, turnaroundDays: 1, popular: true,
      sampleType: "Blood", fastingRequired: false,
      whyThisTest: "Thyroid dysfunction is the #1 undiagnosed condition in India, especially in women. Early detection prevents weight gain, hair loss, fatigue, and fertility issues.",
      recommendedFor: ["Women with unexplained weight gain", "Fatigue & brain fog sufferers", "PCOD patients", "Anyone with a family history of thyroid disease"],
      niche: "thyroid", color: "#8B5CF6", thyrocareCode: "THYROID3",
      testNames: ["TSH", "T3 (Total)", "T4 (Total)"],
    },
    {
      id: LAB_DIABETES,
      name: "Diabetes Screening",
      slug: "diabetes-screening",
      description: "Fasting glucose, HbA1c, and insulin resistance markers for comprehensive diabetes risk assessment.",
      testsCount: 5, pricePaise: 79900, mrpPaise: 119900, turnaroundDays: 2, popular: true,
      sampleType: "Blood", fastingRequired: true,
      whyThisTest: "India has 77 million diabetics — the second highest in the world. Most have no idea. HbA1c reveals a 3-month glucose average, catching pre-diabetes before it's too late.",
      recommendedFor: ["Anyone above 30", "Family history of diabetes", "Overweight individuals", "PCOD patients", "Those with frequent thirst or urination"],
      niche: "diabetes", color: "#F59E0B", thyrocareCode: "DIABSCR",
      testNames: ["Fasting Blood Glucose", "HbA1c", "Fasting Insulin", "HOMA-IR", "Post-meal Glucose"],
    },
    {
      id: LAB_LIVER,
      name: "Liver Function Test",
      slug: "liver-function-test",
      description: "Full liver panel including ALT, AST, ALP, bilirubin and albumin.",
      testsCount: 8, pricePaise: 49900, mrpPaise: 74900, turnaroundDays: 1, popular: false,
      sampleType: "Blood", fastingRequired: true,
      whyThisTest: "Non-alcoholic fatty liver disease (NAFLD) affects 1 in 3 Indians and is mostly silent. LFT catches enzyme elevation before serious damage occurs.",
      recommendedFor: ["People taking long-term medications", "Alcohol consumers", "Obesity or belly fat", "Annual health check", "Jaundice history"],
      niche: "liver", color: "#F97316", thyrocareCode: "LFT",
      testNames: ["ALT (SGPT)", "AST (SGOT)", "ALP", "Total Bilirubin", "Direct Bilirubin", "Albumin", "Total Protein", "GGT"],
    },
    {
      id: LAB_VITD,
      name: "Vitamin D (25-OH)",
      slug: "vitamin-d-25oh",
      description: "Accurate 25-hydroxyvitamin D measurement — the gold standard for vitamin D status.",
      testsCount: 1, pricePaise: 79900, mrpPaise: 109900, turnaroundDays: 2, popular: false,
      sampleType: "Blood", fastingRequired: false,
      whyThisTest: "85% of urban Indians are Vitamin D deficient due to indoor lifestyles and sun avoidance. Deficiency drives fatigue, bone loss, poor immunity, and mood disorders.",
      recommendedFor: ["Office workers with low sunlight", "Women (esp. after 30)", "Anyone with bone pain", "Post-COVID recovery", "People with autoimmune conditions"],
      niche: "vitamin", color: "#EAB308", thyrocareCode: "VIT25OH",
      testNames: ["Vitamin D (25-Hydroxyvitamin D)"],
    },
    {
      id: LAB_COMPREHENSIVE,
      name: "Comprehensive Health Checkup",
      slug: "comprehensive-health",
      description: "Full-body health assessment: CBC, lipid profile, thyroid, liver, kidney, diabetes, vitamin D and B12.",
      testsCount: 72, pricePaise: 149900, mrpPaise: 299900, turnaroundDays: 2, popular: true,
      sampleType: "Blood", fastingRequired: true,
      whyThisTest: "The annual full-body check is the single most impactful preventive health action you can take. Catches 90% of common lifestyle diseases early, when they are reversible.",
      recommendedFor: ["Annual health ritual", "Anyone above 30", "Pre-conception screening", "Post-illness recovery", "Corporate wellness"],
      niche: "general", color: "#22C55E", thyrocareCode: "AAROGYAM-C",
      testNames: ["CBC (22 tests)", "Lipid Profile", "Thyroid (T3, T4, TSH)", "Liver Function (8 tests)", "Kidney Function", "HbA1c", "Fasting Glucose", "Vitamin D", "Vitamin B12", "Iron Studies"],
    },
    {
      id: LAB_PCOD,
      name: "PCOD / PCOS Hormonal Panel",
      slug: "pcod-hormonal-panel",
      description: "Comprehensive hormonal assessment for women with PCOD/PCOS — LH, FSH, Prolactin, Testosterone, AMH and thyroid.",
      testsCount: 9, pricePaise: 129900, mrpPaise: 199900, turnaroundDays: 2, popular: true,
      sampleType: "Blood", fastingRequired: false,
      whyThisTest: "PCOD affects 1 in 5 Indian women of reproductive age. This panel identifies the hormonal imbalance driving your symptoms — enabling targeted treatment.",
      recommendedFor: ["Irregular periods", "Acne and excess hair growth", "Difficulty conceiving", "Unexplained weight gain", "Women with insulin resistance"],
      niche: "pcod", color: "#EC4899", thyrocareCode: "PCOSPANEL",
      testNames: ["LH", "FSH", "LH:FSH Ratio", "Prolactin", "Total Testosterone", "Free Testosterone", "AMH", "TSH", "Fasting Insulin"],
    },
  ];

  for (const lp of labPkgs) {
    await db.insert(labPackages).values(lp).onConflictDoUpdate({
      target: labPackages.id,
      set: { sampleType: lp.sampleType, fastingRequired: lp.fastingRequired, whyThisTest: lp.whyThisTest, recommendedFor: lp.recommendedFor, niche: lp.niche, color: lp.color, thyrocareCode: lp.thyrocareCode, testNames: lp.testNames },
    });
  }
  console.log(`  ✓ ${labPkgs.length} lab packages`);

  // ── Lab Tests ─────────────────────────────────────────────────────────────────
  const labTestData = [
    { id: LT_TSH,  packageId: LAB_THYROID, name: "TSH (Thyroid Stimulating Hormone)", code: "TSH",   unit: "mIU/L",  referenceRangeLow: 0.4, referenceRangeHigh: 4.0,  section: "Thyroid" },
    { id: LT_T3,   packageId: LAB_THYROID, name: "T3 (Triiodothyronine)",             code: "T3",    unit: "ng/dL",  referenceRangeLow: 80,  referenceRangeHigh: 200,  section: "Thyroid" },
    { id: LT_T4,   packageId: LAB_THYROID, name: "T4 (Thyroxine)",                    code: "T4",    unit: "μg/dL",  referenceRangeLow: 5.1, referenceRangeHigh: 14.1, section: "Thyroid" },
    { id: LT_VITD, packageId: LAB_VITD,    name: "Vitamin D (25-OH)",                 code: "25OHD", unit: "ng/mL",  referenceRangeLow: 30,  referenceRangeHigh: 100,  section: "Vitamins" },
    { id: LT_HB,   packageId: LAB_CBC,     name: "Haemoglobin",                       code: "HB",    unit: "g/dL",   referenceRangeLow: 12,  referenceRangeHigh: 17.5, section: "CBC" },
  ];
  for (const lt of labTestData) {
    await db.insert(labTests).values(lt).onConflictDoUpdate({ target: labTests.id, set: { section: lt.section } });
  }
  console.log("  ✓ 5 lab tests");

  // ── Demo Lab Report + Results (only if mobile user exists) ───────────────────
  if (MOBILE_USER_ID) {
    await db.insert(labReports).values({
      id: REPORT_DEMO_1,
      bookingId: null,
      userId: MOBILE_USER_ID,
      title: "Thyroid & Vitamin D Panel",
      reportDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: "ready",
      abnormalCount: 2,
      packageName: "Thyroid Panel (T3, T4, TSH)",
    }).onConflictDoUpdate({ target: labReports.id, set: { abnormalCount: 2, packageName: "Thyroid Panel (T3, T4, TSH)" } });

    const resultRows = [
      { id: RR_1, reportId: REPORT_DEMO_1, testId: LT_TSH,  testName: "TSH (Thyroid Stimulating Hormone)", value: 6.8,  unit: "mIU/L",  referenceRangeLow: 0.4, referenceRangeHigh: 4.0,  isAbnormal: true,  flag: "high",   section: "Thyroid" },
      { id: RR_2, reportId: REPORT_DEMO_1, testId: LT_VITD, testName: "Vitamin D (25-OH)",                 value: 14.2, unit: "ng/mL",  referenceRangeLow: 30,  referenceRangeHigh: 100,  isAbnormal: true,  flag: "low",    section: "Vitamins" },
      { id: RR_3, reportId: REPORT_DEMO_1, testId: LT_T4,   testName: "T4 (Thyroxine)",                    value: 8.3,  unit: "μg/dL",  referenceRangeLow: 5.1, referenceRangeHigh: 14.1, isAbnormal: false, flag: "normal", section: "Thyroid" },
      { id: RR_4, reportId: REPORT_DEMO_1, testId: LT_T3,   testName: "T3 (Triiodothyronine)",             value: 1.3,  unit: "ng/mL",  referenceRangeLow: 0.8, referenceRangeHigh: 2.0,  isAbnormal: false, flag: "normal", section: "Thyroid" },
    ];
    for (const rr of resultRows) {
      await db.insert(labReportResults).values(rr).onConflictDoUpdate({ target: labReportResults.id, set: { section: rr.section } });
    }
    console.log("  ✓ 1 demo lab report (2 abnormal flags)");

    // ── Coach Lab Recommendations ─────────────────────────────────────────────
    const coachLabRecs = [
      { id: CLR_1, coachId: COACH_ID, userId: MOBILE_USER_ID, packageId: LAB_THYROID, note: "Your fatigue and hair shedding pattern strongly suggests subclinical hypothyroidism. Let's rule it out — TSH is the first step." },
      { id: CLR_2, coachId: COACH_ID, userId: MOBILE_USER_ID, packageId: LAB_VITD,    note: "85% of my clients have Vitamin D below 20 ng/mL. Combined with your sleep issues, I suspect this is a factor." },
    ];
    for (const clr of coachLabRecs) {
      await db.insert(coachLabRecommendations).values(clr).onConflictDoNothing({ target: coachLabRecommendations.id });
    }
    console.log("  ✓ 2 coach lab recommendations");

    // NOTE: access_grants skipped — requires a live dpdp_consent_records row
    // (enforced by tg_require_consent_on_activate trigger). Grant consent via
    // the mobile app's consent flow first, then access grants activate correctly.
  }

  // ── Food Items (public system catalog; per-100g macros, USDA/IFCT values) ──────
  // [name, category, calories, proteinG, carbsG, fatG, fiberG] per 100 g edible portion.
  const foodDefs: [string, string, number, number, number, number, number][] = [
    // Grains & Cereals
    ["White Rice (cooked)",        "Grains & Cereals", 130, 2.7,  28.2, 0.3,  0.4],
    ["Brown Rice (cooked)",        "Grains & Cereals", 123, 2.7,  25.6, 1.0,  1.6],
    ["Whole Wheat Chapati",        "Grains & Cereals", 297, 10.6, 49.5, 7.5,  4.9],
    ["Rolled Oats (dry)",          "Grains & Cereals", 389, 16.9, 66.3, 6.9, 10.6],
    ["Quinoa (cooked)",            "Grains & Cereals", 120, 4.4,  21.3, 1.9,  2.8],
    ["Poha (flattened rice, dry)", "Grains & Cereals", 350, 6.6,  77.0, 1.2,  4.0],
    ["Ragi Flour (finger millet)", "Grains & Cereals", 328, 7.3,  72.0, 1.3, 11.5],
    ["Whole Wheat Bread",          "Grains & Cereals", 247, 13.0, 41.0, 3.4,  7.0],
    ["Idli",                       "Grains & Cereals", 132, 4.0,  26.0, 0.4,  1.5],
    // Legumes & Pulses
    ["Toor Dal (cooked)",          "Legumes & Pulses", 121, 6.0,  18.0, 0.4,  4.0],
    ["Moong Dal (cooked)",         "Legumes & Pulses", 105, 7.0,  19.0, 0.4,  2.0],
    ["Chickpeas (boiled)",         "Legumes & Pulses", 164, 8.9,  27.4, 2.6,  7.6],
    ["Rajma / Kidney Beans (boiled)", "Legumes & Pulses", 127, 8.7, 22.8, 0.5, 6.4],
    ["Masoor Dal (cooked)",        "Legumes & Pulses", 116, 9.0,  20.0, 0.4,  8.0],
    ["Green Peas",                 "Legumes & Pulses",  81, 5.4,  14.5, 0.4,  5.7],
    ["Soybean (boiled)",           "Legumes & Pulses", 173, 16.6,  9.9, 9.0,  6.0],
    ["Tofu",                       "Legumes & Pulses",  76, 8.0,   1.9, 4.8,  0.3],
    ["Sprouted Moong",             "Legumes & Pulses",  30, 3.0,   5.9, 0.2,  1.8],
    // Vegetables
    ["Potato (boiled)",            "Vegetables",  87, 1.9, 20.1, 0.1, 1.8],
    ["Spinach (raw)",              "Vegetables",  23, 2.9,  3.6, 0.4, 2.2],
    ["Broccoli",                   "Vegetables",  34, 2.8,  6.6, 0.4, 2.6],
    ["Cauliflower",                "Vegetables",  25, 1.9,  5.0, 0.3, 2.0],
    ["Tomato",                     "Vegetables",  18, 0.9,  3.9, 0.2, 1.2],
    ["Carrot",                     "Vegetables",  41, 0.9,  9.6, 0.2, 2.8],
    ["Onion",                      "Vegetables",  40, 1.1,  9.3, 0.1, 1.7],
    ["Cabbage",                    "Vegetables",  25, 1.3,  5.8, 0.1, 2.5],
    ["Okra / Bhindi",              "Vegetables",  33, 1.9,  7.5, 0.2, 3.2],
    ["Brinjal / Eggplant",         "Vegetables",  25, 1.0,  5.9, 0.2, 3.0],
    ["Cucumber",                   "Vegetables",  15, 0.7,  3.6, 0.1, 0.5],
    ["Bottle Gourd / Lauki",       "Vegetables",  14, 0.6,  3.4, 0.0, 0.5],
    // Fruits
    ["Banana",                     "Fruits", 89, 1.1, 22.8, 0.3, 2.6],
    ["Apple",                      "Fruits", 52, 0.3, 13.8, 0.2, 2.4],
    ["Mango",                      "Fruits", 60, 0.8, 15.0, 0.4, 1.6],
    ["Orange",                     "Fruits", 47, 0.9, 11.8, 0.1, 2.4],
    ["Papaya",                     "Fruits", 43, 0.5, 10.8, 0.3, 1.7],
    ["Guava",                      "Fruits", 68, 2.6, 14.3, 1.0, 5.4],
    ["Pomegranate",                "Fruits", 83, 1.7, 18.7, 1.2, 4.0],
    ["Watermelon",                 "Fruits", 30, 0.6,  7.6, 0.2, 0.4],
    ["Grapes",                     "Fruits", 69, 0.7, 18.1, 0.2, 0.9],
    // Dairy & Eggs
    ["Whole Milk (cow)",           "Dairy & Eggs",  61,  3.2,  4.8,  3.3, 0.0],
    ["Curd / Plain Yogurt",        "Dairy & Eggs",  60,  3.5,  4.7,  3.3, 0.0],
    ["Paneer",                     "Dairy & Eggs", 265, 18.3,  1.2, 20.8, 0.0],
    ["Greek Yogurt (plain)",       "Dairy & Eggs",  59, 10.0,  3.6,  0.4, 0.0],
    ["Egg (whole, boiled)",        "Dairy & Eggs", 155, 13.0,  1.1, 11.0, 0.0],
    ["Egg White",                  "Dairy & Eggs",  52, 11.0,  0.7,  0.2, 0.0],
    ["Cheddar Cheese",             "Dairy & Eggs", 402, 25.0,  1.3, 33.0, 0.0],
    // Meat & Seafood
    ["Chicken Breast (cooked)",    "Meat & Seafood", 165, 31.0, 0.0,  3.6, 0.0],
    ["Mutton (cooked)",            "Meat & Seafood", 294, 25.0, 0.0, 21.0, 0.0],
    ["Rohu Fish",                  "Meat & Seafood",  97, 16.6, 0.0,  3.6, 0.0],
    ["Salmon (cooked)",            "Meat & Seafood", 208, 20.0, 0.0, 13.0, 0.0],
    ["Prawns (cooked)",            "Meat & Seafood",  99, 24.0, 0.2,  0.3, 0.0],
    // Nuts, Seeds & Fats
    ["Almonds",                    "Nuts, Seeds & Fats", 579, 21.2, 21.6, 49.9, 12.5],
    ["Walnuts",                    "Nuts, Seeds & Fats", 654, 15.2, 13.7, 65.2,  6.7],
    ["Peanuts",                    "Nuts, Seeds & Fats", 567, 25.8, 16.1, 49.2,  8.5],
    ["Chia Seeds",                 "Nuts, Seeds & Fats", 486, 16.5, 42.1, 30.7, 34.4],
    ["Flax Seeds",                 "Nuts, Seeds & Fats", 534, 18.3, 28.9, 42.2, 27.3],
    ["Ghee",                       "Nuts, Seeds & Fats", 900,  0.0,  0.0,100.0,  0.0],
    ["Olive Oil",                  "Nuts, Seeds & Fats", 884,  0.0,  0.0,100.0,  0.0],
    ["Fresh Coconut",              "Nuts, Seeds & Fats", 354,  3.3, 15.2, 33.5,  9.0],
  ];
  const foodIdByName = new Map<string, string>();
  for (let i = 0; i < foodDefs.length; i++) {
    const [name, category, cal, p, c, f, fiber] = foodDefs[i];
    const id = mkId("fd", i + 1);
    foodIdByName.set(name, id);
    await db.insert(foodItems).values({
      id,
      name,
      category,
      source: "system",
      isVerified: true,
      createdByUserId: null,
      servingSizeG: "100",
      calories: String(cal),
      proteinG: String(p),
      carbsG: String(c),
      fatG: String(f),
      fiberG: String(fiber),
    }).onConflictDoNothing({ target: foodItems.id });
  }
  console.log(`  ✓ ${foodDefs.length} food items`);

  // ── Recipes (public system recipes; ingredients link to the food catalog) ──────
  const recipeDefs: {
    title: string;
    description: string;
    servings: number;
    prepMinutes: number;
    totalCalories: number;
    instructions: string[];
    ingredients: { name: string; food?: string; quantityG: number }[];
  }[] = [
    {
      title: "Masala Oats",
      description: "Savoury Indian-spiced oats — a high-fibre, 10-minute breakfast.",
      servings: 1, prepMinutes: 10, totalCalories: 320,
      instructions: ["Dry-roast oats for 2 minutes.", "Sauté onion, tomato and spinach with spices.", "Add oats and water; simmer 5 minutes until thick.", "Garnish and serve hot."],
      ingredients: [
        { name: "Rolled Oats (dry)", food: "Rolled Oats (dry)", quantityG: 50 },
        { name: "Onion", food: "Onion", quantityG: 30 },
        { name: "Tomato", food: "Tomato", quantityG: 40 },
        { name: "Spinach", food: "Spinach (raw)", quantityG: 30 },
      ],
    },
    {
      title: "Moong Dal Khichdi",
      description: "One-pot comfort food of rice and yellow moong dal — gentle and protein-rich.",
      servings: 2, prepMinutes: 25, totalCalories: 480,
      instructions: ["Rinse rice and moong dal together.", "Pressure-cook with turmeric, salt and water for 3 whistles.", "Temper with ghee and cumin.", "Serve warm."],
      ingredients: [
        { name: "White Rice", food: "White Rice (cooked)", quantityG: 120 },
        { name: "Moong Dal", food: "Moong Dal (cooked)", quantityG: 100 },
        { name: "Ghee", food: "Ghee", quantityG: 10 },
      ],
    },
    {
      title: "Paneer Bhurji",
      description: "Scrambled cottage cheese with onion and tomato — a quick high-protein meal.",
      servings: 2, prepMinutes: 15, totalCalories: 540,
      instructions: ["Crumble paneer.", "Sauté onion and tomato with spices.", "Add paneer and toss 3 minutes.", "Finish with coriander."],
      ingredients: [
        { name: "Paneer", food: "Paneer", quantityG: 150 },
        { name: "Onion", food: "Onion", quantityG: 50 },
        { name: "Tomato", food: "Tomato", quantityG: 60 },
      ],
    },
    {
      title: "Greek Yogurt Berry Bowl",
      description: "Protein-packed yogurt bowl with banana, chia and almonds.",
      servings: 1, prepMinutes: 5, totalCalories: 360,
      instructions: ["Spoon Greek yogurt into a bowl.", "Top with sliced banana, chia seeds and almonds.", "Drizzle honey if desired."],
      ingredients: [
        { name: "Greek Yogurt", food: "Greek Yogurt (plain)", quantityG: 150 },
        { name: "Banana", food: "Banana", quantityG: 100 },
        { name: "Chia Seeds", food: "Chia Seeds", quantityG: 15 },
        { name: "Almonds", food: "Almonds", quantityG: 15 },
      ],
    },
    {
      title: "Grilled Chicken Salad",
      description: "Lean grilled chicken over crunchy vegetables with olive oil.",
      servings: 1, prepMinutes: 20, totalCalories: 420,
      instructions: ["Grill seasoned chicken breast and slice.", "Toss cucumber and tomato.", "Add chicken; dress with olive oil, lemon and pepper."],
      ingredients: [
        { name: "Chicken Breast", food: "Chicken Breast (cooked)", quantityG: 120 },
        { name: "Cucumber", food: "Cucumber", quantityG: 80 },
        { name: "Tomato", food: "Tomato", quantityG: 60 },
        { name: "Olive Oil", food: "Olive Oil", quantityG: 10 },
      ],
    },
    {
      title: "Vegetable Poha",
      description: "Light flattened-rice breakfast with peas, onion and peanuts.",
      servings: 2, prepMinutes: 15, totalCalories: 400,
      instructions: ["Rinse poha and drain.", "Temper mustard, curry leaves, onion and peas.", "Fold in poha, peanuts, turmeric and salt.", "Finish with lemon and coriander."],
      ingredients: [
        { name: "Poha", food: "Poha (flattened rice, dry)", quantityG: 80 },
        { name: "Green Peas", food: "Green Peas", quantityG: 40 },
        { name: "Onion", food: "Onion", quantityG: 40 },
        { name: "Peanuts", food: "Peanuts", quantityG: 20 },
      ],
    },
    {
      title: "Banana Peanut Smoothie",
      description: "Creamy post-workout smoothie with banana, milk and peanuts.",
      servings: 1, prepMinutes: 5, totalCalories: 350,
      instructions: ["Blend banana, milk and peanuts until smooth.", "Serve chilled."],
      ingredients: [
        { name: "Banana", food: "Banana", quantityG: 120 },
        { name: "Whole Milk", food: "Whole Milk (cow)", quantityG: 200 },
        { name: "Peanuts", food: "Peanuts", quantityG: 20 },
      ],
    },
    {
      title: "Rajma Brown Rice Bowl",
      description: "Fibre- and protein-rich kidney bean curry over brown rice.",
      servings: 2, prepMinutes: 30, totalCalories: 520,
      instructions: ["Cook rajma with onion-tomato masala.", "Serve over brown rice.", "Garnish with coriander."],
      ingredients: [
        { name: "Rajma", food: "Rajma / Kidney Beans (boiled)", quantityG: 150 },
        { name: "Brown Rice", food: "Brown Rice (cooked)", quantityG: 150 },
        { name: "Onion", food: "Onion", quantityG: 40 },
      ],
    },
  ];
  let ingredientCounter = 0;
  for (let i = 0; i < recipeDefs.length; i++) {
    const r = recipeDefs[i];
    const recipeId = mkId("fc", i + 1);
    await db.insert(recipes).values({
      id: recipeId,
      organizationId: null, // system recipe
      createdByUserId: COACH_ID,
      title: r.title,
      description: r.description,
      instructions: r.instructions,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      totalCalories: String(r.totalCalories),
      isPublic: true,
    }).onConflictDoNothing({ target: recipes.id });
    for (let j = 0; j < r.ingredients.length; j++) {
      const ing = r.ingredients[j];
      await db.insert(recipeIngredients).values({
        id: mkId("fb", ++ingredientCounter),
        recipeId,
        foodItemId: ing.food ? foodIdByName.get(ing.food) ?? null : null,
        name: ing.name,
        quantityG: String(ing.quantityG),
        sortOrder: j,
      }).onConflictDoNothing({ target: recipeIngredients.id });
    }
  }
  console.log(`  ✓ ${recipeDefs.length} system recipes`);

  // ── Programs (published, public demo programs owned by the coach's org) ─────────
  // Flow: insert as draft → add modules + sessions → UPDATE status='published'
  // (tg_bump_program_version snapshots the full curriculum into program_versions).
  const programDefs: {
    id: string;
    title: string;
    slug: string;
    description: string;
    durationDays: number;
    modules: { title: string; description: string; sessions: { title: string; body: string; minutes: number }[] }[];
  }[] = [
    {
      id: mkId("fa", 1),
      title: "12-Week Fat Loss Foundation",
      slug: "12-week-fat-loss-foundation",
      description: "A structured 12-week program covering calorie balance, protein targets, and sustainable habits for steady fat loss.",
      durationDays: 84,
      modules: [
        {
          title: "Weeks 1–2: Kickstart",
          description: "Establish your baseline and core daily habits.",
          sessions: [
            { title: "Understanding Energy Balance", body: "Fat loss happens when you consistently consume fewer calories than you expend. This session explains how to estimate your maintenance calories and set a moderate 15–20% deficit that preserves muscle and energy.", minutes: 8 },
            { title: "Setting Your Protein Target", body: "Protein protects muscle in a deficit and keeps you full. Aim for 1.6–2.2 g per kg of bodyweight daily, spread across 3–4 meals. We cover practical sources and portion sizes.", minutes: 7 },
            { title: "Building the Daily Logging Habit", body: "Tracking what you eat is the single highest-leverage habit for fat loss. Learn a 60-second logging routine and how to handle estimation when eating out.", minutes: 6 },
          ],
        },
        {
          title: "Weeks 3–6: Building Habits",
          description: "Layer in movement and meal structure.",
          sessions: [
            { title: "Daily Steps and NEAT", body: "Non-exercise activity thermogenesis (NEAT) can account for hundreds of calories a day. Set a step goal (start at 8,000/day) and learn simple ways to move more without formal exercise.", minutes: 7 },
            { title: "Plate Composition", body: "A simple plate method: half non-starchy vegetables, a quarter lean protein, a quarter whole-grain carbs, plus a thumb of fats. This keeps meals balanced without weighing everything.", minutes: 6 },
          ],
        },
        {
          title: "Weeks 7–12: Sustaining",
          description: "Make progress durable and prevent rebound.",
          sessions: [
            { title: "Navigating Plateaus", body: "Weight loss is rarely linear. Learn when a stall is real versus water-weight noise, and how a brief diet break or a small further deficit can restart progress.", minutes: 8 },
            { title: "Transitioning to Maintenance", body: "Once you reach your goal, gradually add calories back (reverse dieting) over several weeks while monitoring weight, so the result sticks.", minutes: 7 },
          ],
        },
      ],
    },
    {
      id: mkId("fa", 2),
      title: "Muscle Building Foundation",
      slug: "muscle-building-foundation",
      description: "Learn the nutrition and recovery fundamentals that drive lean muscle gain for beginners and early-intermediate trainees.",
      durationDays: 56,
      modules: [
        {
          title: "Nutrition for Growth",
          description: "Fuel muscle synthesis correctly.",
          sessions: [
            { title: "The Lean Bulk Surplus", body: "Muscle gain needs a modest calorie surplus — about 10% above maintenance. Larger surpluses mostly add fat. We cover how to set and adjust your intake based on the scale and the mirror.", minutes: 8 },
            { title: "Protein Timing and Distribution", body: "Total daily protein matters most, but spreading 0.4 g/kg across 4 meals maximises the muscle-building signal. Learn practical meal templates.", minutes: 6 },
          ],
        },
        {
          title: "Training Principles",
          description: "Apply progressive overload safely.",
          sessions: [
            { title: "Progressive Overload Explained", body: "Muscles grow when you ask them to do slightly more over time — more weight, reps, or quality sets. Track your key lifts and aim to beat your last session.", minutes: 7 },
            { title: "Choosing the Right Volume", body: "For beginners, 10–15 hard sets per muscle group per week drives growth without excessive fatigue. We show how to distribute this across a simple weekly split.", minutes: 7 },
          ],
        },
        {
          title: "Recovery",
          description: "Grow between sessions, not just during them.",
          sessions: [
            { title: "Sleep and Muscle Repair", body: "Most muscle repair happens during deep sleep. Aim for 7–9 hours; chronic short sleep blunts gains and raises hunger. Practical sleep-hygiene tips included.", minutes: 6 },
            { title: "Managing Fatigue and Deloads", body: "Every 6–8 weeks, a lighter deload week lets accumulated fatigue dissipate so you can keep progressing. Learn to recognise the signs you need one.", minutes: 6 },
          ],
        },
      ],
    },
    {
      id: mkId("fa", 3),
      title: "Metabolic Reset",
      slug: "metabolic-reset",
      description: "A 4-week reset to stabilise blood sugar, improve energy, and rebuild a healthy relationship with food through whole foods and routine.",
      durationDays: 28,
      modules: [
        {
          title: "Understanding Your Metabolism",
          description: "Why energy and cravings fluctuate.",
          sessions: [
            { title: "Blood Sugar and Energy Swings", body: "Large refined-carb meals spike and then crash blood sugar, driving fatigue and cravings. Pairing carbs with protein, fat and fibre flattens the curve and steadies energy.", minutes: 7 },
            { title: "The Role of Fibre", body: "Fibre slows digestion, feeds gut bacteria, and improves satiety. Most people get half the 25–30 g they need. We map out easy ways to close the gap with vegetables, legumes and whole grains.", minutes: 6 },
          ],
        },
        {
          title: "The Reset Protocol",
          description: "Four weeks of structured whole-food eating.",
          sessions: [
            { title: "Building a Reset Plate", body: "Each meal centres on protein and vegetables, with whole-grain carbs sized to your activity. We provide a template and a sample day using common Indian foods.", minutes: 8 },
            { title: "Hydration and Routine", body: "Consistent meal timing and adequate water support stable energy and digestion. Set anchor meal times and a daily water target appropriate to your bodyweight.", minutes: 6 },
          ],
        },
        {
          title: "Maintenance",
          description: "Carry the gains forward.",
          sessions: [
            { title: "The 80/20 Approach", body: "Long-term success comes from eating well about 80% of the time while leaving room for foods you enjoy. This prevents the all-or-nothing cycle that derails most plans.", minutes: 6 },
          ],
        },
      ],
    },
  ];

  // Deterministic curriculum IDs (no running counters) so the block is fully re-runnable even
  // when an earlier program is skipped or left half-built by a failed run.
  for (let pIdx = 0; pIdx < programDefs.length; pIdx++) {
    const def = programDefs[pIdx];
    const existing = await db.select({ status: programs.status }).from(programs).where(eq(programs.id, def.id)).limit(1);
    if (existing[0]?.status === "published") {
      console.log(`  • program "${def.title}" already published — skipping`);
      continue;
    }
    if (existing[0]) {
      // Leftover draft from a prior failed run — wipe its curriculum and rebuild deterministically.
      await db.delete(programSessions).where(eq(programSessions.programId, def.id));
      await db.delete(programModules).where(eq(programModules.programId, def.id));
    } else {
      await db.insert(programs).values({
        id: def.id,
        organizationId: ORG_ID,
        createdByUserId: COACH_ID,
        title: def.title,
        slug: def.slug,
        description: def.description,
        pricePaise: 0,
        currency: "INR",
        durationDays: def.durationDays,
        status: "draft",
        visibility: "public",
      });
    }
    for (let mIdx = 0; mIdx < def.modules.length; mIdx++) {
      const m = def.modules[mIdx];
      const moduleId = mkId("f9", (pIdx + 1) * 100 + mIdx);
      await db.insert(programModules).values({
        id: moduleId,
        programId: def.id,
        title: m.title,
        description: m.description,
        sortOrder: mIdx,
      });
      for (let sIdx = 0; sIdx < m.sessions.length; sIdx++) {
        const s = m.sessions[sIdx];
        await db.insert(programSessions).values({
          id: mkId("f8", (pIdx + 1) * 1000 + mIdx * 100 + sIdx),
          moduleId,
          programId: def.id,
          title: s.title,
          contentType: "article",
          content: { body: s.body },
          durationSeconds: s.minutes * 60,
          sortOrder: sIdx,
        });
      }
    }
    // Publish: fires tg_bump_program_version → snapshots curriculum into program_versions.
    await db.update(programs).set({ status: "published" }).where(eq(programs.id, def.id));
    console.log(`  ✓ program "${def.title}" published (${def.modules.length} modules)`);
  }

  // ── Metric Definitions ────────────────────────────────────────────────────────
  await db.insert(metricDefinitions).values([
    { id: "00000000-0000-0000-0000-0000000005a1", code: "weight_kg",          displayName: "Weight",             category: "body_composition",  valueType: "numeric", canonicalUnit: "kg" },
    { id: "00000000-0000-0000-0000-0000000005a2", code: "height_cm",          displayName: "Height",             category: "body_composition",  valueType: "numeric", canonicalUnit: "cm" },
    { id: "00000000-0000-0000-0000-0000000005a3", code: "body_fat_pct",       displayName: "Body Fat",           category: "body_composition",  valueType: "numeric", canonicalUnit: "%" },
    { id: "00000000-0000-0000-0000-0000000005a4", code: "resting_heart_rate", displayName: "Resting Heart Rate", category: "vital",             valueType: "integer", canonicalUnit: "bpm" },
    { id: "00000000-0000-0000-0000-0000000005a5", code: "sleep_hours",        displayName: "Sleep",              category: "sleep",             valueType: "numeric", canonicalUnit: "h" },
    { id: "00000000-0000-0000-0000-0000000005a6", code: "mood_level",         displayName: "Mood",               category: "vital",             valueType: "integer", canonicalUnit: null },
    { id: "00000000-0000-0000-0000-0000000005a7", code: "energy_level",       displayName: "Energy",             category: "vital",             valueType: "integer", canonicalUnit: null },
    { id: "00000000-0000-0000-0000-0000000005a8", code: "water_glasses",      displayName: "Water",              category: "nutrition_derived", valueType: "integer", canonicalUnit: "glass" },
  ]).onConflictDoNothing({ target: metricDefinitions.id });
  console.log("  ✓ 8 metric definitions");

  // ── Coaching Sessions (coach ↔ mobile client) ─────────────────────────────────
  // Real coaching_sessions so the coach platform Sessions page + mobile session
  // screen have data. Zoom URLs start null — created on demand from the coach UI.
  if (MOBILE_USER_ID) {
    await db.insert(coachingSessions).values([
      {
        id: mkId("c5", 1),
        organizationId: ORG_ID,
        coachUserId: COACH_ID,
        clientUserId: MOBILE_USER_ID,
        title: "1:1 Progress Check-in",
        description: "Review meal logs, adjust the diet chart, and set goals for next week.",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMinutes: 45,
        status: "scheduled",
        createdByUserId: COACH_ID,
      },
      {
        id: mkId("c5", 2),
        organizationId: ORG_ID,
        coachUserId: COACH_ID,
        clientUserId: MOBILE_USER_ID,
        title: "Monthly Strategy Session",
        description: "Deep-dive review of the last month and plan the next phase.",
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        durationMinutes: 60,
        status: "scheduled",
        createdByUserId: COACH_ID,
      },
    ]).onConflictDoNothing({ target: coachingSessions.id });
    console.log("  ✓ 2 coaching sessions");
  }

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
