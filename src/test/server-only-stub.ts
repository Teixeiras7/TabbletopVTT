// Stub para o pacote "server-only" em testes: fora do bundler do Next.js,
// o import real lança um erro (assume que só roda em contexto de servidor
// do Next). Em testes, esse contexto não existe, então o import vira noop.
export {};
