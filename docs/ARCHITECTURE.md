# Numa — Architecture Overview

## 1. Project Description

Numa is a B2C e-commerce platform for dietary supplements (BADs). One backend serves three distinct sub-stores:

| Slug          | Store              |
|---------------|--------------------|
| `nutrition`   | Numa Nutrition     |
| `kids`        | Numa Kids          |
| `halal`       | NAbaviy tatobati   |

All products, categories, carts, and orders are scoped to a `store` field. A single admin panel (CMS) manages all three stores.

---

## 2. Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Runtime        | Node.js + Express 5               |
| Language       | TypeScript 5                      |
| ORM            | Sequelize 6 + PostgreSQL          |
| Cache          | Redis (rarely-changing data only) |
| Auth           | JWT (access + refresh) + Redis blacklist |
| Validation     | Zod                               |
| Logging        | Pino + pino-http                  |
| File uploads   | Multer (`shared/middleware/upload.ts`) |

---

## 3. Project Structure

```
src/
  admin/      — Admin authentication & management (CMS users)
  category/   — Product categories (tree structure, per-store)
  product/    — Products + media (public & CMS)
  cart/       — Guest shopping cart (PostgreSQL, session cookie)
  order/      — Checkout & order management
  types.ts    — Shared enums (StoreSlug)
  routers.ts  — Mounts all domain routers under /api/v1
  main.ts     — App bootstrap, middleware, server start

shared/
  config/     — DB, Redis connections
  middleware/ — auth, errorHandler, healthCheck, upload
  models/     — Associations.ts (all Sequelize relations)
  utils/      — AppError, apiResponse, jwt, logger, zod helpers
```

Each domain owns: `model/` → `repository/` → `service/` → `controller/` → `router` → `dto/`

---

## 4. Data Model & Relationships

```
Admin
  id, name, email, passwordHash, role(admin), isActive, lastLoginAt

Category
  id, slug, nameUz/Ru/En, store, parentId(self-ref), imageUrl, sortOrder, isActive
  └── subcategories: Category[]       (self-join)
  └── products: Product[]

Product
  id, slug, sku, nameUz/Ru/En, descriptionUz/Ru/En
  price, discountPrice, stock, unit
  store, categoryId, status(active|draft|archived), isFeatured
  deletedAt (paranoid soft-delete)
  └── media: ProductMedia[]

ProductMedia
  id, productId, url, type(image|video), isMain, sortOrder

Cart  ←— identified by httpOnly cookie "cart_session"
  id, sessionToken, store, expiresAt(+7 days)
  └── items: CartItem[]

CartItem
  id, cartId, productId, quantity
  (unique: cartId + productId)

Order
  id, store, customerName, customerSurname, customerPhone
  customerAddress, notes, status(new|processing|completed|cancelled)
  totalAmount
  └── items: OrderItem[]

OrderItem  ←— snapshot at time of order (price/name never changes)
  id, orderId, productId
  productNameUz/Ru/En, productSku, unitPrice, quantity, subtotal
```

---

## 5. User Flow (Guest Shopper)

```
1. BROWSE
   GET  /api/v1/products?store=nutrition&categoryId=...&q=...
   GET  /api/v1/products/featured/nutrition
   GET  /api/v1/products/nutrition/some-product-slug

2. GET CART
   GET  /api/v1/cart
   ← Server reads cookie "cart_session"
   ← If no cookie → creates Cart row, sets httpOnly cookie (nanoid 32, 7-day TTL)
   ← Returns cart with items + product details

3. ADD / UPDATE / REMOVE ITEMS
   POST   /api/v1/cart/store/nutrition       { productId, quantity }
   PATCH  /api/v1/cart/item/:productId       { quantity }
   DELETE /api/v1/cart/item/:productId
   DELETE /api/v1/cart                        (clear all)

4. CHECKOUT
   POST /api/v1/orders/checkout
   Body: {
     cartSessionToken,   ← token from cookie (sent by client)
     customerName,
     customerSurname,
     customerPhone,
     customerAddress,
     notes?
   }
   ← Validates stock for each item
   ← Creates Order + OrderItems (price snapshot)
   ← Clears cart
   ← Returns order summary
```

