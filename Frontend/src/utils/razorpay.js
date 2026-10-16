import ecommerceService from '../services/ecommerceService';

/**
 * Loads Razorpay checkout.js script asynchronously
 */
export const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.Razorpay) {
            resolve(true);
            return;
        }
        const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
        if (existingScript) {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            existingScript.addEventListener('load', () => resolve(true));
            existingScript.addEventListener('error', () => resolve(false));
            setTimeout(() => {
                resolve(!!window.Razorpay);
            }, 500);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

/**
 * Opens Razorpay checkout modal for an ecommerce order and verifies payment end-to-end.
 * Returns a Promise that resolves on successful payment verification,
 * or rejects if dismissed / payment fails.
 * 
 * @param {string} orderId - Mongo ID of the EcommerceOrder
 * @returns {Promise<object>} - Resolved verification response from backend
 */
export const startEcommercePayment = (orderId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                return reject(new Error("Unable to load Razorpay payment gateway. Please check your internet connection."));
            }

            // 1. Create payment order on backend
            const orderRes = await ecommerceService.createPaymentOrder(orderId);
            if (!orderRes || !orderRes.success) {
                return reject(new Error(orderRes?.message || "Failed to initiate payment with server"));
            }

            const { order_id, amount, currency, key } = orderRes.data;
            const razorpayKey = key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw';

            // Prefill user details if available
            let userPrefill = {};
            try {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const u = JSON.parse(storedUser);
                    userPrefill = {
                        name: u.name || '',
                        email: u.email || '',
                        contact: u.phone || u.mobileNumber || ''
                    };
                }
            } catch (e) {
                console.warn("Could not read user prefill from localStorage", e);
            }

            // 2. Configure Razorpay modal options
            const options = {
                key: razorpayKey,
                amount, // Amount in paise as returned from backend
                currency: currency || 'INR',
                name: "GrooAgri",
                description: "Agri Marketplace Order Payment",
                order_id,
                prefill: userPrefill,
                theme: { color: "#2E7D32" },
                handler: async function (response) {
                    try {
                        // 3. Verify payment signature with backend
                        const verifyRes = await ecommerceService.payPlatformFee(orderId, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });

                        if (verifyRes && verifyRes.success) {
                            resolve(verifyRes);
                        } else {
                            reject(new Error(verifyRes?.message || "Payment verification failed"));
                        }
                    } catch (verifyErr) {
                        const errMsg = verifyErr.response?.data?.message || verifyErr.message || "Payment verification failed";
                        reject(new Error(errMsg));
                    }
                },
                modal: {
                    ondismiss: function () {
                        reject({ dismissed: true, message: "Payment was cancelled" });
                    }
                }
            };

            const razorpay = new window.Razorpay(options);
            razorpay.on('payment.failed', function (resp) {
                const failMsg = resp?.error?.description || resp?.error?.reason || "Payment transaction failed";
                reject(new Error(failMsg));
            });

            razorpay.open();
        } catch (err) {
            const errText = err.response?.data?.message || err.message || "Failed to launch payment gateway";
            reject(new Error(errText));
        }
    });
};
