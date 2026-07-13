// Install-time script hooks — these run automatically on `npm install`, the #1
// vector for malicious dependencies / "clone this repo" job-offer attacks.
export const INSTALL_HOOKS = ["preinstall", "install", "postinstall", "prepare", "prepublish", "preprepare", "prepack"];

// High-risk patterns in a script command: remote fetch-and-execute, obfuscation,
// dynamic eval, raw-IP callbacks, hex/base64 payloads.
export const OBFUSCATION: RegExp[] = [
  /\bcurl\b[\s\S]*?\|\s*(ba)?sh\b/i,
  /\bwget\b[\s\S]*?\|\s*(ba)?sh\b/i,
  /\|\s*(ba)?sh\b/i,
  /\beval\s*\(/i,
  /\batob\s*\(/i,
  /Buffer\.from\([^)]*base64/i,
  /child_process/i,
  /\bnode\s+-e\b/i,
  /require\(['"]https?['"]\)/i,
  /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/, // raw-IP URL
  /\\x[0-9a-f]{2}/i, // hex escapes
];

// Popular npm packages used for typosquat / look-alike detection.
export const POPULAR = new Set([
  "react", "react-dom", "vue", "angular", "svelte", "next", "nuxt",
  "express", "koa", "fastify", "body-parser", "cors", "morgan", "helmet",
  "lodash", "underscore", "ramda", "axios", "node-fetch", "request", "got", "form-data", "qs",
  "chalk", "commander", "yargs", "inquirer", "ora", "debug", "dotenv", "cross-env",
  "moment", "dayjs", "date-fns", "uuid", "nanoid", "semver", "glob", "rimraf", "fs-extra",
  "jsonwebtoken", "bcrypt", "bcryptjs", "passport", "mongoose", "sequelize", "prisma", "pg", "mysql", "mysql2", "redis", "ioredis",
  "socket.io", "ws", "classnames", "prop-types", "styled-components", "tailwindcss",
  "webpack", "vite", "rollup", "esbuild", "typescript", "ts-node", "nodemon",
  "eslint", "prettier", "jest", "mocha", "chai", "vitest", "cypress", "playwright", "puppeteer",
  "ethers", "web3", "bignumber.js", "bn.js", "@solana/web3.js", "viem", "wagmi",
]);

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
