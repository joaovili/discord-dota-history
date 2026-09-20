# DDH (Discord Dota History)

Bot do Discord que monitora contas de Dota 2 de um servidor de amigos e posta o
histórico de partidas em um canal de texto. A cada intervalo configurado ele busca
partidas novas via [OpenDota](https://www.opendota.com/) e envia **1 embed por partida**
com todos os 10 participantes divididos por time.

## Recursos

- `/setup` escolhe o canal de histórico.
- `/jogador adicionar` monitora um amigo por URL do perfil Steam, SteamID64 ou ID de conta.
- Monitoramento automático em intervalo configurável (`/config intervalo`), com `/config ativar|desativar`.
- `/partidas` força uma busca imediata.
- Embed por partida com os dois times, KDA, GPM/XPM, membros do servidor destacados (`⭐`)
  e menções reais na descrição.
- Deduplicação: uma partida só é postada uma vez, mesmo que vários amigos tenham jogado juntos.
- Sem API key obrigatória (OpenDota free tier); key opcional aumenta os limites.

## Requisitos

- Node.js 20+
- Um bot no [Discord Developer Portal](https://discord.com/developers/applications)
- Chave de API do OpenDota (opcional) — https://www.opendota.com/api-keys

## 1. Criar o bot no Discord

1. Acesse o Developer Portal, crie uma **Application**.
2. Em **Bot**, copie o **Token** (`DISCORD_TOKEN`).
3. Em **General Information**, copie o **Application ID** (`DISCORD_CLIENT_ID`).
4. Em **Installation / OAuth2**, adicione os escopos `bot` e `applications.commands`,
   e as permissões **Send Messages**, **Embed Links** e **View Channel**.
5. Convide o bot para o servidor com o link gerado.

## 2. Configuração

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | sim | Token do bot |
| `DISCORD_CLIENT_ID` | sim | Application ID |
| `DISCORD_GUILD_ID` | não | Se definido, registra os comandos só nesse servidor (instantâneo) |
| `OPENDOTA_API_KEY` | não | Aumenta os limites da OpenDota |
| `DB_PATH` | não | Caminho do SQLite (padrão `./data/bot.sqlite`) |
| `DEFAULT_INTERVAL_MINUTES` | não | Intervalo inicial ao rodar `/setup` (padrão 30) |

## 3. Rodar em desenvolvimento

```bash
npm install
npm run dev
```

Os comandos são registrados automaticamente quando o bot conecta (globalmente, ou no
servidor se `DISCORD_GUILD_ID` estiver definido). Para registrar manualmente:

```bash
npm run register
```

## 4. Usar no Discord

1. `/setup canal:#dota-historico`
2. `/jogador adicionar perfil:https://steamcommunity.com/id/algum_amigo usuario:@Amigo`
3. `/config intervalo minutos:30`
4. `/config ativar`

## Como funciona

1. A cada ciclo, para cada amigo monitorado, busca as partidas recentes em
   `GET /players/{account_id}/matches`.
2. Descarta partidas anteriores ao último ciclo (ou à data em que o amigo foi adicionado).
3. Deduplica por `match_id` (amigos que jogaram juntos geram um único embed).
4. Enriquece com `GET /matches/{match_id}` para obter os 10 participantes.
5. Monta o embed e envia no canal configurado.

Todas as requisições passam por um limitador (1 req/s) e têm retry com backoff em `429`/`5xx`.

## Deploy na VPS

### Docker

```bash
docker build -t ddh .
docker run -d --name ddh \
  --env-file .env \
  -v "$PWD/data:/app/data" \
  --restart unless-stopped \
  ddh
```

### systemd

```bash
sudo useradd --system --home /opt/ddh ddh-bot
sudo mkdir -p /opt/ddh
sudo chown -R ddh-bot:ddh-bot /opt/ddh
# copie o projeto, rode npm ci && npm run build, e o .env
sudo cp deploy/ddh.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ddh
```

## Desenvolvimento

```bash
npm test         # Vitest
npm run lint     # Biome
npm run typecheck
npm run build
```

### Estrutura

```
src/
├── index.ts              # entrypoint, handlers de evento
├── config.ts             # validação de env (zod)
├── scheduler.ts          # tick de 1 min, dispara guilds vencidas
├── db/                   # SQLite + repositórios
├── services/             # OpenDota, heróis, SteamID
├── commands/             # slash commands
├── jobs/pollMatches.ts   # coleta, dedup, envio
└── embeds/matchEmbed.ts  # montagem do embed
```

## Observações

- Se o histórico de partidas do jogador estiver privado na Steam, a OpenDota não terá os
  dados e o comando avisará ao adicionar.
- Estatísticas avançadas (itens, dano) dependem de a partida estar parseada; o embed
  marca `parseada ✅` / `não parseada ⚠️`. KDA e GPM/XPM aparecem mesmo sem parse.
- Limites do OpenDota free tier: 60 req/min e 2.000/dia.
