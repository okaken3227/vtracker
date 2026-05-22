"use server";

import { revalidateTag } from "next/cache";

export async function revalidateHomeLiveData() {
  revalidateTag("home-live-data", "page");
}
