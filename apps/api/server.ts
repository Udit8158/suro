import express from "express";
import { PORT } from "./utils/constant";
import urlRouter from "./routes/url.routes";
import { redirectUrlController } from "./controllers/url.controller";

const app = express();
app.use(express.json());

// health checking
app.get("/health", (req, res) => {
  res.json("OKAY");
});

app.use("/api/url", urlRouter);
app.use("/:slug", redirectUrlController);

// 404 handler for undefined routes (place before the error handler)
app.use((req, res) => {
  res.status(404).json("Sorry, can't find any route like this! Check docs.");
});

app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});

// export { PORT };
