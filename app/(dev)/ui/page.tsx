import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isDevGalleryEnabled } from "@/lib/dev-gallery";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const ALERTS = [["destructive", CircleAlert, "Upload failed"], ["warning", TriangleAlert, "Deadline soon"], ["info", Info, "New grant match"]] as const;

export default function UiGalleryPage() {
  if (!isDevGalleryEnabled()) notFound();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 py-6">
      <h1>Component gallery</h1>
      <section className="flex flex-wrap gap-2" aria-label="Buttons">
        {VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}
        {(["sm", "default", "lg"] as const).map((s) => <Button key={s} size={s}>{s}</Button>)}
        <Button size="icon" aria-label="Add">+</Button>
        <Button loading>Save draft</Button>
        <Button disabled>Disabled</Button>
      </section>
      <Separator />
      <Label htmlFor="gallery-email">Email</Label>
      <Input id="gallery-email" type="email" defaultValue="staff@example.test" />
      <Label htmlFor="gallery-disabled">Disabled field</Label>
      <Input id="gallery-disabled" disabled defaultValue="disabled@example.test" />
      <Label htmlFor="gallery-err">County</Label>
      <Input id="gallery-err" aria-invalid="true" aria-describedby="gallery-err-msg" />
      <p id="gallery-err-msg">Enter a Utah county.</p>
      <section className="flex flex-wrap gap-2" aria-label="Badges">
        <Badge variant="success" prefix={<CircleCheck />}>success</Badge>
        <Badge variant="warning" prefix={<TriangleAlert />}>warning</Badge>
        <Badge variant="destructive" prefix={<CircleAlert />}>destructive</Badge>
        <Badge variant="info" prefix={<Info />}>info</Badge>
        <Badge variant="muted" prefix="n&lt;11">muted</Badge>
      </section>
      {ALERTS.map(([v, Icon, title]) => <Alert key={v} variant={v}><Icon /><AlertTitle>{title}</AlertTitle><AlertDescription>{v} status.</AlertDescription></Alert>)}
      <Card><CardHeader><CardTitle>Card</CardTitle></CardHeader><CardContent>Every variant is on this page.</CardContent></Card>
    </main>
  );
}
