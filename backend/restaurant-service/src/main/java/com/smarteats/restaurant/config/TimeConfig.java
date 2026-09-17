package com.smarteats.restaurant.config;

import com.smarteats.restaurant.util.RestaurantOperatingHoursUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.system(RestaurantOperatingHoursUtil.ZONE_ASIA_KOLKATA);
    }
}
