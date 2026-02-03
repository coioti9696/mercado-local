import { useState, useEffect, useRef } from 'react';
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
    // retorna lista de publicUrls
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

      // ✅ regra: a primeira vira principal se ainda não tiver principal
      const principalAtual = newProduct.imagem_url?.trim();
      const principal =
        principalAtual && principalAtual.length > 5
          ? principalAtual
          : uploadedUrls[0];

      const extras =
        principalAtual && principalAtual.length > 5
          ? uploadedUrls
          : uploadedUrls.slice(1);

      if (!principalAtual || principalAtual.length <= 5) {
        setNewProduct((p) => ({ ...p, imagem_url: principal }));
      }

      if (extras.length > 0) {
        setGallery((prev) => [
          ...prev,
          ...extras.map((url) => ({ url })),
        ]);
      }

      toast.success(
        uploadedUrls.length === 1 ? 'Imagem enviada' : 'Imagens enviadas'
      );
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar imagens');
    } finally {
      setUploadingImage(false);
      // limpa input pra permitir escolher os mesmos arquivos novamente
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAsPrimary = (url: string) => {
    // move principal atual pra galeria (se existir), e tira essa url da galeria
    setNewProduct((p) => {
      const oldPrimary = p.imagem_url?.trim();
      const nextPrimary = url;

      if (oldPrimary && oldPrimary.length > 5 && oldPrimary !== nextPrimary) {
        setGallery((prev) => [{ url: oldPrimary }, ...prev.filter((g) => g.url !== nextPrimary)]);
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
    // remove duplicatas e não salva a principal na galeria
    const principal = (newProduct.imagem_url || '').trim();

    const clean = gallery
      .map((g) => g.url)
      .filter((url) => url && url !== principal);

    // unique mantendo ordem
    const uniqueUrls: string[] = [];
    for (const u of clean) {
      if (!uniqueUrls.includes(u)) uniqueUrls.push(u);
    }

    // Estratégia segura: apaga tudo e reinsere (simples e consistente)
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

    const { error: insErr } = await supabase
      .from('produtos_imagens')
      .insert(payload);

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

        // ✅ sincroniza galeria
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

        // ✅ sincroniza galeria
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
        <div className="flex justify-between">
          <h1 className="text-2xl font-bold">🍄 Produtos</h1>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {loading ? (
          <Loader2 className="animate-spin" />
        ) : products.length === 0 ? (
          <div className="text-center py-12 border rounded-xl">
            <Package className="mx-auto mb-4 text-muted-foreground" />
            Nenhum produto cadastrado
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((p) => (
              <div key={p.id} className="border rounded-xl p-4">
                <div className="aspect-[4/3] rounded-md overflow-hidden mb-2 bg-muted">
                  <img
                    src={p.imagem_url}
                    alt={p.nome}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="font-semibold">{p.nome}</h3>

                {p.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {p.descricao}
                  </p>
                )}

                <p className="text-sm font-medium mt-2">
                  {p.tipo_cogumelo} • {formatPesoKg(p.peso_disponivel)}
                </p>

                <div className="flex justify-between items-center mt-3">
                  <span className="font-semibold">R$ {p.preco}</span>

                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
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

                        // ✅ carrega galeria
                        await loadGalleryForProduct(p.id);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`Excluir "${p.nome}"?`)) return;
                        try {
                          // apaga galeria primeiro (evita ficar lixo)
                          await supabase
                            .from('produtos_imagens')
                            .delete()
                            .eq('produto_id', p.id);

                          await supabase.from('produtos').delete().eq('id', p.id);

                          toast.success('Produto excluído');
                          loadProducts();
                        } catch (e) {
                          console.error(e);
                          toast.error('Erro ao excluir');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
              <DialogTitle>
                {editingId ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="Nome"
                value={newProduct.nome}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, nome: e.target.value }))
                }
              />

              <Textarea
                placeholder="Descrição"
                value={newProduct.descricao}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, descricao: e.target.value }))
                }
              />

              <Select
                value={newProduct.tipo_cogumelo}
                onValueChange={(v) =>
                  setNewProduct((p) => ({ ...p, tipo_cogumelo: v }))
                }
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

              <Input
                placeholder="Preço"
                value={newProduct.preco}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, preco: e.target.value }))
                }
              />

              <Input
                placeholder="Estoque"
                value={newProduct.estoque}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, estoque: e.target.value }))
                }
              />

              {/* UPLOAD MULTI */}
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
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
                  onChange={(e) =>
                    e.target.files && handlePickImages(e.target.files)
                  }
                />

                {/* PREVIEW PRINCIPAL */}
                <div className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Imagem principal</span>
                  </div>

                  {newProduct.imagem_url?.trim()?.length > 5 ? (
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-20 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={newProduct.imagem_url}
                          alt="principal"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta é a imagem que aparece primeiro na loja.
                        <br />
                        Você pode trocar clicando em uma imagem da galeria.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Nenhuma imagem principal definida (a 1ª enviada vira principal)
                    </div>
                  )}
                </div>

                {/* PREVIEW GALERIA */}
                <div className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Galeria</span>
                    <span className="text-xs text-muted-foreground">
                      ({gallery.length})
                    </span>
                  </div>

                  {gallery.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem imagens extras. Envie mais de uma para criar um “slide”.
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
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
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
