import { Nav } from "@/components/Nav";
import { requireOwner } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOwner();
  return (
    <>
      <Nav username={env().CHESSCOM_USERNAME} />
      <main className="mx-auto max-w-[1080px] px-6 py-8">{children}</main>
    </>
  );
}
