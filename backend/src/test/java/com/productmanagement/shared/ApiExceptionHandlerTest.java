package com.productmanagement.shared;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import static org.assertj.core.api.Assertions.*;

class ApiExceptionHandlerTest {
    @Test void returnsSafeFeedbackForDatabaseConflictsAndUnexpectedFailures() {
        var handler = new ApiExceptionHandler();
        var constraint = handler.handleIntegrity(new DataIntegrityViolationException("private SQL details"));
        assertThat(constraint.getStatus()).isEqualTo(409);
        assertThat(constraint.getProperties()).containsEntry("code", "DATA_CONFLICT");
        assertThat(constraint.getDetail()).doesNotContain("private SQL");
        assertThat(handler.handleConcurrentUpdate(new ObjectOptimisticLockingFailureException("Product", "id")).getStatus()).isEqualTo(409);
        var unexpected = handler.handleUnexpected(new RuntimeException("private connection string"));
        assertThat(unexpected.getStatus()).isEqualTo(500);
        assertThat(unexpected.getDetail()).doesNotContain("private connection");
    }
}
