import { Router, type IRouter } from "express";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import healthRouter from "./health";
import shopRouter from "./shop";
import paymentsRouter from "./payments";
import cartRouter from "./cart";
import labsRouter from "./labs";
import programsRouter from "./programs";
import ordersRouter from "./orders";
import merchantRouter from "./merchant";
import organizationsRouter from "./organizations";
import accessRouter from "./access";
import collaborationRouter from "./collaboration";
import clinicalRouter from "./clinical";
import healthDataRouter from "./health-data";
import nutritionRouter from "./nutrition";
import communityRouter from "./community";
import messagingRouter from "./messaging";
import notificationsRouter from "./notifications";
import sessionsRouter from "./sessions";
import zoomRouter, { zoomCallbackRouter } from "./zoom";
import diagRouter from "./_diag";

const router: IRouter = Router();

// ── Auth posture ──────────────────────────────────────────────────────────────
// Identity is verified globally by middlewares/identity.ts (Supabase JWT → req.userId).
// Here we attach `req.user = { id, email, role }` and enforce presence per router:
//   • optionalAuth — public surfaces (storefront catalog, Cashfree webhook intake,
//     programs catalog). Personalizes when signed in; never rejects.
//   • requireAuth  — everything customer/coach-private. 401 before the handler if no
//     valid identity. (authedRoute also enforces inside each handler — defense in depth.)
// The Cashfree webhook lives in paymentsRouter as an unauthenticated, signature-verified
// handler, so paymentsRouter is mounted under optionalAuth (not requireAuth).

// ── Public / personalizable (mounted BEFORE the requireAuth gate) ───────────────
router.use(healthRouter);                          // liveness/health probe (/healthz)
router.use(optionalAuth, programsRouter);          // includes the public published-program catalog
router.use("/shop", optionalAuth, shopRouter);     // storefront catalog reads
router.use("/shop", optionalAuth, paymentsRouter); // /shop/cashfree/* (webhook is public) + status
router.use(zoomCallbackRouter);                    // /zoom/callback — Zoom redirects here; no auth token

// ── Auth gate: every router mounted BELOW requires a verified identity ──────────
// One global guard (runs once per request) instead of per-router wrapping. It also
// attaches req.user for the handlers below; authedRoute still enforces inside each.
router.use(requireAuth);

router.use(cartRouter);
router.use("/labs", labsRouter);
router.use(ordersRouter);
router.use("/merchant", merchantRouter);
router.use("/organizations", organizationsRouter);
router.use(accessRouter);
router.use(collaborationRouter);
router.use(clinicalRouter);
router.use(healthDataRouter);
router.use(nutritionRouter);
router.use(communityRouter);
router.use(messagingRouter);
router.use(notificationsRouter);
router.use("/sessions", sessionsRouter);
router.use(zoomRouter);           // /zoom/status, /zoom/connect, /zoom/callback, /zoom/connection, /zoom/sdk-signature

// Dev-only Phase 0 seam self-check. Never mounted in production.
if (process.env["DIAG_ENABLED"] === "1") {
  router.use("/_diag", diagRouter);
}

export default router;
