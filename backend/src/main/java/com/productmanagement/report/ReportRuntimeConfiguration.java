package com.productmanagement.report;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableScheduling
public class ReportRuntimeConfiguration {
    @Bean(destroyMethod = "shutdown")
    ScheduledExecutorService reportHeartbeatExecutor() {
        return Executors.newScheduledThreadPool(2, runnable -> {
            var thread = new Thread(runnable, "report-heartbeat"); thread.setDaemon(true); return thread;
        });
    }
    @Bean
    ThreadPoolTaskScheduler taskScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(3); scheduler.setThreadNamePrefix("report-scheduler-");
        return scheduler;
    }
}
