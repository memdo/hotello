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

-- Room Availability
CREATE TABLE IF NOT EXISTS public.room_availability (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_type_id uuid REFERENCES public.room_types(id) ON DELETE CASCADE,
  date date NOT NULL,
  available_count integer NOT NULL,
  is_available boolean DEFAULT true NOT NULL,
  UNIQUE(room_type_id, date)
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
  guest_name text,
  guest_email text,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
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

ALTER TABLE public.room_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read room_availability" ON public.room_availability FOR SELECT USING (true);
CREATE POLICY "Admin manage room_availability" ON public.room_availability FOR ALL TO authenticated USING (
  room_type_id IN (
    SELECT rt.id FROM public.room_types rt 
    JOIN public.hotels h ON rt.hotel_id = h.id 
    WHERE h.admin_id = auth.uid()
  )
) WITH CHECK (
  room_type_id IN (
    SELECT rt.id FROM public.room_types rt 
    JOIN public.hotels h ON rt.hotel_id = h.id 
    WHERE h.admin_id = auth.uid()
  )
);


ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own reservations" ON public.reservations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins see hotel reservations" ON public.reservations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND admin_id = auth.uid())
);
CREATE POLICY "Users can insert own reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


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
  p_check_in date, p_check_out date, p_guests int, p_total_price numeric,
  p_guest_name text DEFAULT NULL, p_guest_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_reservation_id uuid;
  v_date date;
  v_available int;
BEGIN
  -- Verify day-by-day availability in room_availability
  v_date := p_check_in;
  WHILE v_date < p_check_out LOOP
    SELECT available_count INTO v_available
    FROM public.room_availability
    WHERE room_type_id = p_room_type_id 
      AND date = v_date 
      AND is_available = true
    FOR UPDATE;

    -- If there's no record or available count is 0, booking is impossible
    IF v_available IS NULL OR v_available <= 0 THEN
      RAISE EXCEPTION 'No vacancy available on %', v_date;
    END IF;

    -- Decrement the available count for that specific date row
    UPDATE public.room_availability 
    SET available_count = available_count - 1
    WHERE room_type_id = p_room_type_id AND date = v_date;

    v_date := v_date + 1;
  END LOOP;

  -- Insert the confirmed reservation
  INSERT INTO public.reservations (user_id, hotel_id, room_type_id, check_in, check_out, guests, total_price, status, guest_name, guest_email)
  VALUES (p_user_id, p_hotel_id, p_room_type_id, p_check_in, p_check_out, p_guests, p_total_price, 'confirmed', p_guest_name, p_guest_email)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql;
