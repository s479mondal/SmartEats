# Functional Requirements - SmartEats

## 1. Customer Management
- **Registration & Login**: Customers can create accounts and securely authenticate using email/password.
- **Profile Management**: Maintain customer addresses (for delivery range checks) and contact information.

## 2. Restaurant & Menu Management
- **Restaurant Onboarding**: Restaurant owners can submit registration requests.
- **Menu Management**: Authorized restaurant managers can add, edit, or delete dishes, set prices, and update availability flags.

## 3. Shopping Cart
- **Cart Lifecycle**: Add items, update quantities, apply coupon codes, and clear the cart.
- **Fast Caching**: Cart contents are cached in Redis and auto-expire after a timeout (TTL).

## 4. Ordering & Payments
- **Order Placement**: Transform cart items into an active order.
- **Atomic Transactions**: Ensure ordering decrements stock and creates order records atomically.
- **Payment Processing**: Process dummy/sandbox payments. Update order status to "Paid".

## 5. Dispatch & Delivery
- **Driver Matching**: Match incoming orders with delivery partners based on proximity, traffic, and food preparation status.
- **Tracking**: Keep track of the delivery status (`assigned` -> `picked_up` -> `delivered`).

## 6. Restaurant Decision Support System (RDSS)
- **Demand Forecasting**: Display graphs predicting tomorrow's order volumes.
- **Surplus Discounting**: Automatically offer discounted menu items when surplus items are flagged.
- **NGO Routing**: Push unsold food notifications to local NGOs for donation collection.
