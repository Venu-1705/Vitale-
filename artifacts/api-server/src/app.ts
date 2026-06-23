import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { identityMiddleware } from "./middlewares/identity";
import { errorHandler } from "./lib/http";

const app: Express = express();

// Behind App Runner / a load balancer in production the real client IP arrives
// via X-Forwarded-For. Trust exactly one proxy hop so rate limiting keys on the
// real client IP (and never trusts a spoofable header in local dev).
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// --- Security headers -------------------------------------------------------
app.use(helmet());

// --- CORS allowlist ---------------------------------------------------------
// Browsers may only call the API from explicitly-allowed origins. Native apps
// (React Native) and server-to-server callers (the Cashfree webhook) send no
// Origin header and are always allowed; auth is still enforced by the bearer token.
const allowedOrigins = new Set<string>(
  [
    ...(process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()),
    (process.env.COACH_PLATFORM_URL ?? "").trim(),
    ...(process.env.NODE_ENV !== "production"
      ? ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"]
      : []),
  ].filter(Boolean),
);
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin (native app / server-to-server) or an allowlisted origin → allow.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false); // deny without a 500 — the browser blocks the response
  },
  credentials: true,
};
app.use(cors(corsOptions));

// --- Rate limiting ----------------------------------------------------------
// The Cashfree webhook must always be reachable for signed payment callbacks, so
// it is exempt from the global limiter.
const CASHFREE_WEBHOOK_PATH = "/api/shop/cashfree/webhook";
const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === CASHFREE_WEBHOOK_PATH,
});
app.use(globalLimiter);

// Stricter limit on payment-order creation (card-testing / abuse guard).
const paymentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/shop/cashfree/order", paymentLimiter);

// Capture the RAW request body so gateway webhooks (Cashfree) can verify their HMAC
// signature over the exact bytes received — re-serializing the parsed JSON would
// change whitespace/key-order and break verification. Stored only for the webhook path.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Single identity seam: resolves demo identity into req.userId for every request
// (anonymous-friendly; authedRoute enforces presence where required). At auth
// cutover, only identityMiddleware changes.
app.use(identityMiddleware);

app.use("/api", router);

// Terminal error mapper: DbError/ZodError/ApiError → uniform HTTP envelope.
// MUST be mounted last, after all routers.
app.use(errorHandler);

export default app;
