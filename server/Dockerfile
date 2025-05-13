FROM debian:stable-slim
RUN apt-get update && apt-get install -y gnugo

COPY .env /
COPY app /

ENTRYPOINT ["/app"]
