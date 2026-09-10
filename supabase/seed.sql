-- =============================================================================
-- SEED — development data for Al-Murshid
--
-- ⚠️  EVERY price, address, phone number and specification below is FICTIONAL
--     placeholder data for development. None of it is production information.
--     Products carry is_placeholder = true and specs carry is_confirmed = false
--     so the UI never presents any of it as an announced fact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, name_ar, description_ar) values
  ('view_reservations',   'عرض الحجوزات',        'الاطلاع على قائمة الحجوزات وتفاصيلها'),
  ('manage_reservations', 'إدارة الحجوزات',      'تغيير حالة الحجز والإلغاء'),
  ('manage_stock',        'إدارة المخزون',        'تعديل كميات المخزون'),
  ('view_prices',         'عرض الأسعار',          'الاطلاع على الأسعار الداخلية'),
  ('manage_prices',       'إدارة الأسعار',        'تعديل الأسعار الداخلية'),
  ('scan_qr',             'مسح رمز QR',           'التحقق من رموز الاستلام'),
  ('view_audit_logs',     'عرض سجل التدقيق',      'الاطلاع على سجل العمليات الإدارية'),
  ('manage_settings',     'إدارة الإعدادات',      'تعديل إعدادات المتجر والحجز'),
  ('manage_products',     'إدارة المنتجات',       'إضافة وتعديل المنتجات والمواصفات'),
  ('manage_users',        'إدارة المستخدمين',     'إضافة المستخدمين ومنح الصلاحيات'),
  ('export_data',         'تصدير البيانات',       'تصدير الحجوزات إلى CSV')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (key, name_ar, name_en, description_ar, rank) values
  ('admin',   'مدير النظام', 'Administrator', 'صلاحية كاملة على النظام', 100),
  ('manager', 'مدير',        'Manager',       'إدارة الحجوزات والمخزون والأسعار', 50),
  ('staff',   'موظف',        'Staff',         'استقبال العملاء وتسليم الأجهزة', 10)
on conflict (key) do nothing;

-- admin → everything
insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

-- manager → everything except user administration
insert into public.role_permissions (role_key, permission_key)
select 'manager', key from public.permissions where key <> 'manage_users'
on conflict do nothing;

-- staff → the counter's job, and nothing about money
insert into public.role_permissions (role_key, permission_key) values
  ('staff', 'view_reservations'),
  ('staff', 'manage_reservations'),
  ('staff', 'scan_qr')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Settings — ⚙️ every value marked TODO must be set by Al-Murshid
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public, description) values
  ('store_name',               '"المرشد"'::jsonb,        true,  'اسم المتجر'),
  ('store_name_en',            '"Al-Murshid"'::jsonb,    true,  'Store name (English)'),
  ('booking_enabled',          'true'::jsonb,            true,  'تفعيل استقبال الحجوزات'),
  ('maintenance_mode',         'false'::jsonb,           true,  'إيقاف الحجوزات مؤقتًا'),
  ('maintenance_message_ar',   '"الحجوزات متوقفة مؤقتًا. نعود إليكم قريبًا."'::jsonb, true, 'رسالة الإيقاف المؤقت'),
  -- TODO ⚙️ CONFIGURE: replace with the real launch moment (stored in UTC).
  ('booking_launch_at',        to_jsonb((now() + interval '30 days')::text), true, 'موعد فتح الحجز — قيمة مبدئية'),
  ('reservation_expiry_hours', '48'::jsonb,              true,  'مدة صلاحية الحجز بالساعات'),
  ('pickup_enabled',           'true'::jsonb,            true,  'تفعيل الاستلام من الفرع'),
  ('delivery_enabled',         'true'::jsonb,            true,  'تفعيل التوصيل'),
  ('show_exact_stock',         'false'::jsonb,           false, 'إظهار الكمية الدقيقة للعملاء (يُنصح بإبقائه معطلاً)'),
  ('currency',                 '"LYD"'::jsonb,           false, 'عملة الأسعار الداخلية'),
  -- TODO ⚙️ CONFIGURE
  ('contact_phone',            '""'::jsonb,              true,  'رقم التواصل'),
  ('whatsapp_number',          '""'::jsonb,              true,  'رقم واتساب'),
  ('announcement_ar',          '""'::jsonb,              true,  'شريط إعلان أعلى الصفحة'),
  ('social_instagram',         '""'::jsonb,              true,  'رابط إنستغرام'),
  ('social_facebook',          '""'::jsonb,              true,  'رابط فيسبوك'),
  ('social_tiktok',            '""'::jsonb,              true,  'رابط تيك توك'),
  -- Left empty on purpose: the UI omits these blocks rather than inventing terms.
  ('trust_pickup_note_ar',     '""'::jsonb,              true,  'شرح آلية الاستلام'),
  ('trust_delivery_note_ar',   '""'::jsonb,              true,  'شرح آلية التوصيل'),
  ('trust_payment_note_ar',    '""'::jsonb,              true,  'شرح آلية الدفع'),
  ('primary_product_slug',     '"iphone-18-pro-max"'::jsonb, true, 'المنتج الرئيسي في الواجهة'),
  ('compare_product_slugs',    '["iphone-17-pro-max","iphone-18-pro-max"]'::jsonb, true, 'المنتجان في قسم المقارنة')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Branches — ⚙️ CONFIGURE: placeholder locations
