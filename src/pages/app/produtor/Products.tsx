import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoReal } from '@/types';
import {
  Plus,
  Package,
  Loader2,
  Upload,
  X,
  Pencil,
  Trash2,
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

  // ===============================
  // LOAD PRODUCTS
  // ===============================
  useEffect(() => {
    if (producer?.id) loadProducts();
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
  // IMAGE UPLOAD
  // ===============================
  const uploadImagem = async (file: File) => {
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `produto_${producer!.id}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('produtos-imagens')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('produtos-imagens')
        .getPublicUrl(fileName);

      setNewProduct(p => ({ ...p, imagem_url: data.publicUrl }));
      toast.success('Imagem enviada');
    } catch {
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  // ===============================
  // CREATE / UPDATE
  // ===============================
  const handleSaveProduct = async () => {
    if (!producer?.id) return;

    const preco = Number(newProduct.preco.replace(',', '.'));
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
        newProduct.imagem_url ||
        `https://source.unsplash.com/featured/?mushroom,${newProduct.tipo_cogumelo.toLowerCase()}`,
    };

    if (editingId) {
      await supabase.from('produtos').update(payload).eq('id', editingId);
      toast.success('Produto atualizado');
    } else {
      await supabase.from('produtos').insert([payload]);
      toast.success('Produto cadastrado');
    }

    setIsDialogOpen(false);
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

    loadProducts();
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
          <Button onClick={() => setIsDialogOpen(true)}>
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
            {products.map(p => (
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
                      onClick={() => {
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
                        await supabase.from('produtos').delete().eq('id', p.id);
                        toast.success('Produto excluído');
                        loadProducts();
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                onChange={e =>
                  setNewProduct(p => ({ ...p, nome: e.target.value }))
                }
              />

              <Textarea
                placeholder="Descrição"
                value={newProduct.descricao}
                onChange={e =>
                  setNewProduct(p => ({ ...p, descricao: e.target.value }))
                }
              />

              <Select
                value={newProduct.tipo_cogumelo}
                onValueChange={v =>
                  setNewProduct(p => ({ ...p, tipo_cogumelo: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposCogumelos.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={newProduct.peso_disponivel}
                onValueChange={v =>
                  setNewProduct(p => ({ ...p, peso_disponivel: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pesosDisponiveis.map(p => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Preço"
                value={newProduct.preco}
                onChange={e =>
                  setNewProduct(p => ({ ...p, preco: e.target.value }))
                }
              />

              <Input
                placeholder="Estoque"
                value={newProduct.estoque}
                onChange={e =>
                  setNewProduct(p => ({ ...p, estoque: e.target.value }))
                }
              />

              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload imagem
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={e =>
                  e.target.files && uploadImagem(e.target.files[0])
                }
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct}>
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
