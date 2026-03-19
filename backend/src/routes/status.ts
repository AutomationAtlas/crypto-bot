import { Router, IRouter, Request, Response } from "express";
import { trader } from "../trader";
import { riskEngine } from "../risk";
import { config } from "../config/env";
import { getEvents } from "../eventStore";

const router: IRouter = Router();

router.get("/status", (_req: Request, res: Response) => {
  const snapshot  = trader.getSnapshot();
  const dailyPnl  = snapshot.portfolioValue - riskEngine.sessionOpenValue;

  res.json({
    uptime:               process.uptime(),
    mode:                 config.paperTrading ? "paper" : "live",
    halted:               riskEngine.isHalted(),
    haltReason:           riskEngine.getHaltReason(),
    sessionOpenValue:     riskEngine.sessionOpenValue,
    currentPortfolioValue: snapshot.portfolioValue,
    dailyPnl,
    dailyPnlPct:          (dailyPnl / riskEngine.sessionOpenValue) * 100,
    openPositions:        snapshot.positions.length,
    riskRules:            riskEngine.getLimits(),
    timestamp:            new Date().toISOString(),
  });
});

router.get("/events", (req: Request, res: Response) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  res.json(getEvents(type));
});

export default router;
