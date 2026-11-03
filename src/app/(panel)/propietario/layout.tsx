import { AppShell } from "@/components/layout/app-shell";

export default function OwnerLayout({ children }: LayoutProps<"/propietario">) {
  return <AppShell area="owner">{children}</AppShell>;
}
