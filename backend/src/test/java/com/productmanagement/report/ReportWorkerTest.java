package com.productmanagement.report;

import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.productmanagement.storage.ReportStorage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportWorkerTest {
    @ParameterizedTest
    @ValueSource(strings={"unclaimed","lookup-failure","heartbeat-rejected","heartbeat-error","heartbeat-healthy","lost-after-generation","lost-after-upload","completion-rejected","uncertain-commit","cleanup-failed","temporary-cleanup-failed"})
    void handlesLeaseLossAndInfrastructureFailuresWithoutPublishingAnInvalidFile(String scenario) throws Exception {
        var repository=mock(ReportRepository.class); var service=mock(ReportService.class);
        var generator=mock(ProductReportGenerator.class); var storage=mock(ReportStorage.class);
        var scheduler=mock(ScheduledExecutorService.class); var heartbeat=mock(ScheduledFuture.class);
        var pulse=new AtomicReference<Runnable>(); var key=new AtomicReference<String>(); var path=new AtomicReference<Path>();
        var id=UUID.randomUUID();
        when(repository.claim(eq(id),any(),any())).thenReturn(!scenario.equals("unclaimed"));
        when(scheduler.scheduleAtFixedRate(any(Runnable.class),anyLong(),anyLong(),any())).thenAnswer(call->{pulse.set(call.getArgument(0));return heartbeat;});
        when(repository.heartbeat(eq(id),any(),any())).thenReturn(false);
        if(scenario.equals("heartbeat-healthy"))when(repository.heartbeat(eq(id),any(),any())).thenReturn(true);
        if(scenario.equals("heartbeat-error")) when(repository.heartbeat(eq(id),any(),any())).thenThrow(new IllegalStateException("offline"));
        when(service.get(id)).thenReturn(record(id,null));
        if(scenario.equals("lookup-failure")) when(service.get(id)).thenThrow(new IllegalStateException("lookup unavailable"));
        doAnswer(call->{
            Path destination=call.getArgument(1);path.set(destination);Runnable ensure=call.getArgument(2);
            if(scenario.startsWith("heartbeat-"))pulse.get().run();
            ensure.run();
            if(scenario.equals("lost-after-generation"))pulse.get().run();
            if(scenario.equals("temporary-cleanup-failed")){
                Files.delete(destination);Files.createDirectory(destination);Files.writeString(destination.resolve("retained"),"test");
                throw new IllegalStateException("generation failed");
            }
            return null;
        }).when(generator).generate(any(),any(),any());
        doAnswer(call->{key.set(call.getArgument(0));if(scenario.equals("lost-after-upload"))pulse.get().run();return null;}).when(storage).upload(anyString(),any());
        when(repository.complete(eq(id),any(),anyString(),anyLong(),any())).thenReturn(false);
        when(repository.find(id)).thenAnswer(call->scenario.equals("uncertain-commit")?Optional.of(record(id,key.get())):Optional.empty());
        if(scenario.equals("cleanup-failed"))doThrow(new IllegalStateException("storage unavailable")).when(storage).remove(anyString());
        try {
            new ReportWorker(repository,service,generator,storage,scheduler).process(id);
            if(scenario.equals("unclaimed")){verifyNoInteractions(service,generator,storage,scheduler);return;}
            verify(heartbeat).cancel(false);verify(service).failAttempt(eq(id),any());
            if(scenario.equals("uncertain-commit"))verify(storage,never()).remove(anyString());
            else verify(storage).remove(anyString());
            if(path.get()!=null&&!scenario.equals("temporary-cleanup-failed"))assertThat(path.get()).doesNotExist();
        } finally {
            if(path.get()!=null&&Files.isDirectory(path.get())){Files.deleteIfExists(path.get().resolve("retained"));Files.deleteIfExists(path.get());}
        }
    }
    private ReportRecord record(UUID id,String fileKey){return new ReportRecord(id,"REPORT.xlsx",ReportStatus.PROCESSING,Instant.now(),null,null,new ReportRequest(null,null,null,null),fileKey,null,null,null,null,1);}
}
