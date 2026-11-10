// Placeholder until 6d.
export function Enquiry({ product }: { product?: "api" | "eiscd" }) {
  return <div data-enquiry={product ?? ""} className="rounded-xl border bg-card p-6" />;
}
