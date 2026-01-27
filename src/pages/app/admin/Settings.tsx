import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useState } from 'react';

const AdminSettings = () => {
  const [formData, setFormData] = useState({
    platformName: 'Mercado Local',
    supportEmail: 'suporte@mercadolocal.com',
    commissionRate: '10',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save settings
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Configurações gerais da plataforma</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform Info */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Informações da plataforma</h2>
            
            <div className="space-y-2">
              <Label htmlFor="platformName">Nome da plataforma</Label>
              <Input
                id="platformName"
                value={formData.platformName}
                onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportEmail">Email de suporte</Label>
              <Input
                id="supportEmail"
                type="email"
                value={formData.supportEmail}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
              />
            </div>
          </div>

          {/* Business Settings */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Configurações comerciais</h2>
            
            <div className="space-y-2">
              <Label htmlFor="commission">Taxa de comissão (%)</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Percentual cobrado sobre cada venda
              </p>
            </div>
          </div>

          <Button type="submit" variant="premium" size="lg">
            <Save className="w-4 h-4 mr-2" />
            Salvar alterações
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
