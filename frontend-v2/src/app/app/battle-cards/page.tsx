import { redirect } from "next/navigation";

export default function BattleCardsPage() {
  redirect("/app/competitors?tab=battlecards");
}
