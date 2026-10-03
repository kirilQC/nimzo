import type { Metadata } from "next";
import { CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Knowledge bank" };

export default function KnowledgeAdminPage() {
  return (
    <div>
      <PageHeader title="Knowledge bank" subtitle="Upload your lessons PDF. Ingestion turns it into tagged, searchable lessons." />
      <section className="card" aria-labelledby="upload-h">
        <CardHeader id="upload-h" title="Lessons PDF" />
        <EmptyState title="Upload and ingestion arrive in Phase 6" />
      </section>
    </div>
  );
}
