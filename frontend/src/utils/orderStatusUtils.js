/**
 * SmartEats Order & Delivery Combined Lifecycle Status Mapping Utility (Step 8.2)
 *
 * Conceptual Customer-Facing Lifecycle:
 * 1. ORDER CONFIRMED       (Order: CREATED / NEW)
 * 2. RESTAURANT ACCEPTED   (Order: ACCEPTED)
 * 3. PREPARING             (Order: PREPARING)
 * 4. READY                 (Order: READY)
 * 5. DRIVER ASSIGNED       (Delivery: ASSIGNED)
 * 6. PICKED UP             (Delivery: PICKED_UP)
 * 7. OUT FOR DELIVERY      (Delivery: OUT_FOR_DELIVERY)
 * 8. DELIVERED             (Delivery / Order: DELIVERED)
 *
 * Terminal Exception States:
 * - REJECTED               (Order: REJECTED)
 * - CANCELLED              (Order: CANCELLED)
 */

export const ORDER_TRACKING_STEPS = [
  {
    key: 'ORDER_CONFIRMED',
    title: 'Order Confirmed',
    shortLabel: 'Confirmed',
    icon: '✓',
    description: 'Your order has been received and confirmed.'
  },
  {
    key: 'RESTAURANT_ACCEPTED',
    title: 'Restaurant Accepted',
    shortLabel: 'Accepted',
    icon: '🍳',
    description: 'The kitchen has accepted your order and is reviewing items.'
  },
  {
    key: 'PREPARING',
    title: 'Preparing Your Food',
    shortLabel: 'Preparing',
    icon: '👨‍🍳',
    description: 'The chef is preparing your fresh meal.'
  },
  {
    key: 'READY',
    title: 'Ready for Pickup',
    shortLabel: 'Ready',
    icon: '📦',
    description: 'Your food is packed and ready for the delivery partner.'
  },
  {
    key: 'DRIVER_ASSIGNED',
    title: 'Driver Assigned',
    shortLabel: 'Driver Assigned',
    icon: '🛵',
    description: 'A delivery partner has been assigned and is heading to the kitchen.'
  },
  {
    key: 'PICKED_UP',
    title: 'Picked Up',
    shortLabel: 'Picked Up',
    icon: '🛍️',
    description: 'Delivery partner has picked up your food package.'
  },
  {
    key: 'OUT_FOR_DELIVERY',
    title: 'Out for Delivery',
    shortLabel: 'On the Way',
    icon: '🚀',
    description: 'Delivery partner is on the way to your delivery address.'
  },
  {
    key: 'DELIVERED',
    title: 'Delivered',
    shortLabel: 'Delivered',
    icon: '🎉',
    description: 'Order delivered successfully. Enjoy your meal!'
  }
];

export const ORDER_STATUS_MAP = {
  PENDING_PAYMENT: {
    label: 'Payment Pending',
    badgeColor: '#f59e0b',
    stepIndex: 0,
    description: 'Awaiting payment completion.'
  },
  NEW: {
    label: 'Order Confirmed',
    badgeColor: '#3b82f6',
    stepIndex: 0,
    description: 'Your order has been confirmed.'
  },
  CREATED: {
    label: 'Order Confirmed',
    badgeColor: '#3b82f6',
    stepIndex: 0,
    description: 'Your order has been confirmed and queued.'
  },
  ACCEPTED: {
    label: 'Restaurant Accepted',
    badgeColor: '#10b981',
    stepIndex: 1,
    description: 'Restaurant has accepted your order.'
  },
  PREPARING: {
    label: 'Preparing Your Food',
    badgeColor: '#a855f7',
    stepIndex: 2,
    description: 'Kitchen is currently preparing your meal.'
  },
  READY: {
    label: 'Ready for Pickup',
    badgeColor: '#06b6d4',
    stepIndex: 3,
    description: 'Food is packed and ready for pickup.'
  },
  DISPATCHED: {
    label: 'Dispatched',
    badgeColor: '#00f2fe',
    stepIndex: 6,
    description: 'Order dispatched with delivery partner.'
  },
  DELIVERED: {
    label: 'Delivered',
    badgeColor: '#22c55e',
    stepIndex: 7,
    isTerminal: true,
    description: 'Order successfully delivered.'
  },
  REJECTED: {
    label: 'Order Rejected',
    badgeColor: '#ef4444',
    stepIndex: -1,
    isTerminal: true,
    isError: true,
    description: 'The restaurant was unable to fulfill this order.'
  },
  CANCELLED: {
    label: 'Order Cancelled',
    badgeColor: '#ef4444',
    stepIndex: -1,
    isTerminal: true,
    isError: true,
    description: 'This order has been cancelled.'
  }
};

