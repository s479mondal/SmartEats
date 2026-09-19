package com.smarteats.order.client;

import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.smarteats.order.dto.PaymentReconciliationResult;
import com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Slf4j
@Component
public class RazorpayClientWrapper {

    private final String keyId;
    private final String keySecret;
    private final String webhookSecret;

    @org.springframework.beans.factory.annotation.Autowired
    public RazorpayClientWrapper(@Value("${razorpay.key-id:rzp_test_SZ9vgZQjij4g7j}") String keyId,
                                 @Value("${razorpay.key-secret:eU3taZ4ADVpI3HT3sfnjRfvf}") String keySecret,
                                 @Value("${razorpay.webhook-secret:smarteats_test_webhook_secret}") String webhookSecret) {
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
    }

    public RazorpayClientWrapper(String keyId, String keySecret) {
        this(keyId, keySecret, "smarteats_test_webhook_secret");
    }

    public String getKeyId() {
        return keyId;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public String createRazorpayOrder(String smartEatsOrderId, double totalAmountInInr, String customerEmail) throws RazorpayException {
        long amountInPaise = Math.round(totalAmountInInr * 100);
        log.info("Initiating Razorpay order creation for SmartEats order {} (Amount: ₹{}, {} paise)",
                smartEatsOrderId, totalAmountInInr, amountInPaise);

        if (keySecret == null || keySecret.isBlank()) {
            log.warn("Razorpay key-secret is not configured. Generating sandbox test order ID for development.");
            return "order_test_" + smartEatsOrderId;
        }

        try {
            RazorpayClient razorpayClient = new RazorpayClient(keyId, keySecret);
            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", smartEatsOrderId);

            JSONObject notes = new JSONObject();
            notes.put("customerEmail", customerEmail);
            notes.put("smarteatsOrderId", smartEatsOrderId);
            orderRequest.put("notes", notes);

            com.razorpay.Order order = razorpayClient.orders.create(orderRequest);
            String razorpayOrderId = order.get("id");
            log.info("Successfully created Razorpay order: {} for SmartEats order: {}", razorpayOrderId, smartEatsOrderId);
            return razorpayOrderId;
        } catch (RazorpayException e) {
            log.error("Failed to create Razorpay order for SmartEats order {}: {}", smartEatsOrderId, e.getMessage());
            throw e;
        }
    }

    /**
     * Authoritatively verifies the Razorpay payment signature using HMAC-SHA256 with constant-time comparison.
     * message = razorpayOrderId + "|" + razorpayPaymentId
     * secret = RAZORPAY_KEY_SECRET
     */
    public boolean verifyPaymentSignature(String razorpayOrderId, String razorpayPaymentId, String razorpaySignature) {
        if (razorpayOrderId == null || razorpayOrderId.isBlank() ||
                razorpayPaymentId == null || razorpayPaymentId.isBlank() ||
                razorpaySignature == null || razorpaySignature.isBlank()) {
            log.warn("Payment signature verification failed: Missing required verification parameters");
            return false;
        }

        if (keySecret == null || keySecret.isBlank()) {
            log.error("Payment signature verification failed: Razorpay keySecret is missing in configuration");
            return false;
        }

        try {
            String calculatedSignature = calculateHmacSha256(razorpayOrderId + "|" + razorpayPaymentId, keySecret);
            boolean isValid = MessageDigest.isEqual(
                    calculatedSignature.getBytes(StandardCharsets.UTF_8),
                    razorpaySignature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
            if (!isValid) {
                log.warn("Razorpay signature mismatch for orderId: {}, paymentId: {}", razorpayOrderId, razorpayPaymentId);
            }
            return isValid;
        } catch (Exception e) {
            log.error("Cryptographic error verifying Razorpay payment signature: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Authoritatively verifies the Razorpay Webhook signature using HMAC-SHA256 over raw body.
     * message = rawPayload
     * secret = RAZORPAY_WEBHOOK_SECRET
     */
    public boolean verifyWebhookSignature(String rawPayload, String webhookSignature) {
        if (rawPayload == null || webhookSignature == null || webhookSignature.isBlank()) {
            log.warn("Webhook signature verification failed: Missing raw payload or signature");
            return false;
        }

        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.error("Webhook signature verification failed: RAZORPAY_WEBHOOK_SECRET is missing in configuration");
            return false;
        }

        try {
            String calculatedSignature = calculateHmacSha256(rawPayload, webhookSecret);
            boolean isValid = MessageDigest.isEqual(
                    calculatedSignature.getBytes(StandardCharsets.UTF_8),
                    webhookSignature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
            if (!isValid) {
                log.warn("Razorpay webhook signature mismatch for incoming payload");
            }
            return isValid;
        } catch (Exception e) {
            log.error("Cryptographic error verifying Razorpay webhook signature: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Reconciles the payment state for a given Razorpay order directly with Razorpay API.
     */
    public PaymentReconciliationResult reconcileOrderPayment(String razorpayOrderId) {
        if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
            return PaymentReconciliationResult.builder()
                    .status(PaymentReconciliationStatus.FAILED)
                    .message("Missing Razorpay order ID")
                    .build();
        }

        if (keySecret == null || keySecret.isBlank()) {
            log.warn("Razorpay keySecret not configured for reconciliation of {}", razorpayOrderId);
            return PaymentReconciliationResult.builder()
                    .status(PaymentReconciliationStatus.GATEWAY_UNAVAILABLE)
                    .message("Razorpay key-secret not configured")
                    .build();
        }

        try {
            RazorpayClient razorpayClient = new RazorpayClient(keyId, keySecret);

            // 1. Fetch payments associated with the order
            List<com.razorpay.Payment> payments = razorpayClient.orders.fetchPayments(razorpayOrderId);
            if (payments != null && !payments.isEmpty()) {
                for (com.razorpay.Payment p : payments) {
                    String status = p.get("status");
                    if ("captured".equalsIgnoreCase(status)) {
                        String method = p.get("method");
                        return PaymentReconciliationResult.builder()
                                .status(PaymentReconciliationStatus.PAID)
                                .paymentId(p.get("id"))
                                .paymentMethod(method != null ? method.toUpperCase() : "RAZORPAY")
                                .message("Payment captured on Razorpay")
                                .build();
                    }
                }

                // If all payments failed
                boolean allFailed = payments.stream().allMatch(p -> "failed".equalsIgnoreCase(p.get("status")));
                if (allFailed) {
                    return PaymentReconciliationResult.builder()
                            .status(PaymentReconciliationStatus.FAILED)
                            .message("All payment attempts failed on Razorpay")
                            .build();
                }
            }

            // 2. Fetch order details to check order-level status
            com.razorpay.Order order = razorpayClient.orders.fetch(razorpayOrderId);
            if (order != null) {
                String orderStatus = order.get("status");
                if ("paid".equalsIgnoreCase(orderStatus)) {
                    return PaymentReconciliationResult.builder()
                            .status(PaymentReconciliationStatus.PAID)
                            .message("Order marked paid on Razorpay")
                            .build();
                } else if ("attempted".equalsIgnoreCase(orderStatus) || "created".equalsIgnoreCase(orderStatus)) {
                    return PaymentReconciliationResult.builder()
                            .status(PaymentReconciliationStatus.PENDING)
                            .message("Order still pending on Razorpay")
                            .build();
                }
            }

            return PaymentReconciliationResult.builder()
                    .status(PaymentReconciliationStatus.PENDING)
                    .message("No captured payment found for order")
                    .build();

        } catch (RazorpayException e) {
            log.error("Error connecting to Razorpay API for reconciliation of order {}: {}", razorpayOrderId, e.getMessage());
            return PaymentReconciliationResult.builder()
                    .status(PaymentReconciliationStatus.GATEWAY_UNAVAILABLE)
                    .message("Gateway unavailable: " + e.getMessage())
                    .build();
        } catch (Exception e) {
            log.error("Unexpected error reconciling Razorpay order {}: {}", razorpayOrderId, e.getMessage());
            return PaymentReconciliationResult.builder()
                    .status(PaymentReconciliationStatus.GATEWAY_UNAVAILABLE)
                    .message("Reconciliation error: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Helper to compute HMAC-SHA256 hex string.
     */
    public static String calculateHmacSha256(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            hexString.append(String.format("%02x", b));
        }
        return hexString.toString();
    }

    /**
     * Fetches the payment method from Razorpay SDK or defaults safely to "RAZORPAY".
     */
    public String fetchPaymentMethod(String razorpayPaymentId) {
        if (keySecret == null || keySecret.isBlank() || razorpayPaymentId == null || razorpayPaymentId.startsWith("pay_test_")) {
            return "RAZORPAY";
        }
        try {
            RazorpayClient razorpayClient = new RazorpayClient(keyId, keySecret);
            com.razorpay.Payment payment = razorpayClient.payments.fetch(razorpayPaymentId);
            String method = payment.get("method");
            if (method != null && !method.isBlank()) {
                return method.toUpperCase();
            }
        } catch (Exception e) {
            log.warn("Could not fetch payment method from Razorpay for payment {}: {}. Defaulting to 'RAZORPAY'",
                    razorpayPaymentId, e.getMessage());
        }
        return "RAZORPAY";
    }
}
