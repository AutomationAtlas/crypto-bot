import { Router, IRouter, Request, Response } from "express";
import { riskEngine } from "../risk";
import { config } from "../config/env";
import { broadcastRiskEvent } from "../ws/broadcaster";
import { logger } from "../logger";

const router: IRouter = Router();

router.post("/halt", (req: Request, res: Response) => {
  const reason = (req.body as { reason?: string }).reason?.trim() || "manual halt via API";
  riskEngine.halt(reason);
  broadcastRiskEvent({ rule: "HALTED", message: reason });
  logger.warn("risk_event", { rule: "HALTED", message: reason });
  res.json({ ok: true, halted: true, reason });
});

router.post("/resume", (_req: Request, res: Response) => {
  const result = riskEngine.resume(config.paperTrading);
  if (!result.ok) {
    res.status(403).json({ ok: false, error: result.error });
    return;
  }
  broadcastRiskEvent({ rule: "HALTED", message: "trading resumed" });
  logger.info("risk_event", { rule: "RESUME", message: "trading resumed" });
  res.json({ ok: true, halted: false });
});

export default router;
