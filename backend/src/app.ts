import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? env.CORS_ORIGIN_PROD
        : env.CORS_ORIGIN_DEV,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("server is running");
});

export default app;
