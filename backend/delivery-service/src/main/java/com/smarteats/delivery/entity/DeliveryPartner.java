package com.smarteats.delivery.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "delivery_partners")
public class DeliveryPartner {

    @Id
    private String id;
    private String name;
    private String email;
    private double latitude;
    private double longitude;
    private boolean active;
    private boolean available;
}
