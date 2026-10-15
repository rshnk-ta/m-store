import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xxxkyznlgxtonxzuijtu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eGt5em5sZ3h0b254enVpanR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4ODg5MTQsImV4cCI6MjA5NjQ2NDkxNH0.DmAktOuuW8D_n6Tw4Rl6kj7ZXVMsNoTOnrAgwrlktuY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── SCHEMA SQL (run once in Supabase SQL editor) ───────────────────────────
// Copy everything below and run in Supabase → SQL Editor → New query

export const SCHEMA_SQL = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS (mirrors auth.users with roles)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('admin','market','supplier')),
  market text check (market in ('Nigeria','Ghana','International')),
  created_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "Users can read all users" on public.users for select using (auth.role() = 'authenticated');
create policy "Users can update own record" on public.users for update using (auth.uid() = id);

-- PRODUCTS
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  status text not null default 'pending_approval' check (status in ('active','draft','pending_approval','rejected')),
  moq integer not null,
  unit_price numeric(10,2) not null,
  production_lead_days integer default 30,
  shipping_lead_days integer default 45,
  image_url text,
  submitted_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  rejection_comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.products enable row level security;
create policy "Authenticated users can read products" on public.products for select using (auth.role() = 'authenticated');
create policy "Supplier can insert products" on public.products for insert with check (auth.role() = 'authenticated');
create policy "Admin and supplier can update products" on public.products for update using (auth.role() = 'authenticated');

-- PRODUCT VARIANTS
create table if not exists public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  brand text not null,
  sku text not null,
  color text not null,
  image_url text,
  moq_override integer,
  created_at timestamptz default now()
);
alter table public.product_variants enable row level security;
create policy "Authenticated can read variants" on public.product_variants for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert variants" on public.product_variants for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update variants" on public.product_variants for update using (auth.role() = 'authenticated');
create policy "Authenticated can delete variants" on public.product_variants for delete using (auth.role() = 'authenticated');

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id),
  variant_id uuid not null references public.product_variants(id),
  market text not null check (market in ('Nigeria','Ghana','International')),
  qty integer not null,
  type text not null default 'standard' check (type in ('standard','sample')),
  status text not null default 'collecting' check (status in (
    'collecting','moq_reached','accepted','in_production','dispatched','in_transit','arrived','delivered'
  )),
  unit_cost numeric(10,2),
  payment_terms text,
  notes text,
  placed_by uuid references public.users(id),
  accepted_by uuid references public.users(id),
  placed_at timestamptz default now(),
  accepted_at timestamptz,
  estimated_completion timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Authenticated can read orders" on public.orders for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert orders" on public.orders for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update orders" on public.orders for update using (auth.role() = 'authenticated');

-- SHIPMENTS (per destination leg)
create table if not exists public.shipments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  destination text not null check (destination in ('Nigeria','Ghana','International')),
  container_no text,
  po_reference text,
  etd date,
  eta date,
  actual_departure date,
  actual_arrival date,
  status text not null default 'pending' check (status in ('pending','dispatched','in_transit','arrived','delivered')),
  confirmed_by uuid references public.users(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.shipments enable row level security;
create policy "Authenticated can read shipments" on public.shipments for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert shipments" on public.shipments for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update shipments" on public.shipments for update using (auth.role() = 'authenticated');

-- TIMELINE LOG
create table if not exists public.timeline_log (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage text not null,
  planned_date date,
  actual_date date,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);
alter table public.timeline_log enable row level security;
create policy "Authenticated can read timeline" on public.timeline_log for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert timeline" on public.timeline_log for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update timeline" on public.timeline_log for update using (auth.role() = 'authenticated');

-- Storage policy for product-images bucket
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing;
create policy "Authenticated can upload images" on storage.objects for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "Anyone can view images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Authenticated can update images" on storage.objects for update using (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "Authenticated can delete images" on storage.objects for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');
`;
