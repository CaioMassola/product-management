package com.productmanagement.storage;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.ErrorResponse;
import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import okhttp3.Headers;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MinioStorageTest {
    @Test void sharesOneLazyClientWhenConcurrentInitializationRaces() throws Exception {
        for(Object storage:new Object[]{image(),report()}){
            var result=new java.util.concurrent.FutureTask<Object>(() -> ReflectionTestUtils.invokeMethod(storage,"client"));
            var thread=new Thread(result,"storage-initialization-test");Object initialized;
            synchronized(storage){
                thread.start();long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
                while(thread.getState()!=Thread.State.BLOCKED && System.nanoTime()<deadline)Thread.sleep(1);
                assertThat(thread.getState()).isEqualTo(Thread.State.BLOCKED);
                initialized=ReflectionTestUtils.invokeMethod(storage,"client");
            }
            assertThat(result.get(3,java.util.concurrent.TimeUnit.SECONDS)).isSameAs(initialized);thread.join(3000);
        }
    }
    @org.junit.jupiter.api.io.TempDir Path temporary;
    @org.junit.jupiter.api.BeforeEach void createFile() throws Exception { java.nio.file.Files.write(temporary.resolve("report.xlsx"), new byte[]{1,2,3}); }
    @Test void initializesClientsLazilyAndRejectsMissingCredentials() {
        for (Object storage : new Object[]{image(), report()}) {
            var first = ReflectionTestUtils.invokeMethod(storage, "client");
            assertThat(first).isInstanceOf(MinioClient.class);
            assertThat((Object)ReflectionTestUtils.invokeMethod(storage, "client")).isSameAs(first);
        }
        for (String[] keys : new String[][]{{"", "secret"}, {"access", ""}}) {
            var image = new MinioImageStorage("http://localhost:9000", keys[0], keys[1], "images");
            assertThatThrownBy(() -> image.put("key", new byte[]{1}, "image/png")).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> image.get("key")).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> image.remove("key")).isInstanceOf(ResponseStatusException.class);
            var report = new MinioReportStorage("http://localhost:9000", keys[0], keys[1], "reports");
            assertThatThrownBy(() -> report.upload("key", Path.of("report.xlsx"))).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> report.open("key")).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> report.remove("key")).isInstanceOf(ResponseStatusException.class);
        }
    }
    @Test void storesReadsAndRemovesImagesAndBoundsDownloads() throws Exception {
        var storage = image(); var client = inject(storage);
        when(client.bucketExists(any())).thenReturn(true, false);
        storage.put("key.png", new byte[]{1,2}, "image/png");
        storage.put("key.png", new byte[]{3}, "image/png");
        verify(client).makeBucket(any());
        verify(client, times(2)).putObject(any());
        when(client.getObject(any())).thenReturn(stream(new byte[]{1,2}), stream(new byte[5*1024*1024+1]));
        assertThat(storage.get("key.png")).containsExactly(1,2);
        assertThatThrownBy(()->storage.get("large.png")).isInstanceOf(ResponseStatusException.class);
        storage.remove("key.png"); verify(client).removeObject(any());
    }
    @Test void toleratesConcurrentBucketCreationButPropagatesOtherStorageFailures() throws Exception {
        for(String code : new String[]{"BucketAlreadyOwnedByYou","AccessDenied"}) {
            var image = image(); var imageClient = inject(image);
            when(imageClient.bucketExists(any())).thenReturn(false);
            doThrow(bucketError(code)).when(imageClient).makeBucket(any());
            var report = report(); var reportClient = inject(report);
            when(reportClient.bucketExists(any())).thenReturn(false);
            doThrow(bucketError(code)).when(reportClient).makeBucket(any());
            if(code.equals("BucketAlreadyOwnedByYou")) {
                image.put("key",new byte[]{1},"image/png");
                report.upload("key",temporary.resolve("report.xlsx"));
                verify(imageClient).putObject(any()); verify(reportClient).uploadObject(any());
            } else {
                assertThatThrownBy(()->image.put("key",new byte[]{1},"image/png")).isInstanceOf(ResponseStatusException.class);
                assertThatThrownBy(()->report.upload("key",Path.of("report.xlsx"))).isInstanceOf(ResponseStatusException.class);
            }
        }
        var image=image(); var client=inject(image);
        when(client.bucketExists(any())).thenThrow(new IllegalStateException("network"));
        when(client.getObject(any())).thenThrow(new IllegalStateException("network"));
        doThrow(new IllegalStateException("network")).when(client).removeObject(any());
        assertThatThrownBy(()->image.put("key",new byte[]{1},"image/png")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->image.get("key")).isInstanceOf(ResponseStatusException.class);
        doReturn(null).when(client).getObject(any());
        assertThatThrownBy(()->image.get("key")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->image.remove("key")).isInstanceOf(ResponseStatusException.class);
    }
    @Test void streamsReportsWithTheirStoredLengthAndTranslatesStorageFailures() throws Exception {
        var storage=report(); var client=inject(storage);
        when(client.bucketExists(any())).thenReturn(true, false);
        storage.upload("key",temporary.resolve("report.xlsx")); storage.upload("key",temporary.resolve("report.xlsx"));
        var stat=mock(StatObjectResponse.class); when(stat.size()).thenReturn(3L);
        when(client.statObject(any())).thenReturn(stat);
        when(client.getObject(any())).thenReturn(stream(new byte[]{1,2,3}));
        var download=storage.open("key");
        assertThat(download.size()).isEqualTo(3); assertThat(download.stream().readAllBytes()).containsExactly(1,2,3); download.stream().close();
        storage.remove("key"); verify(client).removeObject(any());
        when(client.statObject(any())).thenThrow(new IllegalStateException("offline"));
        doThrow(new IllegalStateException("offline")).when(client).removeObject(any());
        assertThatThrownBy(()->storage.open("key")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->storage.remove("key")).isInstanceOf(ResponseStatusException.class);
    }
    private MinioImageStorage image() { return new MinioImageStorage("http://localhost:9000","access","secretkey","images"); }
    private MinioReportStorage report() { return new MinioReportStorage("http://localhost:9000","access","secretkey","reports"); }
    private MinioClient inject(Object storage) { var client=mock(MinioClient.class); ReflectionTestUtils.setField(storage,"client",client); return client; }
    private GetObjectResponse stream(byte[] bytes) { return new GetObjectResponse(new Headers.Builder().build(),"bucket","region","key",new ByteArrayInputStream(bytes)); }
    private ErrorResponseException bucketError(String code) { return new ErrorResponseException(new ErrorResponse(code,"message","bucket","key","resource","id","host"),null,"test"); }
}
