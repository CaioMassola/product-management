package com.productmanagement.product;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class ProductImageValidatorTest {
    @Test void acceptsJpegAndRejectsGifMimeMismatchesAndOversizedUploads() throws Exception {
        var validator=new ProductImageValidator();var image=new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB);
        var jpeg=new ByteArrayOutputStream();ImageIO.write(image,"jpeg",jpeg);
        var actual=validator.validate(new MockMultipartFile("file","sample.jpg","image/jpeg",jpeg.toByteArray()));
        assertThat(actual.extension()).isEqualTo("jpg");assertThat(actual.contentType()).isEqualTo("image/jpeg");
        var gif=new ByteArrayOutputStream();ImageIO.write(image,"gif",gif);
        assertThatThrownBy(()->validator.validate(new MockMultipartFile("file","sample.gif","image/gif",gif.toByteArray()))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->validator.validate(new MockMultipartFile("file","wrong.jpg","image/png",jpeg.toByteArray()))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->validator.validate(new MockMultipartFile("file","large.png","image/png",new byte[5*1024*1024+1]))).isInstanceOf(ResponseStatusException.class);
    }
    @Test void rejectsInvalidCodecDimensionsNullPixelsAndFailedOrOversizedEncoding() throws Exception {
        for(String scenario:List.of("zero-width","zero-height","too-many-pixels","null-image","write-failed","encoded-too-large","bad-codec-argument")){
            var file=mock(MultipartFile.class);when(file.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[]{1}));when(file.getContentType()).thenReturn("image/png");
            var stream=mock(ImageInputStream.class);var reader=mock(ImageReader.class);
            when(reader.getFormatName()).thenReturn("png");when(reader.getWidth(0)).thenReturn(scenario.equals("zero-width")?0:scenario.equals("too-many-pixels")?5001:1);
            when(reader.getHeight(0)).thenReturn(scenario.equals("zero-height")?0:scenario.equals("too-many-pixels")?5000:1);
            when(reader.read(0)).thenReturn(scenario.equals("null-image")?null:new BufferedImage(1,1,BufferedImage.TYPE_INT_RGB));
            if(scenario.equals("bad-codec-argument"))when(reader.read(0)).thenThrow(new IllegalArgumentException("bad codec"));
            try(var codec=mockStatic(ImageIO.class)){
                codec.when(()->ImageIO.createImageInputStream(any())).thenReturn(stream);
                codec.when(()->ImageIO.getImageReaders(stream)).thenReturn(List.of(reader).iterator());
                codec.when(()->ImageIO.write(any(java.awt.image.RenderedImage.class),eq("png"),any(OutputStream.class))).thenAnswer(call->{
                    if(scenario.equals("encoded-too-large"))((OutputStream)call.getArgument(2)).write(new byte[5*1024*1024+1]);return !scenario.equals("write-failed");
                });
                assertThatThrownBy(()->new ProductImageValidator().validate(file)).isInstanceOf(ResponseStatusException.class);
                verify(reader).dispose();verify(stream).close();
            }
        }
    }
}
