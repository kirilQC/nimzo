import { Nav } from "@/components/Nav";
import { env } from "@/lib/env";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav username={env().CHESSCOM_USERNAME} />
      <main className="mx-auto max-w-[1080px] px-6 py-8">{children}</main>
    </>
  );
}
