CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MODERATOR', 'USER');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('MUSCLE_GROUP', 'EQUIPMENT', 'CATEGORY', 'MODIFIER');

-- CreateEnum
CREATE TYPE "ExerciseTagSource" AS ENUM ('EXTERNAL', 'HEURISTIC', 'LLM', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExerciseTagStatus" AS ENUM ('CONFIRMED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "MesocyclusStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('RULE_BASED', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "WorkoutLabel" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('MESOCYCLUS', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "AiJobPriority" AS ENUM ('NORMAL', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "AiPromptType" AS ENUM ('MESOCYCLUS', 'MESOCYCLUS_SIMPLIFIED');

-- CreateEnum
CREATE TYPE "SafetyKeywordAction" AS ENUM ('WARN', 'BLOCK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "oidc_sub" TEXT,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workout_session_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_logout_tokens" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "used_logout_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_pools" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT[],
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "equipment_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_de" TEXT,
    "description_en" TEXT,
    "image_url" TEXT,
    "image_alt_text" TEXT NOT NULL,
    "suggested_rest_seconds" INTEGER,
    "is_global" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT,
    "content_sha256" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "safety_bias" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_tags" (
    "exercise_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "source" "ExerciseTagSource" NOT NULL DEFAULT 'EXTERNAL',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "ExerciseTagStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exercise_tags_pkey" PRIMARY KEY ("exercise_id","tag_id")
);

-- CreateTable
CREATE TABLE "exercise_embeddings" (
    "exercise_id" TEXT NOT NULL,
    "embedding" vector(768),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_embeddings_pkey" PRIMARY KEY ("exercise_id")
);

-- CreateTable
CREATE TABLE "mesocycluses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "MesocyclusStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan_source" "PlanSource" NOT NULL DEFAULT 'RULE_BASED',
    "duration_weeks" INTEGER NOT NULL DEFAULT 4,
    "workouts_per_week" INTEGER NOT NULL DEFAULT 3,
    "next_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mesocycluses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_templates" (
    "id" TEXT NOT NULL,
    "mesocyclus_id" TEXT NOT NULL,
    "label" "WorkoutLabel" NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template_exercises" (
    "id" TEXT NOT NULL,
    "workout_template_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 1,
    "reps" INTEGER,
    "duration_seconds" INTEGER,
    "rest_seconds_override" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workout_template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mesocyclus_id" TEXT,
    "template_id" TEXT,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" TEXT NOT NULL,
    "workout_session_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "substituted_for_exercise_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_logs" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "exercise_log_id" TEXT NOT NULL,
    "set_nr" INTEGER NOT NULL,
    "reps" INTEGER,
    "duration_seconds" INTEGER,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AiJobType" NOT NULL DEFAULT 'MESOCYCLUS',
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "AiJobPriority" NOT NULL DEFAULT 'NORMAL',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "worker_id" TEXT,
    "locked_until" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "balance_score" INTEGER,
    "injection_detected" BOOLEAN NOT NULL DEFAULT false,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "type" "AiPromptType" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "action" "SafetyKeywordAction" NOT NULL DEFAULT 'WARN',
    "body_region" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "safety_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "waist_cm" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oidc_sub_key" ON "users"("oidc_sub");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_hash_key" ON "sessions"("session_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "used_logout_tokens_jti_key" ON "used_logout_tokens"("jti");

-- CreateIndex
CREATE INDEX "used_logout_tokens_expires_at_idx" ON "used_logout_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "equipment_pools_user_id_deleted_at_idx" ON "equipment_pools"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "exercises_is_global_owner_id_idx" ON "exercises"("is_global", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_category_value_key" ON "tags"("category", "value");

-- CreateIndex
CREATE INDEX "exercise_tags_tag_id_idx" ON "exercise_tags"("tag_id");

-- CreateIndex
CREATE INDEX "mesocycluses_user_id_status_deleted_at_idx" ON "mesocycluses"("user_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "workout_templates_mesocyclus_id_position_key" ON "workout_templates"("mesocyclus_id", "position");

-- CreateIndex
CREATE INDEX "workout_template_exercises_workout_template_id_idx" ON "workout_template_exercises"("workout_template_id");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_started_at_id_idx" ON "workout_sessions"("user_id", "started_at", "id");

-- CreateIndex
CREATE INDEX "exercise_logs_workout_session_id_idx" ON "exercise_logs"("workout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "set_logs_uuid_key" ON "set_logs"("uuid");

-- CreateIndex
CREATE INDEX "set_logs_exercise_log_id_idx" ON "set_logs"("exercise_log_id");

-- CreateIndex
CREATE INDEX "ai_jobs_user_id_idx" ON "ai_jobs"("user_id");

-- CreateIndex
CREATE INDEX "ai_jobs_status_priority_created_at_idx" ON "ai_jobs"("status", "priority", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_type_version_key" ON "ai_prompts"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "safety_keywords_keyword_language_key" ON "safety_keywords"("keyword", "language");

-- CreateIndex
CREATE INDEX "body_metrics_user_id_recorded_at_idx" ON "body_metrics"("user_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_pools" ADD CONSTRAINT "equipment_pools_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_tags" ADD CONSTRAINT "exercise_tags_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_tags" ADD CONSTRAINT "exercise_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_embeddings" ADD CONSTRAINT "exercise_embeddings_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesocycluses" ADD CONSTRAINT "mesocycluses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesocycluses" ADD CONSTRAINT "mesocycluses_next_template_id_fkey" FOREIGN KEY ("next_template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_mesocyclus_id_fkey" FOREIGN KEY ("mesocyclus_id") REFERENCES "mesocycluses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_workout_template_id_fkey" FOREIGN KEY ("workout_template_id") REFERENCES "workout_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_mesocyclus_id_fkey" FOREIGN KEY ("mesocyclus_id") REFERENCES "mesocycluses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "workout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_substituted_for_exercise_id_fkey" FOREIGN KEY ("substituted_for_exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ai_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
