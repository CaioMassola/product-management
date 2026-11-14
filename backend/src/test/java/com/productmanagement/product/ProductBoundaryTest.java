package com.productmanagement.product;

import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.*;
import com.productmanagement.storage.ImageStorage;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ProductBoundaryTest {
    @Test void rejectsAllInvalidPaginationInputsBeforeCallingTheService() {
        var service=mock(ProductService.class);var controller=new ProductController(service);
        for(int[] values:new int[][]{{-1,25},{0,0},{0,101}}){
            assertThatThrownBy(()->controller.list(null,null,"ACTIVE",null,null,values[0],values[1],"createdAt",org.springframework.data.domain.Sort.Direction.DESC)).isInstanceOf(ResponseStatusException.class);
        }
        assertThatThrownBy(()->controller.list(null,null,"ACTIVE",null,null,0,25,"invalid",org.springframework.data.domain.Sort.Direction.DESC)).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(service);
    }
    @Test void treatsWhitespaceSearchAsAnAbsentCriterion() {
        var builder=mock(jakarta.persistence.criteria.CriteriaBuilder.class);
        @SuppressWarnings("unchecked")
        jakarta.persistence.criteria.Root<Product> root=mock(jakarta.persistence.criteria.Root.class);
        var predicate=mock(jakarta.persistence.criteria.Predicate.class);when(builder.and(any(jakarta.persistence.criteria.Predicate[].class))).thenReturn(predicate);
        assertThat(new ProductFilter("  ",null,null,null,null).specification().toPredicate(root,null,builder)).isSameAs(predicate);
        verifyNoInteractions(root);
    }
    @Test void rejectsOversizedSearchAndBothPriceBoundaries() {
        for (String amount : new String[]{"-1","0.001","1000000000000"}) {
            assertThatThrownBy(()->new ProductFilter(null,null,null,new BigDecimal(amount),null).validate()).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(()->new ProductFilter(null,null,null,null,new BigDecimal(amount)).validate()).isInstanceOf(ResponseStatusException.class);
        }
        assertThatThrownBy(()->new ProductFilter("x".repeat(201),null,null,null,null).validate()).isInstanceOf(ResponseStatusException.class);
        new ProductFilter("",null,null,BigDecimal.ZERO,BigDecimal.TEN).validate();
    }
    @Test void rejectsReservedCodesForCreateAndUpdate() {
        var repository=mock(ProductRepository.class);var service=new ProductService(repository);
        var request=new ProductRequest("CODE","Title",null,BigDecimal.ONE,1,ProductType.GAMES);
        var id=UUID.randomUUID();when(repository.existsByCodeIgnoreCase("CODE")).thenReturn(true);
        when(repository.findById(id)).thenReturn(Optional.of(new Product(request)));
        when(repository.existsByCodeIgnoreCaseAndIdNot("CODE",id)).thenReturn(true);
        assertThatThrownBy(()->service.create(request)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->service.update(id,request)).isInstanceOf(ResponseStatusException.class);
        verify(repository,never()).saveAndFlush(any());
    }
    @Test void exposesImageResponseHeadersAndDelegatesUploadAndRemoval() {
        var service=mock(ProductImageService.class);var controller=new ProductImageController(service);var id=UUID.randomUUID();
        when(service.get(id)).thenReturn(new ProductImageService.ImageContent(new byte[]{1,2},"image/jpeg"));
        var response=controller.get(id);
        assertThat(response.getHeaders().getFirst("Cache-Control")).isEqualTo("no-store");
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getBody()).containsExactly(1,2);
        var file=new MockMultipartFile("file",new byte[]{1});controller.upload(id,file);controller.remove(id);
        verify(service).upload(id,file);verify(service).remove(id);
    }
    @Test void retainsRemovalResultWhenOrphanCleanupFails() {
        var repository=mock(ProductRepository.class);var storage=mock(ImageStorage.class);
        var product=new Product(new ProductRequest("CODE","Title",null,BigDecimal.ONE,1,ProductType.GAMES));
        product.changeImage("old.jpg");var id=UUID.randomUUID();when(repository.findById(id)).thenReturn(Optional.of(product));
        when(repository.saveAndFlush(product)).thenReturn(product);doThrow(new IllegalStateException("offline")).when(storage).remove("old.jpg");
        var service=new ProductImageService(repository,storage,new ProductImageValidator());
        assertThatThrownBy(()->service.get(UUID.randomUUID())).isInstanceOf(ResponseStatusException.class);
        assertThat(service.get(id).contentType()).isEqualTo("image/jpeg");
        TransactionSynchronizationManager.initSynchronization();
        try{assertThat(service.remove(id).imageKey()).isNull();TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);}
        finally{TransactionSynchronizationManager.clearSynchronization();}
        verify(storage).remove("old.jpg");
    }
    @Test void rejectsUnreadableImageStreams() throws Exception {
        var file=mock(org.springframework.web.multipart.MultipartFile.class);when(file.getInputStream()).thenThrow(new java.io.IOException("broken stream"));
        assertThatThrownBy(()->new ProductImageValidator().validate(file)).isInstanceOf(ResponseStatusException.class);
    }
}
