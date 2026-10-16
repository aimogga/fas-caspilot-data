import Link from "next/link";
import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TodoItem, TodoView } from "@/lib/staff/todo";
import { whyHidden } from "@/lib/trust/glossary";
import { cn } from "@/lib/utils";

const TONE: Record<TodoItem["kind"], "destructive" | "warning" | "info"> = { upload: "destructive", deadline: "warning", reason: "info" };
const ROW = "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]";
const EMPTY = "Nothing needs you this week";
const EMPTY_NOTE = "Every upload is finished, no grant you are working on closes in the next 30 days, and every family who never started therapy has a reason recorded.";
/** "Needs you" (DS-10b): one row per stored thing a person must act on, badge in words with a hint, a title, a sub-line and one 44 px link. */
export function TodoList({ view }: { view: TodoView | null }) {
  const state = view?.state ?? "error", count = view?.items.length ?? 0;
  return (
    <section aria-labelledby="home-todo" data-slot="needs-you" data-state={state}><Card>
      <CardHeader><CardTitle><h2 id="home-todo" className="text-xl font-semibold">Needs you{count ? <span className="font-sans text-sm font-normal text-muted-foreground"> · {count === 1 ? "1 item" : `${count} items`}</span> : null}</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state === "error" ? <><p className="font-medium">{"Couldn't check what needs you"}</p><p className="text-sm text-muted-foreground">{whyHidden("error")}</p></> : null}
        {state === "empty" ? <><p className="font-medium">{EMPTY}</p><p className="max-w-prose text-sm text-muted-foreground">{EMPTY_NOTE}</p></> : null}
        {state === "items" ? (
          <ol className="divide-y">
            {view!.items.map((t, i) => (
              <li key={`${t.kind}-${i}`} data-slot="todo-row" data-kind={t.kind} className={ROW}>
                <Hint text={t.hint} className="rounded-full"><Badge variant={TONE[t.kind]} prefix={null}>{t.badge}</Badge></Hint>
                <div className="min-w-0"><p className="font-medium leading-snug">{t.title}</p><p className="text-sm text-muted-foreground">{t.detail}</p></div>
                <Link href={t.href} className={cn(buttonVariants({ variant: "outline" }), "col-span-2 justify-self-start sm:col-span-1")}>{t.action}</Link>
              </li>
            ))}
          </ol>
        ) : null}
        {view?.missed.length ? <p data-slot="todo-missed" className="text-xs font-medium tracking-wide text-muted-foreground">{`Couldn't check ${view.missed.join(", ")} this time; the rest is shown.`}</p> : null}
      </CardContent>
    </Card></section>
  );
}
