FROM denoland/deno:2.0.0

EXPOSE 8080

WORKDIR /app

COPY . .
RUN deno install -e src/server.ts

CMD ["deno", "task", "start:prod"]
