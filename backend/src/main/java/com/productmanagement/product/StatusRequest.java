package com.productmanagement.product;

import jakarta.validation.constraints.NotNull;

public record StatusRequest(@NotNull ProductStatus status) {}
