import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { config } from "./config/env";
import { loadConfig } from "./config/configStore";

// Load persisted settings before anything else reads liveConfig
loadConfig();

import healthRouter    from "./routes/health";
import tradeRouter     from "./routes/trade";
import controlRouter   from "./routes/control";
import statusRouter    from "./routes/status";
import strategyRouter  from "./routes/strategy";
import configRouter    from "./routes/config";
import instrumentsRouter from "./routes/instruments";
import pricesRouter      from "./routes/prices";
import { initBroadcaster } from "./ws/broadcaster";
import { initPriceFeed } from "./priceFeed";
import { initStrategy } from "./strategy";
import { logger } from "./logger";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", tradeRouter);
app.use("/api", controlRouter);
app.use("/api", statusRouter);
app.use("/api", strategyRouter);
app.use("/api", configRouter);
app.use("/api", instrumentsRouter);
app.use("/api", pricesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("[ws] client connected");
  ws.send(JSON.stringify({ type: "connected", mode: config.paperTrading ? "paper" : "live" }));
  ws.on("close", () => console.log("[ws] client disconnected"));
});

initPriceFeed();
initBroadcaster(wss);
initStrategy();

server.listen(config.port, () => {
  logger.info("server_start", {
    port:         config.port,
    mode:         config.paperTrading ? "paper" : "live",
    paperBalance: config.paperBalance,
    wsPath:       "/ws",
  });
});
