import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { format, isSameDay, isBefore, startOfToday, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ClipboardList, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Signature,
  Loader2
} from "lucide-react";
import { ServiceCallForm } from "@/components/ServiceCallForm";
import type { Tables } from "@/integrations/supabase/types";

type ServiceCall = Tables<"service_calls">;

export default function Dashboard() {
  const { isStaff, loading: roleLoading } = useRole();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [editingCall, setEditingCall] = useState<ServiceCall | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["service-calls-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_calls")
        .select("*")
        .order("service_date", { ascending: false });
      if (error) throw error;
      return data as ServiceCall[];
    },
    enabled: !!isStaff,
  });

  const stats = useMemo(() => {
    const today = startOfToday();
    const monthStart = startOfMonth(new Date());
    
    return {
      open: calls.filter(c => c.status !== "completed").length,
      waitingParts: calls.filter(c => c.status === "waiting_parts").length,
      completedMonth: calls.filter(c => c.status === "completed" && c.service_date && parseISO(c.service_date) >= monthStart).length,
      overdue: calls.filter(c => c.status !== "completed" && c.service_date && isBefore(parseISO(c.service_date), today)).length,
      pendingSignature: calls.filter(c => c.status === "completed" && !c.client_signature).length,
    };
  }, [calls]);

  const selectedDayCalls = useMemo(() => {
    if (!selectedDate) return [];
    return calls.filter(c => c.service_date && isSameDay(parseISO(c.service_date), selectedDate));
  }, [calls, selectedDate]);

  const overdueCalls = useMemo(() => {
    const today = startOfToday();
    return calls
      .filter(c => c.status !== "completed" && c.service_date && isBefore(parseISO(c.service_date), today))
      .slice(0, 5);
  }, [calls]);

  const unsignedCalls = useMemo(() => {
    return calls
      .filter(c => c.status === "completed" && !c.client_signature)
      .slice(0, 5);
  }, [calls]);

  const handleEdit = (call: ServiceCall) => {
    setEditingCall(call);
    setFormOpen(true);
  };

  const bookedDates = useMemo(() => {
    return calls
      .filter(c => c.service_date)
      .map(c => parseISO(c.service_date!));
  }, [calls]);

  if (roleLoading || isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff) return <div className="p-8 text-center font-display">Acesso restrito para administradores.</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Painel de Controle" 
        subtitle="Visão geral e gestão operacional DiagMed" 
      />

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Chamados Abertos" 
          value={stats.open} 
          icon={<ClipboardList className="w-5 h-5 text-blue-500" />}
          className="border-l-4 border-l-blue-500"
        />
        <MetricCard 
          title="Aguardando Peça" 
          value={stats.waitingParts} 
          icon={<Package className="w-5 h-5 text-amber-500" />}
          className="border-l-4 border-l-amber-500"
        />
        <MetricCard 
          title="Finalizados (Mês)" 
          value={stats.completedMonth} 
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          className="border-l-4 border-l-green-500"
        />
        <MetricCard 
          title="Atrasados" 
          value={stats.overdue} 
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          className="border-l-4 border-l-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda e Calendário */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm bg-card/40 backdrop-blur-sm ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2 font-display">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Agenda de Atendimentos
            </CardTitle>
            <Badge variant="secondary" className="font-medium bg-primary/10 text-primary hover:bg-primary/20 border-none">
              {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0 flex flex-col md:flex-row h-auto md:h-[420px]">
            <div className="p-4 border-r border-border/50 bg-muted/5">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="rounded-md border-none"
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{ 
                  booked: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full relative" 
                }}
              />
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white/50 dark:bg-black/10">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Compromissos do dia
              </h4>
              {selectedDayCalls.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 opacity-40">
                  <Clock className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium">Nenhum atendimento agendado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayCalls.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleEdit(c)}
                      className="group flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/80 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <p className="font-semibold text-sm truncate">{c.client_name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] h-4 leading-none uppercase tracking-wider px-1.5">{c.equipment_type}</Badge>
                          <span className="truncate">S/N: {c.equipment_serial}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${c.status === 'completed' ? 'bg-success' : 'bg-warning animate-pulse'}`} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas Críticos */}
        <div className="space-y-6">
          {/* Alerta de Atrasos */}
          <Card className="border-none shadow-sm bg-red-500/5 ring-1 ring-red-500/20">
            <CardHeader className="pb-3 border-b border-red-500/10">
              <CardTitle className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" />
                Atrasados ({stats.overdue})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3">
              <div className="space-y-2">
                {overdueCalls.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground/50">
                    <CheckCircle2 className="w-8 h-8 opacity-20" />
                  </div>
                ) : (
                  overdueCalls.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleEdit(c)}
                      className="flex items-center justify-between p-3 rounded-lg border border-red-500/10 bg-background/50 hover:border-red-500/30 transition-all cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{c.client_name}</p>
                        <p className="text-[10px] text-red-500 font-medium">Desde {c.service_date ? format(parseISO(c.service_date), "dd/MM/yyyy") : "--"}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-red-400" />
                    </div>
                  ))
                )}
                {stats.overdue > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-7 text-muted-foreground hover:text-red-500">
                    Ver mais {stats.overdue - 5} alertas
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alerta de Assinaturas */}
          <Card className="border-none shadow-sm bg-amber-500/5 ring-1 ring-amber-500/20">
            <CardHeader className="pb-3 border-b border-amber-500/10">
              <CardTitle className="text-sm font-bold text-amber-600 flex items-center gap-2 uppercase tracking-wider">
                <Signature className="w-4 h-4" />
                Sem Assinatura ({stats.pendingSignature})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3">
              <div className="space-y-2">
                {unsignedCalls.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground/50">
                    <CheckCircle2 className="w-8 h-8 opacity-20" />
                  </div>
                ) : (
                  unsignedCalls.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleEdit(c)}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-500/10 bg-background/50 hover:border-amber-500/30 transition-all cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{c.client_name}</p>
                        <p className="text-[10px] text-amber-500 font-medium">Relatório: {c.report_number || "Sem Nº"}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-amber-400" />
                    </div>
                  ))
                )}
                {stats.pendingSignature > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-7 text-muted-foreground hover:text-amber-500">
                    Ver mais {stats.pendingSignature - 5} pendências
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ServiceCallForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        editing={editingCall} 
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["service-calls-all"] });
        }} 
      />
    </div>
  );
}

function MetricCard({ title, value, icon, className = "" }: { title: string; value: number; icon: React.ReactNode; className?: string }) {
  return (
    <Card className={`shadow-sm border-none bg-card/40 backdrop-blur-sm ring-1 ring-border/50 overflow-hidden ${className}`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-bold mt-1.5 tracking-tight">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-background/80 grid place-items-center shadow-sm ring-1 ring-border/20">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
