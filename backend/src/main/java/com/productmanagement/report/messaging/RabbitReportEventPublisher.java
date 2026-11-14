package com.productmanagement.report.messaging;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.reports.messaging-enabled", havingValue = "true", matchIfMissing = true)
public class RabbitReportEventPublisher implements ReportEventPublisher {
    private final RabbitTemplate template;
    public RabbitReportEventPublisher(RabbitTemplate template) { this.template = template; }
    @Override
    public void publish(UUID eventId, UUID reportId) throws Exception {
        var properties = new MessageProperties();
        properties.setContentType(MessageProperties.CONTENT_TYPE_TEXT_PLAIN);
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        properties.setMessageId(eventId.toString());
        var correlation = new CorrelationData(eventId.toString());
        template.send(ReportRabbitConfiguration.EXCHANGE, ReportRabbitConfiguration.ROUTING_KEY,
            new Message(reportId.toString().getBytes(StandardCharsets.UTF_8), properties), correlation);
        var confirmation = correlation.getFuture().get(5, TimeUnit.SECONDS);
        if (!confirmation.isAck() || correlation.getReturned() != null) throw new IllegalStateException("Report message was not confirmed and routed");
    }
}
