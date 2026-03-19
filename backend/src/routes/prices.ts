import { Router, IRouter, Request, Response } from "express";
import { getAllPriceData, INSTRUMENTS } from "../priceFeed";

const router: IRouter = Router();

// ── GET /api/prices ───────────────────────────────────────────────────────────
// Returns the latest cached price for all tracked instruments.
// Shape: { prices: Record<string, CryptoPriceData>, instruments: string[], cachedAt: string }

router.get("/prices", (_req: Request, res: Response) => {
  const prices = getAllPriceData();
  res.json({
    prices,
    instruments: [...INSTRUMENTS],
    cachedAt: new Date().toISOString(),
  });
});

export default router;
