import { AppShell } from "@/components/layout/app-shell";

export default function ProfessionalLayout({ children }: LayoutProps<"/profesional">) {
  return <AppShell area="professional">{children}</AppShell>;
}
