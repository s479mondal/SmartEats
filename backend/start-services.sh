#!/bin/sh

# Create files if they don't exist to prevent tail from exiting
touch auth-service.log restaurant-service.log order-service.log delivery-service.log notification-service.log api-gateway.log

echo "Starting Auth Service..."
java -Dspring.data.mongodb.uri=mongodb://smarteats-mongodb:27017/smarteats_auth -jar auth-service/target/auth-service-0.0.1-SNAPSHOT.jar > auth-service.log 2>&1 &

echo "Starting Restaurant Service..."
java -Dspring.data.mongodb.uri=mongodb://smarteats-mongodb:27017/smarteats_restaurant -Dspring.data.redis.host=smarteats-redis -jar restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar > restaurant-service.log 2>&1 &

echo "Starting Order Service..."
java -Dspring.data.mongodb.uri=mongodb://smarteats-mongodb:27017/smarteats_order -Dspring.data.redis.host=smarteats-redis -Dspring.kafka.bootstrap-servers=smarteats-kafka:29092 -jar order-service/target/order-service-0.0.1-SNAPSHOT.jar > order-service.log 2>&1 &

echo "Starting Delivery Service..."
java -Dspring.data.mongodb.uri=mongodb://smarteats-mongodb:27017/smarteats_delivery -Dspring.kafka.bootstrap-servers=smarteats-kafka:29092 -jar delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar > delivery-service.log 2>&1 &

echo "Starting Notification Service..."
java -Dspring.data.mongodb.uri=mongodb://smarteats-mongodb:27017/smarteats_notification -Dspring.kafka.bootstrap-servers=smarteats-kafka:29092 -jar notification-service/target/notification-service-0.0.1-SNAPSHOT.jar > notification-service.log 2>&1 &

echo "Starting API Gateway..."
java -jar api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar > api-gateway.log 2>&1 &

echo "All services started. Monitoring logs..."
tail -f auth-service.log restaurant-service.log order-service.log delivery-service.log notification-service.log api-gateway.log
