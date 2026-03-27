import express from "express";
import { shortenUrlController } from "../controllers/url.controller";
import { rateLimiter } from "../middleware/rate_limiter.middleware";

const urlRouter = express.Router();

urlRouter.post("/shorten", rateLimiter, shortenUrlController);

export default urlRouter;
