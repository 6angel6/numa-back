export enum Permission {
   // ── Products ──────────────────────────────────────────────────────────────
   PRODUCTS_READ = 'products:read',
   PRODUCTS_WRITE = 'products:write',
   PRODUCTS_DELETE = 'products:delete',

   // ── Categories ────────────────────────────────────────────────────────────
   CATEGORIES_READ = 'categories:read',
   CATEGORIES_WRITE = 'categories:write',
   CATEGORIES_DELETE = 'categories:delete',

   // ── Orders ────────────────────────────────────────────────────────────────
   ORDERS_READ = 'orders:read',
   ORDERS_WRITE = 'orders:write',

   // ── Payments ──────────────────────────────────────────────────────────────
   PAYMENTS_READ = 'payments:read',
   PAYMENTS_WRITE = 'payments:write',

   // ── Blog ──────────────────────────────────────────────────────────────────
   BLOG_READ = 'blog:read',
   BLOG_WRITE = 'blog:write',
   BLOG_DELETE = 'blog:delete',

   // ── Restaurant: Menu ──────────────────────────────────────────────────────
   MENU_READ = 'menu:read',
   MENU_WRITE = 'menu:write',
   MENU_DELETE = 'menu:delete',

   // ── Restaurant: Tables ────────────────────────────────────────────────────
   TABLES_READ = 'tables:read',
   TABLES_WRITE = 'tables:write',

   // ── Restaurant: Reservations ──────────────────────────────────────────────
   RESERVATIONS_READ = 'reservations:read',
   RESERVATIONS_WRITE = 'reservations:write',

   // ── Restaurant: Catering ─────────────────────────────────────────────────
   CATERING_READ = 'catering:read',
   CATERING_WRITE = 'catering:write',

   // ── Nutrition: Dishes (блюда с БЖУ) ──────────────────────────────────────
   DISHES_READ = 'dishes:read',
   DISHES_WRITE = 'dishes:write',
   DISHES_DELETE = 'dishes:delete',

   // ── Nutrition: Sets (комбо-наборы) ───────────────────────────────────────
   SETS_READ = 'sets:read',
   SETS_WRITE = 'sets:write',
   SETS_DELETE = 'sets:delete',

   // ── Nutrition: Delivery Slots (слоты доставки) ───────────────────────────
   DELIVERY_SLOTS_READ = 'delivery_slots:read',
   DELIVERY_SLOTS_WRITE = 'delivery_slots:write',

   // ── Nutrition: Subscription Plans ─────────────────────────────────────────
   SUBSCRIPTION_PLANS_READ = 'subscription_plans:read',
   SUBSCRIPTION_PLANS_WRITE = 'subscription_plans:write',
   SUBSCRIPTION_PLANS_DELETE = 'subscription_plans:delete',

   // ── Site CMS ──────────────────────────────────────────────────────────────
   SITE_MANAGE = 'site:manage',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [];
