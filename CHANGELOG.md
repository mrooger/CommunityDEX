# Changelog

## v1.3.0 — Interface adaptativa e central de atualizações

### Melhorias
- Atualizado o subtítulo da marca para **SUA FERRAMENTA POKÉMON** no painel e no popup.
- Menu de abas adaptável à largura real do painel, com ícones, textos e espaçamentos menores nos modos Smart Dex, Compacto e Complete Dex.
- Abas distribuídas em uma única linha sem rolagem horizontal, inclusive com o painel redimensionado.
- Incluído o módulo **Ajustes → Atualizações**, com consulta ao último release oficial de [CommunityDEX](https://github.com/mrooger/CommunityDEX/releases).
- Verificação manual e automática de novas versões (na abertura do jogo e periodicamente enquanto ele estiver aberto).
- Aviso de nova versão, com acesso ao release e download do ZIP oficial, se disponível.
- Documentação de atualização manual para instalações descompactadas, sem executar código remoto.

### Nota sobre atualizações
Extensões carregadas pelo modo desenvolvedor não podem substituir automaticamente seus próprios arquivos a partir de um ZIP do GitHub. A verificação é automática; a instalação requer substituir os arquivos na pasta existente e recarregar o Chrome/Edge. A atualização automática de instalação é um recurso da distribuição pelas lojas oficiais.

## v1.2.1 — Correção de Shinies repetidos

- Detecta Shinies somente em pacotes do mapa, evitando mensagens de inventário, equipe, capturas e combate.
- Impede avisos repetidos para o mesmo encontro durante atualizações do mapa, mesmo que a descrição use outro nome, identificador ou posição.
- Reutiliza encontros recentes após recarregar a página; evita alertas repetidos no retorno ao jogo.
- Reagrupa registros históricos muito próximos do mesmo Shiny e mantém registros posteriores separados.
- Preserva configurações, histórico e compatibilidade com a instalação anterior.

## v1.2.0 — Community Dex

- Corrigido o registro duplicado de encontros Shiny em mensagens numéricas e nominais.
- Resolução de espécies pelo catálogo do jogo e pela lista pública da PokéAPI.
- Normalização de registros antigos, mantendo encontros distintos.
- Preferências independentes para o número de Shinies sobre o ícone e a exibição do botão Smart Dex.
- Adicionado o modo Complete Dex com cabeçalho recolhível, movimentação e redimensionamento persistentes.
- Link permanente do Community Hub na barra de status.
- Layout dos botões de ação da Pokédex ajustado para uma única linha.

## 1.1.0

- Botão flutuante arrastável, novos ícones e opções de copiar fichas.
- Histórico da Pokédex, Loot e Shinies com limites de exibição 5/50.

## 1.0.1

- Leitura de tooltips mais tolerante ao HTML do jogo.
- Botão para reiniciar as estatísticas da Visão Geral.
