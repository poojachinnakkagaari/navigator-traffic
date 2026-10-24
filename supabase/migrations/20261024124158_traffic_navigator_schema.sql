/*
# Smart Urban Traffic Navigator — initial schema

1. Purpose
   Stores per-user route search history and simulated traffic segment data
   for the Smart Urban Traffic Navigator app. The app requires sign-in,
   so every table is owner-scoped to the authenticated user.

2. New Tables
   - `route_history` — one row per completed route search performed by a user.
     Stores source/destination labels + coordinates, selected algorithm,
     route preference, distance, time, traffic level, safety score, the
     GeoJSON geometry of the route, congested segments, recommendation
     explanation, and timestamps.
   - `traffic_segments` — simulated traffic data for known road segments.
     Stores segment key, two coordinate endpoints, congestion level (low /
     medium / high), simulated speed, and last-updated timestamp. This is
     the clearly-labelled simulated data layer that can later be swapped
     for a real traffic API.
   - `algorithm_comparisons` — saved results comparing the five graph-search
     algorithms on the same source/destination pair: distance, time, nodes
     expanded, and path length, for the algorithms comparison page and
     analytics.

3. Security
   - RLS enabled on every table.
   - `route_history` + `algorithm_comparisons` are owner-scoped to the
     authenticated user (GRANT + policies TO authenticated only).
   - `traffic_segments` is a shared reference dataset that every signed-in
     user can read but only the service_role (edge function) can write;
     authenticated gets SELECT only.
   - Owner columns default to `auth.uid()` so inserts that omit user_id
     still satisfy the WITH CHECK policy.
*/

CREATE TABLE IF NOT EXISTS route_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_label text NOT NULL,
  destination_label text NOT NULL,
  source_coords jsonb NOT NULL,
  destination_coords jsonb NOT NULL,
  algorithm text NOT NULL,
  preference text NOT NULL,
  distance_km numeric NOT NULL,
  travel_time_min numeric NOT NULL,
  traffic_level text NOT NULL,
  safety_score numeric NOT NULL,
  congested_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geometry jsonb NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traffic_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text UNIQUE NOT NULL,
  from_coords jsonb NOT NULL,
  to_coords jsonb NOT NULL,
  road_name text,
  congestion_level text NOT NULL CHECK (congestion_level IN ('low','medium','high')),
  simulated_speed_kmh numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS algorithm_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_label text NOT NULL,
  destination_label text NOT NULL,
  source_coords jsonb NOT NULL,
  destination_coords jsonb NOT NULL,
  algorithm text NOT NULL,
  distance_km numeric NOT NULL,
  travel_time_min numeric NOT NULL,
  nodes_expanded integer NOT NULL,
  path_length integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE route_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_comparisons ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON route_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON algorithm_comparisons TO authenticated;
GRANT SELECT ON traffic_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON traffic_segments TO service_role;

DROP POLICY IF EXISTS "select_own_routes" ON route_history;
CREATE POLICY "select_own_routes" ON route_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_routes" ON route_history;
CREATE POLICY "insert_own_routes" ON route_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_routes" ON route_history;
CREATE POLICY "update_own_routes" ON route_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_routes" ON route_history;
CREATE POLICY "delete_own_routes" ON route_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_comparisons" ON algorithm_comparisons;
CREATE POLICY "select_own_comparisons" ON algorithm_comparisons FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_comparisons" ON algorithm_comparisons;
CREATE POLICY "insert_own_comparisons" ON algorithm_comparisons FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_comparisons" ON algorithm_comparisons;
CREATE POLICY "update_own_comparisons" ON algorithm_comparisons FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_comparisons" ON algorithm_comparisons;
CREATE POLICY "delete_own_comparisons" ON algorithm_comparisons FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_traffic_segments" ON traffic_segments;
CREATE POLICY "select_traffic_segments" ON traffic_segments FOR SELECT
  TO authenticated USING (true);
