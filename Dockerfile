FROM node:22

RUN apt-get update && apt-get install -y \
  libglib2.0-0 \
  libnss3 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libx11-xcb1 \
  libxfixes3 \
  libxext6 \
  libxrender1 \
  libx11-6 \
  libxcb1 \
  libxau6 \
  libxdmcp6 \
  libgtk-3-0 \
  libpango-1.0-0 \
  libcairo2 \
  fonts-liberation \
  --no-install-recommends

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]