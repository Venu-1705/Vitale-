import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { identityMiddleware } from "./middlewares/identity";
import { errorHandler } from "./lib/http";

const app: Express = express();

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
app.use(cors());
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
