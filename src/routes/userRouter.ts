import express from "express";
import userController from "../controller/UserController";
import { isAuthenticated } from "../middlewares/isAuthenticated";
const userRouter = express.Router();

userRouter.post("/register", userController.register);
userRouter.get("/auth/confirm", userController.confirm);
userRouter.post("/login", userController.login);
userRouter.post("/auth", isAuthenticated, userController.authCheck);
userRouter.post("/logout", isAuthenticated, userController.logout);
userRouter.get("/me", isAuthenticated, userController.getMe);

export default userRouter;
