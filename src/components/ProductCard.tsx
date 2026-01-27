import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

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
          src={product.image || 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=400&h=300&fit=crop'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
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
            <span className="text-sm text-muted-foreground ml-1">
              /{product.unit}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border rounded-lg">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2 hover:bg-muted transition-colors rounded-l-lg"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 font-medium min-w-[3rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-2 hover:bg-muted transition-colors rounded-r-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <Button
            variant="premium"
            className="flex-1"
            onClick={handleAdd}
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
};
