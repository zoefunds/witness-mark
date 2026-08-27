import Link from "next/link";
import { LinkButton } from "@/components/ui";

const steps = [
  {
    n: "1",
    title: "PROMISE",
    body: "A creator writes a structured, measurable promise naming a counterparty beneficiary — exact terms, not vibes.",
  },
  {
    n: "2",
    title: "STAKE",
    body: "The creator stakes GEN behind the promise. Capital is escrowed by the contract the moment it's created.",
  },
  {
    n: "3",
    title: "EVIDENCE",
    body: "Once the outcome is known, the counterparty submits evidence — URLs, images, documents — for the contract to fetch itself.",
  },
  {
    n: "4",
    title: "ADJUDICATION",
    body: "A GenLayer Intelligent Contract independently fetches the evidence and reaches validator consensus on the outcome.",
  },
  {
    n: "5",
    title: "SETTLEMENT",
    body: "The stake is paid out automatically — fulfilled, partially fulfilled, or broken — no arbiter, no chargeback.",
  },
];

const useCases = [
  {
    title: "Verifiable work delivery",
    body: "AI agents, freelancers, and contractors stake completion terms behind a scoped deliverable — the client submits proof of delivery, evidence is fetched and judged against exact conditions, not a subjective review.",
    lead: true,
  },
  { title: "Freelance & creator milestones", body: "A client or campaign sponsor stakes payment behind a scoped deliverable; the freelancer or creator submits proof of delivery." },
  { title: "Procurement terms", body: "A buyer's supplier promise — quantity, quality, deadline — backed by real capital, not a PO." },
  { title: "Service-level promises", body: "A vendor stakes GEN behind an uptime or response-time commitment made to a customer." },
  { title: "Personal accountability", body: "Stake GEN behind a commitment to a friend, a coach, or a counterparty who benefits if you don't follow through." },
  { title: "Cross-border trust", body: "Two parties with no shared legal system settle a promise through neutral, evidence-driven adjudication." },
];

export default function LandingPage() {
  return (
    <div>
      <section className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-8 sm:py-28">
          <p className="label-caps mb-4">GenLayer Intelligent Contracts</p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
            Make promises that survive contact with reality.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-on-surface-variant">
            WitnessMark lets a creator stake GEN behind a real-world promise naming a counterparty. When the outcome
            is known, evidence is submitted and a GenLayer Intelligent Contract adjudicates FULFILLED, PARTIALLY
            FULFILLED, or BROKEN — then pays the stake out automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/promises/new" variant="primary">Create a promise</LinkButton>
            <LinkButton href="/promises" variant="outline">Browse promises</LinkButton>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
        <h2 className="label-caps mb-8 border-b border-outline-variant pb-3">Protocol architecture</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {steps.map((step, i) => (
            <div key={step.n} className="card flex flex-col gap-3 p-5">
              <span className="font-mono-data text-xs text-on-surface-variant">{step.n}/5</span>
              <span className="text-sm font-bold tracking-wide text-on-surface">{step.title}</span>
              <p className="text-sm text-on-surface-variant">{step.body}</p>
              {i < steps.length - 1 ? (
                <span className="mt-auto hidden text-right text-on-surface-variant sm:block" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
          <h2 className="label-caps mb-2 border-b border-outline-variant pb-3">Use cases</h2>
          <p className="mb-8 max-w-2xl text-sm text-on-surface-variant">
            WitnessMark is a general-purpose promise primitive, not a narrow product — but it is strongest where
            evidence is concrete and conditions are measurable. Verifiable work delivery is the clearest starting
            point; the same primitive extends to any evidence-rich commitment below.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((uc) => (
              <div key={uc.title} className={`card p-5 ${uc.lead ? "border-primary" : ""}`}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-on-surface">{uc.title}</p>
                  {uc.lead ? (
                    <span className="label-caps rounded-full border border-primary px-2 py-0.5 text-[10px] text-primary">
                      Start here
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{uc.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
        <div className="card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-on-surface">Ready to stake a promise?</p>
            <p className="mt-1 text-sm text-on-surface-variant">Connect a wallet and create your first promise in minutes.</p>
          </div>
          <div className="flex gap-3">
            <LinkButton href="/promises/new" variant="primary">Create a promise</LinkButton>
            <Link href="/dashboard" className="focus-ring inline-flex items-center px-3 text-sm font-medium text-on-surface-variant hover:text-on-surface">
              View dashboard →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
