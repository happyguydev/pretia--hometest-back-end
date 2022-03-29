import argon2 from "argon2";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { PrismaClient, User, Applist } from "@prisma/client";
import * as yup from "yup";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET ?? "jwtsecret";
const ACCESS_TOKEN_MINUTES = process.env.ACCESS_TOKEN_MINUTES
  ? +process.env.ACCESS_TOKEN_MINUTES
  : 5;
const REFRESH_TOKEN_MINUTES = process.env.REFRESH_TOKEN_MINUTES
  ? +process.env.REFRESH_TOKEN_MINUTES
  : 60 * 4;
const WEB_URL = process.env.WEB_URL || "http://localhost:4100";

const app = express();
// stripe webhook body should not be parsed as json
app.use((req, res, next): void => {
  express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: WEB_URL, credentials: true }));
if (process.env.NODE_ENV !== "test")
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "short"));

interface TokenUser {
  id: string;
  username: string;
}

const userJson = (user: User): TokenUser => {
  return {
    id: user.id,
    username: user.username ?? "",
  };
};

interface Claims {
  [key: string]: any;
  iat: number;
  exp: number;
  sub: string;
}

const createToken = (user: User, expirationInMinutes: number): string => {
  const iat = Math.floor(new Date().getTime() / 1000);
  const exp = iat + 60 * expirationInMinutes;
  const claims: Claims = {
    iat,
    exp,
    sub: user.id,
  };
  return jwt.sign(claims, JWT_SECRET);
};

const setRefreshTokenCookie = (res: Response, user: User): void => {
  // add refresh token to cookie
  res.cookie("JWTRefreshToken", createToken(user, REFRESH_TOKEN_MINUTES), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    expires: new Date(new Date().valueOf() + 1000 * 60 * REFRESH_TOKEN_MINUTES),
  });
};

const sendToken = (res: Response, user: User): Response => {
  setRefreshTokenCookie(res, user);
  const accessToken = createToken(user, ACCESS_TOKEN_MINUTES);
  return res.json({ accessToken, user: userJson(user) });
};

const validateSchema =
  (schema: yup.AnySchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.validate(
        {
          body: req.body,
          query: req.query,
          params: req.params,
        },
        { abortEarly: false }
      );
      return next();
    } catch (err: unknown) {
      if (err instanceof yup.ValidationError)
        return res.status(400).json({ message: err.errors.join(", ") });
      if (err instanceof TypeError)
        return res.status(400).json({ message: err.message });
      return res
        .status(500)
        .json({ message: "Unknown validation error." + String(err) });
    }
  };

app.get("/", (req: Request, res: Response): Response => {
  return res.json({ message: "ok" });
});

const registerSchema = yup.object({
  body: yup.object({
    username: yup.string().required("A user name is required."),
    password: yup
      .string()
      .min(8, "The password must be at least 8 characters long.")
      .required("A password is required."),
  }),
});

app.post(
  "/register",
  validateSchema(registerSchema),
  async (req: Request, res: Response) => {
    const userData = registerSchema.cast(req).body;
    if (
      await prisma.user.findUnique({ where: { username: userData.username } })
    ) {
      return res
        .status(400)
        .json({ message: "That user name is already registered." });
    }
    const hashed = await argon2.hash(userData.password!!);
    try {
      const user = await prisma.user.create({
        data: {
          username: userData.username || "",
          password: hashed,
        },
      });
      return sendToken(res, user);
    } catch (e) {
      console.error(JSON.stringify(e));
      res.status(500).json({ message: String(e) });
    }
  }
);

const loginSchema = yup.object({
  body: yup.object({
    username: yup.string().required("A user name is required."),
    password: yup.string().required("A password is required."),
  }),
});

app.post(
  "/login",
  validateSchema(loginSchema),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findFirst({
      where: {
        username: req.body.username,
        password: { not: null },
      },
    });
    if (!user) {
      return res
        .status(401)
        .json({ message: "That user name is not registered." });
    }
    if (user && (await argon2.verify(user.password!!, req.body.password)))
      return sendToken(res, user);
    return res.status(401).json({ message: "Unauthorized" });
  }
);

app.get("/applist", async (req: Request, res: Response) => {
  try {
    const applist = await prisma.applist.findMany();
    return res.json({ applist: applist });
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
});

const createEditAppSchema = yup.object({
  body: yup.object({
    title: yup.string().required("Title is required."),
    description: yup.string().required("Description is required."),
  }),
});

app.post(
  "/create-edit-app",
  validateSchema(createEditAppSchema),
  async (req: Request, res: Response) => {
    let app = await prisma.applist.findUnique({
      where: { title: req.body.title },
    });
    try {
      if (req.body.id === "" && app)
        return res
          .status(401)
          .json({ message: "This app is already registered." });
      if (!app) {
        app = await prisma.applist.create({
          data: {
            title: req.body.title,
            description: req.body.description,
            type: req.body.type,
          },
        });
      } else {
        app = await prisma.applist.update({
          where: { id: req.body.id },
          data: {
            description: req.body.description,
            type: req.body.type,
          },
        });
      }
      res.status(200).json({ message: "ok", applist: app });
    } catch (e) {
      console.error(JSON.stringify(e));
      res.status(500).json({ message: String(e) });
    }
  }
);

app.post("/delete-app", async (req: Request, res: Response) => {
  try {
    await prisma.applist.deleteMany({
      where: {
        id: {
          in: req.body.ids,
        },
      },
    });
    res.status(200).json({ message: "ok" });
  } catch (e) {
    console.error(JSON.stringify(e));
    res.status(500).json({ message: String(e) });
  }
});

app.get("/refresh", async (req: Request, res: Response) => {
  try {
    const claims = jwt.verify(
      req.cookies.JWTRefreshToken,
      JWT_SECRET
    ) as Claims;
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return sendToken(res, user);
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
});

declare global {
  namespace Express {
    export interface Request {
      user: User;
    }
  }
}

export default app;
