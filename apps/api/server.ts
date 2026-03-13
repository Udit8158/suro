import express from "express";
import "dotenv/config";
import urlRouter from "./routes/url.routes";
import { redirectUrlController } from "./controllers/url.controller";

export const PORT = process.env.PORT || 3000;

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
  res.status(404).json("Sorry, can't find that!");
});

app.listen(PORT, () => {
  console.log("Server is running");
});
