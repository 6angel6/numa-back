import Admin from '../../src/admin/model/Admin';
import Category from '../../src/category/model/Category';
import Product from '../../src/product/model/Product';
import ProductMedia from '../../src/product/model/ProductMedia';
import Cart from '../../src/cart/model/Cart';
import CartItem from '../../src/cart/model/CartItem';
import Order from '../../src/order/model/Order';
import OrderItem from '../../src/order/model/OrderItem';
import Payment from '../../src/payment/model/Payment';
import BlogPost from '../../src/blog/model/BlogPost';
import BlogPostProduct from '../../src/blog/model/BlogPostProduct';
import MenuCategory from '../../src/restaurant/model/MenuCategory';
import MenuItem from '../../src/restaurant/model/MenuItem';
import RestaurantTable from '../../src/restaurant/model/RestaurantTable';
import Reservation from '../../src/restaurant/model/Reservation';
import CateringCart from '../../src/restaurant/model/CateringCart';
import CateringCartItem from '../../src/restaurant/model/CateringCartItem';
import CateringOrder from '../../src/restaurant/model/CateringOrder';
import CateringOrderItem from '../../src/restaurant/model/CateringOrderItem';

// Nutrition (FoodTech) models
import { Dish } from '../../src/nutrition/model/Dish';
import { Addon } from '../../src/nutrition/model/Addon';
import { Tag } from '../../src/nutrition/model/Tag';
import { MenuSchedule } from '../../src/nutrition/model/MenuSchedule';
import { DeliverySlot } from '../../src/nutrition/model/DeliverySlot';
import {
   NutritionOrder,
   NutritionOrderDay,
   NutritionOrderItem,
} from '../../src/nutrition/model/NutritionOrder';
import { SubscriptionPlan } from '../../src/nutrition/model/SubscriptionPlan';
import { initNutritionModels } from '../../src/nutrition/model/associations';
import SitePage from '../../src/site/model/SitePage';
import SiteSection from '../../src/site/model/SiteSection';
import { db } from '../config/database';

