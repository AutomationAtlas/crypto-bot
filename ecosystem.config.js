const path = require("path");
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "crypto-bot-backend",
      script: "/usr/bin/node",
      args: "/root/crypto-bot/backend/node_modules/.bin/tsx src/index.ts",
      cwd: path.join(root, "backend"),
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        PORT: "8082",
        PAPER_TRADING: "true",
        STRATEGY_ENABLED: "true",
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_CHAT_ID: "",
      },
    },
    {
      name: "crypto-bot-dashboard",
      script: "/usr/bin/node",
      args: "/root/crypto-bot/dashboard/node_modules/.bin/next start -p 3082",
      cwd: path.join(root, "dashboard"),
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "http://localhost:8082",
      },
    },
  ],
};
