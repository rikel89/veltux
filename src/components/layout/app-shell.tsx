import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { DemoBanner } from "./demo-banner";
import { MobileTabBar } from "./mobile-tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <AppSidebar />
      <div className="flex min-h-dvh flex-col lg:pl-[260px]">
        {!isSupabaseConfigured() && <DemoBanner />}
        <AppTopbar />
        <main className="flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