export const DELIVERY_STATUS_MAP = {
  PENDING: {
    label: 'Looking for Driver',
    badgeColor: '#f59e0b',
    stepIndex: 3,
    description: 'Matching an available delivery partner nearby.'
  },
  ASSIGNED: {
    label: 'Driver Assigned',
    badgeColor: '#3b82f6',
    stepIndex: 4,
    description: 'Delivery partner assigned to your order.'
  },
  PICKED_UP: {
    label: 'Picked Up',
    badgeColor: '#a855f7',
    stepIndex: 5,
    description: 'Delivery partner has picked up your meal.'
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    badgeColor: '#00f2fe',
    stepIndex: 6,
    description: 'Delivery partner is heading to your address.'
  },
  DELIVERED: {
    label: 'Delivered',
    badgeColor: '#22c55e',
    stepIndex: 7,
    isTerminal: true,
    description: 'Delivered to customer address.'
  },
  CANCELLED: {
    label: 'Delivery Cancelled',
    badgeColor: '#ef4444',
    stepIndex: -1,
    isTerminal: true,
    isError: true,
    description: 'Delivery was cancelled.'
  }
};

/**
 * Computes the unified tracking state combining Order and Delivery entities without mutating backend data.
 *
 * @param {Object} order - OrderResponse object from order-service
 * @param {Object|null} delivery - Optional DeliveryResponse from delivery-service
 * @returns {Object} Comprehensive combined status object for frontend tracking display
 */
