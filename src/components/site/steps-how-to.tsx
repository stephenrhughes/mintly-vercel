import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import step1 from "../../../public/assets/img/theme/administrator-working-on-computer.png";
import step2 from "../../../public/assets/img/theme/people-and-technology.png";
import step3 from "../../../public/assets/img/theme/startups-entrepreneurship-and-growth.png";

const steps = [
  {
    image: step1,
    alt: "Sign up to our bank account check API",
    text: "Create your account and choose a plan that suits your needs. Enjoy full functionality during the trial period with no commitment required.",
  },
  {
    image: step2,
    alt: "Try our sort code, bank account, IBAN and SWIFT check tools",
    text: "Access Mintly's intuitive web tools or integrate our robust API into your systems. Collaborate effortlessly by inviting team members to use the tools with you.",
  },
  {
    image: step3,
    alt: "Save money as invalid bank accounts are checked",
    text: "Experience fewer payment failures and enhanced cash flow by ensuring account details are accurate before processing transactions.",
  },
];

export function StepsHowTo() {
  return (
    <div>
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        How it works
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.alt} className="text-center">
            <Image src={step.image} alt={step.alt} className="mx-auto h-auto w-48" sizes="12rem" />
            <p className="mt-2 text-sm font-semibold text-primary">Step {index + 1}</p>
            <p className="mt-2 text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 text-center">
        <Button asChild>
          <Link href="/pricing">Start free trial</Link>
        </Button>
      </div>
    </div>
  );
}
