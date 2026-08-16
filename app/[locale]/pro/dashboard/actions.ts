"use server";

import { createClient } from "@/supabase/server";
import { toCitySlug } from "@/lib/glatko/cities";
import {
  getProAnalytics,
  getProfileCompleteness,
  getProAvailability,
  updateProAvailability,
  upsertAvailabilityException,
  getProPackages,
  createProPackage,
  updateProPackage,
  deleteProPackage,
  updateProfessionalProfile,
  getProfessionalProfile,
} from "@/lib/supabase/glatko.server";

async function requireProId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function getProAnalyticsAction() {
  const id = await requireProId();
  return getProAnalytics(id);
}

export async function getProfileCompletenessAction() {
  const id = await requireProId();
  return getProfileCompleteness(id);
}

export async function getProAvailabilityAction() {
  const id = await requireProId();
  return getProAvailability(id);
}

export async function updateProAvailabilityAction(
  day: number,
  startTime: string,
  endTime: string,
  isAvailable: boolean
) {
  const id = await requireProId();
  return updateProAvailability(id, day, startTime, endTime, isAvailable);
}

export async function upsertAvailabilityExceptionAction(
  date: string,
  isAvailable: boolean,
  note?: string
) {
  const id = await requireProId();
  return upsertAvailabilityException(id, date, isAvailable, note);
}

export async function getProPackagesAction() {
  const id = await requireProId();
  return getProPackages(id);
}

export async function createProPackageAction(data: {
  name: string;
  description?: string;
  category_id?: string;
  price: number;
  price_type: "fixed" | "starting_at";
  estimated_duration_hours?: number;
  includes?: string[];
}) {
  const id = await requireProId();
  return createProPackage({ ...data, professional_id: id });
}

export async function updateProPackageAction(
  packageId: string,
  updates: Partial<{
    name: string;
    description: string;
    price: number;
    price_type: string;
    estimated_duration_hours: number;
    includes: string[];
    is_active: boolean;
  }>
) {
  const id = await requireProId();
  return updateProPackage(packageId, id, updates);
}

export async function deleteProPackageAction(packageId: string) {
  const id = await requireProId();
  return deleteProPackage(packageId, id);
}

export async function updateProfileAction(
  updates: Partial<{
    business_name: string;
    bio: string;
    phone: string;
    location_city: string;
    languages: string[];
    years_experience: number;
    hourly_rate_min: number;
    hourly_rate_max: number;
  }>
) {
  const id = await requireProId();
  // Normalised here rather than in the form: ProfileForm posts the display NAME
  // while other surfaces post the slug, and location_city is grouped on by the
  // city-scoped RPCs. Doing it in the action covers every caller.
  const normalised = updates.location_city
    ? { ...updates, location_city: toCitySlug(updates.location_city) }
    : updates;
  return updateProfessionalProfile(id, normalised);
}

export async function getProfileAction() {
  const id = await requireProId();
  return getProfessionalProfile(id);
}
