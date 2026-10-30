const EcommerceCart = require('../../models/EcommerceCart');
const Product = require('../../models/Product');

/**
 * Get user's e-commerce cart
 */
const getCart = async (req, res) => {
    try {
        const userId = req.user._id;
        let cart = await EcommerceCart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'title price discountPrice unit bagWeight stock imageUrl images gstPercentage commissionPercentage shippingCharge approvalStatus status'
            });

        if (!cart) {
            cart = await EcommerceCart.create({ userId, items: [] });
        }

        res.status(200).json({
            success: true,
            data: cart.items || []
        });
    } catch (error) {
        console.error('Get e-commerce cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cart: ' + error.message
        });
    }
};

/**
 * Add product to e-commerce cart
 */
const addToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, quantity = 1 } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }
        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000) {
            return res.status(400).json({ success: false, message: 'Please enter a valid quantity' });
        }

        const product = await Product.findById(productId);
        if (!product || product.approvalStatus !== 'approved' || product.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Product is unavailable or inactive' });
        }

        let cart = await EcommerceCart.findOne({ userId });
        if (!cart) {
            cart = await EcommerceCart.create({ userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId
        );

        if (existingItemIndex !== -1) {
            cart.items[existingItemIndex].quantity += Number(quantity);
        } else {
            cart.items.push({ productId, quantity: Number(quantity) });
        }

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Product added to cart',
            data: cart.items
        });
    } catch (error) {
        console.error('Add to e-commerce cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product to cart: ' + error.message
        });
    }
};

/**
 * Update e-commerce cart item quantity
 */
const updateCartItem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.params;
        const { quantity } = req.body;

        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be at least 1'
            });
        }

        const cart = await EcommerceCart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const item = cart.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        item.quantity = Number(quantity);
        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Cart item updated',
            data: cart.items
        });
    } catch (error) {
        console.error('Update e-commerce cart item error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update cart item: ' + error.message
        });
    }
};

/**
 * Remove product from e-commerce cart
 */
const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.params;

        const cart = await EcommerceCart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Product removed from cart',
            data: cart.items
        });
    } catch (error) {
        console.error('Remove from e-commerce cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove product from cart: ' + error.message
        });
    }
};

/**
 * Clear e-commerce cart
 */
const clearCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await EcommerceCart.findOne({ userId });
        if (cart) {
            cart.items = [];
            await cart.save();
        }

        res.status(200).json({
            success: true,
            message: 'Cart cleared',
            data: []
        });
    } catch (error) {
        console.error('Clear e-commerce cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cart: ' + error.message
        });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart
};
