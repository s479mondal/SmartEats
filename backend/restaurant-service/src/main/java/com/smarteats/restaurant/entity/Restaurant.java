package com.smarteats.restaurant.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "restaurants")
public class Restaurant implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private String id;
    private String ownerId; // Logical mapping to users._id
    private String name;
    private String description;
    private String ownerEmail;
    private String email;
    private String address;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint geoLocation;

    private String location;
    private String phone;
    private String cuisineType;
    private String openingTime;
    private String closingTime;
    private Integer openingTimeMinutes;
    private Integer closingTimeMinutes;
    private String logoUrl;
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;
    
    @Builder.Default
    private boolean approved = false;
    
    @Builder.Default
    private String status = "PENDING"; // PENDING, ACTIVE, REJECTED, SUSPENDED

    @Builder.Default
    private boolean open = true; // Direct operational toggle

    private String approvedBy;
    private LocalDateTime approvalDate;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public void syncGeoLocation() {
        if (this.longitude != null && this.latitude != null
                && this.latitude >= -90.0 && this.latitude <= 90.0
                && this.longitude >= -180.0 && this.longitude <= 180.0) {
            this.geoLocation = new GeoJsonPoint(this.longitude, this.latitude);
        } else {
            this.geoLocation = null;
        }
    }

    public void syncOperatingTimeMinutes() {
        if (this.openingTime != null && this.openingTimeMinutes == null) {
            this.openingTimeMinutes = com.smarteats.restaurant.util.RestaurantOperatingHoursUtil.timeToMinutes(this.openingTime);
        }
        if (this.closingTime != null && this.closingTimeMinutes == null) {
            this.closingTimeMinutes = com.smarteats.restaurant.util.RestaurantOperatingHoursUtil.timeToMinutes(this.closingTime);
        }
    }
}
