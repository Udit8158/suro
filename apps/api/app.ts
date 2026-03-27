import express from "express";
import urlRouter from "./routes/url.routes";
import { redirectUrlController } from "./controllers/url.controller";
import { cacheStats, shortenUrlCache } from "./cache/cache";
import { rateLimiter } from "./middleware/rate_limiter.middleware";

const app = express();

app.set("trust proxy", true); // or a specific IP/subnet
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json("OKAY");
});
// this should be admin only (or protected somehow)
app.get("/api/dev/cache-stats", (req, res) => {
  cacheStats.size = shortenUrlCache.size; // calcualting the current cache size
  res.json({
    data: cacheStats,
  });
});

app.use("/api/url", urlRouter);
app.use("/:slug", rateLimiter, redirectUrlController);

app.use((req, res) => {
  res.status(404).json("Sorry, can't find any route like this! Check docs.");
});

export { app };
