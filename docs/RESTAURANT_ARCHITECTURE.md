# Архитектурная Документация: Ресторанный Модуль

## Обзор Системы

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NUMA BACKEND (Express/TS)                           │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   E-COMMERCE    │   RESTAURANT    │   RESTAURANT    │      SHARED           │
│   (БАДы/Goods)  │   SITE 1        │   SITE 2        │                       │
│                 │   (Reservations)│   (Delivery)    │                       │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ • Products      │ • Tables        │ • Menu + BZHU   │ • Admin Auth          │
│ • Categories    │ • Reservations  │ • Subscriptions │ • Payment Gateway     │
│ • Cart          │ • Time Slots    │ • Delivery      │ • Redis Cache         │
│ • Orders        │ • Deposits      │ • Couriers      │ • Logger              │
│ • Blog          │ • Blocked Dates │ • Zones         │                       │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL DB   │
                    │   + Redis Cache   │
                    └───────────────────┘
```

---

## 1. Схема БД: Бронирование Столов

### Таблицы

```sql
-- Столы ресторана
restaurant.tables (
   id UUID PK,
   number VARCHAR(20) UNIQUE,
   capacity INTEGER,
   zone VARCHAR(100),      -- "терраса", "VIP-зал", "основной зал"
   is_active BOOLEAN
)

-- Бронирования
restaurant.reservations (
   id UUID PK,
   table_id UUID FK → tables,
   customer_name, phone, email,
   party_size INTEGER,
   reservation_date DATE,
   start_time TIME,
   end_time TIME,
   deposit_amount DECIMAL,
   status ENUM('pending_payment','confirmed','cancelled','completed','no_show'),
   paid_at TIMESTAMP
)

-- Предустановленные слоты (опционально)
restaurant.reservation_time_slots (
   id UUID PK,
   day_of_week INTEGER,      -- 0=Воскресенье
   start_time TIME,
   end_time TIME,
   duration_minutes INTEGER,
   deposit_required DECIMAL  -- NULL = default
)

-- Закрытые дни/события
restaurant.blocked_dates (
   id UUID PK,
   date DATE,
   block_type ENUM('closed','private_event','maintenance','holiday'),
   table_ids JSONB,          -- NULL = весь ресторан
   start_time TIME,          -- NULL = весь день
   end_time TIME,
   reason TEXT
)
```

### Индексы для Быстрого Поиска Доступности

```sql
CREATE INDEX idx_reservations_availability
ON reservations (reservation_date, start_time, table_id, status);

CREATE INDEX idx_blocked_dates_lookup
ON blocked_dates (date);
```

---

## 2. Защита от Race Conditions (Гонок)

### Проблема

```
Время  │ Пользователь A              │ Пользователь B
──────────────────────────────────────────────────────────────
T1     │ findAvailable() → [Table 5] │
T2     │                             │ findAvailable() → [Table 5]
T3     │ create(Table 5, 19:00)      │
T4     │                             │ create(Table 5, 19:00) ← ДУБЛИКАТ!
```

### Решение: 3-уровневая защита

```typescript
// 1. Redis Distributed Lock (первичная защита)
async function acquireReservationLock(tableId, date, time) {
   const key = `reservation:lock:${tableId}:${date}:${time}`;
   return await redis.set(key, uuid, { NX: true, PX: 30000 });
}

// 2. PostgreSQL Advisory Lock (fallback при недоступности Redis)
SELECT pg_try_advisory_lock(hash_of_key);

// 3. Optimistic → Pessimistic Check
// Сначала быстрая проверка (без лока), потом повторная внутри лока
```

### Реализация

```typescript
// reservationService.create():

// 1. Optimistic check (быстрый, без лока)
const available = await tableRepository.findAvailable(date, time, partySize);
if (!available.includes(tableId)) throw new BadRequestError('Not available');

// 2. Acquire distributed lock
return withReservationLock(tableId, date, time, async () => {

   // 3. Pessimistic recheck (внутри лока)
   const stillAvailable = await tableRepository.findAvailable(date, time, partySize);
   if (!stillAvailable.includes(tableId)) {
      throw new ConflictError('Table was just booked');
   }

   // 4. Create inside transaction
   return db.transaction(async (t) => {
      const reservation = await reservationRepository.create({...}, t);
      await paymentRepository.create({...}, t);
      return reservation;
   });
});
```

---

## 3. Схема БД: Подписки и Доставка

### Таблицы

```sql
-- Зоны доставки
delivery_zones (
   id UUID PK,
   name JSONB,               -- {ru: "Чиланзар", uz: "Chilonzor"}
   boundary_geojson JSONB,   -- GeoJSON polygon (для интеграции с Яндекс/2GIS)
   districts JSONB,          -- ["Чиланзар", "Юнусабад"]
   delivery_fee DECIMAL,
   min_order_amount DECIMAL,
   estimated_minutes INTEGER
)

