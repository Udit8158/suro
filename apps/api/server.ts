import { app } from "./app";
import { startCacheCleanUp } from "./cache/cache";
import { PORT } from "./utils/constant";

// starting the background cacheCleanUp job
const cacheCleanUpTimer = startCacheCleanUp(60);

// clearning that timer while closing the sever (only few cases)
process.on("SIGINT", () => {
  clearInterval(cacheCleanUpTimer);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(cacheCleanUpTimer);
  process.exit(0);
});

app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});
