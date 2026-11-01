import Link from "next/link";

export default function NotFound() {
  return (
    <main id="planner-main" className="mx-auto max-w-xl px-4 py-24">
      <h1 className="font-serif text-5xl">That page is not in this planner.</h1>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-semibold">
        Back home
      </Link>
    </main>
  );
}
