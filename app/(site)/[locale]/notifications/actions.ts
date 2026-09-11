"use server";

import { createClient } from "@/supabase/server";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from "@/lib/supabase/glatko.server";

export async function getNotificationsAction(limit = 20, unreadOnly = false) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  const rows = await getUserNotifications(
    user.id,
    limit,
    unreadOnly,
    supabase,
  );
  return rows;
}

export async function markReadAction(notificationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await markNotificationRead(notificationId, user.id, supabase);
}

export async function markAllReadAction() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await markAllNotificationsRead(user.id, supabase);
}

export async function getUnreadCountAction() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return getUnreadNotificationCount(user.id, supabase);
}
