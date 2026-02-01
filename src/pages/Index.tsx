import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Store, LogIn } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />

        <nav className="relative z-10 max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Mercado Local</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/login')}>
            <LogIn className="w-4 h-4 mr-2" />
            Entrar
          </Button>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-sm text-secondary-foreground mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Plataforma multi-produtor
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            Conectando produtores locais a{' '}
            <span className="text-primary">clientes</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Uma plataforma completa para produtores rurais gerenciarem suas vendas e
            clientes comprarem produtos frescos diretamente de quem produz.
          </p>

          {/* ✅ Apenas o botão Acessar painel centralizado */}
          <div className="flex justify-center">
            <Button variant="outline" size="xl" onClick={() => navigate('/login')}>
              Acessar painel
            </Button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-20 bg-background-secondary">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            Três experiências, uma plataforma
          </h2>

          {/* ✅ Agora só 2 cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-premium animate-fade-in">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Loja do Produtor
              </h3>
              <p className="text-muted-foreground text-sm">
                Cada produtor tem sua própria loja online personalizada com seus
                produtos, preços e informações.
              </p>
            </div>

            <div
              className="bg-card rounded-2xl p-6 border border-border shadow-premium animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-info"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Painel do Produtor
              </h3>
              <p className="text-muted-foreground text-sm">
                Dashboard completo para gerenciar produtos, acompanhar pedidos
                e configurar a loja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground mb-8">
            Acesse o painel para testar a plataforma.
          </p>

          {/* ✅ Removido o botão de demo aqui também */}
          <div className="flex justify-center">
            <Button variant="outline" size="lg" onClick={() => navigate('/login')}>
              Acessar painel
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Mercado Local. Plataforma SaaS multi-tenant.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
