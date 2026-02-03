import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabaseGuest } from '@/lib/supabase';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  // ✅ Galeria
  const fallbackImg =
    'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=400&h=300&fit=crop';

  const mainImage = useMemo(() => {
    const img = (product.image || '').trim();
    return img.length > 5 ? img : fallbackImg;
  }, [product.image]);

  const [images, setImages] = useState<string[]>([mainImage]);
  const [activeIndex, setActiveIndex] = useState(0);

  // sempre que a imagem principal mudar (troca de produto), reset
  useEffect(() => {
    setImages([mainImage]);
    setActiveIndex(0);
  }, [mainImage, product.id]);

  // busca imagens extras da tabela produtos_imagens (slide)
  useEffect(() => {
    const loadGallery = async () => {
      if (!product?.id) return;

      try {
        const { data, error } = await supabaseGuest
          .from('produtos_imagens')
          .select('url, ordem')
          .eq('produto_id', product.id)
          .order('ordem', { ascending: true });

        if (error) {
          // não quebra a UI: só mantém a imagem principal
          console.error('Erro ao carregar galeria:', error);
          return;
        }

        const extraUrls = (data || [])
          .map((x: any) => String(x.url || '').trim())
          .filter((u: string) => u.length > 5 && u !== mainImage);

        if (extraUrls.length === 0) return;

        // ✅ principal + extras (sem duplicar)
        setImages([mainImage, ...extraUrls]);
      } catch (e) {
        console.error('Erro ao carregar galeria:', e);
      }
    };

    loadGallery();
  }, [product.id, mainImage]);

  const hasGallery = images.length > 1;

  const prev = () => {
    if (!hasGallery) return;
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  };

  const next = () => {
    if (!hasGallery) return;
    setActiveIndex((i) => (i + 1) % images.length);
  };

  const handleAdd = () => {
    addItem(product, quantity);
    setQuantity(1);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-premium border border-border/50 animate-fade-in">
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={images[activeIndex] || fallbackImg}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />

        {/* ✅ Controles discretos (somente se tiver galeria) */}
        {hasGallery && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 border border-border rounded-full p-2 backdrop-blur-sm hover:bg-background/90 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 border border-border rounded-full p-2 backdrop-blur-sm hover:bg-background/90 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* ✅ indicadores (bolinhas) */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir para imagem ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex ? 'w-5 bg-primary' : 'w-2 bg-background/70 border border-border'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground text-lg">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            <span className="text-sm text-muted-foreground ml-1">/{product.unit}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border rounded-lg">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2 hover:bg-muted transition-colors rounded-l-lg"
              type="button"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 font-medium min-w-[3rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-2 hover:bg-muted transition-colors rounded-r-lg"
              type="button"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <Button variant="premium" className="flex-1" onClick={handleAdd}>
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
};
