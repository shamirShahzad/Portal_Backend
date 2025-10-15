import { Router } from "express";
import exportController from "../controller/ExportController";
import errorMiddleware from "../middlewares/errorMiddleware";
import { isAuthenticated } from "../middlewares/isAuthenticated";

const router = Router();

// Apply authentication to all export routes
router.use(isAuthenticated);

// Get export history (must come before /:exportId routes)
router.get(
  "/",
  exportController.getExportHistory,
  errorMiddleware
);

// Create export job
router.post(
  "/",
  exportController.createExport,
  errorMiddleware
);

// Download export file (specific route before general /:exportId)
router.get(
  "/:exportId/download",
  exportController.downloadExport,
  errorMiddleware
);

// Get export job status
router.get(
  "/:exportId",
  exportController.getExportStatus,
  errorMiddleware
);

// Delete export job
router.delete(
  "/:exportId",
  exportController.deleteExport,
  errorMiddleware
);

export default router;