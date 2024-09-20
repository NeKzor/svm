FROM denoland/deno:2.0.0-rc.4

EXPOSE 8080

WORKDIR /app

USER deno

COPY . .
RUN deno cache src/server.ts

CMD ["deno", "task", "start:prod"]
