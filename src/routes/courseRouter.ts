import express from "express";
const courseRouter = express.Router();

import { isAuthenticated } from "../middlewares/isAuthenticated";
import courseController from "../controller/CourseController";
import { upload } from "../util/multerConfig";

courseRouter.get("/", courseController.getCourse);
courseRouter.post(
  "/",
  isAuthenticated,
  upload.single("image"),
  courseController.createCourse
);

courseRouter.put(
  "/:id",
  isAuthenticated,
  upload.single("image"),
  courseController.updateCourse
);

courseRouter.delete("/:id", isAuthenticated, courseController.deleteCourse);
export default courseRouter;
