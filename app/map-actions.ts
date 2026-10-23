"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { mapLocationSchema } from "@/lib/validation";
import type { Result } from "./actions";

export async function saveBusinessLocation(
  businessId: string,
  latitude: number | null,
  longitude: number | null,
): Promise<Result> {
  const parsed = mapLocationSchema.safeParse({ latitude, longitude });
  if (!z.uuid().safeParse(businessId).success || !parsed.success)
    return {
      ok: false,
      message: "Choose valid latitude and longitude together.",
    };
  try {
    const db = await supabase();
    if (!db)
      return { ok: false, message: "Business maps are not configured yet." };
    const { error } = await db.rpc("set_business_location", {
      bid: businessId,
      pin_latitude: parsed.data.latitude,
      pin_longitude: parsed.data.longitude,
    });
    if (error)
      return {
        ok: false,
        message: error.message.includes("Daily action")
          ? "You've reached today's location update limit."
          : "Location could not be saved. Check your business access and try again.",
      };
    revalidatePath("/maps");
    revalidatePath("/business/dashboard");
    revalidatePath(`/businesses/${businessId}`);
    return {
      ok: true,
      message:
        latitude === null
          ? "Business pin removed."
          : "Business location saved.",
    };
  } catch {
    return {
      ok: false,
      message: "Location could not be saved. Please check your connection.",
    };
  }
}