-- -----------------------------------------------------------------------------
insert into public.branches (slug, name_ar, name_en, city_ar, address_ar, phone, opening_hours, display_order) values
  ('tripoli-main', 'فرع طرابلس الرئيسي', 'Tripoli Main', 'طرابلس',
   'TODO — العنوان التفصيلي', null,
   '{"sat_thu": "10:00-21:00", "fri": "16:00-21:00"}'::jsonb, 1),
  ('benghazi',     'فرع بنغازي',         'Benghazi',     'بنغازي',
   'TODO — العنوان التفصيلي', null,
   '{"sat_thu": "10:00-21:00", "fri": "16:00-21:00"}'::jsonb, 2)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Capacities & colors
-- -----------------------------------------------------------------------------
insert into public.capacities (key, label_ar, label_en, size_gb, display_order) values
  ('256GB', '256 جيجابايت', '256 GB',  256, 1),
  ('512GB', '512 جيجابايت', '512 GB',  512, 2),
  ('1TB',   '1 تيرابايت',   '1 TB',   1024, 3)
on conflict (key) do nothing;

insert into public.colors (key, name_ar, name_en, hex, gradient_from, gradient_to, display_order) values
  ('burgundy',     'العنابي',          'Burgundy',     '#6B1F2E', '#2A0A11', '#8E2A3C', 1),
  ('silver',       'السيلفر',          'Silver',       '#C9CCD1', '#5A5E63', '#EDEFF2', 2),
  ('glacier-blue', 'الأزرق السمائي',   'Glacier Blue', '#8FB4CE', '#274357', '#BBD7E8', 3),
  ('royal-black',  'الأسود الملكي',    'Royal Black',  '#16171A', '#000000', '#3A3D42', 4)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
insert into public.products
  (slug, name_ar, name_en, tagline_ar, description_ar, generation, is_active, is_bookable, is_placeholder, hero_image_path, model_3d_path, display_order)
values
  ('iphone-18-pro-max', 'آيفون 18 برو ماكس', 'iPhone 18 Pro Max',
   'أكبر شاشة، أطول عمر بطارية', 'الطراز الأعلى في الجيل الجديد.',
   18, true, true, true, '/images/products/iphone-18-pro-max.png', '/models/iphone.glb', 1),
  ('iphone-18-pro',     'آيفون 18 برو',      'iPhone 18 Pro',
   'قوة احترافية بحجم مثالي', 'الطراز الاحترافي في الجيل الجديد.',
   18, true, true, true, '/images/products/iphone-18-pro.png', '/models/iphone.glb', 2),
  -- Shown only in the comparison section; not reservable.
  ('iphone-17-pro-max', 'آيفون 17 برو ماكس', 'iPhone 17 Pro Max',
   'الجيل السابق', 'يُعرض لأغراض المقارنة فقط.',
   17, true, false, true, '/images/products/iphone-17-pro-max.png', null, 3)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Variants — model × capacity × color, generated rather than hand-listed.
