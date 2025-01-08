FROM alpine AS certs
RUN apk add --no-cache ca-certificates

FROM scratch
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

COPY .env /
COPY app /

ENTRYPOINT ["/app"]
