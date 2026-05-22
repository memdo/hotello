import { createClient } from '@supabase/supabase-js';

const isNode = typeof process !== 'undefined' && process.env;
const supabaseUrl = isNode ? process.env.VITE_SUPABASE_URL : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = isNode ? process.env.VITE_SUPABASE_ANON_KEY : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
