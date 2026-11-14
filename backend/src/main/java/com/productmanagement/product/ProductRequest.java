package com.productmanagement.product;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record ProductRequest(
    @NotBlank @Size(max = 64) String code,
    @NotBlank @Size(max = 200) String title,
    @Size(max = 4000) String description,
    @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal price,
    @NotNull @Min(0) Integer quantity,
    @NotNull ProductType productType
) {}
