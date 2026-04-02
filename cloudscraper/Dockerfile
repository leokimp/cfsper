FROM denoland/deno:latest

WORKDIR /app

COPY cloudscraper.js .

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "cloudscraper.js"]
