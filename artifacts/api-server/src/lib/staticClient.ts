import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger";

function resolveClientDistDir(): string | null {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const configured = process.env.CLIENT_DIST_DIR;
  const candidates = [
    configured ? path.resolve(process.cwd(), configured) : null,
    path.resolve(process.cwd(), "artifacts/exam-practice/dist/public"),
    path.resolve(moduleDir, "../../exam-practice/dist/public"),
  ].filter((candidate): candidate is string => candidate !== null);

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
}

function shouldServeIndex(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  if (req.path.startsWith("/api")) {
    return false;
  }

  if (path.extname(req.path)) {
    return false;
  }

  const accept = req.headers.accept;
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

export function serveStaticClient(app: Express): void {
  const clientDistDir = resolveClientDistDir();

  if (!clientDistDir) {
    logger.warn(
      "Client build not found. Run `pnpm run build:host` or set CLIENT_DIST_DIR to serve the web app.",
    );
    return;
  }

  app.use(
    express.static(clientDistDir, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1y" : 0,
      setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!shouldServeIndex(req)) {
      next();
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(clientDistDir, "index.html"));
  });

  logger.info({ clientDistDir }, "Serving client build");
}
