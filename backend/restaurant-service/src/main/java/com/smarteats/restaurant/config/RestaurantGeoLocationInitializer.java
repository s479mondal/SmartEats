package com.smarteats.restaurant.config;

import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.RestaurantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class RestaurantGeoLocationInitializer {

    private final MongoTemplate mongoTemplate;
    private final RestaurantRepository restaurantRepository;

    public RestaurantGeoLocationInitializer(MongoTemplate mongoTemplate, RestaurantRepository restaurantRepository) {
        this.mongoTemplate = mongoTemplate;
        this.restaurantRepository = restaurantRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init2dSphereIndexAndSyncExistingData() {
        log.info("Ensuring 2dsphere index on 'restaurants.geoLocation' collection...");
        try {
            mongoTemplate.indexOps(Restaurant.class)
                    .ensureIndex(new GeospatialIndex("geoLocation").typed(GeoSpatialIndexType.GEO_2DSPHERE));
            log.info("Successfully verified/created 2dsphere index on 'restaurants.geoLocation'.");
        } catch (Exception e) {
            log.error("Failed to create 2dsphere index on 'restaurants.geoLocation': {}", e.getMessage(), e);
        }

        try {
            log.info("Checking for existing restaurant documents requiring GeoJSON synchronization...");
            List<Restaurant> restaurants = restaurantRepository.findAll();
            int updatedCount = 0;

            for (Restaurant r : restaurants) {
                if (r.getLatitude() != null && r.getLongitude() != null && r.getGeoLocation() == null) {
                    r.syncGeoLocation();
                    if (r.getGeoLocation() != null) {
                        restaurantRepository.save(r);
                        updatedCount++;
                    }
                }
            }

            log.info("Non-destructive GeoJSON sync complete. Updated {} existing restaurant documents.", updatedCount);
        } catch (Exception e) {
            log.error("Error during existing restaurant GeoJSON synchronization: {}", e.getMessage(), e);
        }
    }
}
