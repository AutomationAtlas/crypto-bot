import { Router, Request, Response, IRouter } from "express";
import { config } from "../config/env";

const router: IRouter = Router();
const startedAt = new Date().toISOString();

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status:    "ok",
    uptime:    process.uptime(),
    startedAt,
    mode:      config.paperTrading ? "paper" : "live",
    env:       config.nodeEnv,
  });
});

export default router;
