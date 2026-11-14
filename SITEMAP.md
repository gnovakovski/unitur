# Sitemap XML

O site entrega **`https://www.unitur.com.br/sitemap.xml`** como XML UTF-8 pela
função `api/sitemap.js`, ligada ao endereço pelo `vercel.json`. A indicação já
está em `public/robots.txt`. Não é uma página HTML de navegação.

O XML é gerado a partir dos dados publicados no Firestore e fica em cache na
Vercel por uma hora. Assim, alterações de roteiros e posts entram no sitemap
sem gerar manualmente um arquivo estático a cada publicação.

Inclui:

- Páginas institucionais, menus visíveis, posts publicados e roteiros ativos.
- URLs canônicas nacionais e internacionais e `lastmod` quando disponível.
- Extensão `image:image`: imagens dos banners ativos, página Sobre, capas,
  galerias dos roteiros, hotéis e imagens do conteúdo dos posts.
- Extensão `video:video`: players YouTube e Vimeo aceitos pelo site e presentes
  nos posts, com título e miniatura reais obtidos do oEmbed do provedor,
  descrição do post e endereço do player.

URLs repetidas são removidas, caracteres XML são escapados e esquemas como
`javascript:` e `data:` são excluídos. Vídeos privados/removidos ou sem metadados
acessíveis são omitidos. A consulta aos provedores tem concorrência e duração
limitadas; as páginas e imagens continuam presentes se o provedor falhar.
Rascunhos, roteiros inativos e páginas administrativas não entram no XML.

## Verificação

```sh
npm run test:sitemap
```

Depois do deploy, abra `/sitemap.xml` para conferir a resposta e envie o mesmo
endereço ao Google Search Console. A implementação segue as extensões oficiais
de [imagens](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
e [vídeos](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps).
