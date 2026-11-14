package com.productmanagement.report;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.ReturnedMessage;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.productmanagement.report.messaging.RabbitReportEventPublisher;
import static org.assertj.core.api.Assertions.*;

class ReportPublisherTest {
    private RabbitReportEventPublisher publisher(boolean acknowledged, boolean returned) {
        var template = new RabbitTemplate() {
            @Override
            public void send(String exchange, String routingKey, Message message, CorrelationData correlation) {
                assertThat(message.getMessageProperties().getDeliveryMode()).isEqualTo(org.springframework.amqp.core.MessageDeliveryMode.PERSISTENT);
                if (returned) correlation.setReturned(new ReturnedMessage(message, 312, "NO_ROUTE", exchange, routingKey));
                correlation.getFuture().complete(new CorrelationData.Confirm(acknowledged, acknowledged ? null : "Broker rejected message"));
            }
        };
        return new RabbitReportEventPublisher(template);
    }
    @Test
    void acceptsOnlyConfirmedRoutedPersistentMessages() {
        assertThatCode(() -> publisher(true, false).publish(UUID.randomUUID(), UUID.randomUUID())).doesNotThrowAnyException();
        assertThatThrownBy(() -> publisher(false, false).publish(UUID.randomUUID(), UUID.randomUUID())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> publisher(true, true).publish(UUID.randomUUID(), UUID.randomUUID())).isInstanceOf(IllegalStateException.class);
    }
}
