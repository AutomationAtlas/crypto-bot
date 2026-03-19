import { Router, IRouter, Request, Response } from "express";
import { enable, disable, isEnabled, getStatus } from "../strategy";
import { logger } from "../logger";

const router: IRouter = Router();

router.get("/strategy/status", (_req: Request, res: Response) => {
  res.json(getStatus());
});

router.post("/strategy/enable", (_req: Request, res: Response) => {
  if (isEnabled()) {
    res.json({ ok: true, message: "strategy already enabled" });
    return;
  }
  enable();
  logger.info("strategy", { msg: "Strategy enabled via API" });
  res.json({ ok: true, message: "strategy enabled" });
});

router.post("/strategy/disable", (_req: Request, res: Response) => {
  if (!isEnabled()) {
    res.json({ ok: true, message: "strategy already disabled" });
    return;
  }
  disable();
  logger.info("strategy", { msg: "Strategy disabled via API" });
  res.json({ ok: true, message: "strategy disabled" });
});

export default router;
