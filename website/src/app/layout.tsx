import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Gestor Jurídico',
  description: 'Sistema de gestão de clientes e geração de contratos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
