package com.productmanagement.report.messaging;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import com.productmanagement.report.ReportWorker;

@Component
@ConditionalOnProperty(name = "app.reports.messaging-enabled", havingValue = "true", matchIfMissing = true)
public class ReportMessageListener {
    private static final Logger log = LoggerFactory.getLogger(ReportMessageListener.class);
    private final ReportWorker worker;
    public ReportMessageListener(ReportWorker worker) { this.worker = worker; }
    @RabbitListener(queues = ReportRabbitConfiguration.QUEUE)
    public void receive(Message message) {
        UUID id;
        try {
            if (message.getBody().length != 36) throw new IllegalArgumentException("Invalid report ID length");
            id = UUID.fromString(new String(message.getBody(), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException exception) {
            log.warn("Discarded malformed report message {}", message.getMessageProperties().getMessageId());
            return;
        }
        try { worker.process(id); }
        catch (Exception exception) {
            // Infrastructure failures before a claim return through a delayed dead-letter queue.
            throw new AmqpRejectAndDontRequeueException("Report processing is temporarily unavailable", exception);
        }
    }
}
