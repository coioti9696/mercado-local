import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const { login, authenticated, role, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 🔥 REDIRECIONAMENTO CENTRALIZADO (CORRETO)
  useEffect(() => {
    if (!loading && authenticated) {
      if (role === 'admin') {
        navigate('/app/admin/dashboard', { replace: true });
      } else if (role === 'producer') {
        navigate('/app/produtor/dashboard', { replace: true });
      }
    }
  }, [authenticated, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email.trim().toLowerCase(), password);

    if (!result.success) {
      setError('Email ou senha incorretos');
      toast.error('Credenciais inválidas');
      setIsSubmitting(false);
      return;
    }

    toast.success('Login realizado com sucesso');
    // ❗ NÃO navega aqui
    // o useEffect acima cuida disso
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-secondary p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-premium">
        <h1 className="text-2xl font-bold text-center mb-2">Mercado Local</h1>
        <p className="text-center text-muted-foreground mb-6">
          Acesse seu painel
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive text-center border border-destructive/30 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting || loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
