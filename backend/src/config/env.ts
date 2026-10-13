import "dotenv/config";
import { z } from "zod";

const httpOrigin = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Must be an http(s) URL");

const httpUrlList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(httpOrigin).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "Must be a PostgreSQL connection string",
    ),
  CORS_ORIGIN_DEV: httpUrlList,
  CORS_ORIGIN_PROD: httpUrlList,
  NEON_AUTH_BASE_URL: httpOrigin,
  NEON_AUTH_JWKS_URL: httpOrigin.refine(
    (value) => new URL(value).pathname.endsWith("/.well-known/jwks.json"),
    "Must end with /.well-known/jwks.json",
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  console.error("Invalid environment variables:\n" + details.join("\n"));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
