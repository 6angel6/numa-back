import { Router } from 'express';
import { cartController } from './controller/cartController';
import { storeParam } from '../../shared/middleware/storeContext';

const router = Router();

// Store is identified in the URL path: /api/v1/cart/:store
router.get(   '/:store',                    storeParam, cartController.getCart);
router.post(  '/:store/items',              storeParam, cartController.addItem);
router.patch( '/:store/items/:productId',   storeParam, cartController.updateItem);
router.delete('/:store/items/:productId',   storeParam, cartController.removeItem);
router.delete('/:store',                    storeParam, cartController.clearCart);

export default router;
