#!/bin/sh

# Create files if they don't exist to prevent tail from exiting
touch auth-service.log restaurant-service.log order-service.log delivery-service.log notification-service.log api-gateway.log

# Load .env if present
if [ -f ../.env ]; then
  export $(cat ../.env | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Starting Auth Service..."
java -Dspring.kafka.bootstrap-servers=${KAFKA_SERVERS:-smarteats-kafka:29092} -jar auth-service/target/auth-service-0.0.1-SNAPSHOT.jar > auth-service.log 2>&1 &

echo "Starting Restaurant Service..."
java -Dspring.data.redis.host=${REDIS_HOST:-smarteats-redis} -Dspring.kafka.bootstrap-servers=${KAFKA_SERVERS:-smarteats-kafka:29092} -jar restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar > restaurant-service.log 2>&1 &

echo "Starting Order Service..."
java -Dspring.data.redis.host=${REDIS_HOST:-smarteats-redis} -Dspring.kafka.bootstrap-servers=${KAFKA_SERVERS:-smarteats-kafka:29092} -jar order-service/target/order-service-0.0.1-SNAPSHOT.jar > order-service.log 2>&1 &

echo "Starting Delivery Service..."
java -Dspring.kafka.bootstrap-servers=${KAFKA_SERVERS:-smarteats-kafka:29092} -jar delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar > delivery-service.log 2>&1 &

echo "Starting Notification Service..."
java -Dspring.kafka.bootstrap-servers=${KAFKA_SERVERS:-smarteats-kafka:29092} -jar notification-service/target/notification-service-0.0.1-SNAPSHOT.jar > notification-service.log 2>&1 &

echo "Starting API Gateway..."
java -jar api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar > api-gateway.log 2>&1 &

echo "All services started. Keeping container alive..."
tail -f /dev/null
