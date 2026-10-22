import { redirect } from "next/navigation";

/**
 * Add Safe is opened as a modal from Inventory (and Overview).
 * Redirect direct links to Inventory with query so the modal opens.
 */
export default function NewSafeRedirect() {
  redirect("/dashboard/inventory?addSafe=1");
}
