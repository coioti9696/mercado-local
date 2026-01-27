import { Loader2 } from 'lucide-react';

export const AuthLoading = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
      <span className="text-lg font-medium">Verificando autenticação...</span>
      <span className="text-sm text-muted-foreground mt-2">
        Aguarde enquanto carregamos sua sessão
      </span>
    </div>
  );
};