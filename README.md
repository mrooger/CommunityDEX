# Community Dex

**Sua ferramenta Pokémon para o Poké Idle World.**

Community Dex reúne Pokédex, análise de atributos, acompanhamento da Hunt, capturas e encontros Shiny em uma extensão independente para **Google Chrome e Microsoft Edge**, com interface personalizável e armazenamento local.

[**Community Hub**](https://stigalzera.com/) · [**Releases**](https://github.com/mrooger/CommunityDEX/releases) · [**Histórico de versões**](CHANGELOG.md)

## Instalação

1. Baixe o arquivo ZIP da versão desejada em [Releases](https://github.com/mrooger/CommunityDEX/releases).
2. Extraia o ZIP para uma pasta permanente.
3. No Chrome, abra `chrome://extensions` (no Edge, `edge://extensions`).
4. Ative o **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
5. Selecione a pasta que contém o arquivo `manifest.json`.
6. Entre em [Poké Idle World](https://poke.idleworld.online/play). Abra o Community Dex pelo ícone flutuante ou por **Alt + P**.

### Atualização

Mantenha a extensão instalada e **substitua os arquivos dentro da mesma pasta**. Depois clique em **Recarregar** na página de extensões e atualize a aba do jogo. Isso preserva o armazenamento associado à instalação existente.

Em **Ajustes → Atualizações**, é possível consultar os lançamentos publicados neste repositório. A instalação por pasta não permite substituição automática do código: a atualização precisa ser aplicada pelo usuário.

## Recursos

### Visão Geral

- Indicadores de capturas, Shinies, abates e ritmo da Hunt.
- **Histórico & Logs**, com seções recolhíveis para **LOG Diário (24 horas)** e **LOG Manual**.
- Arquivamento automático a cada 24 horas de sessão; até cinco logs diários dos últimos cinco dias.
- Até cinco logs manuais, gerados pelo botão **Salvar LOG**, sem interromper a sessão atual.
- Visualização dos relatórios em uma nova aba **Community LOG**, com exportação JSON.
- Histórico recente de até 45 atividades, incluindo capturas e encontros Shiny, recolhido inicialmente.

### Community LOG

Cada relatório mostra XP acumulada, XP/h e abates/h médios no período, abates totais, encontros Shiny, capturas normais e Shiny, além de histórico recente de encontros, capturas, loot e fontes de XP.

As médias são calculadas sobre o **tempo decorrido do período registrado**, não sobre a taxa instantânea da Hunt. Logs gerados a partir de dados migrados podem apresentar indicação de totais parciais.

### Pokédex

Leitura de fichas pelo mouse, estimativa de IVs, informações de tipos, fraquezas, resistências, imagens, comparação de exemplares, cópia de ficha, análise manual e histórico de até 50 Pokémon. Listas expandidas têm rolagem própria.

### Hunt

Contadores de abates e XP **independentes do tamanho do histórico**. Uma sessão de 24 horas pode ultrapassar 30 mil abates sem congelar a contagem. A memória conserva apenas os eventos recentes necessários ao cálculo de ritmo; os acumulados continuam corretos.

A composição da XP mostra os **bônus atuais em relação à XP base**, calculados a partir dos abates recentes. Alterações de VIP ou Stream aparecem sem depender da média acumulada da sessão; os percentuais exibidos refletem os eventos recebidos, sem presumir bônus não confirmados.

### Capturas

- Capturas totais, média por hora, taxa de sucesso e destaque da melhor captura com dados disponíveis.
- **Últimas capturas** com abas **Todos / Normais / Shiny** e visualização de até 200 sucessos recentes.
- Seletor de raridades compacto, com seleção múltipla, incluindo **Fraca, Comum, Incomum, Raro, Épico, Lendário, Mítica, Anciã, Divina** e **Não informada**. Os filtros afetam apenas a visualização, não os registros.
- Raridade, multiplicador e IV são lidos dos eventos, atualizações da lista de Pokémon e do **Log de Capturas do jogo**. Para sincronizar capturas cujo resultado não incluiu esses atributos, abra **Ver Log de Capturas** dentro do jogo. A extensão compara nomes, horários e a ordem dos registros, inclusive quando a mesma espécie foi capturada repetidamente, sem alterar o Log original. Registros que não podem ser identificados com segurança permanecem sem IV/raridade.
- Ícones dos Pokémon capturados, obtidos do jogo quando disponíveis, com sprite de referência como alternativa.
- Resumo de resultados por Poké Bola e exportação CSV.

### Stream Geral

Aba opcional, desativada inicialmente e ativada em **Ajustes → Organizar abas**. Reúne nove indicadores compactos da sessão e o histórico de capturas com filtros recolhidos por padrão. Pode ser reorganizada como qualquer outra aba.

### Shinies e personalização

Detector de encontros com redução de duplicidades, histórico, notificações configuráveis e opções de interface. Escolha entre **Smart Dex** e **Complete Dex**, reorganize abas e módulos, arraste/redimensione o painel e configure os avisos.

## Armazenamento e limites

| Informação | Política |
| --- | --- |
| Sessão automática | 24 horas desde o início da sessão |
| Abates acumulados | Sem teto artificial de contagem; dimensionado/testado para 30 mil ou mais |
| Eventos recentes para ritmo | Últimos 1.400 abates em memória |
| Capturas recentes | 200 capturas bem-sucedidas; totais continuam sendo somados |
| Shinies visíveis no histórico | Até 200 encontros; total independente |
| Atividades recentes | 45 eventos |
| LOGs diários | Até 5, retidos por no máximo 5 dias |
| LOGs manuais | Até 5, substituição dos mais antigos |

Listas extensas de capturas, Shinies, atividades, fichas e loot têm área de rolagem interna quando expandidas. Os relatórios são mantidos no armazenamento local do navegador. Para ter uma cópia externa, abra um **Community LOG** e utilize **Exportar JSON**. O navegador pode limpar dados locais se o perfil ou a extensão forem removidos.

## Estrutura

| Arquivo | Finalidade |
| --- | --- |
| `manifest.json` | Configuração da extensão Manifest V3 |
| `app.js`, `app.css` | Interface e integração dos módulos |
| `core.js` | Leitura e normalização dos eventos do jogo |
| `session.js` | Estatísticas acumuladas, bônus recentes, fechamento de 24 horas e LOGs |
| `capture-log.js` | Leitura e associação de metadados do Log de Capturas |
| `log.html`, `log.css`, `log.js` | Visualizador Community LOG |
| `main-bridge.js` | Leitura passiva de eventos recebidos na página |
| `background.js` | Consultas externas, recursos e abertura de relatórios |
| `tests/` | Testes automatizados |

Para executar os testes, com Node.js instalado:

```bash
node --test tests/*.test.js
```

## Projeto

- **Repositório:** https://github.com/mrooger/CommunityDEX
- **Site da comunidade:** https://stigalzera.com/
- **Licença:** [MIT](LICENSE)

Community Dex é uma ferramenta comunitária independente, sem afiliação oficial ao jogo ou à Pokémon Company. O uso deve respeitar as regras e permissões aplicáveis ao Poké Idle World.
