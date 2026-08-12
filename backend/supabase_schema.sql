create table if not exists menu_items (
  id text primary key,
  name text not null,
  description text not null default '',
  price_pkr integer not null check (price_pkr >= 0),
  image_url text not null default '',
  tags text[] not null default '{}',
  is_available boolean not null default true,
  sort_order integer not null default 99,
  created_at timestamptz not null default now()
);

create table if not exists toppings (
  id text primary key,
  name text not null,
  price_pkr integer not null check (price_pkr >= 0),
  icon text not null default '',
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists custom_options (
  id text primary key,
  category text not null check (category in ('broth', 'noodle', 'protein', 'spice')),
  name text not null,
  note text not null default '',
  price_pkr integer not null check (price_pkr >= 0),
  icon text not null default '',
  is_available boolean not null default true,
  sort_order integer not null default 99,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  order_number text not null,
  customer_name text not null,
  phone text not null,
  address text not null,
  delivery_note text default '',
  payment_method text not null default 'Cash on Delivery',
  total_pkr integer not null default 0,
  status text not null default 'pending',
  order_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id text primary key,
  setting_key text not null unique,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists admin_logs (
  id text primary key,
  admin_name text not null default 'Admin',
  action_type text not null,
  target_table text not null,
  target_id text not null default '',
  old_value jsonb,
  new_value jsonb,
  status text not null default 'success',
  created_at timestamptz not null default now()
);

alter table menu_items enable row level security;
alter table toppings enable row level security;
alter table custom_options enable row level security;
alter table orders enable row level security;
alter table site_settings enable row level security;
alter table admin_logs enable row level security;

alter table toppings add column if not exists icon text not null default '';
alter table custom_options add column if not exists icon text not null default '';

insert into site_settings (id, setting_key, setting_value)
values
  ('setting-primary-color', 'primary_color', '#B94A2F'),
  ('setting-secondary-color', 'secondary_color', '#FFF3E4'),
  ('setting-logo-url', 'logo_url', ''),
  ('setting-tagline', 'tagline', 'A bowl that feels like home.'),
  ('setting-hero-title', 'hero_title', 'Ramen Remedy'),
  ('setting-delivery-fee', 'delivery_fee', '150')
on conflict (setting_key) do nothing;

insert into menu_items (id, name, description, price_pkr, image_url, tags, is_available, sort_order)
values
  (
    'classic-chicken-ramen',
    'Classic Chicken Ramen',
    'Slow-simmered chicken broth, springy noodles, tender chicken, greens, and a jammy egg.',
    850,
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    array['comfort', 'chicken', 'classic'],
    true,
    1
  ),
  (
    'spicy-miso-ramen',
    'Spicy Miso Ramen',
    'A cozy miso broth with a gentle kick, corn, scallions, and chili warmth.',
    950,
    'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=900&q=80',
    array['spicy', 'miso', 'popular'],
    true,
    2
  ),
  (
    'korean-fire-ramen',
    'Korean Fire Ramen',
    'Bold red broth, chewy noodles, chili oil, and big heat for spice lovers.',
    1050,
    'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80',
    array['extra spicy', 'bold', 'hot'],
    true,
    3
  ),
  (
    'creamy-cheese-ramen',
    'Creamy Cheese Ramen',
    'Silky broth with melted cheese, sweet corn, noodles, and soft cozy flavor.',
    990,
    'https://images.unsplash.com/photo-1623341214825-9f4f963727da?auto=format&fit=crop&w=900&q=80',
    array['creamy', 'cheese', 'cozy'],
    true,
    4
  ),
  (
    'veggie-comfort-ramen',
    'Veggie Comfort Ramen',
    'Vegetable broth with mushrooms, tofu, corn, seaweed, and fresh spring onions.',
    780,
    'https://images.unsplash.com/photo-1637024698421-533d83c7b883?auto=format&fit=crop&w=900&q=80',
    array['vegetarian', 'light', 'fresh'],
    true,
    5
  ),
  (
    'seafood-ramen',
    'Seafood Ramen',
    'Ocean-inspired broth with shrimp, seaweed, scallions, and a clean savory finish.',
    1150,
    'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=900&q=80',
    array['seafood', 'shrimp', 'savory'],
    true,
    6
  )
on conflict (id) do nothing;

insert into toppings (id, name, price_pkr, icon, is_available)
values
  ('boiled-egg', 'Boiled Egg', 120, '🥚', true),
  ('corn', 'Corn', 70, '🌽', true),
  ('mushrooms', 'Mushrooms', 110, '🍄', true),
  ('chicken-slices', 'Chicken Slices', 250, '🍗', true),
  ('cheese', 'Cheese', 130, '🧀', true),
  ('seaweed', 'Seaweed', 80, '🌿', true),
  ('chili-oil', 'Chili Oil', 60, '🌶️', true),
  ('spring-onions', 'Spring Onions', 40, '🥗', true),
  ('tofu', 'Tofu', 180, '◻️', true)
on conflict (id) do update set
  icon = case
    when toppings.icon = '' then excluded.icon
    else toppings.icon
  end;

insert into custom_options (id, category, name, note, price_pkr, icon, is_available, sort_order)
values
  ('shoyu', 'broth', 'Shoyu Broth', 'soy-based and balanced', 520, '🍜', true, 1),
  ('miso', 'broth', 'Miso Broth', 'savory, deep, and cozy', 570, '🍲', true, 2),
  ('tonkotsu', 'broth', 'Tonkotsu Broth', 'rich and creamy-style', 650, '🥣', true, 3),
  ('veggie', 'broth', 'Veggie Broth', 'light and plant-friendly', 500, '🥦', true, 4),
  ('classic', 'noodle', 'Classic Noodles', 'regular springy ramen noodles', 0, '🍜', true, 1),
  ('thick', 'noodle', 'Thick Noodles', 'chewy noodles for extra comfort', 80, '🍝', true, 2),
  ('thin', 'noodle', 'Thin Noodles', 'light noodles that soak broth quickly', 0, '🥢', true, 3),
  ('udon', 'noodle', 'Udon-Style Noodles', 'wide soft noodles with a cozy bite', 120, '🥣', true, 4),
  ('none', 'protein', 'No Protein', 'keep it simple', 0, '✨', true, 1),
  ('chicken', 'protein', 'Chicken', 'tender chicken pieces', 250, '🍗', true, 2),
  ('tofu', 'protein', 'Tofu', 'soft vegetarian protein', 180, '◻️', true, 3),
  ('shrimp', 'protein', 'Shrimp', 'seafood-style protein', 350, '🦐', true, 4),
  ('beef', 'protein', 'Beef', 'rich and filling protein', 380, '🥩', true, 5),
  ('mild', 'spice', 'Mild', 'gentle and cozy', 0, '🌱', true, 1),
  ('medium', 'spice', 'Medium', 'warm but balanced', 40, '🌶️', true, 2),
  ('hot', 'spice', 'Hot', 'strong chili warmth', 70, '🔥', true, 3),
  ('fire', 'spice', 'Fire', 'for serious spice lovers', 90, '🔥', true, 4)
on conflict (id) do update set
  icon = case
    when custom_options.icon = '' then excluded.icon
    else custom_options.icon
  end;
