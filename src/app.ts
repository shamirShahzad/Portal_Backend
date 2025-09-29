import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/userRouter";
import errorMiddleware from "./middlewares/errorMiddleware";
import courseRouter from "./routes/courseRouter";
import path from "path";
import applicationRouter from "./routes/applicationRouter";

const app = express();
const port = process.env.PORT || 3000;

//CORS
app.use(cors({ origin: process.env.CORS, credentials: true }));

//Middlewares
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1/users", userRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/applications", applicationRouter);
app.use(errorMiddleware);

app.get("/", (req, res) => res.send("Hello World!"));
app.get("/confirm", (req, res) => res.send("Confirm endpoint"));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
