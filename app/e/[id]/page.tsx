import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { ActylLogo } from "@/components/layout/actyl-logo";
import { EventRsvpForm } from "@/components/public/event-rsvp-form";

export const metadata = { title: "Inscription à un événement" };

export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findFirst({
    where: { id, isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      endsAt: true,
      workspace: { select: { name: true, logoEmoji: true } },
    },
  });
  if (!event) notFound();

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(event.startsAt);
  const isPast = event.startsAt.getTime() <= Date.now();

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 text-fg sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Actyl, accueil"><ActylLogo className="h-7 w-[112px]" /></Link>
          <span className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-mut">{event.workspace.logoEmoji} {event.workspace.name}</span>
        </header>

        <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-xl shadow-black/[0.04]">
          <div className="border-b border-line bg-elev/50 px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Invitation · événement public</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{event.title}</h1>
            <div className="mt-5 flex flex-col gap-3 text-sm text-mut sm:flex-row sm:flex-wrap sm:gap-x-6">
              <p className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-accent-text" />{dateLabel}{event.endsAt ? ` · fin à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(event.endsAt)}` : ""}</p>
              {event.location && <p className="inline-flex items-center gap-2"><MapPin className="size-4 text-accent-text" />{event.location}</p>}
            </div>
            {event.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-mut">{event.description}</p>}
          </div>

          <section aria-labelledby="rsvp-title" className="px-5 py-6 sm:px-8 sm:py-8">
            <h2 id="rsvp-title" className="mb-5 text-lg font-semibold">Votre participation</h2>
            <EventRsvpForm eventId={event.id} closed={isPast} />
          </section>
        </article>

        <footer className="mt-7 text-center text-xs text-faint">
          <p>Organisé par {event.workspace.name} · Propulsé par Actyl</p>
          <p className="mt-1">Vos informations sont utilisées pour gérer votre réponse à cet événement.</p>
        </footer>
      </div>
    </main>
  );
}
