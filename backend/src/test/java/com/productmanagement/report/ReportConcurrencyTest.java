package com.productmanagement.report;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.domain.*;
import com.productmanagement.report.messaging.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class ReportConcurrencyTest {
    @Test void ignoresStaleFailureTokensAndAConcurrentStateTransition() {
        var jdbc=mock(JdbcTemplate.class);var repository=mock(ReportRepository.class);var service=new ReportService(jdbc,repository);
        var id=UUID.randomUUID();var token=UUID.randomUUID();
        when(repository.find(id)).thenReturn(Optional.of(record(id,ReportStatus.PROCESSING,token)));
        service.failAttempt(id,UUID.randomUUID());verifyNoInteractions(jdbc);
        when(repository.find(id)).thenReturn(Optional.of(record(id,ReportStatus.COMPLETED,token)));
        service.failAttempt(id,token);verifyNoInteractions(jdbc);
        when(repository.find(id)).thenReturn(Optional.of(record(id,ReportStatus.PROCESSING,token)));
        service.failAttempt(id,token);
        verify(jdbc).update(contains("UPDATE reports"),any(Object[].class));
        verify(jdbc,never()).update(contains("INSERT INTO report_outbox"),any(Object[].class));
    }
    @Test void rejectsUnknownSortColumnsAndDoesNotSearchWhitespaceAsAName() {
        var jdbc=mock(JdbcTemplate.class);var repository=new ReportRepository(jdbc);
        when(jdbc.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(0L);
        var filter=new ReportSearch(" ",null,null,null,null,null,null,null);
        assertThatThrownBy(()->repository.search(filter,PageRequest.of(0,25,Sort.by("unknown")))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verify(jdbc).queryForObject(eq("SELECT COUNT(*) FROM reports"),eq(Long.class),any(Object[].class));
    }
    @Test void doesNotPublishAnOutboxEventWhoseLeaseWasClaimedByAnotherDispatcher() {
        var jdbc=mock(JdbcTemplate.class);var publisher=mock(ReportEventPublisher.class);
        when(jdbc.queryForList(anyString(),any(Object[].class))).thenReturn(List.of(Map.of("id",UUID.randomUUID(),"report_id",UUID.randomUUID())));
        new ReportOutboxDispatcher(jdbc,publisher).dispatch();verifyNoInteractions(publisher);
    }
    private ReportRecord record(UUID id,ReportStatus status,UUID token){return new ReportRecord(id,"REPORT.xlsx",status,Instant.now(),null,null,new ReportRequest(null,null,null,null),null,null,null,token,null,1);}
}
