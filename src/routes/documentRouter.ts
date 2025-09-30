import express from "express";
const documentRouter = express.Router();
import documentController from "../controller/DocumentController";
import { upload } from "../util/multerConfig";

documentRouter.get("/", documentController.getAllDocuments);
documentRouter.post(
  "/",
  upload.array("documents"),
  documentController.createNewDocument
);
documentRouter.put("/:id", documentController.updateDocument);
documentRouter.delete("/:id", documentController.deleteDocument);

export default documentRouter;
