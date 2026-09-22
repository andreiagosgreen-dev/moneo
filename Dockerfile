# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Vite inlines VITE_* vars into the JS bundle at build time (not runtime),
# so they must arrive as build ARGs, not container environment/compose vars.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_LEMONSQUEEZY_STORE_ID
ARG VITE_LEMONSQUEEZY_CHECKOUT_URL
ARG VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID
ARG VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID
ARG VITE_SENTRY_DSN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_LEMONSQUEEZY_STORE_ID=$VITE_LEMONSQUEEZY_STORE_ID \
    VITE_LEMONSQUEEZY_CHECKOUT_URL=$VITE_LEMONSQUEEZY_CHECKOUT_URL \
    VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID=$VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID \
    VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID=$VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
