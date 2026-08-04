# User Roles - SmartEats

SmartEats operates with four primary user roles, each having distinct permissions and interface access:

## 1. Customer (`ROLE_CUSTOMER`)
- Browse registered restaurants and their active menus.
- Manage items in their Redis-backed shopping cart.
- Place orders, complete mock payments, and track delivery routes in real-time.

## 2. Restaurant Owner (`ROLE_RESTAURANT`)
- Manage restaurant profile details (opening hours, address, cuisine).
- Create, modify, and delete menu items and control item availability.
- View incoming orders and update preparation status.
- Access the RDSS dashboard to view demand forecasts and manage surplus inventory/donations.

## 3. Delivery Partner (`ROLE_DELIVERY`)
- Register and manage delivery vehicle information.
- View and accept/reject delivery requests.
- Update delivery statuses (`assigned` -> `picked_up` -> `delivered`).
- Broadcast real-time location coordinates via WebSockets.

## 4. Administrator (`ROLE_ADMIN`)
- Monitor system health and view global transaction aggregations.
- Approve or reject new restaurant onboarding requests.
- Manage user accounts and override system-wide configurations.
