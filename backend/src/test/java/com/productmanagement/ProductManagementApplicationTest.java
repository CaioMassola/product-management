package com.productmanagement;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;
import static org.mockito.Mockito.*;
class ProductManagementApplicationTest {
    @Test void closesOnlyTheSeedApplicationContext() {
        var context=mock(ConfigurableApplicationContext.class);var environment=mock(ConfigurableEnvironment.class);
        when(context.getEnvironment()).thenReturn(environment);when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false,true);
        try(var application=mockStatic(SpringApplication.class)){
            application.when(()->SpringApplication.run(eq(ProductManagementApplication.class),any(String[].class))).thenReturn(context);
            ProductManagementApplication.main(new String[]{});verify(context,never()).close();
            ProductManagementApplication.main(new String[]{"--spring.profiles.active=seed"});verify(context).close();
        }
    }
}
