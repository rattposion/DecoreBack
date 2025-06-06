# Estágio de build
FROM node:18-alpine as builder

WORKDIR /app

# Primeiro, copiar todo o código fonte
COPY . .

# Remover node_modules e dist se existirem
RUN rm -rf node_modules dist

# Instalar todas as dependências (incluindo devDependencies)
RUN npm install

# Build do TypeScript
RUN npm run build

# Estágio de produção
FROM node:18-alpine

WORKDIR /app

# Copiar apenas os arquivos necessários do estágio de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Expor a porta
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "dist/server.js"] 