package com.productmanagement.report.messaging;

import org.springframework.amqp.core.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "app.reports.messaging-enabled", havingValue = "true", matchIfMissing = true)
public class ReportRabbitConfiguration {
    public static final String EXCHANGE = "product.reports";
    public static final String QUEUE = "product.reports.generate";
    public static final String ROUTING_KEY = "generate";
    @Bean
    Declarables reportTopology() {
        var exchange = new DirectExchange(EXCHANGE, true, false);
        var retryExchange = new DirectExchange(EXCHANGE + ".retry", true, false);
        var queue = QueueBuilder.durable(QUEUE).deadLetterExchange(EXCHANGE + ".retry").deadLetterRoutingKey("retry").build();
        var retryQueue = QueueBuilder.durable(QUEUE + ".retry").ttl(5000)
            .deadLetterExchange(EXCHANGE).deadLetterRoutingKey(ROUTING_KEY).build();
        return new Declarables(exchange, retryExchange, queue, retryQueue,
            BindingBuilder.bind(queue).to(exchange).with(ROUTING_KEY),
            BindingBuilder.bind(retryQueue).to(retryExchange).with("retry"));
    }
}