> **Session token**: The guest has no account. The `cart_session` cookie (httpOnly, sameSite=lax) is the only identity. It prevents XSS from stealing the token and lets the server own cart state in PostgreSQL.

---

## 6. Admin Flow

```
1. LOGIN
   POST /api/v1/admin/login    { email, password }
   ← Returns { accessToken, refreshToken }
   ← All subsequent CMS requests: Authorization: Bearer <accessToken>

2. PROFILE & MANAGEMENT
   GET    /api/v1/admin/me
   GET    /api/v1/admin/            ← list all admins
   POST   /api/v1/admin/            ← create new admin
   DELETE /api/v1/admin/:id         ← deactivate admin

3. MANAGE CATEGORIES
   GET    /api/v1/categories?store=nutrition
   POST   /api/v1/categories        { slug, nameUz, nameRu, nameEn, store, parentId? }
   PATCH  /api/v1/categories/:id
   DELETE /api/v1/categories/:id

4. MANAGE PRODUCTS
   POST   /api/v1/products/cms                    (create)
   GET    /api/v1/products/cms?store=...&status=...
   GET    /api/v1/products/cms/:id
   PATCH  /api/v1/products/cms/:id                (update fields)
   PATCH  /api/v1/products/cms/:id/status         { status: 'active'|'draft'|'archived' }
   DELETE /api/v1/products/cms/:id                (soft-delete)

5. MANAGE PRODUCT MEDIA
   POST   /api/v1/products/cms/:id/media               (upload image/video)
   PATCH  /api/v1/products/cms/:id/media/:mediaId/main (set as main image)
   DELETE /api/v1/products/cms/:id/media/:mediaId

6. MANAGE ORDERS
   GET    /api/v1/orders/cms?store=...&status=...
   GET    /api/v1/orders/cms/:id
   PATCH  /api/v1/orders/cms/:id    { status: 'processing'|'completed'|'cancelled' }
```

---

## 7. Full API Route Reference

**Base prefix**: `/api/v1`

### Admin (`/admin`)
| Method | Path          | Auth | Description              |
|--------|---------------|------|--------------------------|
| POST   | /login        | —    | Admin login, get tokens  |
| GET    | /me           | JWT  | Own profile              |
| GET    | /             | JWT  | List all admins          |
| POST   | /             | JWT  | Create admin             |
| DELETE | /:id          | JWT  | Deactivate admin         |

### Categories (`/categories`)
| Method | Path             | Auth | Description                  |
|--------|------------------|------|------------------------------|
| GET    | /store/:store    | —    | Public: list active categories |
| GET    | /                | JWT  | CMS: list all categories      |
| GET    | /id/:id          | JWT  | CMS: get category by ID       |
| POST   | /                | JWT  | CMS: create category          |
| PATCH  | /:id             | JWT  | CMS: update category          |
| DELETE | /:id             | JWT  | CMS: delete category          |

### Products (`/products`)
| Method | Path                             | Auth | Description               |
|--------|----------------------------------|------|---------------------------|
| GET    | /                                | —    | Public: list products     |
| GET    | /featured/:store                 | —    | Public: featured products |
| GET    | /:store/:slug                    | —    | Public: product detail    |
| GET    | /cms                             | JWT  | CMS: list all products    |
| POST   | /cms                             | JWT  | CMS: create product       |
| GET    | /cms/:id                         | JWT  | CMS: get product by ID    |
| PATCH  | /cms/:id                         | JWT  | CMS: update product       |
| PATCH  | /cms/:id/status                  | JWT  | CMS: change status        |
| DELETE | /cms/:id                         | JWT  | CMS: soft-delete          |
| POST   | /cms/:id/media                   | JWT  | CMS: upload media         |
| PATCH  | /cms/:id/media/:mediaId/main     | JWT  | CMS: set main image       |
| DELETE | /cms/:id/media/:mediaId          | JWT  | CMS: delete media file    |

### Cart (`/cart`)
| Method | Path               | Auth | Description                    |
|--------|--------------------|------|--------------------------------|
| GET    | /                  | —    | Get/create cart (cookie-based) |
| POST   | /store/:store      | —    | Add item to cart               |
| PATCH  | /item/:productId   | —    | Update item quantity           |
| DELETE | /item/:productId   | —    | Remove item from cart          |
| DELETE | /                  | —    | Clear entire cart              |

