import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import applicationController from "../controller/ApplicationController";

const applicationRouter = express.Router();

applicationRouter.get("/", applicationController.getApplications);
applicationRouter.post("/", applicationController.createApplication);

export default applicationRouter;
