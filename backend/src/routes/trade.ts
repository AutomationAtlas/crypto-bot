import { Router, IRouter, Request, Response } from "express";
import { trader } from "../trader";
import { getPrice, getRegisteredSymbols } from "../priceFeed";
import { riskEngine } from "../risk";
import { logger } from "../logger";

const router: IRouter = Router();

router.post("/trade/buy", (req: Request, res: Response) => {
  const { symbol, qty } = req.body as { symbol?: string; qty?: number };

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ ok: false, error: "symbol is required" });
    return;
  }
  if (!getRegisteredSymbols().includes(symbol)) {
    res.status(400).json({ ok: false, error: `unknown symbol '${symbol}'. valid: ${getRegisteredSymbols().join(", ")}` });
    return;
  }
  if (typeof qty !== "number" || qty <= 0) {
    res.status(400).json({ ok: false, error: "qty must be a positive number" });
    return;
  }

  const price = getPrice(symbol);
  if (price === undefined) {
    res.status(500).json({ ok: false, error: "price unavailable" });
    return;
  }

  const riskCheck = riskEngine.checkBuy(symbol, qty, price, trader.getSnapshot());
  if (!riskCheck.ok) {
    res.status(400).json({ ok: false, violations: riskCheck.violations });
    return;
  }

  const result = trader.buy(symbol, qty, price);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }

  const { trade } = result;
  logger.info("trade", {
    tradeId: trade.id, side: trade.side, symbol: trade.symbol,
    qty: trade.qty, price: trade.price, total: trade.total, balanceAfter: trade.balanceAfter,
    source: "manual",
  });

  res.json({ ...result, snapshot: trader.getSnapshot() });
});

router.post("/trade/sell", (req: Request, res: Response) => {
  const { symbol, qty } = req.body as { symbol?: string; qty?: number };

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ ok: false, error: "symbol is required" });
    return;
  }
  if (typeof qty !== "number" || qty <= 0) {
    res.status(400).json({ ok: false, error: "qty must be a positive number" });
    return;
  }

  const price = getPrice(symbol);
  if (price === undefined) {
    res.status(400).json({ ok: false, error: `no price for symbol '${symbol}'` });
    return;
  }

  const riskCheck = riskEngine.checkSell();
  if (!riskCheck.ok) {
    res.status(400).json({ ok: false, violations: riskCheck.violations });
    return;
  }

  const result = trader.sell(symbol, qty, price);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }

  const { trade } = result;
  logger.info("trade", {
    tradeId: trade.id, side: trade.side, symbol: trade.symbol,
    qty: trade.qty, price: trade.price, total: trade.total, balanceAfter: trade.balanceAfter,
    source: "manual",
  });

  res.json({ ...result, snapshot: trader.getSnapshot() });
});

router.get("/trade/portfolio", (_req: Request, res: Response) => {
  res.json(trader.getSnapshot());
});

router.get("/trade/history", (_req: Request, res: Response) => {
  res.json(trader.getHistory());
});

export default router;