-- Курьеры
couriers (
   id UUID PK,
   full_name VARCHAR,
   phone VARCHAR,
   vehicle_type ENUM('bicycle','scooter','car'),
   current_lat DECIMAL(10,7),
   current_lng DECIMAL(10,7),
   location_updated_at TIMESTAMP,
   status ENUM('offline','available','busy','on_break'),
   zone_ids JSONB           -- [zone_id1, zone_id2, ...]
)

-- Планы подписок
subscription_plans (
   id UUID PK,
   name JSONB,
   duration_days INTEGER,    -- 7, 14, 30
   meals_per_day INTEGER,    -- 3 (завтрак, обед, ужин)
   daily_calories_min INTEGER,
   daily_calories_max INTEGER,
   price_per_day DECIMAL,
   total_price DECIMAL,
   discount_percent DECIMAL,
   dietary_type ENUM('standard','vegetarian','vegan','keto','halal')
)

-- Активные подписки пользователей
user_subscriptions (
   id UUID PK,
   plan_id UUID FK → subscription_plans,
   customer_name, phone, email,
   delivery_address TEXT,
   delivery_lat DECIMAL,
   delivery_lng DECIMAL,
   zone_id UUID FK → delivery_zones,
   start_date DATE,
   end_date DATE,
   preferred_delivery_times JSONB,  -- [{meal:"breakfast", time:"08:00-10:00"}]
   status ENUM('pending_payment','active','paused','completed','cancelled'),
   skipped_dates JSONB,            -- ["2026-03-20", "2026-03-21"]
   custom_menu JSONB               -- {date: {breakfast: itemId, ...}}
)

-- Задачи на доставку (генерируются из подписок + разовых заказов)
delivery_tasks (
   id UUID PK,
   -- Полиморфная связь (или подписка, или заказ)
   subscription_id UUID FK → user_subscriptions,
   catering_order_id UUID FK → catering_orders,
   CHECK (exactly one is NOT NULL),

   delivery_date DATE,
   time_window_start TIME,
   time_window_end TIME,
   address TEXT,
   lat DECIMAL, lng DECIMAL,
   zone_id UUID FK,
   contact_phone VARCHAR,

   courier_id UUID FK → couriers,
   assigned_at TIMESTAMP,
   status ENUM('pending','assigned','in_transit','delivered','failed','cancelled'),
   picked_up_at TIMESTAMP,
   delivered_at TIMESTAMP,

   delivery_photo_url TEXT,
   recipient_signature TEXT     -- Base64
)
```

### Генерация Delivery Tasks из Подписки

```typescript
// При активации подписки генерируем все delivery_tasks
async function generateDeliveryTasks(subscription: UserSubscription) {
   const tasks = [];
   let currentDate = subscription.startDate;

   while (currentDate <= subscription.endDate) {
      // Пропускаем выходные или skipped_dates
      if (!subscription.skippedDates.includes(currentDate)) {
         for (const meal of subscription.preferredDeliveryTimes) {
            tasks.push({
               subscriptionId: subscription.id,
               deliveryDate: currentDate,
               timeWindowStart: meal.time.split('-')[0],
               timeWindowEnd: meal.time.split('-')[1],
               address: subscription.deliveryAddress,
               lat: subscription.deliveryLat,
               lng: subscription.deliveryLng,
               zoneId: subscription.zoneId,
               contactPhone: subscription.customerPhone,
               contactName: subscription.customerName,
               status: 'pending',
            });
         }
      }
      currentDate = addDays(currentDate, 1);
   }

   return deliveryTaskRepository.bulkCreate(tasks);
}
```

---

## 4. УЗКИЕ МЕСТА ПЛАТЕЖНОЙ СИСТЕМЫ

### 4.1 Полиморфная Таблица Payments

**Текущее состояние:**
```sql
payments (
   order_id UUID,           -- Shop orders
   catering_order_id UUID,  -- Restaurant catering
   reservation_id UUID,     -- Table reservations
   subscription_id UUID,    -- NEW: Meal subscriptions
   CHECK (exactly one is NOT NULL)
)
```

**Потенциальные проблемы:**

| Проблема | Риск | Решение |
|----------|------|---------|
| Один провайдер callback endpoint для всех типов | Путаница в routing | Click/Payme используют merchant_trans_id = entity ID. При поиске пробуем Order → Reservation → Subscription |
| Разные суммы и валидации | Неверные проверки | Абстрагировать getPayableEntity() |
| Разные статусы после оплаты | Забыть обновить одну сущность | Единый updatePaymentContext() |

**Рекомендуемая архитектура:**

```typescript
// paymentContextService.ts

