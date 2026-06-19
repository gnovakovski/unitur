/**
 * Entry point da Serverless Function da Vercel para o SSR do Angular.
 *
 * O build do Angular (outputMode: "server") gera o servidor Express em
 * dist/angular-app/server/server.mjs, que exporta `reqHandler`
 * (createNodeRequestHandler). A Vercel não executa esse servidor sozinha:
 * sem este arquivo + os rewrites no vercel.json, a Vercel serve apenas os
 * estáticos de /browser e qualquer rota sem arquivo físico (ex.: /admin/)
 * cai em 404. Aqui a função delega cada request ao Express do Angular, que
 * resolve tanto as páginas SSR públicas quanto o shell client-side do /admin.
 */
export default async (req, res) => {
  const { reqHandler } = await import('../dist/angular-app/server/server.mjs');
  return reqHandler(req, res);
};
