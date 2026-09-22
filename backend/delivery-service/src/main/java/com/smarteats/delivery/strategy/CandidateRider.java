package com.smarteats.delivery.strategy;

import com.smarteats.delivery.entity.DeliveryPartner;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateRider {
    private DeliveryPartner partner;
    private double distanceKm;
    private double riderLatitude;
    private double riderLongitude;
}
