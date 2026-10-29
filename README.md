# Bragdoc

Diário pessoal de trabalho em Next.js. O navegador usa Supabase Auth e o Data API para registrar entradas, editar conquistas e relacionar evidências. A rota `POST /api/ai/analyze` do Next valida a sessão, lê apenas o período solicitado com o JWT do usuário, chama a OpenAI e salva sugestões pendentes no Supabase.

## Configuração do Supabase

1. Crie um projeto e execute o conteúdo atualizado de [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor. Se já executou uma versão anterior, execute o arquivo atualizado novamente para criar as tabelas de sugestões e a coluna `source`.
2. Em **Authentication**, crie seu usuário e desative novos cadastros públicos para manter o app privado.
3. Copie a URL do projeto e a chave publicável para `.env.local` a partir de `.env.example`.

A chave publicável pode estar no cliente. Nunca use `service_role` no navegador. As tabelas têm políticas RLS que restringem operações ao usuário autenticado; a rota de IA também usa o JWT do usuário e não ignora essas políticas.

## Chave da OpenAI

Defina `OPENAI_API_KEY` somente no ambiente do servidor (localmente em `.env.local`, na Vercel como variável de ambiente sem prefixo `NEXT_PUBLIC_`). `OPENAI_MODEL` é opcional e, por padrão, usa `gpt-6-luna`. A análise envia à OpenAI somente as entradas dentro do período que você seleciona e só começa quando você aciona **Analisar período**. Cada execução aceita no máximo 90 dias, 200 registros e 80 mil caracteres, com limite de cinco chamadas por minuto por usuário e instância.

## Desenvolvimento e deploy

- `npm install`: instala dependências.
- `npm run dev`: inicia Next.js em <http://127.0.0.1:3000>.
- `npm run typecheck`: verifica os tipos TypeScript.
- `npm run build`: gera a versão de produção.
- `npm start`: inicia a versão compilada localmente.

Conecte o repositório à Vercel. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `OPENAI_API_KEY`; opcionalmente defina `OPENAI_MODEL`. `vercel.json` mantém a detecção nativa de Next.js.
