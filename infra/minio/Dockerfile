FROM golang:1.26-alpine AS build
ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ENV CGO_ENABLED=0
RUN go install -trimpath -ldflags="-s -w" github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.23
RUN apk add --no-cache ca-certificates curl && addgroup -S minio && adduser -S minio -G minio && mkdir /data && chown minio:minio /data
COPY --from=build /go/bin/minio /usr/local/bin/minio
USER minio
EXPOSE 9000 9001
HEALTHCHECK --interval=10s --timeout=5s --retries=20 CMD curl --fail --silent http://localhost:9000/minio/health/ready || exit 1
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
