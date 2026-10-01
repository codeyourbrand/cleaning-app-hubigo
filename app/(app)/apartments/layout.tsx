import { DetailShell } from "@/components/detail-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DetailShell>{children}</DetailShell>;
}
