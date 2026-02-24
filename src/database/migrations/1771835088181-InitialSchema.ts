import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1771835088181 implements MigrationInterface {
  name = 'InitialSchema1771835088181';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // ENUMS
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'manager', 'sales')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."organizations_plan_enum" AS ENUM('free', 'starter', 'professional', 'enterprise')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."organization_members_role_enum" AS ENUM('owner', 'admin', 'manager', 'member')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."quotations_status_enum" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."quotation_history_action_enum" AS ENUM(
        'created', 'updated', 'status_changed', 'duplicated', 'pdf_exported',
        'ai_extracted', 'ai_translated', 'normalized', 'email_sent',
        'ingestion_failed', 'version_created', 'review_requested',
        'review_approved', 'review_rejected', 'comparison_run'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."n8n_execution_log_status_enum" AS ENUM('success', 'failed', 'partial')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."token_usage_operation_enum" AS ENUM('generate', 'suggest', 'improve', 'extract', 'translate', 'compare')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."ai_prompt_versions_type_enum" AS ENUM('extract', 'translate', 'generate', 'suggest', 'improve', 'compare')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."ingestion_jobs_status_enum" AS ENUM(
        'pending', 'extracting', 'translating', 'normalizing',
        'review_pending', 'completed', 'failed', 'dead_letter'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."review_requests_type_enum" AS ENUM('ingestion', 'status_change', 'price_override', 'comparison')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."review_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'revision_requested')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."rule_sets_category_enum" AS ENUM('lab', 'biotech', 'icu', 'analytical', 'general')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."price_monitoring_jobs_status_enum" AS ENUM('pending', 'running', 'completed', 'failed', 'partial')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."price_monitoring_jobs_trigger_type_enum" AS ENUM('manual', 'scheduled')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."price_alerts_severity_enum" AS ENUM('info', 'warning', 'critical')
    `);

    // -------------------------------------------------------------------------
    // TABLE: users
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "full_name" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'sales',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // -------------------------------------------------------------------------
    // TABLE: organizations
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "logo_url" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "plan" "public"."organizations_plan_enum" NOT NULL DEFAULT 'free',
        "monthly_token_limit" integer NOT NULL DEFAULT 100000,
        "anthropic_api_key" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organizations_name" UNIQUE ("name"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    // -------------------------------------------------------------------------
    // TABLE: organization_members
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "organization_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "organization_id" character varying NOT NULL,
        "role" "public"."organization_members_role_enum" NOT NULL DEFAULT 'member',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organization_members_user_org" UNIQUE ("user_id", "organization_id"),
        CONSTRAINT "PK_organization_members" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_organization_members_user_id" ON "organization_members" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_organization_members_organization_id" ON "organization_members" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "organization_members"
        ADD CONSTRAINT "FK_organization_members_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_members"
        ADD CONSTRAINT "FK_organization_members_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: currencies
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "currencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(3) NOT NULL,
        "name" character varying NOT NULL,
        "symbol" character varying(5) NOT NULL,
        "exchange_rate" numeric(15,6) NOT NULL DEFAULT 1,
        "decimal_places" integer NOT NULL DEFAULT 0,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_currencies_code" UNIQUE ("code"),
        CONSTRAINT "PK_currencies" PRIMARY KEY ("id")
      )
    `);

    // -------------------------------------------------------------------------
    // TABLE: customers
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "address" text,
        "tax_code" character varying,
        "contact_person" character varying,
        "notes" text,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_customers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_customers_organization_id" ON "customers" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD CONSTRAINT "FK_customers_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD CONSTRAINT "FK_customers_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: products
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "unit" character varying NOT NULL,
        "default_price" numeric(15,2) NOT NULL,
        "category" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "currency_id" character varying,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_products_organization_id" ON "products" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "FK_products_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "FK_products_currency_id"
        FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "FK_products_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: templates
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "default_terms" text,
        "default_notes" text,
        "default_tax" numeric(5,2) NOT NULL DEFAULT 0,
        "default_discount" numeric(5,2) NOT NULL DEFAULT 0,
        "items" jsonb,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_templates_organization_id" ON "templates" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "templates"
        ADD CONSTRAINT "FK_templates_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "templates"
        ADD CONSTRAINT "FK_templates_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: quotations
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "quotations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "quotation_number" character varying NOT NULL,
        "title" character varying NOT NULL,
        "customer_id" character varying NOT NULL,
        "status" "public"."quotations_status_enum" NOT NULL DEFAULT 'draft',
        "valid_until" date,
        "notes" text,
        "terms" text,
        "discount" numeric(5,2) NOT NULL DEFAULT 0,
        "tax" numeric(5,2) NOT NULL DEFAULT 0,
        "subtotal" numeric(15,2) NOT NULL DEFAULT 0,
        "total" numeric(15,2) NOT NULL DEFAULT 0,
        "currency_id" character varying,
        "template_id" character varying,
        "created_by" character varying NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_quotations_quotation_number" UNIQUE ("quotation_number"),
        CONSTRAINT "PK_quotations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quotations_organization_id" ON "quotations" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "quotations"
        ADD CONSTRAINT "FK_quotations_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
        ADD CONSTRAINT "FK_quotations_customer_id"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
        ADD CONSTRAINT "FK_quotations_currency_id"
        FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
        ADD CONSTRAINT "FK_quotations_template_id"
        FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
        ADD CONSTRAINT "FK_quotations_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: quotation_items
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "quotation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" character varying NOT NULL,
        "product_id" character varying,
        "name" character varying NOT NULL,
        "description" text,
        "unit" character varying NOT NULL,
        "quantity" numeric(15,2) NOT NULL,
        "unit_price" numeric(15,2) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_quotation_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_items"
        ADD CONSTRAINT "FK_quotation_items_quotation_id"
        FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_items"
        ADD CONSTRAINT "FK_quotation_items_product_id"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: attachments
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "quotation_id" character varying NOT NULL,
        "file_name" character varying NOT NULL,
        "original_name" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "file_path" character varying NOT NULL,
        "uploaded_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_attachments_organization_id" ON "attachments" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "FK_attachments_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "FK_attachments_quotation_id"
        FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "FK_attachments_uploaded_by"
        FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: quotation_history
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "quotation_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" character varying NOT NULL,
        "action" "public"."quotation_history_action_enum" NOT NULL,
        "changes" jsonb,
        "note" text,
        "performed_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_history"
        ADD CONSTRAINT "FK_quotation_history_quotation_id"
        FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_history"
        ADD CONSTRAINT "FK_quotation_history_performed_by"
        FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: quotation_versions
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "quotation_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" character varying NOT NULL,
        "version_number" integer NOT NULL,
        "label" text,
        "snapshot" jsonb NOT NULL,
        "change_summary" text,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_quotation_versions_quotation_version" UNIQUE ("quotation_id", "version_number"),
        CONSTRAINT "PK_quotation_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quotation_versions_quotation_id" ON "quotation_versions" ("quotation_id")`);
    await queryRunner.query(`
      ALTER TABLE "quotation_versions"
        ADD CONSTRAINT "FK_quotation_versions_quotation_id"
        FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_versions"
        ADD CONSTRAINT "FK_quotation_versions_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: company_settings
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "company_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "company_name" character varying NOT NULL,
        "company_name_en" character varying,
        "tax_code" character varying,
        "address" text,
        "phone" character varying,
        "email" character varying,
        "website" character varying,
        "logo_url" character varying,
        "bank_name" character varying,
        "bank_account" character varying,
        "bank_branch" character varying,
        "quotation_prefix" character varying NOT NULL DEFAULT 'BG',
        "quotation_terms" text,
        "quotation_notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_company_settings_organization_id" ON "company_settings" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "company_settings"
        ADD CONSTRAINT "FK_company_settings_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: n8n_execution_log
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "n8n_execution_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workflow_name" character varying NOT NULL,
        "execution_id" character varying NOT NULL,
        "status" "public"."n8n_execution_log_status_enum" NOT NULL,
        "quotation_id" character varying,
        "payload" jsonb,
        "error" text,
        "processing_time_ms" integer,
        "organization_id" character varying,
        "correlation_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_n8n_execution_log" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_n8n_execution_log_execution_id" ON "n8n_execution_log" ("execution_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_n8n_execution_log_quotation_id" ON "n8n_execution_log" ("quotation_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_n8n_execution_log_correlation_id" ON "n8n_execution_log" ("correlation_id")`);

    // -------------------------------------------------------------------------
    // TABLE: token_usage
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "token_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" character varying,
        "operation" "public"."token_usage_operation_enum" NOT NULL,
        "model" character varying NOT NULL,
        "input_tokens" integer NOT NULL,
        "output_tokens" integer NOT NULL,
        "total_tokens" integer NOT NULL,
        "cost_usd" numeric(10,6) NOT NULL,
        "user_id" character varying,
        "tenant_id" character varying,
        "n8n_execution_id" character varying,
        "prompt_version_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_usage" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_token_usage_quotation_id" ON "token_usage" ("quotation_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_usage_user_id" ON "token_usage" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_usage_tenant_id" ON "token_usage" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_usage_created_at" ON "token_usage" ("created_at")`);

    // -------------------------------------------------------------------------
    // TABLE: ai_prompt_versions
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "ai_prompt_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."ai_prompt_versions_type_enum" NOT NULL,
        "version_number" integer NOT NULL,
        "system_prompt" text NOT NULL,
        "user_prompt_template" text NOT NULL,
        "model" character varying NOT NULL,
        "max_tokens" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "change_notes" text,
        "created_by" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_prompt_versions_type_version" UNIQUE ("type", "version_number"),
        CONSTRAINT "PK_ai_prompt_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_prompt_versions_type" ON "ai_prompt_versions" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_prompt_versions_is_active" ON "ai_prompt_versions" ("is_active")`);

    // -------------------------------------------------------------------------
    // TABLE: ingestion_jobs
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "ingestion_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "attachment_id" character varying NOT NULL,
        "status" "public"."ingestion_jobs_status_enum" NOT NULL DEFAULT 'pending',
        "current_step" character varying,
        "retries" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "file_checksum" character varying(64),
        "extract_result" jsonb,
        "translate_result" jsonb,
        "normalize_result" jsonb,
        "quotation_id" character varying,
        "error" text,
        "error_stack" text,
        "n8n_execution_id" character varying,
        "correlation_id" character varying,
        "prompt_version_id" character varying,
        "customer_id" character varying,
        "created_by" character varying NOT NULL,
        "processing_time_ms" integer,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ingestion_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ingestion_jobs_organization_id" ON "ingestion_jobs" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ingestion_jobs_status" ON "ingestion_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_ingestion_jobs_file_checksum" ON "ingestion_jobs" ("file_checksum")`);
    await queryRunner.query(`CREATE INDEX "IDX_ingestion_jobs_correlation_id" ON "ingestion_jobs" ("correlation_id")`);
    await queryRunner.query(`
      ALTER TABLE "ingestion_jobs"
        ADD CONSTRAINT "FK_ingestion_jobs_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: review_requests
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "review_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "type" "public"."review_requests_type_enum" NOT NULL,
        "status" "public"."review_requests_status_enum" NOT NULL DEFAULT 'pending',
        "quotation_id" character varying,
        "job_id" character varying,
        "payload" jsonb NOT NULL,
        "proposed_data" jsonb,
        "reviewer_notes" text,
        "reviewer_changes" jsonb,
        "requested_by" character varying NOT NULL,
        "assigned_to" character varying,
        "reviewed_by" character varying,
        "reviewed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_review_requests_organization_id" ON "review_requests" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_review_requests_status" ON "review_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_review_requests_quotation_id" ON "review_requests" ("quotation_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_review_requests_assigned_to" ON "review_requests" ("assigned_to")`);
    await queryRunner.query(`
      ALTER TABLE "review_requests"
        ADD CONSTRAINT "FK_review_requests_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "review_requests"
        ADD CONSTRAINT "FK_review_requests_quotation_id"
        FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "review_requests"
        ADD CONSTRAINT "FK_review_requests_requested_by"
        FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "review_requests"
        ADD CONSTRAINT "FK_review_requests_assigned_to"
        FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "review_requests"
        ADD CONSTRAINT "FK_review_requests_reviewed_by"
        FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: glossary_terms
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "glossary_terms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "source_term" character varying NOT NULL,
        "target_term" character varying NOT NULL,
        "source_language" character varying NOT NULL DEFAULT 'en',
        "target_language" character varying NOT NULL DEFAULT 'vi',
        "category" character varying,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_glossary_terms_org_source_term" UNIQUE ("organization_id", "source_term"),
        CONSTRAINT "PK_glossary_terms" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_glossary_terms_organization_id" ON "glossary_terms" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_glossary_terms_category" ON "glossary_terms" ("category")`);
    await queryRunner.query(`
      ALTER TABLE "glossary_terms"
        ADD CONSTRAINT "FK_glossary_terms_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: rule_sets
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "rule_sets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "category" "public"."rule_sets_category_enum" NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "rules" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_rule_sets_org_category" UNIQUE ("organization_id", "category"),
        CONSTRAINT "PK_rule_sets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_rule_sets_organization_id" ON "rule_sets" ("organization_id")`);
    await queryRunner.query(`
      ALTER TABLE "rule_sets"
        ADD CONSTRAINT "FK_rule_sets_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: file_checksum_cache
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "file_checksum_cache" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "checksum" character varying(64) NOT NULL,
        "organization_id" character varying NOT NULL,
        "original_file_name" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "extract_result" jsonb,
        "translate_result" jsonb,
        "prompt_version_id" character varying,
        "hit_count" integer NOT NULL DEFAULT 0,
        "last_hit_at" TIMESTAMP,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_file_checksum_cache_checksum_org" UNIQUE ("checksum", "organization_id"),
        CONSTRAINT "PK_file_checksum_cache" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_file_checksum_cache_checksum" ON "file_checksum_cache" ("checksum")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_checksum_cache_organization_id" ON "file_checksum_cache" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_checksum_cache_expires_at" ON "file_checksum_cache" ("expires_at")`);
    await queryRunner.query(`
      ALTER TABLE "file_checksum_cache"
        ADD CONSTRAINT "FK_file_checksum_cache_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: price_monitoring_jobs
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "price_monitoring_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "status" "public"."price_monitoring_jobs_status_enum" NOT NULL DEFAULT 'pending',
        "trigger_type" "public"."price_monitoring_jobs_trigger_type_enum" NOT NULL,
        "triggered_by" character varying,
        "total_products" integer NOT NULL DEFAULT 0,
        "processed_products" integer NOT NULL DEFAULT 0,
        "alert_count" integer NOT NULL DEFAULT 0,
        "n8n_execution_id" character varying,
        "error" text,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_price_monitoring_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_price_monitoring_jobs_organization_id" ON "price_monitoring_jobs" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_price_monitoring_jobs_status" ON "price_monitoring_jobs" ("status")`);
    await queryRunner.query(`
      ALTER TABLE "price_monitoring_jobs"
        ADD CONSTRAINT "FK_price_monitoring_jobs_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: price_records
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "price_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" character varying NOT NULL,
        "product_id" character varying NOT NULL,
        "product_name" character varying NOT NULL,
        "previous_price" numeric(15,2) NOT NULL,
        "current_price" numeric(15,2) NOT NULL,
        "price_change" numeric(15,2) NOT NULL,
        "price_change_percent" numeric(8,2) NOT NULL,
        "currency_code" character varying(3) NOT NULL DEFAULT 'VND',
        "source" character varying,
        "fetched_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_price_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_price_records_job_id" ON "price_records" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_price_records_product_id" ON "price_records" ("product_id")`);
    await queryRunner.query(`
      ALTER TABLE "price_records"
        ADD CONSTRAINT "FK_price_records_job_id"
        FOREIGN KEY ("job_id") REFERENCES "price_monitoring_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // TABLE: price_alerts
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "price_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" character varying NOT NULL,
        "job_id" character varying NOT NULL,
        "product_id" character varying NOT NULL,
        "product_name" character varying,
        "severity" "public"."price_alerts_severity_enum" NOT NULL,
        "previous_price" numeric(15,2) NOT NULL,
        "current_price" numeric(15,2) NOT NULL,
        "price_change_percent" numeric(8,2) NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_price_alerts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_price_alerts_organization_id" ON "price_alerts" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_price_alerts_job_id" ON "price_alerts" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_price_alerts_product_id" ON "price_alerts" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_price_alerts_severity" ON "price_alerts" ("severity")`);
    await queryRunner.query(`
      ALTER TABLE "price_alerts"
        ADD CONSTRAINT "FK_price_alerts_organization_id"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "price_alerts"
        ADD CONSTRAINT "FK_price_alerts_job_id"
        FOREIGN KEY ("job_id") REFERENCES "price_monitoring_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`ALTER TABLE "price_alerts" DROP CONSTRAINT "FK_price_alerts_job_id"`);
    await queryRunner.query(`ALTER TABLE "price_alerts" DROP CONSTRAINT "FK_price_alerts_organization_id"`);
    await queryRunner.query(`DROP TABLE "price_alerts"`);

    await queryRunner.query(`ALTER TABLE "price_records" DROP CONSTRAINT "FK_price_records_job_id"`);
    await queryRunner.query(`DROP TABLE "price_records"`);

    await queryRunner.query(`ALTER TABLE "price_monitoring_jobs" DROP CONSTRAINT "FK_price_monitoring_jobs_organization_id"`);
    await queryRunner.query(`DROP TABLE "price_monitoring_jobs"`);

    await queryRunner.query(`ALTER TABLE "file_checksum_cache" DROP CONSTRAINT "FK_file_checksum_cache_organization_id"`);
    await queryRunner.query(`DROP TABLE "file_checksum_cache"`);

    await queryRunner.query(`ALTER TABLE "rule_sets" DROP CONSTRAINT "FK_rule_sets_organization_id"`);
    await queryRunner.query(`DROP TABLE "rule_sets"`);

    await queryRunner.query(`ALTER TABLE "glossary_terms" DROP CONSTRAINT "FK_glossary_terms_organization_id"`);
    await queryRunner.query(`DROP TABLE "glossary_terms"`);

    await queryRunner.query(`ALTER TABLE "review_requests" DROP CONSTRAINT "FK_review_requests_reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "review_requests" DROP CONSTRAINT "FK_review_requests_assigned_to"`);
    await queryRunner.query(`ALTER TABLE "review_requests" DROP CONSTRAINT "FK_review_requests_requested_by"`);
    await queryRunner.query(`ALTER TABLE "review_requests" DROP CONSTRAINT "FK_review_requests_quotation_id"`);
    await queryRunner.query(`ALTER TABLE "review_requests" DROP CONSTRAINT "FK_review_requests_organization_id"`);
    await queryRunner.query(`DROP TABLE "review_requests"`);

    await queryRunner.query(`ALTER TABLE "ingestion_jobs" DROP CONSTRAINT "FK_ingestion_jobs_organization_id"`);
    await queryRunner.query(`DROP TABLE "ingestion_jobs"`);

    await queryRunner.query(`DROP TABLE "ai_prompt_versions"`);
    await queryRunner.query(`DROP TABLE "token_usage"`);
    await queryRunner.query(`DROP TABLE "n8n_execution_log"`);

    await queryRunner.query(`ALTER TABLE "company_settings" DROP CONSTRAINT "FK_company_settings_organization_id"`);
    await queryRunner.query(`DROP TABLE "company_settings"`);

    await queryRunner.query(`ALTER TABLE "quotation_versions" DROP CONSTRAINT "FK_quotation_versions_created_by"`);
    await queryRunner.query(`ALTER TABLE "quotation_versions" DROP CONSTRAINT "FK_quotation_versions_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_versions"`);

    await queryRunner.query(`ALTER TABLE "quotation_history" DROP CONSTRAINT "FK_quotation_history_performed_by"`);
    await queryRunner.query(`ALTER TABLE "quotation_history" DROP CONSTRAINT "FK_quotation_history_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_history"`);

    await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_uploaded_by"`);
    await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_quotation_id"`);
    await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_organization_id"`);
    await queryRunner.query(`DROP TABLE "attachments"`);

    await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_quotation_items_product_id"`);
    await queryRunner.query(`ALTER TABLE "quotation_items" DROP CONSTRAINT "FK_quotation_items_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_items"`);

    await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_created_by"`);
    await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_template_id"`);
    await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_currency_id"`);
    await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_customer_id"`);
    await queryRunner.query(`ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_organization_id"`);
    await queryRunner.query(`DROP TABLE "quotations"`);

    await queryRunner.query(`ALTER TABLE "templates" DROP CONSTRAINT "FK_templates_created_by"`);
    await queryRunner.query(`ALTER TABLE "templates" DROP CONSTRAINT "FK_templates_organization_id"`);
    await queryRunner.query(`DROP TABLE "templates"`);

    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_created_by"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_currency_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_organization_id"`);
    await queryRunner.query(`DROP TABLE "products"`);

    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_created_by"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_organization_id"`);
    await queryRunner.query(`DROP TABLE "customers"`);

    await queryRunner.query(`DROP TABLE "currencies"`);

    await queryRunner.query(`ALTER TABLE "organization_members" DROP CONSTRAINT "FK_organization_members_organization_id"`);
    await queryRunner.query(`ALTER TABLE "organization_members" DROP CONSTRAINT "FK_organization_members_user_id"`);
    await queryRunner.query(`DROP TABLE "organization_members"`);

    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."price_alerts_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."price_monitoring_jobs_trigger_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."price_monitoring_jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."rule_sets_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."review_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."review_requests_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ingestion_jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ai_prompt_versions_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."token_usage_operation_enum"`);
    await queryRunner.query(`DROP TYPE "public"."n8n_execution_log_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_history_action_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."organization_members_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."organizations_plan_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
