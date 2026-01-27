import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Upload, Save, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const ProducerSettings = () => {
  const { producer } = useAuth();

  // =====================
  // STATES
  // =====================
  const [nomeLoja, setNomeLoja] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [capaUrl, setCapaUrl] = useState('');
  const [aceitaPix, setAceitaPix] = useState(true);
  const [aceitaDinheiro, setAceitaDinheiro] = useState(true);
  const [aceitaCartao, setAceitaCartao] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);

  // =====================
  // LOAD DATA (F5 SAFE)
  // =====================
  useEffect(() => {
    if (!producer?.id) return;

    const carregar = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('produtores')
          .select('*')
          .eq('id', producer.id)
          .single();

        if (error) throw error;

        setNomeLoja(data.nome_loja || '');
        setCidade(data.cidade || '');
        setEstado(data.estado || '');
        setDescricao(data.descricao || '');
        setLogoUrl(data.logo_url || '');
        setCapaUrl(data.capa_url || '');
        setAceitaPix(data.aceita_pix !== false);
        setAceitaDinheiro(data.aceita_dinheiro !== false);
        setAceitaCartao(Boolean(data.aceita_cartao));
      } catch (err) {
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [producer?.id]);

  // =====================
  // UPLOAD IMAGE
  // =====================
  const uploadImagem = async (file: File, tipo: 'logo' | 'capa') => {
    if (!producer?.id) return;

    const bucket = tipo === 'logo' ? 'logos-produtores' : 'capas-produtores';
    const setUploading = tipo === 'logo' ? setUploadingLogo : setUploadingCapa;
    const setUrl = tipo === 'logo' ? setLogoUrl : setCapaUrl;
    const campo = tipo === 'logo' ? 'logo_url' : 'capa_url';

    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${producer.id}_${tipo}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

      await supabase
        .from('produtores')
        .update({ [campo]: data.publicUrl })
        .eq('id', producer.id);

      setUrl(data.publicUrl);
      toast.success(`${tipo === 'logo' ? 'Logo' : 'Capa'} atualizada`);
    } catch {
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  // =====================
  // SAVE
  // =====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producer?.id) return;

    setSaving(true);
    try {
      await supabase
        .from('produtores')
        .update({
          nome_loja: nomeLoja,
          cidade,
          estado,
          descricao,
          aceita_pix: aceitaPix,
          aceita_dinheiro: aceitaDinheiro,
          aceita_cartao: aceitaCartao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', producer.id);

      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // =====================
  // RENDER
  // =====================
  return (
    <DashboardLayout type="producer">
      {!producer || loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold">Configurações da Loja</h1>

          {/* CAPA */}
          <div>
            <Label>Capa da Loja</Label>
            <div className="relative mt-2">
              <div className="aspect-[16/6] w-full rounded-xl overflow-hidden border bg-muted">
                {capaUrl ? (
                  <img src={capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Sem capa
                  </div>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => capaInputRef.current?.click()}
                  disabled={uploadingCapa}
                >
                  {uploadingCapa ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Alterar capa
                </Button>

                {capaUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setCapaUrl('')}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>

              <input
                ref={capaInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={e =>
                  e.target.files && uploadImagem(e.target.files[0], 'capa')
                }
              />
            </div>
          </div>

          {/* LOGO */}
          <div>
            <Label>Logo da Loja</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-28 h-28 rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">Sem logo</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Alterar logo
                </Button>

                {logoUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setLogoUrl('')}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={e =>
                  e.target.files && uploadImagem(e.target.files[0], 'logo')
                }
              />
            </div>
          </div>

          {/* INFO */}
          <div>
            <Label>Nome da Loja</Label>
            <Input value={nomeLoja} onChange={e => setNomeLoja(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={estado} onChange={e => setEstado(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <textarea
              className="w-full border rounded p-3"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>

          {/* PAGAMENTOS */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>PIX</Label>
              <Switch checked={aceitaPix} onCheckedChange={setAceitaPix} />
            </div>
            <div className="flex justify-between">
              <Label>Dinheiro</Label>
              <Switch
                checked={aceitaDinheiro}
                onCheckedChange={setAceitaDinheiro}
              />
            </div>
            <div className="flex justify-between">
              <Label>Cartão</Label>
              <Switch
                checked={aceitaCartao}
                onCheckedChange={setAceitaCartao}
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar configurações
          </Button>
        </form>
      )}
    </DashboardLayout>
  );
};

export default ProducerSettings;
