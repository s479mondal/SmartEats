package com.smarteats.restaurant.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.restaurant.dto.InventoryBatchReservationRequest;
import com.smarteats.restaurant.dto.InventoryBatchReservationResponse;
import com.smarteats.restaurant.dto.InventoryItemRequest;
import com.smarteats.restaurant.entity.MenuItem;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class InventoryAtomicDeductionTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @Mock
    private ProfileChangeRequestRepository profileChangeRequestRepository;

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private CacheManager cacheManager;

    private RestaurantServiceImpl restaurantService;

    private final String restaurantId = "rest_test_101";

    @BeforeEach
    void setUp() {
        restaurantService = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                null,
                null,
                mongoTemplate,
                cacheManager
        );
    }

    @Test
    @DisplayName("TC-INV-BE-01: Initial = 20, Request = 5 -> Success, Remaining = 15")
    void testReservationSucceedsWhenSufficientStock() {
        String itemId = "item_paneer_20";
        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Paneer Butter Masala")
                .available(true)
                .availableQuantity(20)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        MenuItem updatedItem = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Paneer Butter Masala")
                .available(true)
                .availableQuantity(15)
                .build();

        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(updatedItem);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 5)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertTrue(response.isSuccess());
        assertEquals(1, response.getReservedItems().size());
        assertEquals(15, response.getReservedItems().get(0).getRemainingQuantity());
    }

    @Test
    @DisplayName("TC-INV-BE-02: Initial = 5, Request = 5 -> Success, Remaining = 0")
    void testReservationSucceedsDepletingExactStock() {
        String itemId = "item_biryani_5";
        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Chicken Biryani")
                .available(true)
                .availableQuantity(5)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        MenuItem updatedItem = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Chicken Biryani")
                .available(true)
                .availableQuantity(0)
                .build();

        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(updatedItem);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 5)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertTrue(response.isSuccess());
        assertEquals(0, response.getReservedItems().get(0).getRemainingQuantity());
    }

    @Test
    @DisplayName("TC-INV-BE-03: Initial = 4, Request = 5 -> Failure, Remaining unchanged")
    void testReservationFailsWhenRequestedExceedsAvailable() {
        String itemId = "item_tikka_4";
        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Paneer Tikka")
                .available(true)
                .availableQuantity(4)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        // findAndModify returns null because availableQuantity >= 5 condition is not met in MongoDB
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(null);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 5)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertFalse(response.isSuccess());
        assertEquals(itemId, response.getFailedMenuItemId());
        assertTrue(response.getMessage().contains("Insufficient portions"));
    }

    @Test
    @DisplayName("TC-INV-BE-04: Initial = 0, Request = 1 -> Failure, Remaining = 0")
    void testReservationFailsWhenSoldOut() {
        String itemId = "item_soldout_0";
        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Naan")
                .available(true)
                .availableQuantity(0)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(null);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 1)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertFalse(response.isSuccess());
        assertEquals(itemId, response.getFailedMenuItemId());
    }

    @Test
    @DisplayName("TC-INV-BE-05 & 06: Request quantity <= 0 -> Failure / Validation rejected")
    void testReservationRejectsNonPositiveQuantities() {
        InventoryBatchReservationRequest requestZero = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest("item_1", 0)))
                .build();

        InventoryBatchReservationResponse respZero = restaurantService.reserveInventory(restaurantId, requestZero);
        assertFalse(respZero.isSuccess());
        assertTrue(respZero.getMessage().contains("at least 1"));

        InventoryBatchReservationRequest requestNeg = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest("item_1", -2)))
                .build();

        InventoryBatchReservationResponse respNeg = restaurantService.reserveInventory(restaurantId, requestNeg);
        assertFalse(respNeg.isSuccess());
    }

    @Test
    @DisplayName("TC-INV-BE-07: availableQuantity = null -> Legacy preserved, no fake inventory")
    void testLegacyNullAvailableQuantityPreserved() {
        String itemId = "item_legacy_null";
        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Legacy Samosa")
                .available(true)
                .availableQuantity(null)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 3)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertTrue(response.isSuccess());
        assertEquals(1, response.getReservedItems().size());
        assertNull(response.getReservedItems().get(0).getRemainingQuantity());
        assertFalse(response.getReservedItems().get(0).isTracked());
        // Verify mongoTemplate.findAndModify was NOT called to decrement
        verify(mongoTemplate, never()).findAndModify(any(), any(), any(), eq(MenuItem.class));
    }

    @Test
    @DisplayName("TC-INV-BE-08: Order contains multiple items -> Batch reservation succeeds for all")
    void testBatchReservationMultipleItems() {
        String item1 = "item_1";
        String item2 = "item_2";

        MenuItem mi1 = MenuItem.builder().id(item1).restaurantId(restaurantId).name("Dish 1").available(true).availableQuantity(10).build();
        MenuItem mi2 = MenuItem.builder().id(item2).restaurantId(restaurantId).name("Dish 2").available(true).availableQuantity(5).build();

        when(menuItemRepository.findById(item1)).thenReturn(Optional.of(mi1));
        when(menuItemRepository.findById(item2)).thenReturn(Optional.of(mi2));

        MenuItem upd1 = MenuItem.builder().id(item1).restaurantId(restaurantId).name("Dish 1").available(true).availableQuantity(8).build();
        MenuItem upd2 = MenuItem.builder().id(item2).restaurantId(restaurantId).name("Dish 2").available(true).availableQuantity(2).build();

        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(upd1)
                .thenReturn(upd2);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(
                        new InventoryItemRequest(item1, 2),
                        new InventoryItemRequest(item2, 3)
                ))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertTrue(response.isSuccess());
        assertEquals(2, response.getReservedItems().size());
    }

    @Test
    @DisplayName("TC-INV-BE-09: Second item in batch fails -> First item compensated and rolled back")
    void testBatchReservationRollbackOnPartialFailure() {
        String item1 = "item_1";
        String item2 = "item_2";

        MenuItem mi1 = MenuItem.builder().id(item1).restaurantId(restaurantId).name("Dish 1").available(true).availableQuantity(5).build();
        MenuItem mi2 = MenuItem.builder().id(item2).restaurantId(restaurantId).name("Dish 2").available(true).availableQuantity(1).build();

        when(menuItemRepository.findById(item1)).thenReturn(Optional.of(mi1));
        when(menuItemRepository.findById(item2)).thenReturn(Optional.of(mi2));

        MenuItem upd1 = MenuItem.builder().id(item1).restaurantId(restaurantId).name("Dish 1").available(true).availableQuantity(2).build();

        // item1 succeeds, item2 fails (findAndModify returns null)
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(upd1)
                .thenReturn(null);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(
                        new InventoryItemRequest(item1, 3),
                        new InventoryItemRequest(item2, 2)
                ))
                .build();

        InventoryBatchReservationResponse response = restaurantService.reserveInventory(restaurantId, request);

        assertFalse(response.isSuccess());
        assertEquals(item2, response.getFailedMenuItemId());

        // Verify compensation rollback was executed for item1 (increment by 3)
        verify(mongoTemplate, atLeastOnce()).findAndModify(any(Query.class), any(Update.class), eq(MenuItem.class));
    }

    @Test
    @DisplayName("TC-INV-BE-10: Release inventory restores portions")
    void testReleaseInventoryRestoresPortions() {
        String itemId = "item_restore";
        MenuItem updated = MenuItem.builder().id(itemId).restaurantId(restaurantId).availableQuantity(10).build();

        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenReturn(updated);

        InventoryBatchReservationRequest request = InventoryBatchReservationRequest.builder()
                .items(List.of(new InventoryItemRequest(itemId, 3)))
                .build();

        InventoryBatchReservationResponse response = restaurantService.releaseInventory(restaurantId, request);

        assertTrue(response.isSuccess());
        assertEquals(1, response.getReservedItems().size());
        assertEquals(10, response.getReservedItems().get(0).getRemainingQuantity());
    }

    @Test
    @DisplayName("TC-INV-BE-11: CONCURRENCY TEST - Exactly ONE thread succeeds in reserving the final portion")
    void testConcurrentInventoryReservationsOnlyOneSucceeds() throws InterruptedException {
        String itemId = "item_final_portion";
        int totalThreads = 10;
        int initialStock = 1;

        // Simulated atomic in-memory MongoDB store
        AtomicInteger databaseStock = new AtomicInteger(initialStock);

        MenuItem item = MenuItem.builder()
                .id(itemId)
                .restaurantId(restaurantId)
                .name("Special Chef Dish")
                .available(true)
                .availableQuantity(initialStock)
                .build();

        when(menuItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        // Mock findAndModify simulating MongoDB atomic condition (availableQuantity >= 1)
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(MenuItem.class)))
                .thenAnswer(invocation -> {
                    // Atomic update: only decrement if stock >= 1
                    int current;
                    do {
                        current = databaseStock.get();
                        if (current < 1) {
                            return null; // Condition availableQuantity >= 1 failed in MongoDB
                        }
                    } while (!databaseStock.compareAndSet(current, current - 1));

                    return MenuItem.builder()
                            .id(itemId)
                            .restaurantId(restaurantId)
                            .available(true)
                            .availableQuantity(databaseStock.get())
                            .build();
                });

        ExecutorService executor = Executors.newFixedThreadPool(totalThreads);
        CountDownLatch latch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(totalThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        for (int i = 0; i < totalThreads; i++) {
            executor.submit(() -> {
                try {
                    latch.await(); // Start all threads simultaneously
                    InventoryBatchReservationRequest req = InventoryBatchReservationRequest.builder()
                            .items(List.of(new InventoryItemRequest(itemId, 1)))
                            .build();
                    InventoryBatchReservationResponse res = restaurantService.reserveInventory(restaurantId, req);
                    if (res.isSuccess()) {
                        successCount.incrementAndGet();
                    } else {
                        failureCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        latch.countDown(); // Fire!
        boolean finished = doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "Concurrent tests completed within timeout");
        assertEquals(1, successCount.get(), "Exactly ONE thread must successfully reserve the portion");
        assertEquals(totalThreads - 1, failureCount.get(), "Remaining threads must receive failure");
        assertEquals(0, databaseStock.get(), "Final stock must be exactly 0, never negative");
    }
}
