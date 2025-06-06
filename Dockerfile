# Estágio de build
FROM node:18-alpine

# Instalar ferramentas necessárias
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar todas as dependências
RUN npm install

# Copiar arquivos de configuração
COPY tsconfig.json ./

# Copiar código fonte
COPY src ./src

# Verificar estrutura de arquivos
RUN ls -la && \
    echo "Conteúdo de /app:" && \
    ls -R

# Compilar TypeScript
RUN npm run build

# Verificar a compilação
RUN ls -la dist

# Remover devDependencies
RUN npm prune --production

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Expor a porta
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "dist/server.js"] 