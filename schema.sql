-- Hotello Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email text,
  avatar_url text,
  phone text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Hotels
CREATE TABLE IF NOT EXISTS public.hotels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  address text,
  city text NOT NULL,
  country text NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  star_rating integer CHECK (star_rating BETWEEN 1 AND 5),
  amenities text[],
  image_url text,
  admin_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Room Types
CREATE TABLE IF NOT EXISTS public.room_types (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer NOT NULL,
  price_per_night numeric(10,2) NOT NULL,
  total_rooms integer NOT NULL,
  created_at timestamptz DEFAULT now()
);


-- Reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type_id uuid REFERENCES public.room_types(id) ON DELETE SET NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating_overall integer CHECK (rating_overall BETWEEN 1 AND 10),
  rating_cleanliness integer CHECK (rating_cleanliness BETWEEN 1 AND 10),
  rating_staff integer CHECK (rating_staff BETWEEN 1 AND 10),
  rating_facilities integer CHECK (rating_facilities BETWEEN 1 AND 10),
  rating_location integer CHECK (rating_location BETWEEN 1 AND 10),
  rating_comfort integer CHECK (rating_comfort BETWEEN 1 AND 10),
  comment_text text,
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read hotels" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Admin manage own hotels" ON public.hotels FOR ALL TO authenticated USING (admin_id = auth.uid());

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read room_types" ON public.room_types FOR SELECT USING (true);
CREATE POLICY "Admin manage room_types" ON public.room_types FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND admin_id = auth.uid())
);


ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own reservations" ON public.reservations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins see hotel reservations" ON public.reservations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND admin_id = auth.uid())
);
CREATE POLICY "Users can insert own reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Triggers for User Profile auto-creation (optional but useful)
-- create or replace function public.handle_new_user() 
-- returns trigger as $$
-- begin
--   insert into public.user_profiles (id, email)
--   values (new.id, new.email);
--   return new;
-- end;
-- $$ language plpgsql security definer;

-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();

-- Booking RPC Function
CREATE OR REPLACE FUNCTION book_room(
  p_user_id uuid, p_hotel_id uuid, p_room_type_id uuid,
  p_check_in date, p_check_out date, p_guests int, p_total_price numeric
) RETURNS uuid AS $$
DECLARE
  v_reservation_id uuid;
  v_total_rooms int;
  v_date date;
  v_overlapping_count int;
BEGIN
  -- Get total rooms for this room type
  SELECT total_rooms INTO v_total_rooms
  FROM room_types
  WHERE id = p_room_type_id FOR UPDATE;

  -- Verify availability day-by-day
  v_date := p_check_in;
  WHILE v_date < p_check_out LOOP
    SELECT count(*) INTO v_overlapping_count
    FROM reservations
    WHERE room_type_id = p_room_type_id
      AND status = 'confirmed'
      AND check_in <= v_date AND check_out > v_date;

    IF v_overlapping_count >= v_total_rooms THEN
      RAISE EXCEPTION 'No availability on %', v_date;
    END IF;

    v_date := v_date + 1;
  END LOOP;

  INSERT INTO reservations (user_id, hotel_id, room_type_id, check_in, check_out, guests, total_price, status)
  VALUES (p_user_id, p_hotel_id, p_room_type_id, p_check_in, p_check_out, p_guests, p_total_price, 'confirmed')
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql;
