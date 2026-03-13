import express from "express";
import { shortenUrlController } from "../controllers/url.controller";

const urlRouter = express.Router();

urlRouter.post("/shorten", shortenUrlController);

export default urlRouter;