-- -----------------------------------------------------------------------------
do $$
declare
  v_product  record;
  v_capacity record;
  v_color    record;
  v_sku      text;
  v_prefix   text;
begin
  for v_product in
    select id, slug from public.products where slug in ('iphone-18-pro', 'iphone-18-pro-max')
  loop
    v_prefix := case v_product.slug
                  when 'iphone-18-pro'     then 'IP18P'
                  when 'iphone-18-pro-max' then 'IP18PM'
                end;

    for v_capacity in select id, key from public.capacities order by display_order loop
      for v_color in select id, key from public.colors order by display_order loop
        v_sku := v_prefix || '-' || v_capacity.key || '-' ||
                 upper(replace(v_color.key, '-', ''));

        insert into public.product_variants (product_id, capacity_id, color_id, sku)
        values (v_product.id, v_capacity.id, v_color.id, v_sku)
        on conflict (product_id, capacity_id, color_id) do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Development stock. Mixed on purpose so all three availability states and the
-- disabled-selection path are exercised locally.
-- -----------------------------------------------------------------------------
update public.devices_stock s
   set quantity = case
         when c.key = '1TB'   and col.key = 'burgundy'     then 0    -- 🔴 نفد
         when c.key = '512GB' and col.key = 'glacier-blue' then 4    -- 🟠 كمية محدودة
         when c.key = '1TB'                                then 7    -- 🟠 كمية محدودة
         else 40                                                     -- 🟢 متوفر
       end
from public.product_variants v
join public.capacities c   on c.id   = v.capacity_id
join public.colors     col on col.id = v.color_id
where s.variant_id = v.id;

insert into public.stock_history (variant_id, previous_quantity, new_quantity, delta, reason, note)
select s.variant_id, 0, s.quantity, s.quantity, 'INITIAL_SEED', 'Development seed'
from public.devices_stock s
where s.quantity > 0;

-- -----------------------------------------------------------------------------
-- 🔒 Development pricing — FICTIONAL. Replace before production.
--
-- These values exist only so the reservation engine has a price to snapshot.
-- They are never rendered on any public surface.
-- -----------------------------------------------------------------------------
insert into public.variant_pricing (variant_id, price_lyd)
select v.id,
       case p.slug
         when 'iphone-18-pro'     then 4999
         when 'iphone-18-pro-max' then 5499
       end
       + case c.key when '256GB' then 0 when '512GB' then 700 when '1TB' then 1500 end
from public.product_variants v
join public.products   p on p.id = v.product_id
join public.capacities c on c.id = v.capacity_id
where p.slug in ('iphone-18-pro', 'iphone-18-pro-max')
on conflict (variant_id) do nothing;

insert into public.price_history (variant_id, previous_price, new_price, reason)
select variant_id, null, price_lyd, 'تسعير مبدئي للتطوير — يجب استبداله'
from public.variant_pricing
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Specifications — ALL unconfirmed placeholders.
--
-- is_confirmed = false means the UI renders "يُعلن لاحقًا". Nothing here is
-- presented as an official specification, because none of it is.
-- -----------------------------------------------------------------------------
do $$
declare
  v_product record;
  v_spec    record;
begin
  for v_product in select id, slug, generation from public.products loop
    for v_spec in
      select * from (values
        ('chip',       'المعالج',            'cpu',        true,  1),
        ('display',    'الشاشة',             'monitor',    true,  2),
        ('camera',     'الكاميرا',           'camera',     true,  3),
        ('battery',    'البطارية',           'battery',    true,  4),
        ('materials',  'الخامات',            'layers',     false, 5),
        ('weight',     'الوزن',              'weight',     false, 6),
        ('dimensions', 'الأبعاد',            'ruler',      false, 7),
        ('connectivity','الاتصال',           'wifi',       false, 8)
      ) as t(key, label_ar, icon, is_highlight, ord)
    loop
      insert into public.product_specs
        (product_id, key, label_ar, value_ar, icon, is_confirmed, is_highlight, display_order)
      values
        (v_product.id, v_spec.key, v_spec.label_ar, null, v_spec.icon, false, v_spec.is_highlight, v_spec.ord)
      on conflict (product_id, key) do nothing;
    end loop;
  end loop;
end $$;