### Orders (`/orders`)
| Method | Path          | Auth | Description              |
|--------|---------------|------|--------------------------|
| POST   | /checkout     | —    | Guest checkout           |
| GET    | /cms          | JWT  | CMS: list orders         |
| GET    | /cms/:id      | JWT  | CMS: order detail        |
| PATCH  | /cms/:id      | JWT  | CMS: update order status |

### System
| Method | Path             | Description        |
|--------|------------------|--------------------|
| GET    | /health          | Health check       |
| GET    | /api-docs        | Swagger UI (dev)   |

---

## 8. Multilingual Fields

All user-facing text fields exist in three variants:

```
nameUz / nameRu / nameEn
descriptionUz / descriptionRu / descriptionEn
productNameUz / productNameRu / productNameEn  (OrderItem snapshot)
```

The client selects the appropriate language field client-side based on locale. The API returns all three.

---

## 9. Caching Strategy

Redis is used **only for rarely-changing reads**. Cart and orders are always read from PostgreSQL.

| Cache Key Pattern            | TTL    | When invalidated       |
|------------------------------|--------|------------------------|
| `categories:store:{store}`   | 1h     | On category CUD        |
| `products:featured:{store}`  | 30min  | On product CUD/status  |
| `product:{store}:{slug}`     | 30min  | On product update      |

> **Current state**: Redis infrastructure (`getOrSetCache`, `clearCache`) is ready in `shared/config/redis.ts` but cache calls are not yet wired into repositories.

---

## 10. What Still Needs to Be Done

### High Priority

- [ ] **Sequelize migrations** — no migration files exist yet for any table:
  - `admins`
  - `categories`
  - `products`
  - `product_media`
  - `carts`
  - `cart_items`
  - `orders`
  - `order_items`

- [ ] **Admin seed** — script to create the first admin account
  (`sequelize/seeders/` directory exists but is empty)

- [ ] **Wire Redis caching** — add `getOrSetCache` calls in:
  - `categoryRepository.findByStore()`
  - `productRepository.findFeatured()`
  - `productRepository.findBySlug()`
  - Add `clearCache()` calls in CMS write operations

- [ ] **Checkout from cookie** — `orderController.checkout` currently reads
  `cartSessionToken` from request body. Move to reading `req.cookies.cart_session`
  directly (cleaner, no client JS needed to pass the token explicitly).

### Medium Priority

- [ ] **File upload wiring** — `shared/middleware/upload.ts` (Multer) exists but is
  not yet applied to `POST /products/cms/:id/media`. The endpoint currently expects
  a URL string; needs multipart form handling.

- [ ] **Refresh token endpoint** — `generateRefreshToken` and `blacklistToken` exist
  in `shared/utils/jwt.ts` but no `/admin/refresh` or `/admin/logout` routes exist yet.

- [ ] **Cart cleanup cron** — `cartRepository.deleteExpired()` is implemented but
  nothing calls it. Wire into a `setInterval` in `main.ts` or a separate cron job.

- [ ] **Stock decrement on order** — `orderService.checkout` validates stock but does
  not decrement `product.stock` after order creation.

### Future / Nice-to-Have

- [ ] **Payment integration** — card payments (deferred)
- [ ] **Order confirmation** — SMS/Telegram notification to customer on order creation
- [ ] **Admin order notifications** — push/webhook when new order arrives
- [ ] **Product variants** — size, flavor, etc. (not in current model)
- [ ] **Discount codes / promotions**
- [ ] **Customer accounts** — optional registration with order history
- [ ] **swagger.yaml** — currently a placeholder; fill out all routes

---

## 11. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Guest cart via httpOnly cookie | No auth needed; token is opaque to JS (XSS-safe); cart state in DB survives server restart |
| Order as snapshot | `OrderItem` stores price/name at order time, so product updates don't retroactively change old orders |
| `paranoid: true` on Product | Soft-delete allows order history to still resolve product references |
| Single backend, `store` discriminator | Simpler ops than 3 separate services; store slug gates visibility everywhere |
| No `super_admin` role | All admins are equal; simpler permission model for current team size |
| Redis optional / fail-open | App works fully without Redis; cache is a performance layer, not a dependency |
