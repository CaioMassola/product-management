package com.productmanagement.report;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
class ReportRecoveryTest {
    @Test void delegatesLeaseRecoveryToTransactionalService() {
        var service = mock(ReportService.class);
        new ReportRecovery(service).recover();
        verify(service).recoverExpired();
    }
    @Test void exposesReportStatusThroughTheController() {
        var service=mock(ReportService.class);var storage=mock(com.productmanagement.storage.ReportStorage.class);var id=java.util.UUID.randomUUID();
        when(service.get(id)).thenReturn(new ReportRecord(id,"REPORT.xlsx",ReportStatus.PENDING,java.time.Instant.now(),null,null,new ReportRequest(null,null,null,null),null,null,null,null,null,0));
        var report=new ReportController(service,storage).get(id);
        org.assertj.core.api.Assertions.assertThat(report.id()).isEqualTo(id);
        org.assertj.core.api.Assertions.assertThat(report.downloadAvailable()).isFalse();
    }
}
