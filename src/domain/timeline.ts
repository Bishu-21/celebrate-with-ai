import { addDays, compareIsoDates, daysBetween, isRealIsoDate } from "@/domain/money";
import type { TaskStatus, TimelineTask } from "@/domain/types";

export type TaskDraft = {
  id: string;
  title: string;
  ownerHint: string;
  durationDays: number;
  dependencies: string[];
  priority: TimelineTask["priority"];
  status?: TaskStatus;
  note?: string;
};

function durationOf(task: Pick<TimelineTask, "durationDays">): number {
  return Math.max(1, Math.round(task.durationDays));
}

export function breakCycles(tasks: TaskDraft[]): TaskDraft[] {
  const ids = new Set(tasks.map((task) => task.id));
  const cleaned = tasks.map((task) => ({
    ...task,
    dependencies: task.dependencies.filter((dependency, index, list) =>
      dependency !== task.id && ids.has(dependency) && list.indexOf(dependency) === index,
    ),
  }));

  const incoming = new Map(cleaned.map((task) => [task.id, [...task.dependencies]]));

  for (let guard = 0; guard < cleaned.length * cleaned.length + 1; guard += 1) {
    const children = new Map<string, string[]>(cleaned.map((task) => [task.id, []]));
    for (const task of cleaned) {
      for (const dependency of incoming.get(task.id) ?? []) children.get(dependency)?.push(task.id);
    }
    const indegree = new Map<string, number>(cleaned.map((task) => [task.id, (incoming.get(task.id) ?? []).length]));
    const queue = cleaned.filter((task) => (indegree.get(task.id) ?? 0) === 0).map((task) => task.id);
    const seen = new Set<string>();
    let head = 0;
    while (head < queue.length) {
      const id = queue[head];
      head += 1;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      for (const child of children.get(id) ?? []) {
        indegree.set(child, (indegree.get(child) ?? 1) - 1);
        if ((indegree.get(child) ?? 0) === 0) queue.push(child);
      }
    }
    if (seen.size === cleaned.length) break;
    const stuck = cleaned.find((task) => !seen.has(task.id) && (incoming.get(task.id) ?? []).length > 0);
    if (!stuck) break;
    incoming.set(stuck.id, (incoming.get(stuck.id) ?? []).slice(0, -1));
  }

  return cleaned.map((task) => ({ ...task, dependencies: incoming.get(task.id) ?? [] }));
}

export function topologicalOrder(tasks: Pick<TimelineTask, "id" | "dependencies">[]): string[] {
  const indegree = new Map(tasks.map((task) => [task.id, 0]));
  const children = new Map<string, string[]>(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      children.get(dependency)?.push(task.id);
    }
  }
  const queue = tasks.filter((task) => (indegree.get(task.id) ?? 0) === 0).map((task) => task.id);
  const order: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head];
    head += 1;
    if (!id) continue;
    order.push(id);
    for (const child of children.get(id) ?? []) {
      indegree.set(child, (indegree.get(child) ?? 1) - 1);
      if ((indegree.get(child) ?? 0) === 0) queue.push(child);
    }
  }
  if (order.length !== tasks.length) {
    throw new Error("Timeline dependencies contain a cycle.");
  }
  return order;
}

export function validateTaskGraph(tasks: TaskDraft[], eventDate: string, today?: string): string[] {
  const warnings: string[] = [];
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (dependency === task.id) warnings.push(`${task.title} depends on itself.`);
      else if (!ids.has(dependency)) warnings.push(`${task.title} depends on a task that is not in this plan.`);
    }
  }
  const known = tasks.map((task) => ({
    id: task.id,
    dependencies: task.dependencies.filter((dependency) => dependency !== task.id && ids.has(dependency)),
  }));
  try {
    topologicalOrder(known);
  } catch {
    warnings.push("Timeline dependencies contain a cycle. Due dates stay estimates until that cycle is removed.");
    return warnings;
  }
  if (today && isRealIsoDate(today) && isRealIsoDate(eventDate)) {
    const duration = new Map(tasks.map((task) => [task.id, durationOf(task)]));
    const deps = new Map(known.map((task) => [task.id, task.dependencies]));
    const chain = new Map<string, number>();
    const lengthOf = (id: string): number => {
      const cached = chain.get(id);
      if (cached !== undefined) return cached;
      const next = (duration.get(id) ?? 1) + Math.max(0, ...(deps.get(id) ?? []).map(lengthOf));
      chain.set(id, next);
      return next;
    };
    const longest = Math.max(0, ...known.map((task) => lengthOf(task.id)));
    const available = daysBetween(today, eventDate);
    if (longest > available) {
      warnings.push(`The longest task chain needs ${longest} days and the event is ${available} days away.`);
    }
  }
  return warnings;
}

export function scheduleTasks(tasks: TaskDraft[], eventDate: string, today: string): TimelineTask[] {
  const acyclic = tasks.map((task) => ({
    ...task,
    dependencies: [...task.dependencies],
  }));
  const byId = new Map(acyclic.map((task) => [task.id, task]));
  const dependents = new Map<string, string[]>(acyclic.map((task) => [task.id, []]));
  for (const task of acyclic) {
    for (const dependency of task.dependencies) dependents.get(dependency)?.push(task.id);
  }

  const due = new Map<string, string>();
  const visiting = new Set<string>();

  const finishOf = (id: string): string => {
    const cached = due.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return eventDate;
    visiting.add(id);
    const task = byId.get(id);
    if (!task) return eventDate;
    const children = dependents.get(id) ?? [];
    let finish = eventDate;
    if (children.length > 0) {
      let earliestChildStart = "";
      for (const childId of children) {
        const child = byId.get(childId);
        const start = addDays(finishOf(childId), -(durationOf(child ?? task) - 1));
        if (!earliestChildStart || start < earliestChildStart) earliestChildStart = start;
      }
      finish = addDays(earliestChildStart || eventDate, -1);
    }
    if (compareIsoDates(finish, eventDate) > 0) finish = eventDate;
    due.set(id, finish);
    visiting.delete(id);
    return finish;
  };

  for (const task of acyclic) finishOf(task.id);

  return acyclic.map((task) => {
    const dueDate = due.get(task.id) ?? eventDate;
    const previous = task.status ?? "todo";
    const dependencyOverdue = task.dependencies.some((dependency) => {
      const parent = byId.get(dependency);
      const parentDue = due.get(dependency) ?? eventDate;
      return parent?.status !== "done" && compareIsoDates(parentDue, today) < 0;
    });
    let status: TaskStatus = previous === "done" ? "done" : previous;
    if (status !== "done" && dependencyOverdue) status = "blocked";
    if (status === "blocked" && !dependencyOverdue) status = "todo";
    return {
      id: task.id,
      title: task.title,
      ownerHint: task.ownerHint,
      durationDays: durationOf(task),
      dependencies: task.dependencies,
      priority: task.priority,
      status,
      dueDate,
      overdue: status !== "done" && compareIsoDates(dueDate, today) < 0,
      note: task.note ?? "",
    };
  });
}

export function startDate(task: Pick<TimelineTask, "dueDate" | "durationDays">): string {
  return addDays(task.dueDate, -(durationOf(task) - 1));
}
