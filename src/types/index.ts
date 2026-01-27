// Core Types for Multi-tenant SaaS

export interface Producer {
  id: string;
  user_id: string | null; 
  slug: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  logo?: string;
  coverImage?: string;
  isActive: boolean;
  createdAt: Date;
  // Subscription info
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastPaymentDate?: Date;
}

export type SubscriptionStatus = 'ativo' | 'pendente' | 'atrasado' | 'cancelado';

export interface Product {
  id: string;
  producerId: string;
  name: string;
  description: string;
  price: number;
  unit: 'kg' | 'bandeja' | 'pacote' | 'unidade' | 'g';
  image?: string;
  isActive: boolean;
  stock?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  producerId: string;
  producerName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  customerComplement?: string;
  customerCity?: string;
  customerState?: string;
  customerZipCode?: string;
  subtotal?: number;
  deliveryFee?: number;
  deliveryMethod?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: string;
  paymentId?: string;
  notes?: string;
  orderNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  subtotal: number;
  notes?: string;
}

export type OrderStatus = 'novo' | 'confirmado' | 'preparo' | 'a_caminho' | 'finalizado' | 'cancelado';

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'cartao_credito' | 'cartao_debito' | 'transferencia';

export type UserRole = 'admin' | 'producer' | 'customer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  producerId?: string;
  loja?: string;
}

export interface DashboardStats {
  ordersToday: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts?: number;
  totalProducers?: number;
}

// Adicione estas interfaces novas
export interface ProdutorReal {
  id: string;
  user_id: string | null;
  email: string;
  senha: string;
  nome_loja: string;
  nome_responsavel: string;
  telefone: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  logo_url?: string;
  capa_url?: string;
  descricao?: string;
  cor_principal?: string;
  plano: 'trial' | 'mensal' | 'anual' | 'admin';
  data_inicio: Date;
  data_vencimento: Date;
  status_pagamento: 'pendente' | 'pago' | 'atrasado';
  ativo: boolean;
  total_vendas: number;
  total_clientes: number;
  created_at: Date;
  updated_at: Date;
}

export interface Mensalidade {
  id: string;
  produtor_id: string;
  valor: number;
  data_vencimento: Date;
  data_pagamento?: Date;
  status: 'pendente' | 'pago' | 'atrasado';
  metodo_pagamento?: string;
  created_at: Date;
}

export interface ProdutoReal {
  id: string;
  produtor_id: string;
  nome: string;
  descricao?: string;
  tipo_cogumelo: string;
  peso_disponivel: string;
  preco: number;
  estoque: number;
  imagem_url?: string;
  ativo: boolean;
  destaque: boolean;
  created_at: Date;
  updated_at: Date;
}

// Tipos adicionais para pedidos detalhados
export interface PedidoCompleto {
  id: string;
  numero_pedido: string;
  produtor_id: string;
  cliente_nome: string;
  cliente_email?: string;
  cliente_telefone: string;
  cliente_endereco?: string;
  cliente_complemento?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  cliente_cep?: string;
  status: OrderStatus;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  metodo_pagamento: PaymentMethod;
  status_pagamento?: string;
  id_pagamento?: string;
  metodo_entrega?: string;
  data_entrega?: string;
  horario_entrega?: string;
  observacoes?: string;
  created_at: Date;
  updated_at: Date;
  itens: PedidoItem[];
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  total_item: number;
  observacoes?: string;
}

// Tipos para autenticação
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  producer?: {
    id: string;
    nome_loja: string;
    slug?: string;
  };
}

// Tipos para relatórios
export interface RelatorioVendas {
  periodo: string;
  total_vendas: number;
  total_pedidos: number;
  ticket_medio: number;
  produtos_mais_vendidos: Array<{
    produto_id: string;
    nome: string;
    quantidade: number;
    total: number;
  }>;
}

// Tipos para configurações
export interface ConfiguracoesLoja {
  produtor_id: string;
  cor_principal: string;
  cor_secundaria: string;
  logo_url?: string;
  capa_url?: string;
  descricao: string;
  horario_funcionamento: string;
  telefone_contato: string;
  whatsapp: string;
  instagram?: string;
  facebook?: string;
  endereco: string;
  taxa_entrega: number;
  entrega_gratis_acima: number;
  formas_pagamento: PaymentMethod[];
}