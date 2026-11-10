import { Star } from "lucide-react";

// Customer quotes, rendered as static HTML (ported from MintlyCarousel.js).
const reviews = [
  {
    text: "One of the easiest APIs I've ever worked with - integration was a breeze!",
    name: "Steven G.",
    role: "Lead Developer",
  },
  {
    text: "Massive improvement on our exposure to risk in payments to incorrect beneficiaries.",
    name: "Maria O.",
    role: "Finance Manager",
  },
  {
    text: "Very impressed with the onboarding - Mintly helped us get up and running fast and the great communication made it easy",
    name: "Simon B.",
    role: "Operations Manager",
  },
  {
    text: "Fast and accurate modulus checking from Mintly helps our business check payments will work first time.",
    name: "David K.",
    role: "Head of Payments",
  },
  {
    text: "The free trial gave us confidence that Mintly could deliver - really great support from the Mintly team.",
    name: "Paul T.",
    role: "Product Owner",
  },
];

export function Testimonials() {
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {reviews.map((review) => (
        <li key={review.name} className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex gap-0.5 text-amber-500" aria-label="5 out of 5 stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="size-4 fill-current" aria-hidden />
            ))}
          </div>
          <blockquote className="mt-3 flex-1 text-sm">&ldquo;{review.text}&rdquo;</blockquote>
          <p className="mt-4 text-sm font-semibold">{review.name}</p>
          <p className="text-xs text-muted-foreground">{review.role}</p>
        </li>
      ))}
    </ul>
  );
}
