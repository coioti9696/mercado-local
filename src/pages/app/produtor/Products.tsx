import { useMemo, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoReal } from '@/types';
import {
  Plus,
  Package,
  Loader2,
  Upload,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Star,
  X,
  Search,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProdutoImagem = {
  id?: string;
  url: string;
  ordem?: number;
};

type FiltroStatus = 'all' | 'ativo' | 'inativo' | 'destaque';
type Ordenacao = 'newest' | 'oldest' | 'name_az' | 'name_za' | 'price_high' | 'price_low' | 'stock_low';

const ProducerProducts = () => {
  const { producer } = useAuth();

  const [products, setProducts] = useState<ProdutoReal[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newProduct, setNewProduct] = useState({
    nome: '',
    descricao: '',
    tipo_cogumelo: 'Shiitake',
    peso_disponivel: '500g',
    preco: '',
    estoque: '',
    imagem_url: '',
    ativo: true,
    destaque: false,
  });

  // ✅ Galeria (imagens extras) — tabela produtos_imagens
  const [gallery, setGallery] = useState<ProdutoImagem[]>([]);

  // ✅ Toolbar (busca / filtro / sort)
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroStatus>('all');
  const [sort, setSort] = useState<Ordenacao>('newest');

  const tiposCogumelos = [
    'Shiitake',
    'Champignon',
    'Portobello',
    'Shimeji',
    'Funghi',
    'Cogumelo-do-sol',
    'Maitake',
    'Reishi',
    'Ostra',
    'Outro',
  ];

  const pesosDisponiveis = ['100g', '250g', '500g', '1kg', '2kg'];

  // ===============================
  // HELPERS
  // ===============================
  const formatPesoKg = (peso: string) => {
    if (peso.includes('kg')) return peso.replace('kg', ' kg');
    const g = Number(peso.replace('g', ''));
    return `${g / 1000} kg`;
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const resetForm = () => {
    setEditingId(null);
    setNewProduct({
      nome: '',
      descricao: '',
      tipo_cogumelo: 'Shiitake',
      peso_disponivel: '500g',
      preco: '',
      estoque: '',
      imagem_url: '',
      ativo: true,
      destaque: false,
    });
    setGallery([]);
  };

  // ===============================
  // LOAD PRODUCTS
  // ===============================
  useEffect(() => {
    if (producer?.id) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producer?.id]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('produtor_id', producer!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data as ProdutoReal[]);
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // LOAD GALLERY (EDIT)
  // ===============================
  const loadGalleryForProduct = async (produtoId: string) => {
    try {
      const { data, error } = await supabase
        .from('produtos_imagens')
        .select('id, url, ordem')
        .eq('produto_id', produtoId)
        .order('ordem', { ascending: true });

      if (error) throw error;

      setGallery(
        (data || []).map((i: any) => ({
          id: i.id,
          url: i.url,
          ordem: i.ordem ?? 0,
        }))
      );
    } catch (e) {
      console.error(e);
      setGallery([]);
      toast.error('Não foi possível carregar a galeria do produto');
    }
  };

  // ===============================
  // IMAGE UPLOAD (MULTI)
  // ===============================
  const uploadFilesToStorage = async (files: File[]) => {
    const urls: string[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop() || 'png';
      const safeExt = ext.toLowerCase();
      const fileName = `produto_${producer!.id}_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}.${safeExt}`;

      const { error } = await supabase.storage
        .from('produtos-imagens')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('produtos-imagens')
        .getPublicUrl(fileName);

      urls.push(data.publicUrl);
    }

    return urls;
  };

  const handlePickImages = async (fileList: FileList) => {
    if (!producer?.id) return;

    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;

    setUploadingImage(true);
    try {
      const uploadedUrls = await uploadFilesToStorage(files);

      const principalAtual = newProduct.imagem_url?.trim();
      const principal =
        principalAtual && principalAtual.length > 5 ? principalAtual : uploadedUrls[0];

      const extras =
        principalAtual && principalAtual.length > 5 ? uploadedUrls : uploadedUrls.slice(1);

      if (!principalAtual || principalAtual.length <= 5) {
        setNewProduct((p) => ({ ...p, imagem_url: principal }));
      }

      if (extras.length > 0) {
        setGallery((prev) => [...prev, ...extras.map((url) => ({ url }))]);
      }

      toast.success(uploadedUrls.length === 1 ? 'Imagem enviada' : 'Imagens enviadas');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar imagens');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAsPrimary = (url: string) => {
    setNewProduct((p) => {
      const oldPrimary = p.imagem_url?.trim();
      const nextPrimary = url;

      if (oldPrimary && oldPrimary.length > 5 && oldPrimary !== nextPrimary) {
        setGallery((prev) => [
          { url: oldPrimary },
          ...prev.filter((g) => g.url !== nextPrimary),
        ]);
      } else {
        setGallery((prev) => prev.filter((g) => g.url !== nextPrimary));
      }

      return { ...p, imagem_url: nextPrimary };
    });
  };

  const removeFromGallery = (url: string) => {
    setGallery((prev) => prev.filter((g) => g.url !== url));
  };

  const clearPrimary = () => {
    setNewProduct((p) => ({ ...p, imagem_url: '' }));
  };

  // ===============================
  // SYNC GALLERY (DB)
  // ===============================
  const syncGalleryInDb = async (produtoId: string) => {
    const principal = (newProduct.imagem_url || '').trim();

    const clean = gallery
      .map((g) => g.url)
      .filter((url) => url && url !== principal);

    const uniqueUrls: string[] = [];
    for (const u of clean) {
      if (!uniqueUrls.includes(u)) uniqueUrls.push(u);
    }

    const { error: delErr } = await supabase
      .from('produtos_imagens')
      .delete()
      .eq('produto_id', produtoId);

    if (delErr) throw delErr;

    if (uniqueUrls.length === 0) return;

    const payload = uniqueUrls.map((url, idx) => ({
      produto_id: produtoId,
      url,
      ordem: idx + 1,
    }));

    const { error: insErr } = await supabase.from('produtos_imagens').insert(payload);
    if (insErr) throw insErr;
  };

  // ===============================
  // CREATE / UPDATE
  // ===============================
  const handleSaveProduct = async () => {
    if (!producer?.id) return;

    const preco = Number(String(newProduct.preco).replace(',', '.'));
    const estoque = Number(newProduct.estoque);

    if (!newProduct.nome || isNaN(preco) || isNaN(estoque)) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      produtor_id: producer.id,
      ...newProduct,
      preco,
      estoque,
      imagem_url:
        (newProduct.imagem_url && newProduct.imagem_url.trim().length > 5
          ? newProduct.imagem_url
          : '') ||
        `https://source.unsplash.com/featured/?mushroom,${newProduct.tipo_cogumelo.toLowerCase()}`,
    };

    try {
      if (editingId) {
        const { error: updErr } = await supabase
          .from('produtos')
          .update(payload)
          .eq('id', editingId);

        if (updErr) throw updErr;

        await syncGalleryInDb(editingId);

        toast.success('Produto atualizado');
      } else {
        const { data, error: insErr } = await supabase
          .from('produtos')
          .insert([payload])
          .select('id')
          .single();

        if (insErr) throw insErr;

        const newId = data?.id as string;

        await syncGalleryInDb(newId);

        toast.success('Produto cadastrado');
      }

      setIsDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar produto');
    }
  };

  // ===============================
  // UI: filtros / ordenação / stats
  // ===============================
  const stats = useMemo(() => {
    const total = products.length;
    const ativos = products.filter((p) => !!p.ativo).length;
    const inativos = total - ativos;
    const destaques = products.filter((p) => !!p.destaque).length;
    return { total, ativos, inativos, destaques };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = [...products];

    // filtro
    if (filtro === 'ativo') list = list.filter((p) => !!p.ativo);
    if (filtro === 'inativo') list = list.filter((p) => !p.ativo);
    if (filtro === 'destaque') list = list.filter((p) => !!p.destaque);

    // busca
    if (q) {
      list = list.filter((p) => {
        const nome = (p.nome || '').toLowerCase();
        const desc = (p.descricao || '').toLowerCase();
        return nome.includes(q) || desc.includes(q);
      });
    }

    // ordenação
    list.sort((a, b) => {
      const aName = (a.nome || '').toLowerCase();
      const bName = (b.nome || '').toLowerCase();
      const aPrice = Number(a.preco) || 0;
      const bPrice = Number(b.preco) || 0;
      const aStock = Number(a.estoque) || 0;
      const bStock = Number(b.estoque) || 0;

      const aDate = new Date((a as any).created_at || 0).getTime();
      const bDate = new Date((b as any).created_at || 0).getTime();

      switch (sort) {
        case 'oldest':
          return aDate - bDate;
        case 'name_az':
          return aName.localeCompare(bName);
        case 'name_za':
          return bName.localeCompare(aName);
        case 'price_high':
          return bPrice - aPrice;
        case 'price_low':
          return aPrice - bPrice;
        case 'stock_low':
          return aStock - bStock;
        case 'newest':
        default:
          return bDate - aDate;
      }
    });

    return list;
  }, [products, filtro, search, sort]);

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = async (p: ProdutoReal) => {
    setEditingId(p.id);
    setNewProduct({
      nome: p.nome,
      descricao: p.descricao || '',
      tipo_cogumelo: p.tipo_cogumelo,
      peso_disponivel: p.peso_disponivel,
      preco: String(p.preco),
      estoque: String(p.estoque),
      imagem_url: p.imagem_url,
      ativo: p.ativo,
      destaque: p.destaque,
    });

    setIsDialogOpen(true);
    await loadGalleryForProduct(p.id);
  };

  const deleteProduct = async (p: ProdutoReal) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;

    try {
      await supabase.from('produtos_imagens').delete().eq('produto_id', p.id);
      await supabase.from('produtos').delete().eq('id', p.id);

      toast.success('Produto excluído');
      loadProducts();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir');
    }
  };

  if (!producer) {
    return (
      <DashboardLayout type="producer">
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="producer">
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">🍄 Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seus produtos, estoque e imagens.
            </p>
          </div>

          <Button onClick={openCreate} className="sm:w-auto w-full">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* STATS + TOOLBAR */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-lg font-semibold">{stats.ativos}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Inativos</p>
                <p className="text-lg font-semibold">{stats.inativos}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Destaques</p>
                <p className="text-lg font-semibold">{stats.destaques}</p>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:min-w-[420px]">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou descrição…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroStatus)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                  <SelectItem value="destaque">Destaques</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(v) => setSort(v as Ordenacao)}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="name_az">Nome (A–Z)</SelectItem>
                  <SelectItem value="name_za">Nome (Z–A)</SelectItem>
                  <SelectItem value="price_high">Preço (maior)</SelectItem>
                  <SelectItem value="price_low">Preço (menor)</SelectItem>
                  <SelectItem value="stock_low">Estoque (baixo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card p-4 animate-pulse">
                <div className="aspect-[4/3] rounded-xl bg-muted mb-3" />
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-5/6 mb-3" />
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-8 bg-muted rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-14 border rounded-2xl bg-card">
            <Package className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nenhum produto encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tente mudar o filtro, a busca, ou cadastre um novo produto.
            </p>
            <div className="mt-4">
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar produto
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const estoque = Number(p.estoque) || 0;
              const lowStock = estoque > 0 && estoque <= 5;

              return (
                <div
                  key={p.id}
                  className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-muted">
                    <img
                      src={p.imagem_url}
                      alt={p.nome}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{p.nome}</h3>

                      {p.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {p.descricao}
                        </p>
                      )}
                    </div>

                    {p.destaque && (
                      <div
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs border bg-background"
                        title="Destaque"
                      >
                        <Star className="w-3.5 h-3.5 text-primary" />
                        Destaque
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center rounded-full border bg-background px-2 py-1 text-xs">
                      {p.tipo_cogumelo} • {formatPesoKg(p.peso_disponivel)}
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                        p.ativo ? 'bg-background' : 'bg-secondary/40'
                      }`}
                      title={p.ativo ? 'Produto ativo' : 'Produto inativo'}
                    >
                      {p.ativo ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          Inativo
                        </>
                      )}
                    </div>

                    <div
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${
                        lowStock ? 'bg-destructive/10' : 'bg-background'
                      }`}
                      title="Estoque"
                    >
                      Estoque: <span className="ml-1 font-semibold">{estoque}</span>
                      {lowStock ? <span className="ml-1 text-destructive">(baixo)</span> : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Preço</p>
                      <p className="text-lg font-bold text-primary">
                        {formatMoney(Number(p.preco) || 0)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => openEdit(p)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => deleteProduct(p)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* status (ativo/destaque) */}
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-semibold mb-3">Status do produto</p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant={newProduct.ativo ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setNewProduct((p) => ({ ...p, ativo: true }))}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Ativo
                  </Button>

                  <Button
                    type="button"
                    variant={!newProduct.ativo ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setNewProduct((p) => ({ ...p, ativo: false }))}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Inativo
                  </Button>

                  <Button
                    type="button"
                    variant={newProduct.destaque ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setNewProduct((p) => ({ ...p, destaque: !p.destaque }))}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    {newProduct.destaque ? 'Destaque ON' : 'Marcar destaque'}
                  </Button>
                </div>
              </div>

              {/* campos */}
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Informações</p>

                <Input
                  placeholder="Nome"
                  value={newProduct.nome}
                  onChange={(e) => setNewProduct((p) => ({ ...p, nome: e.target.value }))}
                />

                <Textarea
                  placeholder="Descrição"
                  value={newProduct.descricao}
                  onChange={(e) =>
                    setNewProduct((p) => ({ ...p, descricao: e.target.value }))
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    value={newProduct.tipo_cogumelo}
                    onValueChange={(v) => setNewProduct((p) => ({ ...p, tipo_cogumelo: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposCogumelos.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={newProduct.peso_disponivel}
                    onValueChange={(v) =>
                      setNewProduct((p) => ({ ...p, peso_disponivel: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pesosDisponiveis.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Preço"
                    value={newProduct.preco}
                    onChange={(e) => setNewProduct((p) => ({ ...p, preco: e.target.value }))}
                  />

                  <Input
                    placeholder="Estoque"
                    value={newProduct.estoque}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, estoque: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* UPLOAD MULTI */}
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Imagens</p>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    type="button"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingImage ? 'Enviando...' : 'Adicionar imagens'}
                  </Button>

                  {newProduct.imagem_url?.trim()?.length > 5 && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={clearPrimary}
                      className="text-muted-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remover principal
                    </Button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handlePickImages(e.target.files)}
                />

                {/* PRINCIPAL */}
                <div className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Imagem principal</span>
                  </div>

                  {newProduct.imagem_url?.trim()?.length > 5 ? (
                    <div className="flex items-center gap-3">
                      <div className="w-28 h-20 rounded-lg overflow-hidden bg-muted border">
                        <img
                          src={newProduct.imagem_url}
                          alt="principal"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta é a imagem que aparece primeiro na loja.
                        <br />
                        Para trocar, clique em uma imagem da galeria.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Nenhuma imagem principal definida (a 1ª enviada vira principal)
                    </div>
                  )}
                </div>

                {/* GALERIA */}
                <div className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Galeria</span>
                    <span className="text-xs text-muted-foreground">({gallery.length})</span>
                  </div>

                  {gallery.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem imagens extras. Envie mais de uma para criar um “slide” na loja.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {gallery.map((img) => (
                        <div
                          key={img.id || img.url}
                          className="relative w-24 h-20 rounded-lg overflow-hidden bg-muted border"
                          title="Clique para definir como principal"
                        >
                          <button
                            type="button"
                            className="w-full h-full"
                            onClick={() => setAsPrimary(img.url)}
                          >
                            <img
                              src={img.url}
                              alt="extra"
                              className="w-full h-full object-cover"
                            />
                          </button>

                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-background/80 border rounded-md p-1"
                            onClick={() => removeFromGallery(img.url)}
                            title="Remover"
                          >
                            <X className="w-3 h-3" />
                          </button>

                          <div className="absolute bottom-1 left-1 bg-background/80 border rounded-md px-1 py-0.5 text-[10px]">
                            trocar
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} type="button">
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct} type="button">
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ProducerProducts;
