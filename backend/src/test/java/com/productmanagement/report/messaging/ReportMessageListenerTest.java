package com.productmanagement.report.messaging;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.*;
import com.productmanagement.report.ReportWorker;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ReportMessageListenerTest {
    @Test void discardsMalformedMessagesAndProcessesValidIds() {
        var worker = mock(ReportWorker.class);
        var listener = new ReportMessageListener(worker);
        listener.receive(message("invalid"));
        listener.receive(message("x".repeat(36)));
        verifyNoInteractions(worker);
        var id = UUID.randomUUID();
        listener.receive(message(id.toString()));
        verify(worker).process(id);
        doThrow(new IllegalStateException("database unavailable")).when(worker).process(id);
        assertThatThrownBy(() -> listener.receive(message(id.toString()))).isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
    @Test void declaresDurableRetryQueuesAndBindings() {
        var topology = new ReportRabbitConfiguration().reportTopology();
        assertThat(topology.getDeclarablesByType(Queue.class)).hasSize(2).allMatch(Queue::isDurable);
        assertThat(topology.getDeclarablesByType(DirectExchange.class)).hasSize(2);
        assertThat(topology.getDeclarablesByType(Binding.class)).hasSize(2);
        var retry = topology.getDeclarablesByType(Queue.class).stream().filter(q -> q.getName().endsWith(".retry")).findFirst().orElseThrow();
        assertThat(retry.getArguments()).containsEntry("x-message-ttl", 5000).containsEntry("x-dead-letter-exchange", ReportRabbitConfiguration.EXCHANGE);
    }
    private Message message(String text) { return new Message(text.getBytes(StandardCharsets.UTF_8), new MessageProperties()); }
}