interface PayableEntity {
   id: string;
   type: 'order' | 'catering_order' | 'reservation' | 'subscription';
   amountTiyin: number;
   isPaid: boolean;
   store: StoreSlug;
}

async function resolvePayableEntity(entityId: string): Promise<PayableEntity | null> {
   // Пробуем все типы по порядку
   const order = await Order.findByPk(entityId);
   if (order) {
      return {
         id: order.id,
         type: 'order',
         amountTiyin: Math.round(Number(order.totalAmount) * 100),
         isPaid: order.paymentStatus === 'paid',
         store: order.store,
      };
   }

   const reservation = await Reservation.findByPk(entityId);
   if (reservation) {
      return {
         id: reservation.id,
         type: 'reservation',
         amountTiyin: Math.round((reservation.depositAmount || 0) * 100),
         isPaid: reservation.status === 'confirmed',
         store: StoreSlug.RESTAURANT,
      };
   }

   // ... catering_order, subscription
   return null;
}

async function markEntityPaid(entity: PayableEntity, paidAt: Date): Promise<void> {
   switch (entity.type) {
      case 'order':
         await orderRepository.updatePaymentStatus(entity.id, 'paid');
         break;
      case 'reservation':
         await reservationRepository.updateStatus(entity.id, 'confirmed', paidAt);
         break;
      case 'subscription':
         await subscriptionRepository.activate(entity.id, paidAt);
         // + Generate delivery tasks
         await generateDeliveryTasks(entity.id);
         break;
   }
}
```

### 4.2 Риск: Подписка с Множественными Платежами

**Сценарий:** Месячная подписка = 4 недельных платежа

```
Неделя 1: 500,000 UZS ✓
Неделя 2: 500,000 UZS ✓
Неделя 3: 500,000 UZS ✓
Неделя 4: 500,000 UZS — ОТКАЗ (карта заблокирована)
```

**Решение: Subscription Payments Log**

```sql
-- Отдельная таблица для tracking частичных оплат
subscription_payments (
   id UUID PK,
   subscription_id UUID FK,
   payment_id UUID FK → payments,
   period_start DATE,
   period_end DATE,
   amount DECIMAL,
   status ENUM('pending','paid','failed','refunded')
)
```

### 4.3 Риск: Callback Hell при Множестве Типов

**Текущая проблема в clickService.ts и paymeService.ts:**
```typescript
// Спагетти-код с множеством if/else
if (payment.orderId) {
   await orderRepository.updatePaymentStatus(...);
}
if (payment.reservationId) {
   await reservationRepository.updateStatus(...);
}
if (payment.cateringOrderId) {
   await cateringOrderRepository.updatePaymentStatus(...);
}
if (payment.subscriptionId) {  // NEW
   await subscriptionRepository.activate(...);
   await generateDeliveryTasks(...);
}
```

**Решение: Strategy Pattern**

```typescript
// paymentHandlers.ts

interface PaymentHandler {
   onPaid(paymentId: string, entityId: string, paidAt: Date): Promise<void>;
   onFailed(paymentId: string, entityId: string): Promise<void>;
   onRefunded(paymentId: string, entityId: string): Promise<void>;
}

const handlers: Record<string, PaymentHandler> = {
   order: new OrderPaymentHandler(),
   reservation: new ReservationPaymentHandler(),
   catering_order: new CateringOrderPaymentHandler(),
   subscription: new SubscriptionPaymentHandler(),
};

