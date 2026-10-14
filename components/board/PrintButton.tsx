"use client";
import { Button } from "@/components/ui/button";
/** F-402: prints the board dashboard; hidden in print by `components/board/print.css`. */
export function PrintButton() {
  return <Button type="button" variant="outline" data-slot="print-button" onClick={() => window.print()}>Print</Button>;
}
