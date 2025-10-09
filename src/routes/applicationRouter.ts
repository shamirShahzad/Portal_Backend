import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import applicationController from "../controller/ApplicationController";

const applicationRouter = express.Router();

applicationRouter.get("/", applicationController.getApplications);
applicationRouter.get(
  "/detailed",
  applicationController.getDetailedApplications
);
applicationRouter.post("/", applicationController.createApplication);
applicationRouter.put("/:id", applicationController.updateApplication);
applicationRouter.delete("/:id", applicationController.deleteApplication);

export default applicationRouter;