// В clickService/paymeService:
async function handlePaymentComplete(payment: Payment) {
   const entityType = detectEntityType(payment);
   const handler = handlers[entityType];
   await handler.onPaid(payment.id, getEntityId(payment), new Date());
}
```

### 4.4 Риск: Таймауты на Длинных Операциях

**Проблема:** Активация подписки требует:
1. Обновить статус подписки
2. Создать 30-90 delivery_tasks (по 3 на день)
3. Возможно отправить SMS/email

**Решение: Async Job Queue**

```typescript
// В paymeService.performTransaction:

await db.transaction(async (t) => {
   await paymentRepository.update(payment.id, { status: 'paid', paidAt }, t);
   await subscriptionRepository.updateStatus(subscription.id, 'active', t);
});

// Тяжелые операции — в очередь
await jobQueue.add('subscription:activate', {
   subscriptionId: subscription.id,
});

// Worker обрабатывает асинхронно:
// - generateDeliveryTasks()
// - sendWelcomeEmail()
// - notifyCouriersOfNewSubscription()
```

---

## 5. Рекомендации по Интеграции с Гео-сервисами

### 2GIS / Яндекс.Карты API

```typescript
// geoService.ts

interface GeoService {
   geocode(address: string): Promise<{lat: number, lng: number}>;
   reverseGeocode(lat: number, lng: number): Promise<string>;
   findZone(lat: number, lng: number): Promise<DeliveryZone | null>;
   getRoute(from: LatLng, to: LatLng): Promise<RouteInfo>;
}

// При оформлении подписки/заказа:
const coords = await geoService.geocode(customerAddress);
const zone = await geoService.findZone(coords.lat, coords.lng);

if (!zone) {
   throw new BadRequestError('Delivery not available in your area');
}

subscription.deliveryLat = coords.lat;
subscription.deliveryLng = coords.lng;
subscription.zoneId = zone.id;
```

### Оптимизация Маршрутов для Курьеров

```typescript
// При распределении delivery_tasks на день:

async function optimizeCourierRoute(courierId: string, date: string) {
   const tasks = await deliveryTaskRepository.findByCourierAndDate(courierId, date);

   // Сортируем по времени окна доставки, затем оптимизируем географически
   const optimized = await geoService.optimizeRoute(
      tasks.map(t => ({ id: t.id, lat: t.lat, lng: t.lng, timeWindow: [t.timeWindowStart, t.timeWindowEnd] }))
   );

   // Обновляем порядок выполнения
   for (let i = 0; i < optimized.length; i++) {
      await deliveryTaskRepository.update(optimized[i].id, { sortOrder: i });
   }
}
```

---

## 6. Итоговая Архитектура БД

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PUBLIC SCHEMA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ admins │ categories │ products │ product_media │ carts │ cart_items │      │
│ orders │ order_items │ payments │ blog_posts │ blog_post_products │        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                           RESTAURANT TABLES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ БРОНИРОВАНИЕ (Site 1)         │ ДОСТАВКА ЕДЫ (Site 2)                      │
│ ─────────────────────         │ ────────────────────                       │
│ • tables                      │ • menu_categories                          │
│ • reservations                │ • menu_items (+БЖУК)                       │
│ • reservation_time_slots      │ • subscription_plans                       │
│ • blocked_dates               │ • user_subscriptions                       │
│                               │ • delivery_zones                           │
│                               │ • delivery_time_windows                    │
│                               │ • couriers                                 │
│                               │ • delivery_tasks                           │
│                               │                                            │
│ ОБЩИЕ                                                                       │
│ ──────                                                                       │
│ • catering_carts / catering_cart_items                                      │
│ • catering_orders / catering_order_items                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                          payments (extended)
                 ┌─────────────────────────────────┐
                 │ order_id          │ Shop       │
                 │ catering_order_id │ Restaurant │──► Click/Payme
                 │ reservation_id    │ Restaurant │    Callbacks
                 │ subscription_id   │ Restaurant │
                 └─────────────────────────────────┘
```

---

## 7. Следующие Шаги

1. **[DONE]** Race condition защита для бронирования
2. **[DONE]** Миграция для subscriptions + delivery + nutrition
3. **[TODO]** Модели Sequelize для новых таблиц
4. **[TODO]** Репозитории и сервисы для подписок
5. **[TODO]** Курьерский модуль (назначение задач, tracking)
6. **[TODO]** Интеграция с гео-API
7. **[TODO]** Job queue для асинхронных операций
8. **[TODO]** CMS endpoints для управления всем
