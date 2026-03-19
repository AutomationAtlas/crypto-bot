import { Router, IRouter, Request, Response } from "express";
import { liveConfig, LiveConfig, saveConfig } from "../config/configStore";
import { logger } from "../logger";

const router: IRouter = Router();

router.get("/config", (_req: Request, res: Response) => {
  res.json(liveConfig);
});

interface FieldRule {
  min: number;
  max: number;
}

const RULES: Partial<Record<keyof LiveConfig, FieldRule>> = {
  pricePollIntervalMs:             { min: 5_000,  max: 60_000  },
  strategySizeUsd:                 { min: 10,     max: 10_000  },
  strategyLookback:                { min: 5,      max: 100     },
  strategyConsecutiveTicks:        { min: 1,      max: 10      },
  riskMaxPositions:                { min: 1,      max: 10      },
  riskDailyLossCapPct:             { min: 0.01,   max: 1.0     },
  riskConsecutiveLossPause:        { min: 1,      max: 20      },
  riskConsecutiveLossPauseMinutes: { min: 1,      max: 480     },
  riskCooldownAfterStopMin:        { min: 0,      max: 480     },
  riskMaxEntriesPerInstrument:     { min: 1,      max: 20      },
  riskHardStopPct:                 { min: 0.005,  max: 0.20    },
  riskSlPct:                       { min: 0.005,  max: 0.20    },
  riskTp1Pct:                      { min: 0.005,  max: 0.50    },
  riskTp1Qty:                      { min: 0.10,   max: 1.0     },
  riskTp1SlOffset:                 { min: 0,      max: 0.10    },
  riskTp2Pct:                      { min: 0.005,  max: 0.50    },
  riskTp2Qty:                      { min: 0.10,   max: 1.0     },
  riskTrailPct:                    { min: 0.005,  max: 0.20    },
};

router.post("/config", (req: Request, res: Response) => {
  const body   = req.body as Partial<Record<string, unknown>>;
  const errors: string[] = [];
  const updated: Partial<LiveConfig> = {};

  for (const rawKey of Object.keys(body)) {
    const key  = rawKey as keyof LiveConfig;
    const rule = RULES[key];
    if (!rule) continue;
    const val = body[rawKey];

    if (typeof val !== "number" || !isFinite(val)) {
      errors.push(`${key}: must be a finite number`);
      continue;
    }
    if (val < rule.min || val > rule.max) {
      errors.push(`${key}: ${val} out of range [${rule.min}, ${rule.max}]`);
      continue;
    }
    updated[key] = val as never;
  }

  if (errors.length > 0) {
    res.status(400).json({ ok: false, errors });
    return;
  }

  Object.assign(liveConfig, updated);
  saveConfig();

  logger.info("config_update", { msg: "Live config updated", changes: updated });
  res.json({ ok: true, config: liveConfig });
});

export default router;
