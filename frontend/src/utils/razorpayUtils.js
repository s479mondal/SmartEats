import { orderApi } from '../api/orderApi';

/**
 * Dynamically loads the official Razorpay Checkout JavaScript SDK.
 * @returns {Promise<boolean>} True if loaded successfully, false otherwise.
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.onload = () => resolve(true);
      existingScript.onerror = () => resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout SDK');
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

/**
 * Initiates authoritative Razorpay Checkout workflow:
 * 1. Loads Razorpay SDK
 * 2. Calls backend POST /api/orders/payment/create-order
 * 3. Launches Razorpay modal with backend order data
 * 4. Calls backend POST /api/orders/payment/verify on payment success
 */
export const initiateRazorpayCheckout = async ({
  user,
  idempotencyKey,
  onSuccess,
  onFailure,
  onDismiss,
  onLoadingChange
}) => {
  try {
    onLoadingChange?.(true, 'Preparing secure payment...');

    // Ensure idempotency key exists for this checkout attempt
    const checkoutKey = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    // 1. Ensure Razorpay script is loaded
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      onLoadingChange?.(false);
      onFailure?.('Unable to load Razorpay payment gateway. Please check your network connection and try again.');
      return;
    }

    // 2. Call backend create-payment-order API with Idempotency-Key
    const paymentOrder = await orderApi.createPaymentOrder(checkoutKey);
    if (!paymentOrder || !paymentOrder.razorpayOrderId) {
      onLoadingChange?.(false);
      onFailure?.('Unable to initialize payment session with the server. Please try again.');
      return;
    }

    onLoadingChange?.(true, 'Opening Razorpay secure checkout...');

    // 3. Build Razorpay checkout options
    const keyId = paymentOrder.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SZ9vgZQjij4g7j';
    
    const options = {
      key: keyId,
      amount: paymentOrder.amountInPaise, // Authoritative paise amount from backend
      currency: paymentOrder.currency || 'INR',
      name: 'SmartEats',
      description: `Food Order #${paymentOrder.orderId}`,
      order_id: paymentOrder.razorpayOrderId,
      prefill: {
        email: user?.email || paymentOrder.customerEmail || 'customer@smarteats.com',
        name: user?.name || 'SmartEats Customer'
      },
      theme: {
        color: '#00F2FE'
      },
      modal: {
        ondismiss: () => {
          onLoadingChange?.(false);
          onDismiss?.('Payment was not completed. Your order remains pending. You can retry payment anytime.');
        }
      },
      handler: async (razorpayResponse) => {
        // 4. Handle Razorpay response by submitting to backend verification endpoint
        try {
          onLoadingChange?.(true, 'Verifying payment confirmation with server...');
          const verifyResult = await orderApi.verifyPayment({
            orderId: paymentOrder.orderId,
            razorpayOrderId: razorpayResponse.razorpay_order_id,
            razorpayPaymentId: razorpayResponse.razorpay_payment_id,
            razorpaySignature: razorpayResponse.razorpay_signature
          });

          onLoadingChange?.(false);

          if (verifyResult && verifyResult.success) {
            onSuccess?.({
              orderId: paymentOrder.orderId,
              paymentStatus: verifyResult.paymentStatus || 'PAID',
              orderStatus: verifyResult.orderStatus || 'CREATED',
              amount: paymentOrder.amount,
              razorpayPaymentId: razorpayResponse.razorpay_payment_id,
              message: verifyResult.message || 'Order confirmed and paid successfully'
            });
          } else {
            onFailure?.('Payment verification failed on the server. Please check your order history before retrying.');
          }
        } catch (verifyErr) {
          onLoadingChange?.(false);
          const errorMsg = verifyErr.response?.data?.message || verifyErr.message || '';
          if (verifyErr.response) {
            onFailure?.(`Payment verification notice: ${errorMsg || 'Verification could not be confirmed.'}`);
          } else {
            onFailure?.('Payment verification is taking longer than expected. Please check your order history before attempting another payment.');
          }
        }
      }
    };

    const rzpInstance = new window.Razorpay(options);
    rzpInstance.on('payment.failed', function (failureResponse) {
      onLoadingChange?.(false);
      const reason = failureResponse.error?.description || failureResponse.error?.reason || 'Transaction could not be completed';
      onFailure?.(`Payment failed: ${reason}. Please try again.`);
    });

    rzpInstance.open();
  } catch (err) {
    onLoadingChange?.(false);
    const serverMsg = err.response?.data?.message || err.message || '';
    if (serverMsg.includes('quantity') || serverMsg.includes('inventory') || serverMsg.includes('available') || serverMsg.includes('portion') || err.response?.status === 409) {
      onFailure?.('⚠️ Portion Availability Notice:\n\nSome items in your cart are no longer available in the requested portion quantity. Please review your cart.');
    } else if (serverMsg.includes('closed')) {
      onFailure?.('⚠️ Restaurant is currently closed for orders.');
    } else if (serverMsg.includes('empty')) {
      onFailure?.('Shopping cart is empty. Please add items before checking out.');
    } else {
      onFailure?.(`Unable to start checkout: ${serverMsg || 'Please try again later.'}`);
    }
  }
};
