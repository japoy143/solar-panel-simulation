-- More panels, hybrid inverters and batteries, plus battery max-output ratings.
-- Run once in the Supabase SQL editor after 0001_init.sql. Safe to re-run.
-- For batteries, `kw` is the max continuous output; the simulator uses it to warn
-- when too many appliances run at once.

update public.products set kw = 2.5 where slug = 'battery-5'  and kw is null;
update public.products set kw = 5   where slug = 'battery-10' and kw is null;

insert into public.products
  (slug, name, category, summary, specs, featured, sort_order, placement, size_w, size_h, size_d, watts, kw, kwh, hybrid)
values
  -- Panels (roof)
  ('compact-370', 'Compact 370 W Panel', 'panel',
   'Smaller footprint for tight or oddly shaped roofs.',
   '[{"label":"Power","value":"370 W"},{"label":"Efficiency","value":"20.1%"},{"label":"Warranty","value":"25 yr"}]',
   false, 5, 'roof', 1.05, 1.75, 0.035, 370, null, null, false),
  ('mono-450', 'Mono 450 W Panel', 'panel',
   'More power per panel for medium and large homes.',
   '[{"label":"Power","value":"450 W"},{"label":"Efficiency","value":"21.7%"},{"label":"Warranty","value":"25 yr"}]',
   false, 25, 'roof', 1.13, 1.90, 0.035, 450, null, null, false),
  ('bifacial-550', 'Bifacial 550 W Panel', 'panel',
   'Large dual-glass panel that also captures reflected light. Best on big or flat roofs.',
   '[{"label":"Power","value":"550 W"},{"label":"Efficiency","value":"21.3%"},{"label":"Warranty","value":"30 yr"}]',
   false, 27, 'roof', 1.13, 2.28, 0.035, 550, null, null, false),

  -- Inverters (wall)
  ('hybrid-3-6', 'Hybrid Inverter 3.6 kW', 'inverter',
   'Battery-ready inverter for small homes and cabins.',
   '[{"label":"Output","value":"3.6 kW"},{"label":"Phase","value":"Single"},{"label":"Battery","value":"Ready"}]',
   false, 28, 'wall', 0.42, 0.50, 0.18, null, 3.6, null, true),
  ('hybrid-8', 'Hybrid Inverter 8 kW', 'inverter',
   'Runs larger homes and bigger batteries, with backup output for outages.',
   '[{"label":"Output","value":"8 kW"},{"label":"Phase","value":"Single"},{"label":"Battery","value":"Ready"}]',
   false, 35, 'wall', 0.50, 0.70, 0.24, null, 8, null, true),
  ('hybrid-10-3p', 'Three-Phase Hybrid 10 kW', 'inverter',
   'Three-phase hybrid for large homes and small businesses.',
   '[{"label":"Output","value":"10 kW"},{"label":"Phase","value":"Three"},{"label":"Battery","value":"Ready"}]',
   false, 45, 'wall', 0.55, 0.75, 0.25, null, 10, null, true),

  -- Batteries (wall)
  ('battery-2-5', 'Home Battery 2.5 kWh', 'battery',
   'Entry-level backup for lights, Wi-Fi, fans and the fridge.',
   '[{"label":"Capacity","value":"2.5 kWh"},{"label":"Power","value":"1.25 kW"},{"label":"Chemistry","value":"LFP"}]',
   false, 48, 'wall', 0.50, 0.40, 0.20, null, 1.25, 2.5, false),
  ('battery-7-5', 'Home Battery 7.5 kWh', 'battery',
   'Covers a typical evening, including a small aircon.',
   '[{"label":"Capacity","value":"7.5 kWh"},{"label":"Power","value":"3.75 kW"},{"label":"Chemistry","value":"LFP"}]',
   false, 55, 'wall', 0.60, 0.90, 0.25, null, 3.75, 7.5, false),
  ('battery-13-5', 'Home Battery 13.5 kWh', 'battery',
   'Whole-home backup in a slim wall-mounted unit.',
   '[{"label":"Capacity","value":"13.5 kWh"},{"label":"Power","value":"5 kW"},{"label":"Chemistry","value":"LFP"}]',
   false, 65, 'wall', 0.75, 1.15, 0.15, null, 5, 13.5, false),
  ('battery-15-stack', 'Stackable Battery 15 kWh', 'battery',
   'Modular stack you can extend later. High output for aircons and cooking.',
   '[{"label":"Capacity","value":"15 kWh"},{"label":"Power","value":"7.5 kW"},{"label":"Chemistry","value":"LFP"}]',
   false, 70, 'wall', 0.60, 1.40, 0.30, null, 7.5, 15, false)
on conflict (slug) do nothing;
