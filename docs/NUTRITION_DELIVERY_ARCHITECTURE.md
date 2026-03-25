# Nutrition Delivery Architecture

## Обзор

Сайт доставки здорового питания (GrowFood-style) без подписок — только разовые заказы.

## 1. Схема БД

### Таблицы

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DISHES                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                             │
│ sku (unique)                                                             │
│ name (JSONB: {uz, ru, en})                                              │
│ category (ENUM: breakfast, lunch, dinner, snack, drink, dessert)        │
│ calories, proteins, fats, carbohydrates (DECIMAL) ← БЖУ на порцию       │
│ price (BIGINT, тийины)                                                  │
│ dietary_flags (ARRAY: vegan, keto, etc.)                                │
│ allergens (ARRAY: gluten, nuts, dairy, etc.)                            │
│ is_active, is_available, sort_order                                     │
└─────────────────────────────────────────────────────────────────────────┘
           │
           │ M:N через set_items
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               SETS (Комбо-наборы)                       │
├─────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                             │
│ sku (unique)                                                             │
│ name (JSONB)                                                            │
│ type (ENUM: daily, weekly, custom, promo)                               │
│ price (BIGINT) ← ФИКСИРОВАННАЯ цена (может быть ниже суммы блюд!)       │
│ original_price (BIGINT) ← для зачёркнутой цены                          │
│ total_calories, total_proteins, total_fats, total_carbohydrates         │
│ target_calories (INT) ← для фильтра "Набор на 1500 ккал"               │
│ is_active, sort_order                                                   │
└─────────────────────────────────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            SET_ITEMS (связь M:N)                        │
├─────────────────────────────────────────────────────────────────────────┤
│ set_id (FK → sets)                                                      │
│ dish_id (FK → dishes)                                                   │
│ quantity (INT) ← сколько порций блюда в сете                           │
│ sort_order                                                              │
│ UNIQUE(set_id, dish_id)                                                 │
└─────────────────────────────────────────────────────────────────────────┘

                          При создании заказа → SNAPSHOT
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       NUTRITION_ORDER_ITEMS (snapshot)                  │
├─────────────────────────────────────────────────────────────────────────┤
│ order_id (FK → orders)                                                  │
│ item_type (ENUM: dish, set)                                             │
│ item_id (UUID)                                                          │
│ sku, name (JSONB) ← snapshot на момент заказа                          │
│ unit_price, quantity, subtotal                                          │
│ calories, proteins, fats, carbohydrates ← snapshot БЖУ                 │
│ set_contents (JSONB) ← развёрнутый состав для кухни                    │
│ dietary_flags, allergens (ARRAY)                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Аудит: Почему Сет — отдельная сущность?

✅ **Да, Set должен быть отдельной таблицей:**

| Критерий | Виртуальная группировка | Отдельная сущность |
|----------|------------------------|-------------------|
| Своя цена | ❌ Нет | ✅ Да (89к vs 120к) |
| Свой SKU | ❌ Нет | ✅ Для учёта |
| Маркетинг | ❌ Сложно | ✅ "Экономия 25%" |
| Аналитика | ❌ Смешана | ✅ Топ-сетов отдельно |
| Гибкость | ❌ Статично | ✅ Промо-наборы |

## 3. Redis-корзина

### Структура ключа

```
cart:nutrition:{sessionToken}   TTL: 7 дней
```

### Формат данных

```typescript
interface RedisCart {
   sessionToken: string;
   items: Array<{
      itemType: 'dish' | 'set';
      itemId: string;
      quantity: number;
      addedAt: number;
   }>;
   createdAt: number;
   updatedAt: number;
}
```

### Кеш БЖУ (для быстрого пересчёта)

```
dish:{id}   TTL: 1 час
set:{id}    TTL: 1 час
```

Содержат: `{ sku, name, price, calories, proteins, fats, carbs, allergens }`

## 4. Калькулятор БЖУ

```typescript
// GET /cart → cartService.calculateSummary(sessionToken)

interface CartSummary {
   items: EnrichedCartItem[];  // с БЖУ каждого item
   itemCount: number;

   // Итоги
   totalPrice: number;
   totalCalories: number;
   totalProteins: number;
   totalFats: number;
   totalCarbohydrates: number;
}
```

**Алгоритм:**
1. Берём `items` из Redis-корзины
2. Batch-загружаем БЖУ из кеша или БД
3. Суммируем `calories * quantity` для каждого item
4. Возвращаем готовый объект

## 5. Флоу оплаты и момент фиксации

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  1. Добавление  │────▶│  2. Корзина    │────▶│  3. Checkout   │
│  в корзину      │     │  (Redis)       │     │  (фиксация!)   │
└────────────────┘     └────────────────┘     └────────────────┘
                                                      │
                                                      ▼
                       ┌───────────────────────────────────────────┐
                       │  КРИТИЧЕСКАЯ ТОЧКА: создание заказа       │
                       │                                            │
                       │  1. Order.create() — сам заказ             │
                       │  2. NutritionOrderItem.create() — snapshot │
                       │     - sku, name (на момент заказа)         │
                       │     - unitPrice (цена на момент заказа)    │
                       │     - calories, proteins, fats, carbs      │
                       │     - setContents (состав сета для кухни)  │
                       │  3. Payment.create() — pending             │
                       │  4. Очистка Redis-корзины                  │
                       └───────────────────────────────────────────┘
                                                      │
                                                      ▼
                       ┌────────────────┐     ┌────────────────┐
                       │  4. Редирект   │────▶│  5. Callback   │
                       │  на Click/Payme│     │  от провайдера │
                       └────────────────┘     └────────────────┘
```

**Почему snapshot критичен:**
- Рецепт блюда изменился? История заказов корректна.
- Цена выросла? Старые заказы показывают старую цену.
- Блюдо удалено? В заказе осталось name/sku/БЖУ.

## 6. API Endpoints

### Публичное меню
```
GET  /menu/dishes              # Список блюд (фильтры: category, dietary, maxCalories)
GET  /menu/dishes/:id          # Детали блюда с БЖУ
GET  /menu/sets                # Список сетов
GET  /menu/sets/:id            # Детали сета с составом
```

### Корзина
```
GET    /cart                           # Получить корзину с калькулятором
POST   /cart/items                     # Добавить { itemType, itemId, quantity }
PATCH  /cart/items/:itemType/:itemId   # Обновить количество
DELETE /cart/items/:itemType/:itemId   # Удалить элемент
DELETE /cart                           # Очистить корзину
POST   /cart/checkout                  # Оформить заказ → paymentUrl
```

## 7. Файлы

```
src/nutrition/
├── model/
│   ├── Dish.ts              # Блюдо с БЖУ
│   ├── Set.ts               # Комбо-набор
│   ├── SetItem.ts           # Связь Set ↔ Dish
│   ├── NutritionOrderItem.ts # Snapshot заказа
│   └── associations.ts       # Связи моделей
├── repository/
│   ├── dishRepository.ts
│   └── setRepository.ts
├── service/
│   ├── cartService.ts       # Redis-корзина + калькулятор
│   └── checkoutService.ts   # Оформление заказа + snapshot
├── controller/
│   ├── menuController.ts    # Публичный каталог
│   └── cartController.ts    # Корзина API
├── types/
│   └── redisCart.ts         # Типы Redis-структур
└── nutritionRouter.ts       # Роутер

sequelize/migrations/
└── 20260318100000-create-nutrition-delivery.js
```

## 8. Запуск миграции

```bash
npx sequelize-cli db:migrate
```
