-- Rollback for 121_location_city_shape_guard.sql
-- Drops the slug-shape CHECK on glatko_professional_profiles.location_city.
-- Data is untouched: 120's repair stands on its own and is not reverted here.

ALTER TABLE public.glatko_professional_profiles
  DROP CONSTRAINT IF EXISTS glatko_professional_profiles_location_city_shape;
