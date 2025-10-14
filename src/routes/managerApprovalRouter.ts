import { Router } from "express";
import managerApprovalController from "../controller/ManagerApprovalController";
import errorMiddleware from "../middlewares/errorMiddleware";

const router = Router();

// Send manager approval notification
router.post(
  "/:applicationId/send-notification",
  managerApprovalController.sendManagerNotification,
  errorMiddleware
);

// Get application for manager review (with token validation)
router.get(
  "/:applicationId/review",
  managerApprovalController.getApplicationForReview,
  errorMiddleware
);

// Submit manager approval decision
router.post(
  "/:applicationId/approve",
  managerApprovalController.submitManagerApproval,
  errorMiddleware
);

export default router;