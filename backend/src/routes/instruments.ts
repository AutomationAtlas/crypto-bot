import { Router, IRouter, Request, Response } from "express";
import { INSTRUMENTS, getAllPriceData } from "../priceFeed";

const router: IRouter = Router();

// ── GET /api/instruments ──────────────────────────────────────────────────────
// Returns the list of tracked crypto instruments with current price data.

router.get("/instruments", (_req: Request, res: Response) => {
  const priceData = getAllPriceData();
  const instruments = INSTRUMENTS.map((symbol) => ({
    symbol,
    displayName: symbol.replace("USDT", "/USDT"),
    ...priceData[symbol] ?? { price: null, timestamp: null },
  }));
  res.json({ instruments });
});

export default router;
