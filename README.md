# Community Dex

**Pokédex, Hunt Tracker, capturas e detector de Shinies para Poké Idle World.** Extensão independente para navegadores Chromium (Chrome e Edge), construída com Manifest V3.

**Versão:** 1.2.0 · [Community Hub](https://stigalzera.com/)

## Instalação

1. Extraia o ZIP e abra a pasta `community-dex-extension`.
2. No navegador, acesse `chrome://extensions` ou `edge://extensions` e habilite **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha a pasta com `manifest.json`.
4. Abra `https://poke.idleworld.online/play`. Use o ícone flutuante ou **Alt + P** para exibir o painel.

### Atualização sem perder os dados

**Importante:** sobrescreva os arquivos **na mesma pasta** usada pela extensão anterior. Depois, em `chrome://extensions`, clique em **Recarregar** na extensão Community Dex e recarregue o jogo. Não remova a extensão para reinstalá-la: uma nova identificação pode resultar em armazenamento separado.

A v1.2.0 mantém a chave de armazenamento `community-dex:v1` e migra automaticamente os registros de Shiny repetidos reconhecidos.

## Recursos

- **Visão geral:** métricas de capturas bem-sucedidas, Shinies, Hunt, atividade e link para o Community Hub; botão de zerar estatísticas.
- **Pokédex:** leitura de tooltip, imagens, cálculo estimado de IVs, tipos, comparação, cópia de fichas, leitura manual e até 50 fichas no histórico.
- **Hunt:** abates, XP, composição, calculadora e loot da sessão, com seções expansíveis.
- **Capturas:** tentativas e sucessos em métricas separadas, histórico expansível e exportação CSV.
- **Shinies:** identificação pelo catálogo de espécies, controle de duplicações do mesmo encontro, alertas opcionais e histórico expansível (5/50).
- **Ajustes:** ordem das abas, blocos visíveis, opacidade, tamanho, avisos, botão flutuante e contador de Shinies.

### Smart Dex e Complete Dex

Escolha o modo em **Ajustes → Estilo da Community Dex**:

| Smart Dex | Complete Dex |
| --- | --- |
| Painel independente com ícone flutuante arrastável | Painel amplo com cabeçalho permanente enquanto aberto |
| Ícone e contador podem ser ocultados individualmente | Conteúdo pode ser recolhido/expandido pelo cabeçalho |
| Mantém a posição do painel e do ícone | Arraste o cabeçalho para mover; use o canto inferior direito para redimensionar |

As posições e dimensões são salvas separadamente para cada modo. Mesmo que o ícone flutuante esteja oculto, **Alt + P** continua abrindo o painel.

### Identificação de Shinies

O detector usa os identificadores de espécie e localização presentes nos eventos do jogo, evitando contabilizar duas vezes o mesmo encontro quando chegam mensagens numéricas e com o nome. Procura os nomes no catálogo fornecido pelo jogo e, como alternativa, na lista de espécies da [PokéAPI](https://pokeapi.co/). Para identificadores ainda não reconhecidos, exibe `Pokémon #ID` até conseguir resolver o nome.

A normalização dos registros existentes procura preservar encontros distintos. Registros em uma mesma posição com grande intervalo de tempo são mantidos separadamente.

## Estrutura do projeto

| Arquivo | Responsabilidade |
| --- | --- |
| `manifest.json` | Definição Manifest V3, permissões e pontos de entrada |
| `app.js` / `app.css` | Interface, preferências e histórico |
| `core.js` | Normalização dos eventos e cálculos |
| `main-bridge.js` | Leitura passiva de eventos já recebidos pelo jogo |
| `background.js` | Consulta e cache de dados públicos de espécies |
| `popup.html`, `popup.js`, `manual.html` | Interface auxiliar e instruções |
| `tests/` | Testes automatizados |

**Nenhuma dependência externa de build.** Para rodar os testes locais, use Node.js 22 ou superior:

```bash
node --test tests/*.test.js
```

## Privacidade e limitações

O Community Dex guarda preferências e históricos localmente no navegador. Consulta dados públicos da PokéAPI para análise e identificação das espécies. Não envia credenciais, inventário pessoal ou logs de jogo para o Community Hub; também não envia comandos automáticos de combate, compra ou negociação.

O funcionamento depende dos eventos que o jogo disponibiliza. As fórmulas de IV/XP são estimativas. Os testes automatizados cobrem os processamentos e a interface simulada, **não substituem testes com uma sessão autenticada nem autorização da equipe do jogo**. Respeite as regras do serviço.

## Licença

MIT — consulte [LICENSE](LICENSE).