export function computeCombinedOrderStatus(order, delivery = null) {
  if (!order) {
    return {
      activeStepIndex: 0,
      currentStatusKey: 'CREATED',
      currentLabel: 'Order Confirmed',
      currentDescription: 'Order confirmed.',
      badgeColor: '#3b82f6',
      progressPct: 12,
      isTerminal: false,
      isError: false,
      isDelivered: false,
      isCancelled: false,
      isRejected: false,
      steps: ORDER_TRACKING_STEPS.map((s, idx) => ({ ...s, status: idx === 0 ? 'current' : 'upcoming' }))
    };
  }

  const orderStatus = (order.status || 'CREATED').toUpperCase();
  const deliveryStatus = delivery?.status ? String(delivery.status).toUpperCase() : null;

  // Handle Terminal Exception States first
  if (orderStatus === 'CANCELLED' || deliveryStatus === 'CANCELLED') {
    return {
      activeStepIndex: -1,
      currentStatusKey: 'CANCELLED',
      currentLabel: 'Order Cancelled',
      currentDescription: 'This order has been cancelled and cannot be fulfilled.',
      badgeColor: '#ef4444',
      progressPct: 0,
      isTerminal: true,
      isError: true,
      isDelivered: false,
      isCancelled: true,
      isRejected: false,
      steps: ORDER_TRACKING_STEPS.map((s) => ({ ...s, status: 'cancelled' }))
    };
  }

  if (orderStatus === 'REJECTED') {
    return {
      activeStepIndex: -1,
      currentStatusKey: 'REJECTED',
      currentLabel: 'Order Rejected',
      currentDescription: 'The restaurant was unable to accept this order.',
      badgeColor: '#ef4444',
      progressPct: 0,
      isTerminal: true,
      isError: true,
      isDelivered: false,
      isCancelled: false,
      isRejected: true,
      steps: ORDER_TRACKING_STEPS.map((s) => ({ ...s, status: 'cancelled' }))
    };
  }

  if (orderStatus === 'DELIVERED' || deliveryStatus === 'DELIVERED') {
    return {
      activeStepIndex: 7,
      currentStatusKey: 'DELIVERED',
      currentLabel: 'Delivered',
      currentDescription: 'Order delivered successfully. Enjoy your meal!',
      badgeColor: '#22c55e',
      progressPct: 100,
      isTerminal: true,
      isError: false,
      isDelivered: true,
      isCancelled: false,
      isRejected: false,
      steps: ORDER_TRACKING_STEPS.map((s) => ({ ...s, status: 'completed' }))
    };
  }

  // Active Lifecycle Determination:
  // We determine the highest advanced stage across Order and Delivery
  let activeStep = 0;
  let statusKey = 'ORDER_CONFIRMED';
  let label = 'Order Confirmed';
  let description = 'Your order has been received and confirmed.';
  let badgeColor = '#3b82f6';

  if (deliveryStatus === 'OUT_FOR_DELIVERY' || orderStatus === 'DISPATCHED') {
    activeStep = 6;
    statusKey = 'OUT_FOR_DELIVERY';
    label = 'Out for Delivery';
    description = 'Delivery partner is on the way to your delivery address.';
    badgeColor = '#00f2fe';
  } else if (deliveryStatus === 'PICKED_UP') {
    activeStep = 5;
    statusKey = 'PICKED_UP';
    label = 'Picked Up';
    description = 'Delivery partner picked up your food from the kitchen.';
    badgeColor = '#a855f7';
  } else if (deliveryStatus === 'ASSIGNED') {
    activeStep = 4;
    statusKey = 'DRIVER_ASSIGNED';
    label = 'Driver Assigned';
    description = 'A delivery partner has been assigned and is heading to the kitchen.';
    badgeColor = '#3b82f6';
  } else if (orderStatus === 'READY') {
    activeStep = 3;
    statusKey = 'READY';
    label = 'Ready for Pickup';
    description = 'Your meal is prepared and packaged, waiting for delivery partner pickup.';
    badgeColor = '#06b6d4';
  } else if (orderStatus === 'PREPARING') {
    activeStep = 2;
    statusKey = 'PREPARING';
    label = 'Preparing Your Food';
    description = 'The chef is cooking your meal in the kitchen.';
    badgeColor = '#a855f7';
  } else if (orderStatus === 'ACCEPTED') {
    activeStep = 1;
    statusKey = 'RESTAURANT_ACCEPTED';
    label = 'Restaurant Accepted';
    description = 'The restaurant has accepted your order and scheduled preparation.';
    badgeColor = '#10b981';
  } else {
    // CREATED / NEW / PENDING_PAYMENT
    activeStep = 0;
    statusKey = 'ORDER_CONFIRMED';
    label = orderStatus === 'PENDING_PAYMENT' ? 'Payment Pending' : 'Order Confirmed';
    description = orderStatus === 'PENDING_PAYMENT' ? 'Awaiting payment confirmation.' : 'Your order has been placed and confirmed.';
    badgeColor = '#3b82f6';
  }

  // Progress percentage calculation: (activeStep + 1) / totalSteps
  const progressPct = Math.round(((activeStep + 1) / ORDER_TRACKING_STEPS.length) * 100);

  // Generate step states
  const steps = ORDER_TRACKING_STEPS.map((step, idx) => {
    let stepStatus = 'upcoming';
    if (idx < activeStep) {
      stepStatus = 'completed';
    } else if (idx === activeStep) {
      stepStatus = 'current';
    }
    return {
      ...step,
      status: stepStatus
    };
  });

  return {
    activeStepIndex: activeStep,
    currentStatusKey: statusKey,
    currentLabel: label,
    currentDescription: description,
    badgeColor,
    progressPct,
    isTerminal: false,
    isError: false,
    isDelivered: false,
    isCancelled: false,
    isRejected: false,
    steps
  };
}

/**
 * Formats ISO date/time string nicely for customer display
 *
 * @param {string|Date} isoString
 * @returns {string} Formatted date time string
 */
export function formatOrderTimestamp(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Just now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
      ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Just now';
  }
}
