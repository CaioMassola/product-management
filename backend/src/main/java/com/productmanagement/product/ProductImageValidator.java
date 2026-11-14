package com.productmanagement.product;

import java.io.*;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ProductImageValidator {
    public record ValidatedImage(byte[] content, String contentType, String extension) {}
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final long MAX_PIXELS = 25_000_000L;

    public ValidatedImage validate(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) throw invalid();
        try (var source = file.getInputStream(); var stream = ImageIO.createImageInputStream(source)) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                if (!format.equals("png") && !format.equals("jpeg")) throw invalid();
                String contentType = format.equals("png") ? "image/png" : "image/jpeg";
                if (!contentType.equalsIgnoreCase(file.getContentType())) throw invalid();
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || (long) width * height > MAX_PIXELS) throw invalid();
                var image = reader.read(0);
                if (image == null) throw invalid();
                // Re-encode decoded pixels to discard metadata and appended payloads.
                var output = new ByteArrayOutputStream();
                if (!ImageIO.write(image, format, output) || output.size() > MAX_BYTES) throw invalid();
                return new ValidatedImage(output.toByteArray(), contentType, format.equals("png") ? "png" : "jpg");
            } finally { reader.dispose(); }
        } catch (ResponseStatusException exception) { throw exception; }
        catch (IOException | IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image content");
        }
    }

    private ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be a valid PNG or JPEG up to 5 MiB and 25 megapixels");
    }
}
