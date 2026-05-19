import { z } from "zod";

const storageProviderSchema = z.enum(["local", "s3"]);
const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    schema,
  );

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    APP_URL: z.string().url().default("http://localhost:3000"),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AI_PROVIDER: z
      .enum(["ollama", "openai", "anthropic", "gemini"])
      .default("ollama"),
    AI_BASE_URL: emptyStringToUndefined(z.string().url().optional()),
    AI_MODEL: z.string().default("llama3.2"),
    OIDC_ISSUER: emptyStringToUndefined(z.string().url().optional()),
    OIDC_CLIENT_ID: emptyStringToUndefined(z.string().optional()),
    OIDC_CLIENT_SECRET: emptyStringToUndefined(z.string().optional()),
    OIDC_ROLE_CLAIM: z.string().default("groups"),
    OIDC_ADMIN_VALUE: z.string().default("admin"),
    USE_LOCAL_AUTH_ONLY: z.coerce.boolean().default(false),
    STORAGE_PROVIDER: storageProviderSchema.default("local"),
    S3_BUCKET: emptyStringToUndefined(z.string().optional()),
    S3_ENDPOINT: emptyStringToUndefined(z.string().url().optional()),
    S3_ACCESS_KEY: emptyStringToUndefined(z.string().optional()),
    S3_SECRET_KEY: emptyStringToUndefined(z.string().optional()),
    BOOTSTRAP_ADMIN_EMAIL: emptyStringToUndefined(
      z.string().email().optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.USE_LOCAL_AUTH_ONLY) {
      if (!value.OIDC_ISSUER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["OIDC_ISSUER"],
          message: "OIDC_ISSUER is required when USE_LOCAL_AUTH_ONLY is false",
        });
      }

      for (const key of ["OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when USE_LOCAL_AUTH_ONLY is false`,
          });
        }
      }
    }

    if (value.STORAGE_PROVIDER === "s3") {
      for (const key of [
        "S3_BUCKET",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_PROVIDER is s3`,
          });
        }
      }
    }
  });

type Config = z.infer<typeof schema>;

export const config: Config = (() => {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }

  return result.data;
})();
