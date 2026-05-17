import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const password = process.env.ADMIN_PASSWORD;

  if (password) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE)?.value;

    if (!token || !verifyAdminToken(token, password)) {
      redirect("/admin/login");
    }
  }

  return <>{children}</>;
}
