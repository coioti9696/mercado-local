import { Producer, Product, Order } from '@/types';

export const mockProducers: Producer[] = [
  {
    id: '1',
    slug: 'fazenda-verde',
    name: 'Fazenda Verde Orgânicos',
    email: 'contato@fazendaverde.com',
    phone: '(19) 99999-0001',
    location: 'Campinas, SP',
    logo: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200&h=200&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=400&fit=crop',
    isActive: true,
    createdAt: new Date('2024-01-15'),
    subscriptionStatus: 'ativo',
    subscriptionPlan: 'Profissional',
    subscriptionStartDate: new Date('2024-01-15'),
    subscriptionEndDate: new Date('2025-01-15'),
    lastPaymentDate: new Date('2024-12-15'),
  },
  {
    id: '2',
    slug: 'sitio-boa-terra',
    name: 'Sítio Boa Terra',
    email: 'sitioboaterra@email.com',
    phone: '(19) 99999-0002',
    location: 'Valinhos, SP',
    logo: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=200&h=200&fit=crop',
    isActive: true,
    createdAt: new Date('2024-02-20'),
    subscriptionStatus: 'pendente',
    subscriptionPlan: 'Básico',
    subscriptionStartDate: new Date('2024-02-20'),
    subscriptionEndDate: new Date('2025-02-20'),
    lastPaymentDate: new Date('2024-11-20'),
  },
  {
    id: '3',
    slug: 'horta-da-serra',
    name: 'Horta da Serra',
    email: 'hortadaserra@email.com',
    phone: '(19) 99999-0003',
    location: 'Jundiaí, SP',
    logo: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&h=200&fit=crop',
    isActive: false,
    createdAt: new Date('2024-03-10'),
    subscriptionStatus: 'atrasado',
    subscriptionPlan: 'Básico',
    subscriptionStartDate: new Date('2024-03-10'),
    subscriptionEndDate: new Date('2024-12-10'),
    lastPaymentDate: new Date('2024-09-10'),
  },
];

export const mockProducts: Product[] = [
  {
    id: '1',
    producerId: '1',
    name: 'Shimeji Branco',
    description: 'Cogumelos shimeji brancos frescos, sabor delicado',
    price: 28.90,
    unit: 'bandeja',
    image: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=400&h=300&fit=crop',
    isActive: true,
    stock: 50,
  },
  {
    id: '2',
    producerId: '1',
    name: 'Shimeji Preto',
    description: 'Cogumelos shimeji pretos, textura firme e saborosa',
    price: 32.90,
    unit: 'bandeja',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82ber73d?w=400&h=300&fit=crop',
    isActive: true,
    stock: 30,
  },
  {
    id: '3',
    producerId: '1',
    name: 'Cogumelo Paris',
    description: 'Champignon fresco de alta qualidade',
    price: 45.00,
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1552825898-84875c08e847?w=400&h=300&fit=crop',
    isActive: true,
    stock: 40,
  },
  {
    id: '4',
    producerId: '1',
    name: 'Shiitake Fresco',
    description: 'Shiitake fresco, ideal para pratos orientais',
    price: 65.00,
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1564149504298-00c351fd7f16?w=400&h=300&fit=crop',
    isActive: true,
    stock: 20,
  },
  {
    id: '5',
    producerId: '1',
    name: 'Mix de Cogumelos',
    description: 'Variedade de cogumelos frescos em pacote especial',
    price: 42.00,
    unit: 'pacote',
    image: 'https://images.unsplash.com/photo-1606851094655-b4bbf6c7e0a1?w=400&h=300&fit=crop',
    isActive: true,
    stock: 15,
  },
  {
    id: '6',
    producerId: '1',
    name: 'Portobello',
    description: 'Cogumelos portobello grandes, perfeitos para grelhar',
    price: 55.00,
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1580820267682-426da823b514?w=400&h=300&fit=crop',
    isActive: true,
    stock: 25,
  },
];

export const mockOrders: Order[] = [
  {
    id: '1',
    producerId: '1',
    producerName: 'Fazenda Verde Orgânicos',
    items: [
      { productId: '1', productName: 'Shimeji Branco', quantity: 3, unitPrice: 28.90, unit: 'bandeja', subtotal: 86.70 },
      { productId: '3', productName: 'Cogumelo Paris', quantity: 2, unitPrice: 45.00, unit: 'kg', subtotal: 90.00 },
    ],
    total: 176.70,
    status: 'novo',
    customerName: 'Maria Silva',
    customerPhone: '(19) 99999-1234',
    customerAddress: 'Rua das Flores, 123 - Centro',
    paymentMethod: 'pix',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    producerId: '1',
    producerName: 'Fazenda Verde Orgânicos',
    items: [
      { productId: '4', productName: 'Shiitake Fresco', quantity: 1.5, unitPrice: 65.00, unit: 'kg', subtotal: 97.50 },
      { productId: '5', productName: 'Mix de Cogumelos', quantity: 2, unitPrice: 42.00, unit: 'pacote', subtotal: 84.00 },
    ],
    total: 181.50,
    status: 'confirmado',
    customerName: 'João Santos',
    customerPhone: '(19) 98888-5678',
    paymentMethod: 'dinheiro',
    notes: 'Entregar após as 14h',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: '3',
    producerId: '1',
    producerName: 'Fazenda Verde Orgânicos',
    items: [
      { productId: '6', productName: 'Portobello', quantity: 2, unitPrice: 55.00, unit: 'kg', subtotal: 110.00 },
    ],
    total: 110.00,
    status: 'preparo',
    customerName: 'Ana Oliveira',
    customerPhone: '(19) 97777-9012',
    paymentMethod: 'pix',
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 86400000),
  },
];

export const getProducerBySlug = (slug: string): Producer | undefined => {
  return mockProducers.find(p => p.slug === slug);
};

export const getProductsByProducer = (producerId: string): Product[] => {
  return mockProducts.filter(p => p.producerId === producerId && p.isActive);
};

export const getOrdersByProducer = (producerId: string): Order[] => {
  return mockOrders.filter(o => o.producerId === producerId);
};
