'use client';

import * as React from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { CommandPalette } from '../../components/CommandPalette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Global Cmd+K / Ctrl+K shortcut
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <DashboardShell onOpenSearch={() => setPaletteOpen(true)}>
        {children}
      </DashboardShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
