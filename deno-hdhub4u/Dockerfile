FROM denoland/deno:2.3.3

WORKDIR /app

# Cache dependencies
COPY src/ ./src/

# Pre-compile for faster startup
RUN deno cache src/index.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "src/index.ts"]
