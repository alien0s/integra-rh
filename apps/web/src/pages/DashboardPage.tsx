import { funcionarioExemplo, type Funcionario } from "@erp/shared-types";
import { KpiCard, StatusBadge } from "@erp/shared-ui";
import { calcularResumoFolha } from "@erp/rh-core";
import { BarChart3, BriefcaseBusiness, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ApiState = "online" | "offline";

export function DashboardPage() {
  const [apiState, setApiState] = useState<ApiState>("offline");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([
    funcionarioExemplo
  ]);

  const setFuncionaisFallback = useCallback(() => {
    setFuncionarios([funcionarioExemplo]);
  }, []);

  const carregarFuncionarios = useCallback(async () => {
    try {
      const response = await fetch("/api/funcionarios");
      if (!response.ok) {
        throw new Error("Falha ao buscar funcionários");
      }

      const payload = (await response.json()) as { data: Funcionario[] };
      setFuncionarios(payload.data);
      setApiState("online");
    } catch {
      setFuncionaisFallback();
      setApiState("offline");
    }
  }, [setFuncionaisFallback]);

  useEffect(() => {
    void carregarFuncionarios();
  }, [carregarFuncionarios]);

  const resumoFolha = useMemo(
    () => calcularResumoFolha(funcionarios, "2026-05"),
    [funcionarios]
  );

  const ativos = funcionarios.filter((funcionario) => funcionario.status === "ATIVO");

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">ERP ACEAM</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
              Painel de RH
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={apiState === "online" ? "success" : "warning"}>
              API {apiState}
            </StatusBadge>
            <Button onClick={carregarFuncionarios} variant="outline">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-3 lg:px-8">
        <KpiCard
          icon={<UsersRound className="h-5 w-5" />}
          label="Funcionários ativos"
          value={ativos.length.toString()}
          caption={`${funcionarios.length} cadastrados`}
        />
        <KpiCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="Departamentos"
          value={new Set(funcionarios.map((item) => item.departamento)).size.toString()}
          caption="Base compartilhada"
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Folha estimada"
          value={resumoFolha.totalLiquidoFormatado}
          caption="Competência 2026-05"
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] gap-3 border-b bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>Nome</span>
            <span>Cargo</span>
            <span>Departamento</span>
            <span>Status</span>
          </div>
          <div className="divide-y">
            {funcionarios.map((funcionario) => (
              <div
                className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-[1.2fr_1fr_1fr_0.8fr] sm:items-center"
                key={funcionario.id}
              >
                <div>
                  <p className="font-medium text-foreground">{funcionario.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Matrícula {funcionario.matricula}
                  </p>
                </div>
                <span>{funcionario.cargo}</span>
                <span>{funcionario.departamento}</span>
                <StatusBadge
                  tone={funcionario.status === "ATIVO" ? "success" : "neutral"}
                >
                  {funcionario.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
