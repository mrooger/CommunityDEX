# Community Dex · v1.1.0

Extensão independente para Chrome e Edge que organiza a Pokédex, a Hunt, as capturas e o histórico de Shinies do Poke Idle World em um único painel.

## Instalação

1. Extraia o ZIP e localize a pasta `community-dex-extension`.
2. Em `chrome://extensions` ou `edge://extensions`, ative **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha essa pasta.
4. Abra `https://poke.idleworld.online/play`. Clique no ícone vermelho no alto à direita ou use **Alt + P**.

**Atualização sem perder os registros:** copie os novos arquivos sobre os da mesma pasta previamente carregada e clique em **Recarregar** na página de extensões. Não remova a extensão para reinstalá-la, porque uma nova ID pode resultar em outro armazenamento local. A extensão preserva os dados anteriores no mesmo perfil/ID.

## Recursos

- **Visão Geral:** indicadores, acesso ao Community Hub, 5 atividades recentes expansíveis e botão para reiniciar a sessão.
- **Pokédex:** leitura ao passar o mouse, imagens quando disponíveis, IV estimado, potencial, tipos, fraquezas, atributos, comparação e botão **Copiar ficha**. Histórico de 5 fichas expansível até 50. **Leitura manual** recolhida inicialmente, com modelo copiável e editável.
- **Hunt:** XP e abates por sessão, composição da XP e calculadora recolhíveis. Loot ordenado por quantidade, mostrando 5 itens e até 50 ao expandir.
- **Capturas:** tentativas, sucessos, taxas e histórico de 5 até 50 eventos; exportação CSV.
- **Shinies:** contador, aviso visual, áudio opcional e histórico de 5 até 50 encontros visíveis.
- **Ajustes:** escolha e reordene abas, controle a visibilidade dos blocos, opacidade e preferências de leitura.

O ícone de acesso pode ser arrastado e mantém a posição entre sessões. A posição do painel é independente. Os registros e as preferências ficam no armazenamento local do navegador.

## Desenvolvimento

Sem dependências de build ou bibliotecas em tempo de execução. A interface é construída com JavaScript e CSS próprios. Os módulos `core.js` e `main-bridge.js` concentram as rotinas de cálculo e eventos.

```sh
node --test tests/*.test.js
```

A extensão não envia comandos automáticos de combate, negociação ou compra. Os resultados dependem dos eventos e das informações disponibilizados pelo jogo. Cálculos de IV e XP são estimativas, não valores garantidos pelo servidor. É necessário validar a compatibilidade em uma sessão real antes da distribuição pública e respeitar as regras de uso do jogo.

## Licença

MIT. Consulte [LICENSE](LICENSE).

Site da comunidade: https://stigalzera.com/
