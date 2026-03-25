export enum StoreSlug {
   NUTRITION  = 'nutrition',  // Numa Nutrition
   KIDS       = 'kids',       // Numa Kids
   HALAL      = 'halal',      // NAbaviy tatobati
   RESTAURANT = 'restaurant', // Restaurant (table reservations)
}

export const STORE_SLUGS = Object.values(StoreSlug) as [StoreSlug, ...StoreSlug[]];
 