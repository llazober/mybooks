FROM node:22-alpine

WORKDIR /app

# Accept build arguments from Easypanel
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG GIT_SHA

# Set them as environment variables so they are available during build
ENV DATABASE_URL=$DATABASE_URL
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV GIT_SHA=$GIT_SHA

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js server
CMD ["npm", "start"]
