// ✅ ADMIN PRODUCERS — CONTROLE TOTAL (ROBUSTO, SEGURO E ESCALÁVEL)

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { ProdutorReal } from '@/types';
import { Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AdminProducers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [producers, setProducers] = useState<ProdutorReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [newProducer, setNewProducer] = useState({
    email: '',
    nome_loja: '',
    nome_responsavel: '',
    telefone: '',
    cidade: '',
    estado: '',
    plano: 'trial',
  });

  // ===============================
  // LOAD PRODUCERS
  // ===============================
  const loadProducers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('produtores')
      .select('*')
      .neq('plano', 'admin')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar produtores');
    } else {
      setProducers((data || []) as ProdutorReal[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProducers();
  }, []);

  const filteredProducers = producers.filter((p) =>
    `${p.nome_loja} ${p.email} ${p.nome_responsavel}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

 // ===============================
// CREATE PRODUCER (EDGE FUNCTION) — ROBUSTO
// ===============================
const handleCreateProducer = async () => {
  try {
    setIsCreating(true);

    const email = newProducer.email.trim().toLowerCase();
    const nome_loja = newProducer.nome_loja.trim();
    const nome_responsavel = newProducer.nome_responsavel.trim();

    if (!email || !nome_loja || !nome_responsavel) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    // ✅ Garante token válido (renova se precisar)
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("refreshSession error:", refreshError);
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    const accessToken = refreshed?.session?.access_token;
    if (!accessToken) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    // ✅ Chamada DIRETA via fetch (mais confiável que invoke)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      toast.error("Config do Supabase não encontrada no .env");
      return;
    }

    const payload = {
      email,
      nome_loja,
      nome_responsavel,
      telefone: newProducer.telefone || null,
      cidade: newProducer.cidade || null,
      estado: newProducer.estado || null,
      plano: newProducer.plano || 'trial',
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/invite-producer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`, // ✅ lowercase (Deno lê assim com certeza)
        "x-supabase-auth": accessToken, // ✅ fallback compatível com seu backend
        "x-application-name": "mercado-local", // ✅ você já usa isso no client
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: text || "Resposta inválida da Edge Function" };
    }

    if (!res.ok) {
      console.error("Edge Function HTTP Error:", res.status, json);

      // ✅ Mensagens claras por status
      if (res.status === 401) {
        toast.error(json?.error || "Não autenticado (401). Faça login novamente.");
        return;
      }
      if (res.status === 403) {
        toast.error(json?.error || "Sem permissão (403).");
        return;
      }

      toast.error(json?.error || `Erro ao criar produtor (HTTP ${res.status})`);
      return;
    }

    if (!json?.ok) {
      console.error("Edge Function returned ok=false:", json);
      toast.error(json?.error || "Erro ao criar produtor");
      return;
    }

    toast.success('Produtor criado! Convite enviado por email.');

    setIsCreateDialogOpen(false);
    setNewProducer({
      email: '',
      nome_loja: '',
      nome_responsavel: '',
      telefone: '',
      cidade: '',
      estado: '',
      plano: 'trial',
    });

    loadProducers();
  } catch (err: any) {
    console.error(err);
    toast.error(err?.message || 'Erro ao criar produtor');
  } finally {
    setIsCreating(false);
  }
};



  // ===============================
  // UPDATE FIELD (GENÉRICO E SEGURO)
  // ===============================
  const updateField = async (id: string, field: keyof ProdutorReal, value: any) => {
    const prev = producers;
    setProducers((curr) =>
      curr.map((p) => (p.id === id ? ({ ...p, [field]: value } as any) : p))
    );

    const { error } = await supabase
      .from('produtores')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      setProducers(prev);
      toast.error('Erro ao atualizar produtor');
    }
  };

  // ===============================
  // DELETE PRODUCER (db only)
  // ===============================
  const handleDeleteProducer = async (producer: ProdutorReal) => {
    try {
      const { error } = await supabase.from('produtores').delete().eq('id', producer.id);
      if (error) throw error;

      toast.success('Produtor excluído');
      setProducers((prev) => prev.filter((p) => p.id !== producer.id));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir produtor');
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Produtores</h1>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 w-4 h-4" /> Novo Produtor
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produtor</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <Input
                  placeholder="Email"
                  value={newProducer.email}
                  onChange={(e) => setNewProducer((p) => ({ ...p, email: e.target.value }))}
                />
                <Input
                  placeholder="Nome da loja"
                  value={newProducer.nome_loja}
                  onChange={(e) => setNewProducer((p) => ({ ...p, nome_loja: e.target.value }))}
                />
                <Input
                  placeholder="Responsável"
                  value={newProducer.nome_responsavel}
                  onChange={(e) =>
                    setNewProducer((p) => ({ ...p, nome_responsavel: e.target.value }))
                  }
                />

                <Input
                  placeholder="Telefone (opcional)"
                  value={newProducer.telefone}
                  onChange={(e) => setNewProducer((p) => ({ ...p, telefone: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Cidade (opcional)"
                    value={newProducer.cidade}
                    onChange={(e) => setNewProducer((p) => ({ ...p, cidade: e.target.value }))}
                  />
                  <Input
                    placeholder="Estado (opcional)"
                    value={newProducer.estado}
                    onChange={(e) => setNewProducer((p) => ({ ...p, estado: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span>Plano:</span>
                  <Select
                    value={newProducer.plano}
                    onValueChange={(value) => setNewProducer((p) => ({ ...p, plano: value }))}
                  >
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateProducer} disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Buscar produtor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {loading ? (
          <Loader2 className="animate-spin mx-auto" />
        ) : (
          filteredProducers.map((p) => (
            <div key={p.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="font-semibold">{p.nome_loja}</p>
                  <p className="text-sm text-muted-foreground">{p.email}</p>

                  <div className="flex items-center gap-2 text-sm">
                    <span>Plano:</span>
                    <Select value={p.plano} onValueChange={(value) => updateField(p.id, 'plano', value)}>
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span>Pagamento:</span>
                    <Select
                      value={p.status_pagamento}
                      onValueChange={(value) => updateField(p.id, 'status_pagamento', value)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateField(p.id, 'ativo', !p.ativo)}
                  >
                    {p.ativo ? <EyeOff /> : <Eye />}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir produtor?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteProducer(p)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminProducers;
