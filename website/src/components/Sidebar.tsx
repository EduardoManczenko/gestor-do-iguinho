'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FileText, Home, Scale, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/contratos', label: 'Contratos', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-64 min-h-screen"
      style={{ background: 'linear-gradient(180deg, #1a3050 0%, #0f1e33 100%)' }}
    >
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c9a84c, #a88630)' }}
          >
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">Gestor</div>
            <div className="text-xs font-medium" style={{ color: '#c9a84c' }}>
              Jurídico
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        <div className="px-3 mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Menu
          </span>
        </div>

        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'sidebar-link',
                isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                  isActive ? 'bg-white/20' : 'bg-white/0 group-hover:bg-white/10'
                )}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-white/70'} />
              </div>
              <span className="text-sm">{label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="px-4 py-6">
        <div className="mx-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={14} style={{ color: '#c9a84c' }} />
            <span className="text-xs font-semibold text-white/60">Armazenamento</span>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Dados salvos localmente no seu computador
          </p>
        </div>
      </div>
    </aside>
  );
}
