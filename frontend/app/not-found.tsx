import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-8">
      <p className="label-caps">404</p>
      <h1 className="text-2xl font-bold text-on-surface">Page not found</h1>
      <p className="text-sm text-on-surface-variant">The page you&apos;re looking for doesn&apos;t exist.</p>
      <LinkButton href="/">Back to home</LinkButton>
    </div>
  );
}
