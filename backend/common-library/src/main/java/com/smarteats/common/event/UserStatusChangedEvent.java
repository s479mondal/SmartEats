package com.smarteats.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStatusChangedEvent implements Serializable {
    private String userId;
    private String email;
    private String role;
    private String status; // PENDING, ACTIVE, REJECTED, SUSPENDED
    private String rejectionReason;
}
