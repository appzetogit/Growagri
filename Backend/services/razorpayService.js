const Razorpay = require('razorpay');

// Initialize Razorpay with validation
let razorpay;
try {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('⚠️  Razorpay credentials missing in .env file');
    console.error('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing');
    console.error('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing');
  } else {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Razorpay:', error.message);
}

/**
 * Create Razorpay order
 */
const createOrder = async (amount, currency = 'INR', receipt = null, notes = {}) => {
  try {
    if (!razorpay) {
      return {
        success: false,
        error: 'Razorpay not initialized. Please check credentials in .env file.'
      };
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes
    };

    console.log('Creating Razorpay order with options:', {
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt
    });

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created successfully:', order.id);
    await razorpayOrders().insertOne({ _id: order.id, amount: order.amount, notes: order.notes || {}, createdAt: new Date() })
      .catch(err => console.error('[Razorpay] could not store order locally:', err.message));

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    };
  } catch (error) {
    console.error('❌ Razorpay create order error:', {
      message: error.message,
      description: error.description,
      code: error.code,
      statusCode: error.statusCode,
      error: error.error
    });

    return {
      success: false,
      error: error.description || error.message || 'Failed to create Razorpay order'
    };
  }
};

/**
 * Verify payment signature
 */
const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  const crypto = require('crypto');
  const secret = process.env.RAZORPAY_KEY_SECRET;

  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return generated_signature === razorpay_signature;
};

/**
 * Get payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Razorpay get payment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Refund payment
 */
const refundPayment = async (paymentId, amount = null, notes = {}) => {
  try {
    const refundOptions = {
      payment_id: paymentId,
      notes
    };

    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    return {
      success: true,
      refund
    };
  } catch (error) {
    console.error('Razorpay refund error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const processedPayments = () => require('mongoose').connection.collection('processed_payments');
const razorpayOrders = () => require('mongoose').connection.collection('razorpay_orders');

/**
 * The checkout signature is an HMAC of "order_id|payment_id" with our secret, which Razorpay only
 * issues for a successful payment on that order — so a valid signature proves this payment paid
 * this order. Amount and notes come from the order WE created (stored locally at creation; older
 * orders are fetched from Razorpay). The payment id is then claimed so it can be used once.
 * Returns { success:false, status, error } or { success:true, amount, amountPaise, notes }.
 * Call releasePayment(paymentId) if crediting fails after a successful claim.
 */
const verifyAndClaimPayment = async (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature || !verifyPayment(orderId, paymentId, signature)) {
    return { success: false, status: 400, error: 'Invalid payment signature' };
  }

  let order = await razorpayOrders().findOne({ _id: orderId });
  if (!order) {
    if (!razorpay) return { success: false, status: 503, error: 'Payment gateway not configured' };
    try {
      const o = await razorpay.orders.fetch(orderId);
      order = { amount: o.amount, notes: o.notes || {} };
    } catch (error) {
      console.error('[Razorpay] order fetch failed:', error.statusCode, JSON.stringify(error.error || error.message));
      return { success: false, status: 502, error: error.error?.description || error.message || 'Could not verify payment with gateway' };
    }
  }

  try {
    await processedPayments().insertOne({ _id: paymentId, orderId, createdAt: new Date() });
  } catch (error) {
    if (error.code === 11000) return { success: false, status: 409, error: 'Payment already processed' };
    throw error;
  }

  return { success: true, amount: order.amount / 100, amountPaise: order.amount, notes: order.notes || {} };
};

const releasePayment = (paymentId) => processedPayments().deleteOne({ _id: paymentId });

module.exports = {
  createOrder,
  verifyPayment,
  verifyAndClaimPayment,
  releasePayment,
  getPaymentDetails,
  refundPayment
};

