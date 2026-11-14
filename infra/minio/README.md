# MinIO development image

The image builds the pinned upstream `RELEASE.2025-10-15T17-29-55Z` source with Go rather than depending on the discontinued public container reference. The first build downloads Go modules and compiles MinIO; Docker caches subsequent builds.

The runtime uses a private data volume, a non-root account and a readiness check. Credentials come from the ignored root `.env` file. Ports bind only to loopback in Compose. The image does not bundle the `mc` administration client; application SDKs create the private image/report buckets lazily.

`go install` builds can identify themselves as `DEVELOPMENT.GOGET` in `minio --version`; the source release is pinned by the Dockerfile build argument rather than that display string.

Source and release instructions: [upstream release](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z). Upstream license: [GNU AGPLv3](https://github.com/minio/minio/blob/RELEASE.2025-10-15T17-29-55Z/LICENSE).