export const setupAssociations = (): void => {
   // Category self-reference (parent → children)
   Category.hasMany(Category, { foreignKey: 'parentId', as: 'subcategories' });
   Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

   // Category → Products
   Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
   Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

   // Product → Media
   Product.hasMany(ProductMedia, {
      foreignKey: 'productId',
      as: 'media',
      onDelete: 'CASCADE',
   });
   ProductMedia.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

   // Cart → CartItems
   Cart.hasMany(CartItem, {
      foreignKey: 'cartId',
      as: 'items',
      onDelete: 'CASCADE',
   });
   CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart' });

   // CartItem → Product (read-only reference, no cascade)
   CartItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

   // Order → OrderItems
   Order.hasMany(OrderItem, {
      foreignKey: 'orderId',
      as: 'items',
      onDelete: 'CASCADE',
   });
   OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

   // OrderItem → Product (snapshot reference, no cascade)
   OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

   // Order → Payments (one order can have multiple attempts; latest is the active one)
   Order.hasMany(Payment, {
      foreignKey: 'orderId',
      as: 'payments',
      onDelete: 'CASCADE',
   });
   Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

   // BlogPost → Author (Admin)
   BlogPost.belongsTo(Admin, { foreignKey: 'authorId', as: 'author' });
   Admin.hasMany(BlogPost, { foreignKey: 'authorId', as: 'posts' });

   // BlogPost ↔ Product (many-to-many through BlogPostProduct)
   BlogPost.belongsToMany(Product, {
      through: BlogPostProduct,
      foreignKey: 'blogPostId',
      as: 'products',
   });
   Product.belongsToMany(BlogPost, {
      through: BlogPostProduct,
      foreignKey: 'productId',
      as: 'blogPosts',
   });
   BlogPostProduct.belongsTo(BlogPost, {
      foreignKey: 'blogPostId',
      as: 'blogPost',
   });
   BlogPostProduct.belongsTo(Product, {
      foreignKey: 'productId',
      as: 'product',
   });

   // ── Restaurant ─────────────────────────────────────────────────────────────

   // MenuCategory → MenuItems
   MenuCategory.hasMany(MenuItem, {
      foreignKey: 'categoryId',
      as: 'items',
      onDelete: 'RESTRICT',
   });
   MenuItem.belongsTo(MenuCategory, {
      foreignKey: 'categoryId',
      as: 'category',
   });

   // RestaurantTable → Reservations
   RestaurantTable.hasMany(Reservation, {
      foreignKey: 'tableId',
      as: 'reservations',
      onDelete: 'RESTRICT',
   });
   Reservation.belongsTo(RestaurantTable, {
      foreignKey: 'tableId',
      as: 'table',
   });

   // RestaurantTable → CateringOrders (dine_in, nullable)
   RestaurantTable.hasMany(CateringOrder, {
      foreignKey: 'tableId',
      as: 'cateringOrders',
   });
   CateringOrder.belongsTo(RestaurantTable, {
      foreignKey: 'tableId',
      as: 'table',
   });

   // CateringCart → CateringCartItems
   CateringCart.hasMany(CateringCartItem, {
      foreignKey: 'cartId',
      as: 'items',
      onDelete: 'CASCADE',
   });
   CateringCartItem.belongsTo(CateringCart, {
      foreignKey: 'cartId',
      as: 'cart',
   });

   // CateringCartItem → MenuItem (availability reference)
   CateringCartItem.belongsTo(MenuItem, {
      foreignKey: 'menuItemId',
      as: 'menuItem',
   });

   // CateringOrder → CateringOrderItems
   CateringOrder.hasMany(CateringOrderItem, {
      foreignKey: 'orderId',
      as: 'items',
      onDelete: 'CASCADE',
   });
   CateringOrderItem.belongsTo(CateringOrder, {
      foreignKey: 'orderId',
      as: 'order',
   });

   // CateringOrderItem → MenuItem (snapshot reference)
   CateringOrderItem.belongsTo(MenuItem, {
      foreignKey: 'menuItemId',
      as: 'menuItem',
   });

   // Payment → CateringOrder (nullable — restaurant catering payments)
   Payment.belongsTo(CateringOrder, {
      foreignKey: 'cateringOrderId',
      as: 'cateringOrder',
   });
   CateringOrder.hasMany(Payment, {
      foreignKey: 'cateringOrderId',
      as: 'payments',
      onDelete: 'CASCADE',
   });

   // Payment → Reservation (nullable — reservation deposit payments)
   Payment.belongsTo(Reservation, {
      foreignKey: 'reservationId',
      as: 'reservation',
   });
   Reservation.hasMany(Payment, {
      foreignKey: 'reservationId',
      as: 'payments',
      onDelete: 'CASCADE',
   });

   // ── Site CMS ──────────────────────────────────────────────────────────────
   SitePage.hasMany(SiteSection, {
      foreignKey: 'pageId',
      as: 'sections',
      onDelete: 'CASCADE',
   });
   SiteSection.belongsTo(SitePage, { foreignKey: 'pageId', as: 'page' });

   // ── Nutrition (FoodTech) ───────────────────────────────────────────────────
   // Initialize nutrition models and their associations
   initNutritionModels(db);

   // Payment → NutritionOrder (nullable — nutrition orders)
   Payment.belongsTo(NutritionOrder, {
      foreignKey: 'nutritionOrderId',
      as: 'nutritionOrder',
   });
   NutritionOrder.hasMany(Payment, {
      foreignKey: 'nutritionOrderId',
      as: 'payments',
      onDelete: 'CASCADE',
   });
};

export {
   Admin,
   Category,
   Product,
   ProductMedia,
   Cart,
   CartItem,
   Order,
   OrderItem,
   Payment,
   BlogPost,
   BlogPostProduct,
};
export {
   MenuCategory,
   MenuItem,
   RestaurantTable,
   Reservation,
   CateringCart,
   CateringCartItem,
   CateringOrder,
   CateringOrderItem,
};
export {
   Dish,
   Addon,
   Tag,
   MenuSchedule,
   DeliverySlot,
   SubscriptionPlan,
   NutritionOrder,
   NutritionOrderDay,
   NutritionOrderItem,
};
export { SitePage, SiteSection };
