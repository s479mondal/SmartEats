package com.smarteats.restaurant.service;

import com.smarteats.restaurant.dto.MenuItemRequest;
import com.smarteats.restaurant.dto.MenuItemResponse;
import com.smarteats.restaurant.entity.MenuItem;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MenuItemAvailableQuantityTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @Mock
    private ProfileChangeRequestRepository profileChangeRequestRepository;

    private RestaurantServiceImpl restaurantService;
    private Validator validator;

    private static final String RESTAURANT_ID = "rest_test_101";
    private static final String OWNER_EMAIL = "owner@smarteats.com";

    private Restaurant mockRestaurant;

    @BeforeEach
    void setUp() {
        restaurantService = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                null,
                null
        );

        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();

        mockRestaurant = Restaurant.builder()
                .id(RESTAURANT_ID)
                .name("Tandoor Express")
                .ownerEmail(OWNER_EMAIL)
                .approved(true)
                .status("ACTIVE")
                .build();
    }

    @Test
    @DisplayName("TEST 1: Create menu item with availableQuantity = 20 -> stored MenuItem and Response have 20")
    void testCreateMenuItemWithAvailableQuantity() {
        when(restaurantRepository.findById(RESTAURANT_ID)).thenReturn(Optional.of(mockRestaurant));

        MenuItemRequest request = MenuItemRequest.builder()
                .name("Butter Chicken")
                .description("Creamy rich chicken gravy")
                .price(180.0)
                .category("Main Course")
                .available(true)
                .availableQuantity(20)
                .build();

        MenuItem savedEntity = MenuItem.builder()
                .id("item_1")
                .restaurantId(RESTAURANT_ID)
                .name("Butter Chicken")
                .description("Creamy rich chicken gravy")
                .price(180.0)
                .category("Main Course")
                .available(true)
                .availableQuantity(20)
                .build();

        when(menuItemRepository.save(any(MenuItem.class))).thenReturn(savedEntity);

        MenuItemResponse response = restaurantService.addMenuItem(RESTAURANT_ID, request, OWNER_EMAIL);

        assertNotNull(response);
        assertEquals("item_1", response.getId());
        assertEquals("Butter Chicken", response.getName());
        assertEquals(20, response.getAvailableQuantity());
        assertTrue(response.isAvailable());

        ArgumentCaptor<MenuItem> captor = ArgumentCaptor.forClass(MenuItem.class);
        verify(menuItemRepository).save(captor.capture());
        MenuItem captured = captor.getValue();
        assertEquals(20, captured.getAvailableQuantity());
        assertEquals("Butter Chicken", captured.getName());
    }

    @Test
    @DisplayName("TEST 2: Create/update menu item with availableQuantity = 0 -> accepted and stored value is 0")
    void testCreateOrUpdateWithZeroQuantity() {
        when(restaurantRepository.findById(RESTAURANT_ID)).thenReturn(Optional.of(mockRestaurant));

        MenuItemRequest request = MenuItemRequest.builder()
                .name("Kadhai Paneer")
                .description("Spicy cottage cheese")
                .price(150.0)
                .category("Main Course")
                .available(false)
                .availableQuantity(0)
                .build();

        // Validation test for quantity = 0
        Set<ConstraintViolation<MenuItemRequest>> violations = validator.validate(request);
        assertTrue(violations.isEmpty(), "Quantity 0 should pass Bean Validation");

        MenuItem existingItem = MenuItem.builder()
                .id("item_2")
                .restaurantId(RESTAURANT_ID)
                .name("Kadhai Paneer")
                .price(150.0)
                .category("Main Course")
                .available(true)
                .availableQuantity(10)
                .build();

        when(menuItemRepository.findById("item_2")).thenReturn(Optional.of(existingItem));
        when(menuItemRepository.save(any(MenuItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MenuItemResponse response = restaurantService.updateMenuItem(RESTAURANT_ID, "item_2", request, OWNER_EMAIL);

        assertNotNull(response);
        assertEquals(0, response.getAvailableQuantity());
        assertFalse(response.isAvailable());
    }

    @Test
    @DisplayName("TEST 3: Create/update with availableQuantity = -1 -> validation failure")
    void testValidationFailureForNegativeQuantity() {
        MenuItemRequest request = MenuItemRequest.builder()
                .name("Garlic Naan")
                .description("Crispy tandoori naan")
                .price(40.0)
                .category("Breads")
                .available(true)
                .availableQuantity(-1)
                .build();

        Set<ConstraintViolation<MenuItemRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty(), "Negative quantity should trigger Bean Validation failure");

        boolean hasNegativeQtyViolation = violations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().equals("availableQuantity") &&
                               v.getMessage().contains("Available portions cannot be negative"));
        assertTrue(hasNegativeQtyViolation, "Should produce 'Available portions cannot be negative' violation");
    }

    @Test
    @DisplayName("TEST 4: Existing menu item without availableQuantity (null) -> loads safely without NPE and returns null")
    void testExistingMenuItemWithNullQuantity() {
        MenuItem legacyItem = MenuItem.builder()
                .id("item_legacy_1")
                .restaurantId(RESTAURANT_ID)
                .name("Dal Makhani")
                .description("Slow cooked black lentils")
                .price(120.0)
                .category("Main Course")
                .available(true)
                .availableQuantity(null) // Legacy item without portion quantity
                .build();

        when(menuItemRepository.findByRestaurantId(RESTAURANT_ID)).thenReturn(List.of(legacyItem));

        List<MenuItemResponse> responses = restaurantService.getMenuItems(RESTAURANT_ID);

        assertNotNull(responses);
        assertEquals(1, responses.size());
        MenuItemResponse response = responses.get(0);
        assertEquals("Dal Makhani", response.getName());
        assertNull(response.getAvailableQuantity(), "availableQuantity should be null for unconfigured legacy item");
        assertTrue(response.isAvailable());
    }

    @Test
    @DisplayName("TEST 5: Update existing menu item from null to 15 -> stored value becomes 15")
    void testUpdateExistingMenuItemFromNullToConfiguredQuantity() {
        when(restaurantRepository.findById(RESTAURANT_ID)).thenReturn(Optional.of(mockRestaurant));

        MenuItem legacyItem = MenuItem.builder()
                .id("item_legacy_2")
                .restaurantId(RESTAURANT_ID)
                .name("Chicken Biryani")
                .description("Fragrant basmati rice with marinated chicken")
                .price(220.0)
                .category("Biryani & Rice")
                .available(true)
                .availableQuantity(null)
                .build();

        when(menuItemRepository.findById("item_legacy_2")).thenReturn(Optional.of(legacyItem));
        when(menuItemRepository.save(any(MenuItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MenuItemRequest updateRequest = MenuItemRequest.builder()
                .name("Chicken Biryani Special")
                .description("Fragrant basmati rice with marinated chicken and extra egg")
                .price(230.0)
                .category("Biryani & Rice")
                .available(true)
                .availableQuantity(15)
                .build();

        MenuItemResponse response = restaurantService.updateMenuItem(RESTAURANT_ID, "item_legacy_2", updateRequest, OWNER_EMAIL);

        assertNotNull(response);
        assertEquals(15, response.getAvailableQuantity());
        assertEquals("Chicken Biryani Special", response.getName());
        assertEquals(230.0, response.getPrice());
    }

    @Test
    @DisplayName("TEST 6: Menu API response contains availableQuantity when configured across multiple items")
    void testMenuResponseContainsAvailableQuantity() {
        MenuItem item1 = MenuItem.builder()
                .id("item_1")
                .restaurantId(RESTAURANT_ID)
                .name("Paneer Tikka")
                .price(160.0)
                .category("Starters")
                .available(true)
                .availableQuantity(12)
                .build();

        MenuItem item2 = MenuItem.builder()
                .id("item_2")
                .restaurantId(RESTAURANT_ID)
                .name("Masala Chai")
                .price(30.0)
                .category("Beverages")
                .available(true)
                .availableQuantity(50)
                .build();

        MenuItem item3 = MenuItem.builder()
                .id("item_3")
                .restaurantId(RESTAURANT_ID)
                .name("Gulab Jamun")
                .price(50.0)
                .category("Desserts")
                .available(false)
                .availableQuantity(0)
                .build();

        when(menuItemRepository.findByRestaurantId(RESTAURANT_ID)).thenReturn(Arrays.asList(item1, item2, item3));

        List<MenuItemResponse> responses = restaurantService.getMenuItems(RESTAURANT_ID);

        assertEquals(3, responses.size());
        assertEquals(12, responses.get(0).getAvailableQuantity());
        assertEquals(50, responses.get(1).getAvailableQuantity());
        assertEquals(0, responses.get(2).getAvailableQuantity());
    }
}
