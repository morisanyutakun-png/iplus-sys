import { redirect } from "next/navigation";

export default function PdfGeneratorRedirect() {
  redirect("/dashboard");
}
