import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata = { title: "Tâches" };

export default async function TasksPage() {
  const session = await requireSession();

  const [tasks, members, contacts] = await Promise.all([
    db.task.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        contact: {
          select: {
            firstName: true,
            lastName: true,
            id: true,
            avatarColor: true,
          },
        },
        assignee: { select: { name: true } },
      },
    }),
    db.membership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.contact.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, avatarColor: true },
      take: 500,
    }),
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "AdvocacyHQ" }, { label: "Tâches" }]}
        title="Tâches & relances"
        description="Suivi opérationnel de l'équipe : qui relance qui, et pour quand."
      />
      <TasksView
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          dueDate: t.dueDate?.toISOString() ?? null,
          done: t.done,
          assignee: t.assignee?.name ?? null,
          contact: t.contact
            ? { id: t.contact.id, name: `${t.contact.firstName} ${t.contact.lastName}`, avatarColor: t.contact.avatarColor }
            : null,
        }))}
        currentUserId={session.user.id}
        members={members.map((m) => ({ userId: m.user.id, name: m.user.name }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          avatarColor: c.avatarColor,
        }))}
      />
    </>
  );
}
