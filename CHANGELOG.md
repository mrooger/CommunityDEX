# Histórico de versões

## v1.4.0 — Sessões, Community LOG e capturas

### Novo
- Sessões com fechamento automático a cada 24 horas e reinício dos contadores.
- **Histórico & Logs** na Visão Geral, recolhido por padrão.
- **LOG Diário**, com até cinco relatórios dos últimos cinco dias, e **LOG Manual**, com até cinco salvamentos independentes.
- **Community LOG** em nova aba, com XP da sessão, médias de XP/h e abates/h, totais, Shinies, capturas, loot e exportação JSON.
- Capturas organizadas em **Todos, Normais e Shiny**, com filtros por raridade e até 200 capturas bem-sucedidas recentes.

### Refinamentos da v1.4.0
- Indicadores de captura reorganizados: total, capturas/hora, taxa e melhor exemplar da sessão.
- Identificação de qualidade, IV e Poder com correlação entre eventos, lista de Pokémon e o Log de Capturas do jogo, quando disponíveis.
- Faixas de raridade ajustadas aos multiplicadores do jogo.
- Filtros de raridade com seleção múltipla compacta, sem excluir capturas do histórico.
- Listas extensas com rolagem independente ao expandir.
- Atividade recente prioriza capturas e encontros Shiny.

- Associação de capturas pelo horário com precisão de minuto, sem exigir segundos idênticos.
- Reconciliação ordenada das capturas repetidas da mesma espécie no Log do jogo.
- Recuperação de raridade e IV em registros consultados até 24 horas após a captura, quando identificáveis.

### Melhorado
- Contadores acumulados independentes do histórico limitado; suportam mais de 30 mil abates por sessão.
- Salvamento periódico da sessão, inclusive ao ocultar ou fechar a aba.
- Atividade recente recolhida por padrão, com até 45 entradas.
- Composição de XP passa a usar os abates mais recentes, refletindo alterações de bônus sem diluição pela média da sessão.
- Identificação de raridade e IV das capturas quando enviados pelo jogo.
- Organização do código e atualização da documentação do projeto.

### Observações
- Dados capturados antes desta versão podem ser migrados parcialmente, conforme os registros disponíveis na versão anterior.
- Os relatórios são locais. Uma cópia em arquivo pode ser obtida no Community LOG pelo botão **Exportar JSON**.

## v1.3.0 — Interface e atualizações

- Título secundário atualizado para **SUA FERRAMENTA POKÉMON**.
- Menu adaptado a larguras menores, incluindo o modo Complete Dex.
- Verificação manual e automática de novas versões publicadas no GitHub.
- Ajustes na disposição dos controles da Pokédex.

## v1.2.1 — Estabilidade do detector Shiny

- Proteção contra notificações repetidas para um mesmo encontro.
- Filtragem de eventos que não representam encontros no mapa.
- Melhor identificação de mensagens duplicadas e recuperação do histórico.

## v1.2.0 — Smart Dex e Complete Dex

- Introdução do modo **Complete Dex**, com painel móvel e redimensionável.
- Controles de visibilidade do botão flutuante e do contador de Shinies.
- Normalização de nomes e IDs de espécies no histórico Shiny.
- Ajustes na barra de status e nos controles da Pokédex.

## v1.1.0 — Interface e produtividade

- Ícone próprio, botão flutuante arrastável, leitura manual recolhida e histórico expansível.
- Opções para copiar fichas de Pokémon e modelos de leitura.

## v1.0.0 — Lançamento inicial

- Pokédex, Hunt, capturas, Shinies e painel de configurações.
