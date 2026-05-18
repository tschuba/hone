import { z } from "zod";

const storageProviderSchema = z.enum(["local", "s3"]);

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AI_PROVIDER: z
      .enum(["ollama", "openai", "anthropic", "gemini"])
      .default("ollama"),
    AI_BASE_URL: z.string().url().optional(),
    AI_MODEL: z.string().default("llama3.2"),
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    USE_LOCAL_AUTH_ONLY: z.coerce.boolean().default(false),
    STORAGE_PROVIDER: storageProviderSchema.default("local"),
    S3_BUCKET: z.string().optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
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

export const config = (() => {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }

  return result.data;
})();
