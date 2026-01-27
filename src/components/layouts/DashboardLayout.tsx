import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DashboardLayoutProps {
  children: React.ReactNode
  type: 'producer' | 'admin'
}

const producerLinks = [
  { to: '/app/produtor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/produtor/produtos', icon: Package, label: 'Produtos' },
  { to: '/app/produtor/pedidos', icon: ClipboardList, label: 'Pedidos' },
  { to: '/app/produtor/configuracoes', icon: Settings, label: 'Configurações' },
]

const adminLinks = [
  { to: '/app/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/admin/produtores', icon: Store, label: 'Produtores' },
  { to: '/app/admin/configuracoes', icon: Settings, label: 'Configurações' },
]

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  type,
}) => {
  const { logout, user, producer } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const links = type === 'admin' ? adminLinks : producerLinks

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // 🔥 NOME SEGURO (NUNCA user.name)
  const displayName =
    producer?.name ||
    user?.email ||
    (type === 'admin' ? 'Administrador' : 'Produtor')

  return (
    <div className="min-h-screen flex bg-background-secondary">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            {type === 'admin' ? 'Admin' : 'Produtor'}
          </h1>
          <p className="text-sm text-sidebar-foreground/60 mt-1">
            {displayName}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-sidebar-foreground">
            {type === 'admin' ? 'Admin' : 'Produtor'}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-sidebar-foreground"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </Button>
        </div>

        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-sidebar border-b border-sidebar-border animate-fade-in">
            <nav className="p-4 space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )
                  }
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </NavLink>
              ))}

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-6 pt-20 lg:pt-6 p-4 overflow-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
