/**
 * SMART EATS - INVENTORY & AVAILABILITY UTILITIES
 * Step 3: Customer-Friendly Availability + Cart Limit
 * 
 * Rules:
 * - Customer never sees exact inventory numbers (no "17 portions available", etc.)
 * - exact availableQuantity is kept internally for enforcement and analytics.
 * 
 * Availability Status Mapping:
 * - available === false                      -> 🔴 "Sold Out" (isOrderable: false)
 * - availableQuantity == null                -> ⚪ "Availability not configured" (isOrderable: true)
 * - availableQuantity == 0                   -> 🔴 "Sold Out" (isOrderable: false)
 * - availableQuantity >= 1 && <= 3           -> 🟠 "Only a few left" (isOrderable: true)
 * - availableQuantity >= 4                   -> 🟢 "Available" (isOrderable: true)
 */

export function getCustomerAvailabilityStatus(item) {
  if (!item) {
    return {
      label: 'Availability not configured',
      icon: '⚪',
      isOrderable: true,
      badgeColor: '#94a3b8',
      bgColor: 'rgba(148, 163, 184, 0.12)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      statusKey: 'NOT_CONFIGURED'
    };
  }

  // Boolean availability check preserved
  if (item.available === false) {
    return {
      label: 'Sold Out',
      icon: '🔴',
      isOrderable: false,
      badgeColor: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      statusKey: 'SOLD_OUT'
    };
  }

  const qty = item.availableQuantity;

  // Case A: availableQuantity == null
  if (qty === null || qty === undefined) {
    return {
      label: 'Availability not configured',
      icon: '⚪',
      isOrderable: true,
      badgeColor: '#94a3b8',
      bgColor: 'rgba(148, 163, 184, 0.12)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      statusKey: 'NOT_CONFIGURED'
    };
  }

  const numQty = Number(qty);

  // Case B: availableQuantity == 0 (or negative)
  if (numQty <= 0) {
    return {
      label: 'Sold Out',
      icon: '🔴',
      isOrderable: false,
      badgeColor: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      statusKey: 'SOLD_OUT'
    };
  }

  // Case C: availableQuantity >= 1 && <= 3
  if (numQty >= 1 && numQty <= 3) {
    return {
      label: 'Only a few left',
      icon: '🟠',
      isOrderable: true,
      badgeColor: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.15)',
      borderColor: 'rgba(249, 115, 22, 0.35)',
      statusKey: 'LOW_STOCK'
    };
  }

  // Case D: availableQuantity >= 4
  return {
    label: 'Available',
    icon: '🟢',
    isOrderable: true,
    badgeColor: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    statusKey: 'AVAILABLE'
  };
}

/**
 * Validates adding an item to the cart against inventory boundaries.
 * 
 * @param {Object} item - Menu item being added
 * @param {Array} cart - Current cart items array
 * @param {number} qtyToAdd - Quantity being added (default 1)
 * @returns {{ allowed: boolean, message?: string }}
 */
export function validateAddToCart(item, cart = [], qtyToAdd = 1) {
  if (!item) {
    return { allowed: false, message: 'Invalid menu item.' };
  }

  const status = getCustomerAvailabilityStatus(item);
  if (!status.isOrderable) {
    return { allowed: false, message: 'This item is currently sold out.' };
  }

  const availQty = item.availableQuantity;
  if (availQty === null || availQty === undefined) {
    // Legacy / unconfigured item: no artificial limit
    return { allowed: true };
  }

  const limit = Number(availQty);
  const itemId = item.id || item._id;
  const existingCartItem = cart.find((i) => (i.id || i._id) === itemId);
  const currentCartQty = existingCartItem ? (existingCartItem.qty || 1) : 0;

  if (currentCartQty + qtyToAdd > limit) {
    return {
      allowed: false,
      message: 'Only the currently available portions can be added.'
    };
  }

  return { allowed: true };
}

/**
 * Checks whether a cart item has a stale overload compared to current menu item data.
 * 
 * @param {Object} cartItem - Item from cart
 * @param {Object} menuItem - Freshest menu item from restaurant API (optional)
 * @returns {{ isOverload: boolean, isSoldOut: boolean, warning?: string }}
 */
export function checkCartItemInventory(cartItem, menuItem) {
  const item = menuItem || cartItem;
  if (!item) return { isOverload: false, isSoldOut: false };

  const isAvailable = item.available !== false;
  const availQty = item.availableQuantity;

  // Check if sold out or disabled
  if (!isAvailable || (availQty !== null && availQty !== undefined && Number(availQty) <= 0)) {
    return {
      isOverload: false,
      isSoldOut: true,
      warning: 'This item is currently sold out. Please remove it to proceed.'
    };
  }

  // Check if quantity in cart exceeds available portions
  if (availQty !== null && availQty !== undefined) {
    const limit = Number(availQty);
    const cartQty = cartItem.qty || 1;
    if (cartQty > limit) {
      return {
        isOverload: true,
        isSoldOut: false,
        warning: 'This item is currently unavailable in the requested quantity. Please reduce the quantity.'
      };
    }
  }

  return { isOverload: false, isSoldOut: false };
}
