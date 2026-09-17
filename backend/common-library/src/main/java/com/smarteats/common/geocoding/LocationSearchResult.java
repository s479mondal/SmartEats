package com.smarteats.common.geocoding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationSearchResult implements Serializable {
    private static final long serialVersionUID = 1L;

    private String displayName;
    private Double latitude;
    private Double longitude;
    @com.fasterxml.jackson.annotation.JsonProperty("isParentArea")
    private boolean isParentArea;
    private String matchedQuery;
    private Map<String, String> addressDetails;
}
