import express from "express";
import urlRouter from "./routes/url.routes";
import { redirectUrlController } from "./controllers/url.controller";

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json("OKAY");
});

app.use("/api/url", urlRouter);
app.use("/:slug", redirectUrlController);

app.use((req, res) => {
  res.status(404).json("Sorry, can't find any route like this! Check docs.");
});

export { app };
