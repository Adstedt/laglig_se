-- Story 5.10: Unit economics — monthly per-workspace cost/revenue/margin rollup.
-- CreateTable
CREATE TABLE "workspace_costs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "ai_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "infra_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,4),
    "gross_margin_pct" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_costs_month_idx" ON "workspace_costs"("month");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_costs_workspace_id_month_key" ON "workspace_costs"("workspace_id", "month");

-- AddForeignKey
ALTER TABLE "workspace_costs" ADD CONSTRAINT "workspace_costs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
