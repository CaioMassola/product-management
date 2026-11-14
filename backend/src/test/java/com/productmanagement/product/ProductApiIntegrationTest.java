package com.productmanagement.product;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ProductApiIntegrationTest {
    @LocalServerPort int port;
    @Autowired ProductRepository repository;
    @Autowired ObjectMapper mapper;
    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void clear() { repository.deleteAll(); }

    @Test
    void createsActiveProductWithLocationAndTimestamps() throws Exception {
        var response = send("POST", "", product("NEW-1", "Desk", "FURNITURE", "100.00", 2));
        assertThat(response.statusCode()).isEqualTo(201);
        var body = json(response);
        assertThat(body.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.get("createdAt").asText()).isNotBlank();
        assertThat(response.headers().firstValue("Location")).contains("/api/products/" + body.get("id").asText());
    }

    @Test
    void reservesCodeAfterInactivationAndSupportsReactivation() throws Exception {
        var created = json(send("POST", "", product("CODE-1", "Desk", "FURNITURE", "100.00", 2)));
        String id = created.get("id").asText();
        var inactive = send("PATCH", "/" + id + "/status", "{\"status\":\"INACTIVE\"}");
        assertThat(inactive.statusCode()).isEqualTo(200);
        assertThat(json(inactive).get("status").asText()).isEqualTo("INACTIVE");
        assertThat(json(inactive).get("updatedAt").asText()).isNotEqualTo(created.get("updatedAt").asText());
        assertThat(repository.existsById(UUID.fromString(id))).isTrue();
        assertThat(send("POST", "", product("code-1", "Other", "GAMES", "1.00", 0)).statusCode()).isEqualTo(409);
        assertThat(json(send("GET", "", null)).get("totalElements").asLong()).isZero();
        assertThat(json(send("GET", "?status=INACTIVE", null)).get("totalElements").asLong()).isEqualTo(1);
        assertThat(json(send("GET", "?status=ALL", null)).get("totalElements").asLong()).isEqualTo(1);
        assertThat(json(send("PATCH", "/" + id + "/status", "{\"status\":\"ACTIVE\"}")).get("status").asText()).isEqualTo("ACTIVE");
        assertThat(json(send("GET", "", null)).get("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void combinesSearchCategoryStatusAndPriceAndPaginates() throws Exception {
        send("POST", "", product("GAME-1", "Puzzle Alpha", "GAMES", "150.00", 5));
        send("POST", "", product("GAME-2", "Puzzle Beta", "GAMES", "250.00", 5));
        send("POST", "", product("BOOK-1", "Puzzle Book", "BOOKS", "150.00", 5));
        send("POST", "", product("GAME-3", "Puzzle Premium", "GAMES", "800.00", 5));
        var page = json(send("GET", "?search=puzzle&productType=GAMES&minPrice=100&maxPrice=500&size=1&sortBy=price&direction=ASC", null));
        assertThat(page.get("totalElements").asLong()).isEqualTo(2);
        assertThat(page.get("totalPages").asInt()).isEqualTo(2);
        assertThat(page.get("content").size()).isEqualTo(1);
        assertThat(page.get("content").get(0).get("code").asText()).isEqualTo("GAME-1");
    }

    @Test
    void treatsSearchWildcardsAsLiteralCharacters() throws Exception {
        send("POST", "", product("NORMAL", "Regular", "GAMES", "1.00", 0));
        assertThat(json(send("GET", "?search=%25", null)).get("totalElements").asLong()).isZero();
        assertThat(json(send("GET", "?search=_", null)).get("totalElements").asLong()).isZero();
    }

    @Test
    void rejectsInvalidProductInput() throws Exception {
        assertThat(send("POST", "", product("NEGATIVE", "Invalid", "GAMES", "-1.00", 1)).statusCode()).isEqualTo(400);
        assertThat(send("POST", "", product("STOCK", "Invalid", "GAMES", "1.00", -1)).statusCode()).isEqualTo(400);
        assertThat(send("POST", "", product("PRECISION", "Invalid", "GAMES", "1.001", 1)).statusCode()).isEqualTo(400);
        assertThat(send("POST", "", product("", "Invalid", "GAMES", "1.00", 1)).statusCode()).isEqualTo(400);
        assertThat(send("POST", "", product("TYPE", "Invalid", "CUSTOM", "1.00", 1)).statusCode()).isEqualTo(400);
    }

    @Test
    void rejectsInvalidFiltersAndStatus() throws Exception {
        for (String query : new String[] {"?minPrice=500&maxPrice=100", "?minPrice=-1", "?minPrice=1.001",
            "?size=101", "?page=-1", "?sortBy=imageKey", "?status=DELETED", "?direction=INVALID"}) {
            assertThat(send("GET", query, null).statusCode()).as(query).isEqualTo(400);
        }
        var id = json(send("POST", "", product("P-1", "Product", "GAMES", "0.00", 0))).get("id").asText();
        assertThat(send("PATCH", "/" + id + "/status", "{\"status\":\"DELETED\"}").statusCode()).isEqualTo(400);
        assertThat(send("PATCH", "/" + id + "/status", "{}").statusCode()).isEqualTo(400);
    }

    @Test
    void editsProductAndPreservesInactiveStatus() throws Exception {
        var id = json(send("POST", "", product("P-1", "Old", "GAMES", "10.00", 1))).get("id").asText();
        send("PATCH", "/" + id + "/status", "{\"status\":\"INACTIVE\"}");
        var updated = send("PUT", "/" + id, product("P-2", "New", "BOOKS", "20.00", 2));
        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(json(updated).get("status").asText()).isEqualTo("INACTIVE");
        assertThat(json(updated).get("title").asText()).isEqualTo("New");
        assertThat(json(send("GET", "/" + id, null)).get("price").decimalValue()).isEqualByComparingTo(new BigDecimal("20.00"));
    }

    @Test
    void returnsNotFoundAndDoesNotExposeDelete() throws Exception {
        assertThat(send("GET", "/" + UUID.randomUUID(), null).statusCode()).isEqualTo(404);
        var id = json(send("POST", "", product("P-1", "Product", "GAMES", "0.00", 0))).get("id").asText();
        assertThat(send("DELETE", "/" + id, null).statusCode()).isEqualTo(405);
        assertThat(repository.existsById(UUID.fromString(id))).isTrue();
    }

    @Test
    void permitsImageRemovalCorsButDoesNotPermitProductDeletionCors() throws Exception {
        String id = UUID.randomUUID().toString();
        var imageRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/products/" + id + "/image"))
            .header("Origin", "http://localhost:3000").header("Access-Control-Request-Method", "DELETE")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        var imageResponse = client.send(imageRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(imageResponse.statusCode()).isEqualTo(200);
        assertThat(imageResponse.headers().firstValue("Access-Control-Allow-Methods").orElse("")).contains("DELETE");
        var productRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/products/" + id))
            .header("Origin", "http://localhost:3000").header("Access-Control-Request-Method", "DELETE")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        assertThat(client.send(productRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
    }

    @Test
    void rejectsStatusOnProductCreationInsteadOfAllowingAnInactiveDefault() throws Exception {
        String payload = product("P-1", "Product", "GAMES", "0.00", 0).strip();
        payload = payload.substring(0, payload.length() - 1) + ",\"status\":\"INACTIVE\"}";
        assertThat(send("POST", "", payload).statusCode()).isEqualTo(400);
    }

    @Test
    void exposesStructuredFieldValidationErrors() throws Exception {
        var response = send("POST", "", product("", "", "GAMES", "-1.00", -1));
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.headers().firstValue("Content-Type").orElse("")).contains("application/problem+json");
        assertThat(json(response).get("code").asText()).isEqualTo("VALIDATION_ERROR");
        assertThat(json(response).get("errors").has("code")).isTrue();
        assertThat(json(response).get("errors").has("quantity")).isTrue();
    }

    private String product(String code, String title, String type, String price, int quantity) {
        return """
            {"code":"%s","title":"%s","description":"Sample product","price":%s,"quantity":%d,"productType":"%s"}
            """.formatted(code, title, price, quantity, type);
    }

    private HttpResponse<String> send(String method, String path, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/products" + path))
            .header("Content-Type", "application/json")
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode json(HttpResponse<String> response) throws Exception { return mapper.readTree(response.body()); }
}
